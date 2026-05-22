// engines/MelodyEngine/noteBuilder.js
// Фаза 1б: генерация сырых нот (питч + позиция, без ритмического наложения)

import { SCALES, ROLE_VOLUME_MULT, CHORD_PROGRESSION_SEMITONES } from "./constants.js";
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

    // Базовая громкость с учётом роли
    const roleVolMult = ROLE_VOLUME_MULT[role] ?? 1.0;
    const roleVolume  = volume * roleVolMult;

    let avgMidi = null;
    if (role === 'melody') {
      let sumMidi = 0;
      for (const pt of points) sumMidi += freqToMidi(yNormToFreq(pt.y));
      avgMidi = sumMidi / points.length;
    }

    const inflections     = detectInflections(seg, T);
    const inflectionTakts = new Set(inflections.map(inf => inf.takt));
    const inflectionMap   = new Map(inflections.map(inf => [inf.takt, inf]));

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
        const accompNotes = buildAccompanimentNote(seg, k, taktPts, inflections, tonicMidi, scale, T, avgMidi, roleVolume);
        rawNotes.push(...accompNotes);
        continue;
      }

      // Мелодия
      const samples = samplePoints(taktPts, N);
      for (let i = 0; i < samples.length; i++) {
        const yNorm   = samples[i].y;
        const rawFreq = yNormToFreq(yNorm);
        let { freq, midi } = quantizeToScale(rawFreq, tonicMidi, scale, prevMidi);

        // Ограничение шага — до 7 полутонов, но изредка разрешаем октавный прыжок
        if (prevMidi !== null) {
          let diff = midi - prevMidi;
          const maxStep = (Math.random() < 0.12) ? 12 : 7;  // 12% шанс октавного прыжка
          if (Math.abs(diff) > maxStep) {
            diff = diff > 0 ? maxStep : -maxStep;
            midi = prevMidi + diff;
            // Проверяем что нота принадлежит гамме, иначе сдвигаем на ближайшую
            const intervals  = SCALES[scale] || SCALES.major;
            const tonicClass = ((tonicMidi % 12) + 12) % 12;
            const rel        = (((midi - tonicClass) % 12) + 12) % 12;
            if (!intervals.includes(rel)) {
              midi = nextScaleStep(midi - 1, tonicClass, intervals, diff > 0 ? +1 : -1);
            }
            freq = midiToFreq(midi);
          }
        }

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
          volume: roleVolume,
          isInflection:   isInflectionTakt && i === Math.floor(N / 2),
          inflectionType: inflectionMap.get(k)?.type ?? null,
          interpolated:   !!(samples[i].interpolated),
        });
        prevMidi = midi;
      }

      // Добираем ноты шагами по гамме если не хватает точек
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
            volume: roleVolume * 0.3,
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

export function buildAccompanimentNote(seg, k, taktPts, inflections, tonicMidi, scale, T, avgMelodyMidi = null, roleVolume = null) {
  const { instrument, role, volume } = seg;
  const roleVolMult = ROLE_VOLUME_MULT[role] ?? 1.0;
  const vol = roleVolume ?? (volume * roleVolMult);

  const intervals   = SCALES[scale] || SCALES.major;
  const tonicClass  = ((tonicMidi % 12) + 12) % 12;

  // Прогрессия аккордов — строго по тонике
  const PROG = CHORD_PROGRESSION_SEMITONES;
  const sectionLen = Math.max(1, Math.floor(T / PROG.length));
  const progIdx    = Math.min(PROG.length - 1, Math.floor(k / sectionLen));
  const progOffset = PROG[progIdx];

  // Строим аккорд правильно: тоника прогрессии + ступени гаммы
  const rootMidiBase  = tonicMidi + progOffset;
  // 3я ступень — intervals[2], 5я — intervals[4]
  const thirdInterval = intervals[2] ?? 4;
  const fifthInterval = intervals[4] ?? 7;

  // Транспонируем аккорд ниже мелодии если нужно
  let rootMidi  = rootMidiBase;
  let thirdMidi = rootMidiBase + thirdInterval;
  let fifthMidi = rootMidiBase + fifthInterval;

  if (avgMelodyMidi !== null) {
    while (rootMidi >= avgMelodyMidi)  { rootMidi -= 12; thirdMidi -= 12; fifthMidi -= 12; }
  }

  if (role === 'bass') {
    // Бас — корневая нота, + хроматический подход к следующей тонике на последней доле такта
    const bassMidi = rootMidi - 12;

    // Определяем следующий корень для walking bass
    const nextProgIdx  = Math.min(PROG.length - 1, Math.floor((k + 1) / sectionLen));
    const nextOffset   = PROG[nextProgIdx];
    const nextRootMidi = (tonicMidi + nextOffset) - 12;
    const walkMidi     = nextRootMidi !== bassMidi
      ? bassMidi + Math.sign(nextRootMidi - bassMidi)  // хроматический шаг к следующей
      : bassMidi + 2;                                  // тон вверх если корень не меняется

    return [
      {
        takt: k,
        posInTakt:      0,
        freq:           midiToFreq(bassMidi),
        midi:           bassMidi,
        instrument,
        role,
        volume:         vol,
        isInflection:   false,
        inflectionType: null,
        accompStyle:    'bassWalk',
      },
      {
        takt: k,
        posInTakt:      0.75,
        freq:           midiToFreq(walkMidi),
        midi:           walkMidi,
        instrument,
        role,
        volume:         vol * 0.7,
        isInflection:   false,
        inflectionType: null,
        accompStyle:    'bassWalk',
      },
    ];
  }

  // Аккорды
  const totalInflections = inflections.length;
  const notes = [];

  if (totalInflections === 0) {
    // Плоский аккорд: root, 3я, 5я, октава
    [rootMidi, thirdMidi, fifthMidi, rootMidi + 12].forEach((midi, i) => {
      notes.push({
        takt: k, posInTakt: i * 0.25,
        freq: midiToFreq(midi), midi,
        instrument, role,
        volume: vol * (i === 0 ? 1.0 : 0.8),
        isInflection: false, inflectionType: null, accompStyle: 'flatChord',
      });
    });
  } else if (totalInflections <= 2) {
    // Арпеджио
    const goingUp = (taktPts[taktPts.length - 1].y < taktPts[0].y);
    const steps   = goingUp
      ? [rootMidi, thirdMidi, fifthMidi, rootMidi + 12]
      : [rootMidi + 12, fifthMidi, thirdMidi, rootMidi];
    steps.forEach((midi, i) => {
      notes.push({
        takt: k, posInTakt: i / steps.length,
        freq: midiToFreq(midi), midi,
        instrument, role,
        volume: vol * (i === 0 ? 1.0 : 0.75),
        isInflection: false, inflectionType: null, accompStyle: 'arpeggio',
      });
    });
  } else {
    // Пульс (насыщенные переломы) — все три ноты одновременно
    [rootMidi, thirdMidi, fifthMidi].forEach(midi => {
      notes.push({
        takt: k, posInTakt: 0,
        freq: midiToFreq(midi), midi,
        instrument, role,
        volume: vol * 0.75,
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