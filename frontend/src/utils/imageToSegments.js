// utils/imageToSegments.js

import { COLOR_TO_INSTRUMENT } from "../engines/MelodyEngine/constants";

export const DEFAULT_PALETTE = Object.entries(COLOR_TO_INSTRUMENT).map(
  ([color, instrument]) => ({ color, instrument })
);

export async function imageToSegments(file, options = {}) {
  const {
    threshold = 100,
    maxWidth = 600,
    minSegmentLen = 20,
    maxSegments = 500,
    simplifyEps = 0.004,
    color = null,
    instrument = null,
    lineWidth = 5,
    palette = DEFAULT_PALETTE,
    // Новый параметр: максимальное число разных инструментов на выходе.
    // Алгоритм выберет только те цвета палитры, которые реально
    // присутствуют в картинке, и отбросит остальные.
    maxInstruments = 3,
  } = options;

  const { rgba, w, h } = await decodeImage(file, maxWidth);

  const segments = await runInWorker(
    {
      rgba: rgba.buffer,
      w,
      h,
      threshold,
      minSegmentLen,
      maxSegments,
      simplifyEps,
      color,
      instrument,
      lineWidth,
      palette,
      maxInstruments,
    },
    [rgba.buffer],
  );

  return segments;
}

async function decodeImage(file, maxWidth) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });

    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);

    const rgba = canvas.getContext("2d").getImageData(0, 0, w, h).data;
    return { rgba: new Uint8Array(rgba.buffer.slice(0)), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function runInWorker(payload, transferList) {
  return new Promise((resolve, reject) => {
    const workerCode = `(${workerFn.toString()})()`;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    worker.onerror = (e) => {
      reject(new Error(e.message));
      worker.terminate();
      URL.revokeObjectURL(url);
    };

    worker.postMessage(payload, transferList);
  });
}

function workerFn() {
  self.onmessage = function (e) {
    const {
      rgba: rgbaBuffer,
      w,
      h,
      threshold,
      minSegmentLen,
      maxSegments,
      simplifyEps,
      color,
      instrument,
      lineWidth,
      palette,
      maxInstruments,
    } = e.data;

    const rgba = new Uint8Array(rgbaBuffer);

    const parsedPalette = palette.map((entry) => ({
      ...entry,
      rgb: hexToRgb(entry.color),
    }));

    // Шаг 1: анализируем какие цвета палитры реально доминируют в картинке.
    // Сэмплируем пиксели и считаем "голоса" за каждый цвет палитры.
    // Затем оставляем только топ-N — это и будут активные инструменты.
    const activePalette = color
      ? parsedPalette
      : buildActivePalette(rgba, w, h, parsedPalette, maxInstruments);

    const gray = toGrayscale(rgba, w, h);
    const blurred = gaussianBlur(gray, w, h);
    const edges = sobelEdges(blurred, w, h, threshold);

    const segs = traceContours(
      edges,
      rgba,
      w,
      h,
      color,
      lineWidth,
      instrument,
      !color,
      activePalette, // маппим только на реальные цвета картинки
      minSegmentLen,
      maxSegments,
      simplifyEps,
    );

    self.postMessage(segs);
  };

  // ── helpers ──────────────────────────────────────────────────────────────────

  function hexToRgb(hex) {
    const c = parseInt(hex.replace("#", ""), 16);
    return { r: (c >> 16) & 0xff, g: (c >> 8) & 0xff, b: c & 0xff };
  }

  /**
   * Анализирует пиксели изображения и выбирает топ-N цветов палитры,
   * которые реально присутствуют в картинке.
   *
   * Логика:
   * 1. Сэмплируем каждый 4-й пиксель (быстро, не нужна полная точность)
   * 2. Для каждого пикселя находим ближайший цвет палитры
   * 3. Считаем "голоса" — сколько пикселей проголосовало за каждый цвет
   * 4. Оставляем топ-N по голосам
   *
   * Это решает проблему "зелёный/жёлтый на красной машинке":
   * если в картинке нет зелёных пикселей — зелёный не попадёт в топ.
   */
  function buildActivePalette(rgba, w, h, palette, maxInstruments) {
    const votes = new Array(palette.length).fill(0);

    // Сэмплируем каждый 4-й пиксель для скорости
    const step = 4;
    for (let i = 0; i < w * h; i += step) {
      const r = rgba[i * 4];
      const g = rgba[i * 4 + 1];
      const b = rgba[i * 4 + 2];
      const a = rgba[i * 4 + 3];

      // Пропускаем тёмные (фон) и прозрачные пиксели —
      // они не несут информации о цвете объекта
      if (a < 128) continue;
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      if (brightness < 30) continue; // почти чёрный фон

      // Находим ближайший цвет палитры и голосуем за него
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let j = 0; j < palette.length; j++) {
        const dr = r - palette[j].rgb.r;
        const dg = g - palette[j].rgb.g;
        const db = b - palette[j].rgb.b;
        const dist = 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }
      votes[bestIdx]++;
    }

    // Сортируем по голосам и берём топ-N
    const ranked = palette
      .map((entry, i) => ({ entry, votes: votes[i] }))
      .filter((x) => x.votes > 0) // только те, за кого вообще проголосовали
      .sort((a, b) => b.votes - a.votes)
      .slice(0, maxInstruments)
      .map((x) => x.entry);

    // Если ничего не нашли — возвращаем первый цвет палитры как дефолт
    return ranked.length > 0 ? ranked : [palette[0]];
  }

  function closestPaletteEntry(r, g, b, palette) {
    let best = palette[0],
      bestDist = Infinity;
    for (const entry of palette) {
      const dr = r - entry.rgb.r,
        dg = g - entry.rgb.g,
        db = b - entry.rgb.b;
      const dist = 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = entry;
      }
    }
    return best;
  }

  function toGrayscale(data, w, h) {
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] =
        0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    return gray;
  }

  function gaussianBlur(gray, w, h) {
    const blur = (src) => {
      const dst = new Float32Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          dst[i] =
            (src[(y - 1) * w + (x - 1)] +
              src[(y - 1) * w + x] +
              src[(y - 1) * w + (x + 1)] +
              src[y * w + (x - 1)] +
              src[i] +
              src[y * w + (x + 1)] +
              src[(y + 1) * w + (x - 1)] +
              src[(y + 1) * w + x] +
              src[(y + 1) * w + (x + 1)]) /
            9;
        }
      }
      return dst;
    };
    return blur(blur(blur(gray)));
  }

  function sobelEdges(gray, w, h, threshold) {
    const edges = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx =
          -gray[(y - 1) * w + (x - 1)] +
          gray[(y - 1) * w + (x + 1)] -
          2 * gray[y * w + (x - 1)] +
          2 * gray[y * w + (x + 1)] -
          gray[(y + 1) * w + (x - 1)] +
          gray[(y + 1) * w + (x + 1)];
        const gy =
          -gray[(y - 1) * w + (x - 1)] -
          2 * gray[(y - 1) * w + x] -
          gray[(y - 1) * w + (x + 1)] +
          gray[(y + 1) * w + (x - 1)] +
          2 * gray[(y + 1) * w + x] +
          gray[(y + 1) * w + (x + 1)];
        edges[y * w + x] = Math.sqrt(gx * gx + gy * gy) > threshold ? 1 : 0;
      }
    }
    return edges;
  }

  function simplify(points, eps) {
    if (points.length <= 2) return points;
    let maxDist = 0,
      maxIdx = 0;
    const first = points[0],
      last = points[points.length - 1];
    const dx = last.x - first.x,
      dy = last.y - first.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let i = 1; i < points.length - 1; i++) {
      const px = points[i].x - first.x,
        py = points[i].y - first.y;
      const dist = Math.abs(px * dy - py * dx) / len;
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }
    if (maxDist > eps) {
      const left = simplify(points.slice(0, maxIdx + 1), eps);
      const right = simplify(points.slice(maxIdx), eps);
      return [...left.slice(0, -1), ...right];
    }
    return [first, last];
  }

  function traceContours(
    edges,
    rgba,
    w,
    h,
    forcedColor,
    lineWidth,
    forcedInstrument,
    usePaletteMatching,
    palette,
    minSegmentLen,
    maxSegments,
    simplifyEps,
  ) {
    const visited = new Uint8Array(w * h);
    const segments = [];

    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
    const MAX_STROKE = 400;

    for (let y = 1; y < h - 1; y++) {
      if (segments.length >= maxSegments) break;
      for (let x = 1; x < w - 1; x++) {
        if (segments.length >= maxSegments) break;
        const idx = y * w + x;
        if (!edges[idx] || visited[idx]) continue;

        const rawPoints = [{ x: x / w, y: y / h }];
        visited[idx] = 1;

        let sumR = rgba[idx * 4],
          sumG = rgba[idx * 4 + 1],
          sumB = rgba[idx * 4 + 2];
        let count = 1,
          cx = x,
          cy = y;

        while (rawPoints.length < MAX_STROKE) {
          let found = false;
          for (const [dx2, dy2] of dirs) {
            const nx = cx + dx2,
              ny = cy + dy2;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const nidx = ny * w + nx;
            if (!edges[nidx] || visited[nidx]) continue;
            visited[nidx] = 1;
            rawPoints.push({ x: nx / w, y: ny / h });
            sumR += rgba[nidx * 4];
            sumG += rgba[nidx * 4 + 1];
            sumB += rgba[nidx * 4 + 2];
            count++;
            cx = nx;
            cy = ny;
            found = true;
            break;
          }
          if (!found) break;
        }

        if (rawPoints.length < minSegmentLen) continue;

        const points = simplify(rawPoints, simplifyEps);
        if (points.length < 2) continue;

        let segColor = forcedColor || "#00ffd1";
        let segInstrument = forcedInstrument || "piano";

        if (usePaletteMatching) {
          const entry = closestPaletteEntry(
            sumR / count,
            sumG / count,
            sumB / count,
            palette,
          );
          segColor = entry.color;
          segInstrument = entry.instrument;
        }

        segments.push({
          points,
          color: segColor,
          lineWidth,
          isErase: false,
          instrument: segInstrument,
        });
      }
    }

    return segments;
  }
}