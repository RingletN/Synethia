// engines/MelodyEngine/roleAssigner.js
// Определяет роль каждого сегмента: melody / chord / bass
// Логика: при 1-3 инструментах – по плотности переломов,
//         при 4+ – явное назначение баса (самый низкий) и аккорда (минимальная плотность)

import { detectInflections } from "./preprocessor.js";

export function assignRoles(processedSegs, T) {
  const byInstrument = new Map();
  for (const seg of processedSegs) {
    if (!byInstrument.has(seg.instrument)) {
      byInstrument.set(seg.instrument, { segs: [], inflectionCount: 0, avgY: 0 });
    }
    byInstrument.get(seg.instrument).segs.push(seg);
  }

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

  // Новая логика для 4+ инструментов
  if (byInstrument.size >= 4) {
    const sorted = Array.from(byInstrument.entries())
      .sort((a, b) => a[1].avgY - b[1].avgY); // по высоте (низкий → высокий)
    const bassInstr = sorted[0][0];
    // Из оставшихся – тот, у кого минимальная плотность переломов (аккорд)
    const remaining = sorted.slice(1);
    let chordInstr = remaining[0][0];
    let minDensity = remaining[0][1].inflectionDensity;
    for (let i = 1; i < remaining.length; i++) {
      if (remaining[i][1].inflectionDensity < minDensity) {
        minDensity = remaining[i][1].inflectionDensity;
        chordInstr = remaining[i][0];
      }
    }
    for (const [instr, data] of byInstrument) {
      let role;
      if (instr === bassInstr) role = 'bass';
      else if (instr === chordInstr) role = 'chord';
      else role = 'melody';
      data.segs.forEach(seg => seg.role = role);
    }
  } else {
    // Старая логика для 2-3 инструментов
    let minDensity = Infinity;
    let accompInstr = null;
    for (const [instr, data] of byInstrument) {
      if (data.inflectionDensity < minDensity) {
        minDensity = data.inflectionDensity;
        accompInstr = instr;
      }
    }
    for (const [instr, data] of byInstrument) {
      // УЛУЧШЕНИЕ: порог баса снижен до 0.5 (ниже середины холста)
      const role = (instr === accompInstr)
        ? (data.avgY > 0.5 ? 'bass' : 'chord')
        : 'melody';
      data.segs.forEach(seg => seg.role = role);
    }
  }
}