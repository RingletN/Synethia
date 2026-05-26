// utils/imageToSegments.js
//
// Извлекает контуры из изображения и возвращает нормализованные сегменты
// для DrawingEngine.
//
// Вся тяжёлая обработка (Sobel, трассировка) выполняется в Web Worker,
// чтобы не блокировать главный поток и не убивать аудио-плеер.
//
// Принимает внешнюю палитру инструментов — должна совпадать с COLOR_TO_INSTRUMENT
// из constants.js движка мелодии.

/**
 * Палитра по умолчанию — полный спектр инструментов из constants.js.
 * Передай свою через options.palette чтобы переопределить.
 */
import { COLOR_TO_INSTRUMENT } from "../engines/MelodyEngine/constants";

/**
 * Основная функция. Принимает File/Blob, возвращает массив сегментов.
 *
 * @param {File} file
 * @param {Object} options
 * @param {number} options.threshold      - порог Собеля (0–255), по умолчанию 120
 * @param {number} options.maxWidth       - макс. ширина для обработки, по умолчанию 600
 * @param {number} options.minSegmentLen  - минимальное число точек в сегменте, по умолчанию 20
 * @param {number} options.maxSegments    - максимальное число сегментов на выходе, по умолчанию 200
 * @param {number} options.simplifyEps    - агрессивность упрощения Douglas-Peucker (0–1), по умолчанию 0.004
 * @param {string} options.color          - принудительный цвет всех сегментов (отключает palette-matching)
 * @param {string} options.instrument     - принудительный инструмент
 * @param {number} options.lineWidth      - толщина линий, по умолчанию 2
 * @param {Array}  options.palette        - [{ color, instrument }] — полный спектр инструментов
 * @returns {Promise<Array>} массив сегментов
 */
export const DEFAULT_PALETTE = Object.entries(COLOR_TO_INSTRUMENT).map(
  ([color, instrument]) => ({ color, instrument }),
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
  } = options;

  // 1. Декодируем изображение на главном потоке (Canvas API недоступен в Worker)
  const { rgba, w, h } = await decodeImage(file, maxWidth);

  // 2. Всю тяжёлую математику отдаём в Web Worker
  const segments = await runInWorker(
    {
      rgba: rgba.buffer, // transferable — не копируем, передаём владение
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
    },
    [rgba.buffer],
  );

  return segments;
}

// ─── Декодирование изображения (главный поток) ────────────────────────────────

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
    // Копируем в обычный Uint8Array чтобы передать как transferable
    return { rgba: new Uint8Array(rgba.buffer.slice(0)), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── Web Worker ───────────────────────────────────────────────────────────────

/**
 * Создаёт одноразовый Worker из Blob-URL со встроенным кодом обработки.
 * Не требует отдельного файла worker.js в сборке.
 */
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

/**
 * Весь код внутри этой функции выполняется в Worker.
 * Не использует ничего из внешнего скоупа.
 */
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
    } = e.data;

    const rgba = new Uint8Array(rgbaBuffer);

    // Разбираем палитру в RGB
    const parsedPalette = palette.map((entry) => ({
      ...entry,
      rgb: hexToRgb(entry.color),
    }));

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
      parsedPalette,
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
    // Два прохода box-blur 3×3 — достаточно для подавления шума
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
    return blur(blur(blur(gray))); // 3 прохода вместо 2 для сложных изображений
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

  /**
   * Douglas-Peucker упрощение полилинии.
   * eps — порог в нормализованных координатах.
   */
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
    // Максимальная длина одного штриха — ограничиваем чтобы не было гигантских змеек
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

        // Отсекаем короткие шумовые штрихи
        if (rawPoints.length < minSegmentLen) continue;

        // Упрощаем геометрию — меньше точек, плавнее линии
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
