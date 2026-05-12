// utils/imageToSegments.js
// Извлекает контуры из изображения и возвращает массив нормализованных сегментов
// для DrawingEngine. Использует оператор Собеля для edge detection.

/**
 * Основная функция: принимает File/Blob, возвращает массив сегментов.
 * @param {File} file - загруженный файл изображения
 * @param {Object} options
 * @param {number} options.threshold - порог яркости для контура (0–255), по умолчанию 30
 * @param {number} options.maxWidth - максимальная ширина для обработки (для скорости), по умолчанию 800
 * @param {string} options.color - цвет линий контура, по умолчанию '#00ffd1'
 * @param {number} options.lineWidth - толщина линий, по умолчанию 2
 * @param {string} options.instrument - инструмент, по умолчанию 'sine'
 * @returns {Promise<Array>} массив сегментов
 */
export async function imageToSegments(file, options = {}) {
    const {
        threshold = 60,
        maxWidth = 800,
        color = '#00ffd1',
        lineWidth = 2,
        instrument = 'sine',
    } = options;

    // 1. Загружаем изображение
    const img = await loadImage(file);

    // 2. Масштабируем для обработки
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    // 3. Рисуем на offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const gray = toGrayscale(imageData.data, w, h);
    const blurred = gaussianBlur(gray, w, h);
    const edges = sobelEdges(blurred, w, h, threshold);

    // 4. Трассируем контуры в полилинии
    const segments = traceContours(edges, w, h, color, lineWidth, instrument);

    return segments;
}

// ---------- helpers ----------

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = reject;
        img.src = url;
    });
}

// RGBA → оттенки серого (Float32Array)
function toGrayscale(data, w, h) {
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
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
                dst[idx] = (
                    src[(y-1)*w+(x-1)] + src[(y-1)*w+x] + src[(y-1)*w+(x+1)] +
                    src[y*w+(x-1)]     + src[y*w+x]     + src[y*w+(x+1)] +
                    src[(y+1)*w+(x-1)] + src[(y+1)*w+x] + src[(y+1)*w+(x+1)]
                ) / 9;
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
                -gray[(y-1)*w+(x-1)] + gray[(y-1)*w+(x+1)]
                -2*gray[y*w+(x-1)]   + 2*gray[y*w+(x+1)]
                -gray[(y+1)*w+(x-1)] + gray[(y+1)*w+(x+1)];

            const gy =
                -gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)]
                +gray[(y+1)*w+(x-1)] + 2*gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)];

            const mag = Math.sqrt(gx*gx + gy*gy);
            edges[y * w + x] = mag > threshold ? 1 : 0;
        }
    }
    return edges;
}

/**
 * Трассировка контуров: для каждого активного пикселя ищем следующий
 * соседний активный пиксель и продолжаем линию. Выбранные пиксели помечаем как посещённые.
 * Возвращает массив сегментов с нормализованными координатами (0–1).
 */
function traceContours(edges, w, h, color, lineWidth, instrument) {
    const visited = new Uint8Array(w * h);
    const segments = [];
    // 8-связность: порядок обхода соседей
    const dirs = [
        [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    const MIN_POINTS = 3; // минимальная длина сегмента
    const MAX_SEGMENT_LENGTH = 300; // разбиваем очень длинные полилинии

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            if (!edges[idx] || visited[idx]) continue;

            // Начинаем трассировку
            const points = [{ x: x / w, y: y / h }];
            visited[idx] = 1;

            let cx = x, cy = y;

            while (true) {
                let found = false;
                for (const [dx, dy] of dirs) {
                    const nx = cx + dx, ny = cy + dy;
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    const nidx = ny * w + nx;
                    if (!edges[nidx] || visited[nidx]) continue;

                    visited[nidx] = 1;
                    points.push({ x: nx / w, y: ny / h });
                    cx = nx; cy = ny;
                    found = true;
                    break;
                }
                if (!found || points.length >= MAX_SEGMENT_LENGTH) break;
            }

            if (points.length >= MIN_POINTS) {
                segments.push({
                    points,
                    color,
                    lineWidth,
                    isErase: false,
                    instrument,
                });
            }
        }
    }

    return segments;
}