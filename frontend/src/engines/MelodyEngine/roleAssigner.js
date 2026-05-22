// engines/MelodyEngine/roleAssigner.js
// Определяет роль каждого сегмента: melody / chord / bass
//
// Приоритет логики:
//   1. Один инструмент → всё melody
//   2. Инструмент явно внизу холста (avgY > BASS_Y_THRESHOLD) → bass,
//      независимо от плотности переломов
//   3. Несколько сегментов одного инструмента → усиливает признак баса/аккорда
//   4. Если кандидат в аккомпанемент не пересекается по времени
//      с мелодическими → всё melody (играют последовательно)
//   5. При 4+ инструментах: самый низкий bass, наиболее плавный chord, остальные melody

import { detectInflections } from "./preprocessor.js";

// Порог: если средний Y инструмента выше этого значения — кандидат в бас
// (Y растёт вниз: 0 = верх холста, 1 = низ)
const BASS_Y_THRESHOLD  = 0.58;

// Если у инструмента несколько сегментов — бонус к "басовости"
const MULTI_SEG_Y_BONUS = 0.06;

export function assignRoles(processedSegs, T) {
  const byInstrument = new Map();
  for (const seg of processedSegs) {
    if (!byInstrument.has(seg.instrument)) {
      byInstrument.set(seg.instrument, { segs: [], inflectionCount: 0, avgY: 0 });
    }
    byInstrument.get(seg.instrument).segs.push(seg);
  }

  // Единственный инструмент — всё мелодия
  if (byInstrument.size === 1) {
    for (const seg of processedSegs) seg.role = 'melody';
    return;
  }

  // Считаем метрики для каждого инструмента
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
    data.segCount          = data.segs.length;

    // Эффективный Y для оценки баса: несколько сегментов усиливают низкое положение
    data.effectiveY = data.avgY + (data.segCount > 1 ? MULTI_SEG_Y_BONUS : 0);
  }

  if (byInstrument.size >= 4) {
    return assignRoles4Plus(byInstrument);
  }

  // ── 2-3 инструмента ──────────────────────────────────────────────────────────

  // Шаг 1: явный бас — инструмент у которого effectiveY выше порога
  // и он самый низкий среди всех
  const sortedByY = Array.from(byInstrument.entries())
    .sort((a, b) => b[1].effectiveY - a[1].effectiveY); // высокий Y = низкое положение

  let bassInstr  = null;
  let chordInstr = null;

  // Самый низкий инструмент становится басом если он действительно внизу
  const lowestEntry = sortedByY[0];
  if (lowestEntry[1].effectiveY >= BASS_Y_THRESHOLD) {
    bassInstr = lowestEntry[0];
  }

  // Из оставшихся (исключая бас) — наиболее плавный становится chord
  const remaining = sortedByY
    .filter(([instr]) => instr !== bassInstr)
    .sort((a, b) => a[1].inflectionDensity - b[1].inflectionDensity);

  if (remaining.length >= 2) {
    // Есть несколько кандидатов — наименее извилистый chord
    chordInstr = remaining[0][0];
  }
  // Если остался только один не-бас инструмент — он melody (chord не нужен)

  // Шаг 2: проверяем временно́е перекрытие
  // Если ни один аккомпанирующий (bass/chord) не пересекается с мелодическими — всё melody
  const melodyInstrs = Array.from(byInstrument.keys())
    .filter(i => i !== bassInstr && i !== chordInstr);

  const melodySegs = melodyInstrs.flatMap(i => byInstrument.get(i).segs);

  const accompSegs = [
    ...(bassInstr  ? byInstrument.get(bassInstr).segs  : []),
    ...(chordInstr ? byInstrument.get(chordInstr).segs : []),
  ];

  if (accompSegs.length > 0 && melodySegs.length > 0) {
    if (!hasTemporalOverlap(accompSegs, melodySegs)) {
      // Аккомпанемент не пересекается с мелодией — все инструменты играют melody
      for (const seg of processedSegs) seg.role = 'melody';
      return;
    }
  }

  // Шаг 3: финальное назначение ролей
  for (const [instr, data] of byInstrument) {
    let role;
    if      (instr === bassInstr)  role = 'bass';
    else if (instr === chordInstr) role = 'chord';
    else                           role = 'melody';
    data.segs.forEach(seg => seg.role = role);
  }
}

// ─── 4+ инструментов ─────────────────────────────────────────────────────────

function assignRoles4Plus(byInstrument) {
  const sorted = Array.from(byInstrument.entries())
    .sort((a, b) => b[1].effectiveY - a[1].effectiveY); // низкий → высокий

  const bassInstr  = sorted[0][0];
  const remaining  = sorted.slice(1);

  let chordInstr  = remaining[0][0];
  let minDensity  = remaining[0][1].inflectionDensity;
  for (let i = 1; i < remaining.length; i++) {
    if (remaining[i][1].inflectionDensity < minDensity) {
      minDensity = remaining[i][1].inflectionDensity;
      chordInstr = remaining[i][0];
    }
  }

  for (const [instr, data] of byInstrument) {
    let role;
    if      (instr === bassInstr)  role = 'bass';
    else if (instr === chordInstr) role = 'chord';
    else                           role = 'melody';
    data.segs.forEach(seg => seg.role = role);
  }
}

// ─── Вспомогательные функции ──────────────────────────────────────────────────

/**
 * Проверяет значимое временно́е перекрытие между двумя группами сегментов.
 * Порог 10% холста — игнорируем случайное касание краёв.
 */
function hasTemporalOverlap(groupA, groupB, overlapThreshold = 0.10) {
  for (const a of groupA) {
    const aMin = a.points[0].x;
    const aMax = a.points[a.points.length - 1].x;
    for (const b of groupB) {
      const bMin = b.points[0].x;
      const bMax = b.points[b.points.length - 1].x;
      const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
      if (overlap > overlapThreshold) return true;
    }
  }
  return false;
}