// engines/MelodyEngine/roleAssigner.js
// Определяет роль каждого сегмента: melody / chord / bass
// Логика: инструмент с наименьшей плотностью переломов → аккомпанемент (chord/bass)

import { detectInflections } from "./preprocessor.js";

export function assignRoles(processedSegs, T) {
  const byInstrument = new Map();
  for (const seg of processedSegs) {
    if (!byInstrument.has(seg.instrument)) {
      byInstrument.set(seg.instrument, { segs: [], inflectionCount: 0, avgY: 0 });
    }
    byInstrument.get(seg.instrument).segs.push(seg);
  }

  // Единственный инструмент — всегда мелодия
  if (byInstrument.size === 1) {
    for (const seg of processedSegs) seg.role = 'melody';
    return;
  }

  for (const [, data] of byInstrument) {
    let totalInflections = 0, totalY = 0, totalPoints = 0;
    for (const seg of data.segs) {
      const inf = detectInflections(seg, T);
      totalInflections += inf.length;
      for (const pt of seg.points) {
        totalY += pt.y;
        totalPoints++;
      }
    }
    data.inflectionDensity = totalPoints > 0 ? totalInflections / (totalPoints / 10) : 0;
    data.avgY              = totalPoints > 0 ? totalY / totalPoints : 0.5;
  }

  // Инструмент с наименьшей плотностью переломов становится аккомпанементом
  let minDensity = Infinity;
  let accompInstr = null;
  for (const [instr, data] of byInstrument) {
    if (data.inflectionDensity < minDensity) {
      minDensity  = data.inflectionDensity;
      accompInstr = instr;
    }
  }

  for (const [instr, data] of byInstrument) {
    // avgY > 0.6 означает низкое положение на канвасе → бас
    const role = (instr === accompInstr)
      ? (data.avgY > 0.6 ? 'bass' : 'chord')
      : 'melody';
    data.segs.forEach(seg => seg.role = role);
  }
}
