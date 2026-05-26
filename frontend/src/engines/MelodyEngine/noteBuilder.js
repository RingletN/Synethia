// engines/MelodyEngine/noteBuilder.js
// Фаза 1б: генерация сырых нот (питч + позиция, без ритмического наложения)
//
// ИЗМЕНЕНИЯ: используем temporalRoleByTakt / temporalVolMultByTakt из roleAssigner
// чтобы инструменты переключали роли (мелодия ↔ аккомпанемент) по ходу времени

import {
  SCALES,
  ROLE_VOLUME_MULT,
  CHORD_PROGRESSION_SEMITONES,
} from "./constants.js";
import {
  freqToMidi,
  midiToFreq,
  yNormToFreq,
  quantizeToScale,
  nextScaleStep,
} from "./musicTheory.js";
import { detectInflections } from "./preprocessor.js";

export function buildRawNotes(
  processedSegs,
  tonicMidi,
  T,
  scale,
  notesPerBeat,
) {
  const rawNotes = [];

  const chordSegsByTakt = buildSimultaneousSegsByTakt(
    processedSegs,
    T,
    "chord",
  );
  const bassSegsByTakt = buildSimultaneousSegsByTakt(processedSegs, T, "bass");

  for (const seg of processedSegs) {
    const { points, instrument, role, volume } = seg;
    if (points.length < 2) continue;

    const temporalRoles = seg.temporalRoleByTakt || new Array(T).fill(role);
    const temporalVolMult = seg.temporalVolMultByTakt || new Array(T).fill(1.0);

    const inflections = detectInflections(seg, T);
    const inflectionTakts = new Set(inflections.map((inf) => inf.takt));
    const inflectionMap = new Map(inflections.map((inf) => [inf.takt, inf]));
    const taktYMap = buildTaktYMap(points, T);

    let prevMidi = null;

    for (let k = 0; k < T; k++) {
      const taktXMin = k / T;
      const taktXMax = (k + 1) / T;
      const taktRole = temporalRoles[k]; // роль в этом такте
      const volMult = temporalVolMult[k]; // множитель громкости в этом такте

      // Нулевой множитель - инструмент здесь не звучит совсем
      if (volMult <= 0) continue;

      let taktPts = points.filter((pt) => pt.x >= taktXMin && pt.x < taktXMax);

      if (taktPts.length === 0) {
        // Аккомпанирующие инструменты молчат там где не нарисованы
        if (taktRole === "chord" || seg.isOrnament) continue;
        // Бас и мелодия: экстраполируем
        if (taktYMap[k] === null) continue;
        taktPts = [
          { x: (taktXMin + taktXMax) / 2, y: taktYMap[k], interpolated: true },
        ];
      }

      const roleVolMult = ROLE_VOLUME_MULT[taktRole] ?? 1.0;
      const roleVolume = volume * roleVolMult * volMult;

      const isInflectionTakt = inflectionTakts.has(k);
      const N = isInflectionTakt ? Math.min(4, notesPerBeat + 1) : notesPerBeat;

      // Бас (статическая роль — не меняется по времени)
      if (role === "bass") {
        const simultaneousSegs =
          (bassSegsByTakt.get(instrument) || [])[k] || [];
        const accompNotes = buildBassNote(
          seg,
          k,
          taktPts,
          tonicMidi,
          scale,
          T,
          roleVolume,
          simultaneousSegs,
        );
        rawNotes.push(...accompNotes);
        continue;
      }

      // ── Аккомпанемент (chord/ornament) в этом такте ──────────────────────
      if (taktRole === "chord") {
        const simultaneousSegs =
          (chordSegsByTakt.get(instrument) || [])[k] || [];

        // isOrnament в данном такте — всегда true для аккомпанирующего голоса
        const ornamentVolMult = 0.45;

        const accompNotes = buildChordNote(
          seg,
          k,
          taktPts,
          inflections,
          tonicMidi,
          scale,
          T,
          roleVolume * ornamentVolMult,
          simultaneousSegs,
          prevMidi,
        );
        // Помечаем как ornament для правильной обработки в rhythmEngine
        accompNotes.forEach((n) => {
          n.isOrnament = true;
          n.temporalFade = volMult; // передаём fade для плавности в зоне перехода
        });
        rawNotes.push(...accompNotes);
        if (accompNotes.length > 0 && accompNotes[0].accompStyle === "single") {
          prevMidi = accompNotes[accompNotes.length - 1].midi;
        }
        continue;
      }

      // Мелодия в этом такте
      const samples = samplePoints(taktPts, N);
      for (let i = 0; i < samples.length; i++) {
        const yNorm = samples[i].y;
        const rawFreq = yNormToFreq(yNorm);
        let { freq, midi } = quantizeToScale(
          rawFreq,
          tonicMidi,
          scale,
          prevMidi,
        );

        if (prevMidi !== null) {
          let diff = midi - prevMidi;
          const maxStep = Math.random() < 0.12 ? 12 : 7;
          if (Math.abs(diff) > maxStep) {
            diff = diff > 0 ? maxStep : -maxStep;
            midi = prevMidi + diff;
            const intervals = SCALES[scale] || SCALES.major;
            const tonicClass = ((tonicMidi % 12) + 12) % 12;
            const rel = (((midi - tonicClass) % 12) + 12) % 12;
            if (!intervals.includes(rel)) {
              midi = nextScaleStep(
                midi - 1,
                tonicClass,
                intervals,
                diff > 0 ? +1 : -1,
              );
            }
            freq = midiToFreq(midi);
          }

          if (midi === prevMidi && i === 0) {
            const intervals = SCALES[scale] || SCALES.major;
            const tonicClass = ((tonicMidi % 12) + 12) % 12;
            const nextTaktY = taktYMap[k + 1];
            const direction =
              nextTaktY !== null && nextTaktY < taktYMap[k] ? +1 : -1;
            midi = nextScaleStep(prevMidi, tonicClass, intervals, direction);
            freq = midiToFreq(midi);
          }
        }

        rawNotes.push({
          takt: k,
          posInTakt: i / N,
          freq,
          midi,
          instrument,
          role: "melody",
          volume: roleVolume,
          isInflection: isInflectionTakt && i === Math.floor(N / 2),
          inflectionType: inflectionMap.get(k)?.type ?? null,
          interpolated: !!samples[i].interpolated,
        });
        prevMidi = midi;
      }

      if (samples.length < N && prevMidi !== null) {
        const intervals = SCALES[scale] || SCALES.major;
        const tonicClass = ((tonicMidi % 12) + 12) % 12;
        const nextY = taktYMap[k + 1];
        const direction = nextY !== null && nextY < taktYMap[k] ? +1 : -1;
        for (let i = samples.length; i < N; i++) {
          const stepMidi = nextScaleStep(
            prevMidi,
            tonicClass,
            intervals,
            direction,
          );
          const stepFreq = midiToFreq(stepMidi);
          rawNotes.push({
            takt: k,
            posInTakt: i / N,
            freq: stepFreq,
            midi: stepMidi,
            instrument,
            role: "melody",
            volume: roleVolume * 0.3,
            isInflection: false,
            inflectionType: null,
            interpolated: true,
          });
          prevMidi = stepMidi;
        }
      }
    }
  }
  return rawNotes;
}

