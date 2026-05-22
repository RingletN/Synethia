// engines/MelodyEngine/preprocessor.js
// Фаза 1а: очистка сегментов, гауссово сглаживание, детекция переломов, определение тоники

import {
  GAUSSIAN_SIGMA,
  INFLECTION_THRESHOLD,
  EDGE_IGNORE_RATIO,
  COLOR_TO_INSTRUMENT,
  INSTRUMENT_VOLUME,
} from "./constants.js";
import { freqToMidi, yNormToFreq } from "./musicTheory.js";

export function preprocessSegments(segments) {
  return segments
    .filter(seg => seg.points?.length >= 5)
    .map(seg => {
      const instrument = COLOR_TO_INSTRUMENT[seg.color] || "piano";
      const sorted = seg.points
        .filter(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y))
        .sort((a, b) => a.x - b.x);
      const deduped  = deduplicateByX(sorted);
      const smoothed = gaussianSmoothY(deduped, GAUSSIAN_SIGMA);
      return {
        ...seg,
        instrument,
        volume: INSTRUMENT_VOLUME[instrument] || 0.22,
        points: sorted,
        smoothedPoints: smoothed,
      };
    });
}

export function detectInflections(seg, T) {
  const pts = seg.smoothedPoints;
  if (pts.length < 5) return [];
  const edgeIgnore = Math.floor(pts.length * EDGE_IGNORE_RATIO);
  const inner = pts.slice(edgeIgnore, pts.length - edgeIgnore);
  if (inner.length < 3) return [];

  const inflections = [];
  let prevDir = null;
  for (let i = 1; i < inner.length - 1; i++) {
    const dy = inner[i + 1].y - inner[i - 1].y;
    if (Math.abs(dy) < INFLECTION_THRESHOLD) continue;
    const dir = dy > 0 ? -1 : +1;
    if (prevDir !== null && dir !== prevDir) {
      const pt   = inner[i];
      const type = dir === +1 ? 'valley' : 'peak';
      const takt = Math.min(T - 1, Math.max(0, Math.floor(pt.x * T)));
      inflections.push({ x: pt.x, y: pt.y, type, takt });
      prevDir = dir;
    } else if (prevDir === null) {
      prevDir = dir;
    }
  }
  return inflections;
}

export function detectTonic(processedSegs) {
  // Берём самую левую точку (первую ноту рисунка) как тонику
  let leftmostPoint = null;
  let leftmostX     = Infinity;
  for (const seg of processedSegs) {
    for (const pt of seg.points) {
      if (pt.x < leftmostX) {
        leftmostX     = pt.x;
        leftmostPoint = pt;
      }
    }
  }
  if (!leftmostPoint) return Math.round(freqToMidi(261.63)); // C4 fallback

  // Квантизуем к ближайшему целому полутону (точная нота, без дрейфа)
  return Math.round(freqToMidi(yNormToFreq(leftmostPoint.y)));
}

// ─── приватные хелперы ────────────────────────────────────────────────────────

function deduplicateByX(sortedPoints) {
  if (sortedPoints.length === 0) return [];
  const result = [];
  let bucket = [sortedPoints[0]];
  for (let i = 1; i < sortedPoints.length; i++) {
    if (Math.abs(sortedPoints[i].x - bucket[0].x) < 0.001) {
      bucket.push(sortedPoints[i]);
    } else {
      const avgY = bucket.reduce((s, p) => s + p.y, 0) / bucket.length;
      result.push({ x: bucket[0].x, y: avgY });
      bucket = [sortedPoints[i]];
    }
  }
  const avgY = bucket.reduce((s, p) => s + p.y, 0) / bucket.length;
  result.push({ x: bucket[0].x, y: avgY });
  return result;
}

function gaussianSmoothY(points, sigma) {
  if (points.length <= 2) return points;
  const kernel = gaussianKernel(sigma);
  const half   = Math.floor(kernel.length / 2);
  return points.map((pt, i) => {
    let weightedY = 0, totalW = 0;
    for (let k = 0; k < kernel.length; k++) {
      const idx = i + k - half;
      if (idx >= 0 && idx < points.length) {
        weightedY += points[idx].y * kernel[k];
        totalW    += kernel[k];
      }
    }
    return { x: pt.x, y: weightedY / totalW };
  });
}

function gaussianKernel(sigma) {
  const size = Math.max(3, Math.round(sigma * 3) * 2 + 1);
  const half = Math.floor(size / 2);
  const kernel = [];
  let sum = 0;
  for (let i = -half; i <= half; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(v);
    sum += v;
  }
  return kernel.map(v => v / sum);
}