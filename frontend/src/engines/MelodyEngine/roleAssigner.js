// engines/MelodyEngine/roleAssigner.js
// Определяет роль каждого сегмента: melody / chord / bass
//
// Логика приоритетов (переработана):
//   1. Один инструмент → всё melody
//   2. Самый нижний по avgY → bass
//   3. Самый длинный по суммарной длине сегментов → melody (главная мелодия)
//   4. Остальные инструменты с короткими фрагментами → chord (обыгрывание)
//      При этом у chord-инструментов сохраняются только их реальные сегменты —
//      они играют ТОЛЬКО в те временны́е промежутки, где нарисованы.

import { detectInflections } from "./preprocessor.js";

// Порог: если avgY самого нижнего инструмента ниже этого — он бас
const BASS_Y_THRESHOLD = 0.45;

// Инструмент считается "коротким" (chord/обыгрывание) если его суммарная
// длина по X меньше этой доли от самого длинного инструмента
const SHORT_SEGMENT_RATIO = 0.55;

export function assignRoles(processedSegs, T) {
  const byInstrument = new Map();
  for (const seg of processedSegs) {
    if (!byInstrument.has(seg.instrument)) {
      byInstrument.set(seg.instrument, { segs: [], totalLength: 0, avgY: 0, totalPoints: 0 });
    }
    const data = byInstrument.get(seg.instrument);
    data.segs.push(seg);
  }

  // Единственный инструмент — всё мелодия
  if (byInstrument.size === 1) {
    for (const seg of processedSegs) seg.role = 'melody';
    return;
  }

  // Считаем метрики для каждого инструмента
  for (const [, data] of byInstrument) {
    let totalY = 0, totalPoints = 0, totalLength = 0;
    for (const seg of data.segs) {
      const pts = seg.points;
      if (pts.length < 2) continue;
      // Суммарная длина по X (от крайней левой до крайней правой точки сегмента)
      totalLength += pts[pts.length - 1].x - pts[0].x;
      for (const pt of pts) {
        totalY += pt.y;
        totalPoints++;
      }
    }
    data.totalLength  = totalLength;
    data.avgY         = totalPoints > 0 ? totalY / totalPoints : 0.5;
    data.totalPoints  = totalPoints;
    data.segCount     = data.segs.length;
  }

  if (byInstrument.size >= 4) {
    return assignRoles4Plus(byInstrument, T);
  }

  // ── 2-3 инструмента ──────────────────────────────────────────────────────────

  // Шаг 1: бас — самый нижний инструмент (наибольший avgY), если он реально внизу
  const sortedByY = Array.from(byInstrument.entries())
    .sort((a, b) => b[1].avgY - a[1].avgY);

  let bassInstr = null;
  const lowestEntry = sortedByY[0];
  if (lowestEntry[1].avgY >= BASS_Y_THRESHOLD) {
    bassInstr = lowestEntry[0];
  }

  // Шаг 2: среди не-басовых — самый длинный = melody, остальные = chord
  const nonBass = Array.from(byInstrument.entries())
    .filter(([instr]) => instr !== bassInstr)
    .sort((a, b) => b[1].totalLength - a[1].totalLength);

  const melodyInstr = nonBass.length > 0 ? nonBass[0][0] : null;
  const maxLength   = melodyInstr ? byInstrument.get(melodyInstr).totalLength : 1;

  // Шаг 3: назначаем роли
  for (const [instr, data] of byInstrument) {
    let role;
    if (instr === bassInstr) {
      role = 'bass';
    } else if (instr === melodyInstr) {
      role = 'melody';
    } else {
      // Короткий инструмент → chord (обыгрывание в свои моменты)
      const ratio = data.totalLength / maxLength;
      role = ratio < SHORT_SEGMENT_RATIO ? 'chord' : 'melody';
    }
    data.segs.forEach(seg => seg.role = role);
  }

  // Шаг 4: для chord-инструментов помечаем сегменты как "ornament"
  // чтобы rhythmEngine знал играть их только в своё время и тише
  for (const [instr, data] of byInstrument) {
    if (data.segs[0]?.role === 'chord') {
      for (const seg of data.segs) {
        seg.isOrnament = true;
      }
    }
  }
}

// ─── 4+ инструментов ─────────────────────────────────────────────────────────

function assignRoles4Plus(byInstrument) {
  // Самый нижний → bass
  const sortedByY = Array.from(byInstrument.entries())
    .sort((a, b) => b[1].avgY - a[1].avgY);
  const bassInstr = sortedByY[0][0];

  // Среди остальных: самый длинный → melody, наименее извилистый из оставшихся → chord
  const nonBass = sortedByY.slice(1)
    .sort((a, b) => b[1].totalLength - a[1].totalLength);

  const melodyInstr = nonBass[0][0];
  const maxLength   = byInstrument.get(melodyInstr).totalLength;

  for (const [instr, data] of byInstrument) {
    let role;
    if (instr === bassInstr) {
      role = 'bass';
    } else if (instr === melodyInstr) {
      role = 'melody';
    } else {
      const ratio = data.totalLength / maxLength;
      role = ratio < SHORT_SEGMENT_RATIO ? 'chord' : 'melody';
    }
    data.segs.forEach(seg => seg.role = role);
    if (role === 'chord') {
      data.segs.forEach(seg => { seg.isOrnament = true; });
    }
  }
}