// Bass

const BASS_MIDI_MIN = 40; // E2
const BASS_MIDI_MAX = 64; // E4

function clampBassOctave(midi) {
  while (midi < BASS_MIDI_MIN) midi += 12;
  while (midi > BASS_MIDI_MAX) midi -= 12;
  return midi;
}

export function buildBassNote(
  seg,
  k,
  taktPts,
  tonicMidi,
  scale,
  T,
  roleVolume,
  simultaneousSegs = [],
) {
  const { instrument, role, volume } = seg;
  const roleVolMult = ROLE_VOLUME_MULT[role] ?? 1.0;
  const vol = roleVolume ?? volume * roleVolMult;

  if (simultaneousSegs.length >= 2) {
    return buildBassInterval(
      simultaneousSegs,
      k,
      T,
      tonicMidi,
      scale,
      vol,
      instrument,
      role,
    );
  }

  const sorted = [...taktPts].sort((a, b) => a.y - b.y);
  const medY = sorted[Math.floor(sorted.length / 2)].y;
  let { midi: bassMidi } = quantizeToScale(yNormToFreq(medY), tonicMidi, scale);

  bassMidi = clampBassOctave(bassMidi);
  const bassFreq = midiToFreq(bassMidi);

  const intervals = SCALES[scale] || SCALES.major;
  const tonicClass = ((tonicMidi % 12) + 12) % 12;
  const taktXMax = (k + 1) / T;
  const nextPts = seg.points.filter(
    (pt) => pt.x >= taktXMax && pt.x < (k + 2) / T,
  );
  let walkMidi = bassMidi;

  if (nextPts.length > 0) {
    const nextSorted = [...nextPts].sort((a, b) => a.y - b.y);
    const nextY = nextSorted[Math.floor(nextSorted.length / 2)].y;
    let { midi: nextMidi } = quantizeToScale(
      yNormToFreq(nextY),
      tonicMidi,
      scale,
    );
    nextMidi = clampBassOctave(nextMidi);
    walkMidi =
      nextMidi !== bassMidi
        ? nextScaleStep(
            bassMidi,
            tonicClass,
            intervals,
            Math.sign(nextMidi - bassMidi),
          )
        : nextScaleStep(bassMidi, tonicClass, intervals, 1);
  } else {
    walkMidi = nextScaleStep(bassMidi, tonicClass, intervals, 1);
  }
  walkMidi = clampBassOctave(walkMidi);

  return [
    {
      takt: k,
      posInTakt: 0,
      freq: bassFreq,
      midi: bassMidi,
      instrument,
      role,
      volume: vol,
      isInflection: false,
      inflectionType: null,
      accompStyle: "bassWalk",
      isWalk: false,
    },
    {
      takt: k,
      posInTakt: 0.75,
      freq: midiToFreq(walkMidi),
      midi: walkMidi,
      instrument,
      role,
      volume: vol * 0.6,
      isInflection: false,
      inflectionType: null,
      accompStyle: "bassWalk",
      isWalk: true,
    },
  ];
}

