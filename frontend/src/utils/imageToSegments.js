// utils/imageToSegments.js
// Извлекает контуры из изображения и возвращает массив нормализованных сегментов
// для DrawingEngine. Использует оператор Собеля для edge detection.
// Цвет каждого сегмента подбирается из палитры инструментов по среднему цвету пикселей.

/**
 * Цветовая палитра инструментов (должна совпадать с DrawingEngine.instrumentColors).
 * Можно переопределить через options.palette.
 */
const DEFAULT_PALETTE = [
  { color: "#00ffd1", instrument: "sine" },
  { color: "#ff3366", instrument: "square" },
  { color: "#ffcc00", instrument: "sawtooth" },
  { color: "#9900ff", instrument: "triangle" },
];

/**
 * Основная функция: принимает File/Blob, возвращает массив сегментов.
 * @param {File} file - загруженный файл изображения
 * @param {Object} options
 * @param {number} options.threshold   - порог яркости для контура (0–255), по умолчанию 60
 * @param {number} options.maxWidth    - максимальная ширина для обработки, по умолчанию 800
 * @param {string} options.color       - если задан, все сегменты будут этого цвета (отключает palette-matching)
 * @param {number} options.lineWidth   - толщина линий, по умолчанию 2
 * @param {string} options.instrument  - если задан, все сегменты будут этого инструмента
 * @param {Array}  options.palette     - массив { color, instrument } для подбора цвета
 * @returns {Promise<Array>} массив сегментов
 */
export async function imageToSegments(file, options = {}) {
  const {
    threshold = 60,
    maxWidth = 800,
    color = null, // null = использовать palette-matching
    lineWidth = 2,
    instrument = null, // null = определяется из палитры
    palette = DEFAULT_PALETTE,
  } = options;

  // Предварительно парсим палитру в RGB для быстрого сравнения
  const parsedPalette = palette.map((entry) => ({
    ...entry,
    rgb: hexToRgb(entry.color),
  }));

  // 1. Загружаем изображение
  const img = await loadImage(file);

  // 2. Масштабируем для обработки
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  // 3. Рисуем на offscreen canvas
  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const rgba = imageData.data; // Uint8ClampedArray, нужен для palette-matching

  const gray = toGrayscale(rgba, w, h);
  const blurred = gaussianBlur(gray, w, h);
  const edges = sobelEdges(blurred, w, h, threshold);

  // 4. Трассируем контуры в полилинии
  const usePaletteMatching = !color; // если color не задан явно — ищем по палитре
  const segments = traceContours(
    edges,
    rgba,
    w,
    h,
    color,
    lineWidth,
    instrument,
    usePaletteMatching,
    parsedPalette,
  );

  return segments;
}

// ---------- helpers ----------

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/** HEX → { r, g, b } */
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const int = parseInt(clean, 16);
  return {
    r: (int >> 16) & 0xff,
    g: (int >> 8) & 0xff,
    b: int & 0xff,
  };
}

/**
 * Находит ближайший цвет из палитры к заданному RGB.
 * Использует евклидово расстояние в RGB-пространстве.
 */
function closestPaletteEntry(r, g, b, palette) {
  let best = palette[0];
  let bestDist = Infinity;
  for (const entry of palette) {
    const dr = r - entry.rgb.r;
    const dg = g - entry.rgb.g;
    const db = b - entry.rgb.b;
    // Взвешенное расстояние (перцептивное приближение)
    const dist = 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best;
}

// RGBA → оттенки серого (Float32Array)
function toGrayscale(data, w, h) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] =
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return gray;
}

// Простое размытие 3×3 (box blur × 2 прохода) для шумоподавления
function gaussianBlur(gray, w, h) {
  const blur = (src) => {
    const dst = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        dst[idx] =
          (src[(y - 1) * w + (x - 1)] +
            src[(y - 1) * w + x] +
            src[(y - 1) * w + (x + 1)] +
            src[y * w + (x - 1)] +
            src[y * w + x] +
            src[y * w + (x + 1)] +
            src[(y + 1) * w + (x - 1)] +
            src[(y + 1) * w + x] +
            src[(y + 1) * w + (x + 1)]) /
          9;
      }
    }
    return dst;
  };
  return blur(blur(gray));
}

// Оператор Собеля: возвращает boolean-маску рёбер
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
 * Трассировка контуров с palette-matching.
 *
 * Для каждого сегмента собирается средний RGB по его пикселям,
 * затем находится ближайший цвет из палитры — этот цвет и инструмент
 * назначаются сегменту.
 *
 * @param {Uint8Array}  edges              - маска рёбер
 * @param {Uint8ClampedArray} rgba         - исходные пиксели изображения (RGBA)
 * @param {number}      w, h               - размеры
 * @param {string|null} forcedColor        - если задан, игнорирует palette
 * @param {number}      lineWidth
 * @param {string|null} forcedInstrument   - если задан, игнорирует palette
 * @param {boolean}     usePaletteMatching
 * @param {Array}       palette            - [{ color, instrument, rgb }]
 */
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

  const MIN_POINTS = 3;
  const MAX_SEGMENT_LENGTH = 300;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (!edges[idx] || visited[idx]) continue;

      const points = [{ x: x / w, y: y / h }];
      visited[idx] = 1;

      // Накапливаем средний цвет пикселей сегмента
      let sumR = rgba[idx * 4];
      let sumG = rgba[idx * 4 + 1];
      let sumB = rgba[idx * 4 + 2];
      let count = 1;

      let cx = x,
        cy = y;

      while (true) {
        let found = false;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx,
            ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nidx = ny * w + nx;
          if (!edges[nidx] || visited[nidx]) continue;

          visited[nidx] = 1;
          points.push({ x: nx / w, y: ny / h });

          sumR += rgba[nidx * 4];
          sumG += rgba[nidx * 4 + 1];
          sumB += rgba[nidx * 4 + 2];
          count++;

          cx = nx;
          cy = ny;
          found = true;
          break;
        }
        if (!found || points.length >= MAX_SEGMENT_LENGTH) break;
      }

      if (points.length < MIN_POINTS) continue;

      let segColor = forcedColor || "#00ffd1";
      let segInstrument = forcedInstrument || "sine";

      if (usePaletteMatching) {
        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;
        const entry = closestPaletteEntry(avgR, avgG, avgB, palette);
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
