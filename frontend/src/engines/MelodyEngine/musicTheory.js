// engines/MelodyEngine/musicTheory.js
// Вся математика нот: MIDI ↔ частоты, квантизация по гамме

import { A4_FREQ, A4_MIDI, MIN_FREQ, MAX_FREQ, SCALES } from "./constants.js";

export function freqToMidi(freq) {
  return A4_MIDI + 12 * Math.log2(freq / A4_FREQ);
}

export function midiToFreq(midi) {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

export function yNormToFreq(yNorm) {
  const t = 1 - Math.max(0, Math.min(1, yNorm));
  return MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, t);
}

export function quantizeToScale(freq, tonicMidi, scale, prevQuantMidi = null) {
  const intervals = SCALES[scale] || SCALES.major;
  const rawMidi = freqToMidi(freq);
  const roundedMidi = Math.round(rawMidi);
  const tonicClass = ((tonicMidi % 12) + 12) % 12;
  const rel = (((roundedMidi - tonicClass) % 12) + 12) % 12;

  let closest = intervals[0];
  let minDist = Infinity;
  for (const iv of intervals) {
    const d = Math.min(Math.abs(iv - rel), 12 - Math.abs(iv - rel));
    if (d < minDist) {
      minDist = d;
      closest = iv;
    }
  }

  const octave = Math.floor((roundedMidi - tonicClass) / 12);
  let quantMidi = tonicClass + octave * 12 + closest;

  if (prevQuantMidi !== null) {
    const expectedUp = rawMidi > prevQuantMidi + 0.5;
    const expectedDn = rawMidi < prevQuantMidi - 0.5;
    if (expectedUp && quantMidi <= prevQuantMidi) {
      quantMidi = nextScaleStep(quantMidi, tonicClass, intervals, +1);
    } else if (expectedDn && quantMidi >= prevQuantMidi) {
      quantMidi = nextScaleStep(quantMidi, tonicClass, intervals, -1);
    }
  }

  quantMidi = Math.max(
    Math.round(freqToMidi(MIN_FREQ)),
    Math.min(Math.round(freqToMidi(MAX_FREQ)), quantMidi),
  );
  return { freq: midiToFreq(quantMidi), midi: quantMidi };
}

export function nextScaleStep(midi, tonicClass, intervals, direction) {
  for (let d = 1; d <= 12; d++) {
    const candidate = midi + direction * d;
    const rel = (((candidate - tonicClass) % 12) + 12) % 12;
    if (intervals.includes(rel)) return candidate;
  }
  return midi;
}