function buildBassInterval(
  simultaneousSegs,
  k,
  T,
  tonicMidi,
  scale,
  vol,
  instrument,
  role,
) {
  const taktXMin = k / T;
  const taktXMax = (k + 1) / T;
  const notes = [];
  const midiSet = new Set();

  for (const s of simultaneousSegs) {
    const sPts = s.points.filter((pt) => pt.x >= taktXMin && pt.x < taktXMax);
    if (sPts.length === 0) continue;
    const sorted = [...sPts].sort((a, b) => a.y - b.y);
    const medY = sorted[Math.floor(sorted.length / 2)].y;
    const { freq, midi } = quantizeToScale(yNormToFreq(medY), tonicMidi, scale);
    if (!midiSet.has(midi)) {
      midiSet.add(midi);
      notes.push({ freq, midi });
    }
  }

  if (notes.length === 0) return [];
  notes.sort((a, b) => a.midi - b.midi);

  return notes.map((n, i) => ({
    takt: k,
    posInTakt: 0,
    freq: n.freq,
    midi: n.midi,
    instrument,
    role,
    volume: vol * (i === 0 ? 1.0 : 0.75),
    isInflection: false,
    inflectionType: null,
    accompStyle: "bassInterval",
  }));
}

// Chord

export function buildChordNote(
  seg,
  k,
  taktPts,
  inflections,
  tonicMidi,
  scale,
  T,
  roleVolume,
  simultaneousSegs,
  prevMidi = null,
) {
  const { instrument, role, volume } = seg;
  const roleVolMult = ROLE_VOLUME_MULT[role] ?? 1.0;
  const vol = roleVolume ?? volume * roleVolMult;

  if (simultaneousSegs.length <= 1) {
    return buildSingleChordLine(
      seg,
      k,
      taktPts,
      tonicMidi,
      scale,
      vol,
      prevMidi,
    );
  }

  return buildTrueChord(
    simultaneousSegs,
    k,
    taktPts,
    tonicMidi,
    scale,
    T,
    inflections,
    vol,
    instrument,
    role,
  );
}

