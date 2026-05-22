// engines/MelodyEngine/noteBuilder.js
// Фаза 1б: генерация сырых нот (питч + позиция, без ритмического наложения)

import { SCALES } from "./constants.js";
import {
  freqToMidi,
  midiToFreq,
  yNormToFreq,
  quantizeToScale,
  nextScaleStep,
} from "./musicTheory.js";
import { detectInflections } from "./preprocessor.js";

export function buildRawNotes(processedSegs, tonicMidi, T, scale, notesPerBeat) {
  const rawNotes = [];

  for (const seg of processedSegs) {
    const { points, instrument, role, volume } = seg;
    if (points.length < 2) continue;

    // Для мелодии вычисляем средний MIDI чтобы ограничить диапазон
    let avgMidi = null;
    if (role === 'melody') {
      let sumMidi = 0;
      for (const pt of points) sumMidi += freqToMidi(yNormToFreq(pt.y));
      avgMidi = sumMidi / points.length;
    }

    const inflections     = detectInflections(seg, T);
    const inflectionTakts = new Set(inflections.map(inf => inf.takt));
    const inflectionMap   = new Map(inflections.map(inf => [inf.takt, inf]));

    // Карта: такт → медианный Y (для интерполяции пустых тактов)
    const taktYMap = new Array(T).fill(null);
    for (let k = 0; k < T; k++) {
      const taktXMin = k / T;
      const taktXMax = (k + 1) / T;
      const taktPts  = points.filter(pt => pt.x >= taktXMin && pt.x < taktXMax);
      if (taktPts.length > 0) {
        const sorted = [...taktPts].sort((a, b) => a.y - b.y);
        taktYMap[k]  = sorted[Math.floor(sorted.length / 2)].y;
      }
    }

    // Линейная интерполяция пустых тактов внутри сегмента
    const segMinTakt = Math.floor(points[0].x * T);
    const segMaxTakt = Math.min(T - 1, Math.floor(points[points.length - 1].x * T));
    for (let k = segMinTakt; k <= segMaxTakt; k++) {
      if (taktYMap[k] !== null) continue;
      let leftK = k - 1, rightK = k + 1;
      while (leftK  >= segMinTakt && taktYMap[leftK]  === null) leftK--;
      while (rightK <= segMaxTakt && taktYMap[rightK] === null) rightK++;
      const leftY  = leftK  >= segMinTakt ? taktYMap[leftK]  : null;
      const rightY = rightK <= segMaxTakt ? taktYMap[rightK] : null;
      if (leftY !== null && rightY !== null) {
        const t = (k - leftK) / (rightK - leftK);
        taktYMap[k] = leftY + (rightY - leftY) * t;
      } else if (leftY  !== null) { taktYMap[k] = leftY;  }
        else if (rightY !== null) { taktYMap[k] = rightY; }
    }

    let prevMidi = null;

    for (let k = 0; k < T; k++) {
      const taktXMin = k / T;
      const taktXMax = (k + 1) / T;
      let taktPts    = points.filter(pt => pt.x >= taktXMin && pt.x < taktXMax);

      if (taktPts.length === 0) {
        if (taktYMap[k] === null) continue;
        taktPts = [{ x: (taktXMin + taktXMax) / 2, y: taktYMap[k], interpolated: true }];
      }

      const isInflectionTakt = inflectionTakts.has(k);
      const N = isInflectionTakt ? Math.min(4, notesPerBeat + 1) : notesPerBeat;

      if (role === 'chord' || role === 'bass') {
        const accompNotes = buildAccompanimentNote(seg, k, taktPts, inflections, tonicMidi, scale, T);
        rawNotes.push(...accompNotes);
        continue;
      }

      // Мелодия
      const samples = samplePoints(taktPts, N);
      for (let i = 0; i < samples.length; i++) {
        const yNorm   = samples[i].y;
        const rawFreq = yNormToFreq(yNorm);
        let { freq, midi } = quantizeToScale(rawFreq, tonicMidi, scale, prevMidi);

        // Ограничиваем диапазон ±12 полутонов от среднего
        if (avgMidi !== null) {
          if (midi > avgMidi + 12) { midi = Math.round(avgMidi + 12); freq = midiToFreq(midi); }
          if (midi < avgMidi - 12) { midi = Math.round(avgMidi - 12); freq = midiToFreq(midi); }
        }

        rawNotes.push({
          takt: k,
          posInTakt: i / N,
          freq,
          midi,
          instrument,
          role,
          volume,
          isInflection:   isInflectionTakt && i === Math.floor(N / 2),
          inflectionType: inflectionMap.get(k)?.type ?? null,
          interpolated:   !!(samples[i].interpolated),
        });
        prevMidi = midi;
      }

      // Добираем ноты шагами по гамме если точек в такте меньше N
      if (samples.length < N && prevMidi !== null) {
        const intervals  = SCALES[scale] || SCALES.major;
        const tonicClass = ((tonicMidi % 12) + 12) % 12;
        const nextY      = taktYMap[k + 1];
        const direction  = (nextY !== null && nextY < taktYMap[k]) ? +1 : -1;
        for (let i = samples.length; i < N; i++) {
          const stepMidi = nextScaleStep(prevMidi, tonicClass, intervals, direction);
          const stepFreq = midiToFreq(stepMidi);
          rawNotes.push({
            takt: k,
            posInTakt: i / N,
            freq:  stepFreq,
            midi:  stepMidi,
            instrument,
            role,
            volume: volume * 0.85,
            isInflection:   false,
            inflectionType: null,
            interpolated:   true,
          });
          prevMidi = stepMidi;
        }
      }
    }
  }
  return rawNotes;
}

