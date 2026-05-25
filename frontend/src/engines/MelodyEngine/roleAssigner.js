// engines/MelodyEngine/roleAssigner.js
//
// Роли инструментов определяются ПО ВРЕМЕНИ (по оси X):
//   - В каждом такте есть ровно один "dominant melody" инструмент
//   - Остальные melody-инструменты в этом такте → аккомпанемент (chord/ornament)
//   - Переход плавный: в зоне overlap оба инструмента слышны, но один тише
//
// Публичный API:
//   assignRoles(processedSegs, T)
//     → каждому seg добавляет .role, .isOrnament, .temporalRoleByTakt[]

import { detectInflections } from "./preprocessor.js";

const BASS_Y_THRESHOLD = 0.45;
const SHORT_SEGMENT_RATIO = 0.55;
const CROSSFADE_WIDTH = 0.15; // ширина зоны перехода (в единицах X [0..1])
const ACCOMP_VOLUME_RATIO = 0.4; // громкость аккомпанирующего инструмента относительно ведущего

export function assignRoles(processedSegs, T) {
  const byInstrument = new Map();
  for (const seg of processedSegs) {
    if (!byInstrument.has(seg.instrument)) {
      byInstrument.set(seg.instrument, {
        segs: [],
        totalLength: 0,
        avgY: 0,
        totalPoints: 0,
      });
    }
    byInstrument.get(seg.instrument).segs.push(seg);
  }

  if (byInstrument.size === 1) {
    for (const seg of processedSegs) {
      seg.role = "melody";
      seg.isOrnament = false;
      seg.temporalRoleByTakt = new Array(T).fill("melody");
      seg.temporalVolMultByTakt = new Array(T).fill(1.0);
    }
    return;
  }

  // Считаем метрики по каждому инструменту
  for (const [, data] of byInstrument) {
    let totalY = 0,
      totalPoints = 0,
      totalLength = 0;
    let minX = Infinity,
      maxX = -Infinity;
    for (const seg of data.segs) {
      const pts = seg.points;
      if (pts.length < 2) continue;
      totalLength += pts[pts.length - 1].x - pts[0].x;
      for (const pt of pts) {
        totalY += pt.y;
        totalPoints++;
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
      }
    }
    data.totalLength = totalLength;
    data.avgY = totalPoints > 0 ? totalY / totalPoints : 0.5;
    data.totalPoints = totalPoints;
    data.segCount = data.segs.length;
    data.minX = minX === Infinity ? 0 : minX;
    data.maxX = maxX === -Infinity ? 1 : maxX;
    data.centerX = (data.minX + data.maxX) / 2;

    // Плотность по X (10 бакетов)
    const BUCKETS = 10;
    const density = new Array(BUCKETS).fill(0);
    for (const seg of data.segs) {
      for (const pt of seg.points) {
        const b = Math.min(BUCKETS - 1, Math.floor(pt.x * BUCKETS));
        density[b]++;
      }
    }
    data.density = density;

    let wSum = 0,
      wCount = 0;
    for (let b = 0; b < BUCKETS; b++) {
      wSum += ((b + 0.5) / BUCKETS) * density[b];
      wCount += density[b];
    }
    data.massCenterX = wCount > 0 ? wSum / wCount : 0.5;

    let cumul = 0;
    data.medianX = 0.5;
    for (let b = 0; b < BUCKETS; b++) {
      cumul += density[b];
      if (cumul >= wCount / 2) {
        data.medianX = (b + 0.5) / BUCKETS;
        break;
      }
    }
  }

  // ── Определяем бас ─────────────────────────────────────────────────────────
  const sortedByY = Array.from(byInstrument.entries()).sort(
    (a, b) => b[1].avgY - a[1].avgY,
  );
  let bassInstr = null;
  if (sortedByY[0][1].avgY >= BASS_Y_THRESHOLD) {
    bassInstr = sortedByY[0][0];
  }

  // Назначаем бас
  if (bassInstr) {
    const bassData = byInstrument.get(bassInstr);
    bassData.segs.forEach((seg) => {
      seg.role = "bass";
      seg.isOrnament = false;
      seg.temporalRoleByTakt = new Array(T).fill("bass");
      seg.temporalVolMultByTakt = new Array(T).fill(1.0);
    });
  }

  const nonBassEntries = Array.from(byInstrument.entries()).filter(
    ([i]) => i !== bassInstr,
  );

  // ── Если только один не-басовый инструмент → он всегда мелодия ─────────────
  if (nonBassEntries.length === 1) {
    nonBassEntries[0][1].segs.forEach((seg) => {
      seg.role = "melody";
      seg.isOrnament = false;
      seg.temporalRoleByTakt = new Array(T).fill("melody");
      seg.temporalVolMultByTakt = new Array(T).fill(1.0);
    });
    return;
  }

  // ── Основная логика: временно́е доминирование ──────────────────────────────
  const spatialSplit = checkSpatialSplit(nonBassEntries);

  if (spatialSplit) {
    applyTemporalDominance(nonBassEntries, byInstrument, T, spatialSplit);
  } else {
    // Нет чёткого разделения по X → фолбэк по длине
    applyLengthBasedRoles(nonBassEntries, byInstrument, T);
  }
}