function buildSingleChordLine(
  seg,
  k,
  taktPts,
  tonicMidi,
  scale,
  vol,
  prevMidi,
) {
  const { instrument, role } = seg;
  const sorted = [...taktPts].sort((a, b) => a.y - b.y);
  const medY = sorted[Math.floor(sorted.length / 2)].y;
  const rawFreq = yNormToFreq(medY);
  let { freq, midi } = quantizeToScale(rawFreq, tonicMidi, scale, prevMidi);

  if (prevMidi !== null && Math.abs(midi - prevMidi) > 12) {
    const dir = midi > prevMidi ? 1 : -1;
    midi = prevMidi + dir * 12;
    freq = midiToFreq(midi);
  }

  return [
    {
      takt: k,
      posInTakt: 0,
      freq,
      midi,
      instrument,
      role,
      volume: vol,
      isInflection: false,
      inflectionType: null,
      accompStyle: "single",
      isOrnament: true,
    },
  ];
}

function buildTrueChord(
  simultaneousSegs,
  k,
  taktPts,
  tonicMidi,
  scale,
  T,
  inflections,
  vol,
  instrument,
  role,
) {
  const notes = [];
  const taktXMin = k / T;
  const taktXMax = (k + 1) / T;
  const midiSet = new Set();
  const segNotes = [];

  for (const s of simultaneousSegs) {
    const sPts = s.points.filter((pt) => pt.x >= taktXMin && pt.x < taktXMax);
    if (sPts.length === 0) continue;
    const sorted = [...sPts].sort((a, b) => a.y - b.y);
    const medY = sorted[Math.floor(sorted.length / 2)].y;
    const { freq, midi } = quantizeToScale(yNormToFreq(medY), tonicMidi, scale);
    if (!midiSet.has(midi)) {
      midiSet.add(midi);
      segNotes.push({ freq, midi });
    }
  }

  if (segNotes.length === 0) return [];

  const style = inflections.length >= 2 ? "arpeggio" : "flatChord";
  segNotes.sort((a, b) => a.midi - b.midi);
  segNotes.forEach(({ freq, midi }, i) => {
    notes.push({
      takt: k,
      posInTakt: style === "arpeggio" ? i / segNotes.length : 0,
      freq,
      midi,
      instrument,
      role,
      volume: vol * (i === 0 ? 1.0 : 0.8),
      isInflection: false,
      inflectionType: null,
      accompStyle: style,
      isOrnament: true,
    });
  });

  return notes;
}

export function buildAccompanimentNote(
  seg,
  k,
  taktPts,
  inflections,
  tonicMidi,
  scale,
  T,
  avgMelodyMidi = null,
  roleVolume = null,
) {
  if (seg.role === "bass") {
    return buildBassNote(seg, k, taktPts, tonicMidi, scale, T, roleVolume);
  }
  return buildChordNote(
    seg,
    k,
    taktPts,
    inflections,
    tonicMidi,
    scale,
    T,
    roleVolume,
    [],
    null,
  );
}

// Вспомогательные функции

export function getSegmentDirection(segment) {
  const pts = segment.points;
  if (pts.length < 2) return 0;
  const dy = pts[pts.length - 1].y - pts[0].y;
  if (Math.abs(dy) < 0.05) return 0;
  return dy < 0 ? 1 : -1;
}