export function buildAccompanimentNote(seg, k, taktPts, inflections, tonicMidi, scale, T) {
  const { instrument, role, volume } = seg;

  if (role === 'bass') {
    const PROGRESSION = [0, 5, 7, 0]; // I–IV–V–I
    const sectionLen  = Math.max(1, Math.floor(T / PROGRESSION.length));
    const progIdx     = Math.min(PROGRESSION.length - 1, Math.floor(k / sectionLen));
    const progOffset  = PROGRESSION[progIdx];
    const baseMidi    = tonicMidi + progOffset - 12; // октавой ниже тоники

    return [{
      takt: k,
      posInTakt:      0,
      freq:           midiToFreq(baseMidi),
      midi:           baseMidi,
      instrument,
      role,
      volume:         volume * 0.85,
      isInflection:   false,
      inflectionType: null,
      accompStyle:    'bassWalk',
    }];
  }

  // Аккорды — стиль зависит от количества переломов
  const totalInflections = inflections.length;
  const notes = [];

  if (totalInflections === 0) {
    // Плоский аккорд на квинте
    const targetMidi = tonicMidi + 7;
    notes.push({
      takt: k, posInTakt: 0, freq: midiToFreq(targetMidi), midi: targetMidi,
      instrument, role, volume: volume * 0.75,
      isInflection: false, inflectionType: null, accompStyle: 'flat',
    });
  } else if (totalInflections <= 2) {
    // Арпеджио
    const intervals      = SCALES[scale] || SCALES.major;
    const arpeggioSteps  = [0, intervals[2], intervals[4], 12];
    const goingUp        = (taktPts[taktPts.length - 1].y < taktPts[0].y);
    const steps          = goingUp ? arpeggioSteps : [...arpeggioSteps].reverse();
    steps.forEach((step, i) => {
      const midi = tonicMidi + step;
      notes.push({
        takt: k, posInTakt: i / steps.length, freq: midiToFreq(midi), midi,
        instrument, role, volume: volume * (i === 0 ? 0.85 : 0.6),
        isInflection: false, inflectionType: null, accompStyle: 'arpeggio',
      });
    });
  } else {
    // Пульсирующий аккорд (трезвучие)
    const intervals   = SCALES[scale] || SCALES.major;
    const chordMidis  = [tonicMidi, tonicMidi + intervals[2], tonicMidi + intervals[4]];
    chordMidis.forEach(midi => {
      notes.push({
        takt: k, posInTakt: 0, freq: midiToFreq(midi), midi,
        instrument, role, volume: volume * 0.65,
        isInflection: false, inflectionType: null, accompStyle: 'pulse',
      });
    });
  }
  return notes;
}

export function getSegmentDirection(segment) {
  const pts = segment.points;
  if (pts.length < 2) return 0;
  const dy = pts[pts.length - 1].y - pts[0].y;
  if (Math.abs(dy) < 0.05) return 0;
  return dy < 0 ? 1 : -1;
}

export function selectNotesPerBeat(bpm) {
  let options;
  if      (bpm >= 120) options = [{ n: 1, p: 0.5 }, { n: 2, p: 0.5 }];
  else if (bpm >= 70)  options = [{ n: 1, p: 0.35 }, { n: 2, p: 0.45 }, { n: 3, p: 0.2 }];
  else                 options = [{ n: 1, p: 0.25 }, { n: 2, p: 0.35 }, { n: 3, p: 0.25 }, { n: 4, p: 0.15 }];
  let cum = 0;
  const r = Math.random();
  for (const o of options) { cum += o.p; if (r <= cum) return o.n; }
  return 2;
}

// ─── приватный хелпер ─────────────────────────────────────────────────────────

function samplePoints(taktPts, N) {
  if (taktPts.length <= N) return taktPts;
  const result    = [];
  const chunkSize = taktPts.length / N;
  for (let i = 0; i < N; i++) {
    const from   = Math.floor(i * chunkSize);
    const to     = Math.floor((i + 1) * chunkSize);
    const chunk  = taktPts.slice(from, to);
    const sorted = [...chunk].sort((a, b) => a.y - b.y);
    result.push(sorted[Math.floor(sorted.length / 2)]);
  }
  return result;
}