// ─── Проверка разделения по X ──────────────────────────────────────────────
function checkSpatialSplit(nonBassEntries) {
  if (nonBassEntries.length < 2) return null;

  const sorted = [...nonBassEntries].sort(
    (a, b) => a[1].massCenterX - b[1].massCenterX,
  );
  const left = sorted[0];
  const right = sorted[sorted.length - 1];
  const leftMass = left[1].massCenterX;
  const rightMass = right[1].massCenterX;

  if (rightMass - leftMass < 0.2) return null;

  const maxPts = Math.max(...nonBassEntries.map(([, d]) => d.totalPoints));
  if (!nonBassEntries.every(([, d]) => d.totalPoints >= maxPts * 0.1))
    return null;

  // Ищем точку смены доминирования
  const BUCKETS = 10;
  const leftDensity = left[1].density;
  const rightDensity = right[1].density;
  const leftTotal = left[1].totalPoints;
  const rightTotal = right[1].totalPoints;

  let switchBucket = Math.round(((leftMass + rightMass) / 2) * BUCKETS);
  let bestDiff = -Infinity;
  for (let b = 1; b < BUCKETS - 1; b++) {
    const lNorm = (leftDensity[b] || 0) / leftTotal;
    const rNorm = (rightDensity[b] || 0) / rightTotal;
    const diff = rNorm - lNorm;
    if (diff > bestDiff) {
      bestDiff = diff;
      switchBucket = b;
    }
  }

  const midX = (switchBucket + 0.5) / BUCKETS;
  return {
    midX,
    leftInstr: left[0],
    rightInstr: right[0],
    allEntries: nonBassEntries,
  };
}