export function selectNotesPerBeat(bpm) {
  let options;
  if (bpm >= 120)
    options = [
      { n: 1, p: 0.5 },
      { n: 2, p: 0.5 },
    ];
  else if (bpm >= 70)
    options = [
      { n: 1, p: 0.35 },
      { n: 2, p: 0.45 },
      { n: 3, p: 0.2 },
    ];
  else
    options = [
      { n: 1, p: 0.25 },
      { n: 2, p: 0.35 },
      { n: 3, p: 0.25 },
      { n: 4, p: 0.15 },
    ];
  let cum = 0;
  const r = Math.random();
  for (const o of options) {
    cum += o.p;
    if (r <= cum) return o.n;
  }
  return 2;
}

function buildSimultaneousSegsByTakt(processedSegs, T, role) {
  const result = new Map();

  for (const seg of processedSegs) {
    if (seg.role !== role) continue;
    const { instrument, points } = seg;
    if (!points || points.length === 0) continue;

    if (!result.has(instrument)) {
      result.set(
        instrument,
        Array.from({ length: T }, () => []),
      );
    }

    const taktArr = result.get(instrument);
    const segMinX = points[0].x;
    const segMaxX = points[points.length - 1].x;
    const minTakt = Math.floor(segMinX * T);
    const maxTakt = Math.min(T - 1, Math.floor(segMaxX * T));

    for (let k = minTakt; k <= maxTakt; k++) {
      if (!taktArr[k]) continue;
      if (!taktArr[k].includes(seg)) {
        taktArr[k].push(seg);
      }
    }
  }

  return result;
}

function buildTaktYMap(points, T) {
  const taktYMap = new Array(T).fill(null);
  for (let k = 0; k < T; k++) {
    const taktXMin = k / T;
    const taktXMax = (k + 1) / T;
    const taktPts = points.filter((pt) => pt.x >= taktXMin && pt.x < taktXMax);
    if (taktPts.length > 0) {
      const sorted = [...taktPts].sort((a, b) => a.y - b.y);
      taktYMap[k] = sorted[Math.floor(sorted.length / 2)].y;
    }
  }

  const segMinTakt = Math.floor(points[0].x * T);
  const segMaxTakt = Math.min(
    T - 1,
    Math.floor(points[points.length - 1].x * T),
  );

  for (let k = segMinTakt; k <= segMaxTakt; k++) {
    if (taktYMap[k] !== null) continue;
    let leftK = k - 1,
      rightK = k + 1;
    while (leftK >= segMinTakt && taktYMap[leftK] === null) leftK--;
    while (rightK <= segMaxTakt && taktYMap[rightK] === null) rightK++;
    const leftY = leftK >= segMinTakt ? taktYMap[leftK] : null;
    const rightY = rightK <= segMaxTakt ? taktYMap[rightK] : null;
    if (leftY !== null && rightY !== null) {
      const t = (k - leftK) / (rightK - leftK);
      taktYMap[k] = leftY + (rightY - leftY) * t;
    } else if (leftY !== null) {
      taktYMap[k] = leftY;
    } else if (rightY !== null) {
      taktYMap[k] = rightY;
    }
  }

  const firstY = taktYMap[segMinTakt];
  const lastY = taktYMap[segMaxTakt];
  for (let k = 0; k < segMinTakt; k++) {
    if (taktYMap[k] === null) taktYMap[k] = firstY;
  }
  for (let k = segMaxTakt + 1; k < T; k++) {
    if (taktYMap[k] === null) taktYMap[k] = lastY;
  }

  return taktYMap;
}

function samplePoints(taktPts, N) {
  if (taktPts.length <= N) return taktPts;
  const result = [];
  const chunkSize = taktPts.length / N;
  for (let i = 0; i < N; i++) {
    const from = Math.floor(i * chunkSize);
    const to = Math.floor((i + 1) * chunkSize);
    const chunk = taktPts.slice(from, to);
    const sorted = [...chunk].sort((a, b) => a.y - b.y);
    result.push(sorted[Math.floor(sorted.length / 2)]);
  }
  return result;
}