// ─── Ключевая функция: временно́е доминирование по тактам ─────────────────
// Для каждого такта:
//   1. Определяем кто "dominant" (у кого больше точек в этом такте)
//   2. Остальные melody-инструменты → chord/ornament с плавным fade
//   3. В зоне overlap: оба слышны, но dominant громче
function applyTemporalDominance(nonBassEntries, byInstrument, T, splitResult) {
  const { midX, leftInstr, rightInstr } = splitResult;

  const fadeStart = midX - CROSSFADE_WIDTH / 2;
  const fadeEnd = midX + CROSSFADE_WIDTH / 2;

  // Для каждого инструмента считаем плотность точек по тактам
  const densityByTakt = new Map();
  for (const [instrName, data] of nonBassEntries) {
    const taktDensity = new Array(T).fill(0);
    for (const seg of data.segs) {
      for (const pt of seg.points) {
        const k = Math.min(T - 1, Math.floor(pt.x * T));
        taktDensity[k]++;
      }
    }
    densityByTakt.set(instrName, taktDensity);
  }

  // Назначаем temporalRoleByTakt и temporalVolMultByTakt для каждого такта
  for (const [instrName, data] of nonBassEntries) {
    const taktRoles = new Array(T).fill("melody");
    const taktVolMult = new Array(T).fill(1.0);
    const myDensity = densityByTakt.get(instrName);

    for (let k = 0; k < T; k++) {
      const taktX = (k + 0.5) / T; // центр такта в нормализованных координатах
      const myPts = myDensity[k];

      // Есть ли у меня вообще точки в этом такте?
      const hasPts = myPts > 0;
      if (!hasPts) {
        // Нет точек → молчим (роль chord/ornament с нулевым объёмом)
        taktRoles[k] = "chord";
        taktVolMult[k] = 0;
        continue;
      }

      // Считаем суммарную плотность всех других инструментов в этом такте
      let totalOtherDensity = 0;
      for (const [otherInstr, otherDensity] of densityByTakt) {
        if (otherInstr !== instrName) totalOtherDensity += otherDensity[k];
      }

      // Нет конкурентов → я главный
      if (totalOtherDensity === 0) {
        taktRoles[k] = "melody";
        taktVolMult[k] = 1.0;
        continue;
      }

      // Есть конкуренты → определяем доминирование
      // Для двух инструментов (левый/правый): позиция такта относительно midX
      if (instrName === leftInstr) {
        if (taktX < fadeStart) {
          // Чётко левая зона → я главный
          taktRoles[k] = "melody";
          taktVolMult[k] = 1.0;
        } else if (taktX <= fadeEnd) {
          // Зона перехода → я аккомпанирую, плавно затихаю
          const t = (taktX - fadeStart) / (fadeEnd - fadeStart); // 0→1
          taktRoles[k] = "chord";
          // Плавное затухание: от 0.85 до ACCOMP_VOLUME_RATIO
          taktVolMult[k] = 0.85 - (0.85 - ACCOMP_VOLUME_RATIO) * t;
        } else {
          // Правая зона → аккомпанемент (тихий)
          taktRoles[k] = "chord";
          taktVolMult[k] = ACCOMP_VOLUME_RATIO;
        }
      } else if (instrName === rightInstr) {
        if (taktX > fadeEnd) {
          // Чётко правая зона → я главный
          taktRoles[k] = "melody";
          taktVolMult[k] = 1.0;
        } else if (taktX >= fadeStart) {
          // Зона перехода → нарастаю
          const t = (taktX - fadeStart) / (fadeEnd - fadeStart); // 0→1
          taktRoles[k] = "chord";
          // Нарастание: от ACCOMP_VOLUME_RATIO до 1.0
          taktVolMult[k] =
            ACCOMP_VOLUME_RATIO + (1.0 - ACCOMP_VOLUME_RATIO) * t;
        } else {
          // Левая зона → аккомпанемент (тихий)
          taktRoles[k] = "chord";
          taktVolMult[k] = ACCOMP_VOLUME_RATIO;
        }
      } else {
        // Прочие инструменты (не левый и не правый) → всегда аккомпанемент
        taktRoles[k] = "chord";
        taktVolMult[k] = ACCOMP_VOLUME_RATIO * 0.7;
      }
    }

    // Назначаем статическую роль для сегмента (для обратной совместимости)
    // Берём наиболее частую роль по тактам
    const melodyTakts = taktRoles.filter((r) => r === "melody").length;
    const dominantStaticRole = melodyTakts >= T / 2 ? "melody" : "chord";

    data.segs.forEach((seg) => {
      seg.role = dominantStaticRole;
      // isOrnament = true для сегментов которые преимущественно аккомпанируют
      seg.isOrnament = dominantStaticRole === "chord";
      seg.temporalRoleByTakt = [...taktRoles];
      seg.temporalVolMultByTakt = [...taktVolMult];
    });
  }
}

// ─── Фолбэк: роли по длине ────────────────────────────────────────────────
function applyLengthBasedRoles(nonBassEntries, byInstrument, T) {
  const sorted = [...nonBassEntries].sort(
    (a, b) => b[1].totalLength - a[1].totalLength,
  );
  const melodyInstr = sorted[0][0];
  const maxLength = sorted[0][1].totalLength;

  for (const [instrName, data] of nonBassEntries) {
    const isMelody =
      instrName === melodyInstr ||
      data.totalLength / maxLength >= SHORT_SEGMENT_RATIO;
    const role = isMelody ? "melody" : "chord";

    data.segs.forEach((seg) => {
      seg.role = role;
      seg.isOrnament = role === "chord";
      seg.temporalRoleByTakt = new Array(T).fill(role);
      seg.temporalVolMultByTakt = new Array(T).fill(1.0);
    });
  }
}
