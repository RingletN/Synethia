// engines/MelodyEngine.js
//
// Алгоритм строго по статье Сафиуллиной А.М.:
//   1. Тоника — самая левая точка рисунка
//   2. T = BPM * t_max / (60 * 4)  — число тактов
//   3. В каждом такте k: средняя частота по всем попавшим точкам → квантование в тональность
//   4. Одновременные точки одного цвета → интервал / аккорд
//      Одновременные точки разных цветов → полифония инструментов
//   5. Направление линии сохраняется (восход → повышение, нисход → понижение)

class MelodyEngine {
    constructor() {
        this.A4_FREQ = 440;
        this.A4_MIDI = 69;

        // Диапазон C3–C6 (статья, стр. 4)
        this.MIN_FREQ = 130.81;   // C3
        this.MAX_FREQ = 1046.50;  // C6

        // Лады (статья, стр. 5–6)
        this.SCALES = {
            major: [0, 2, 4, 5, 7, 9, 11],   // I = {0,2,4,5,7,9,11}
            minor: [0, 2, 3, 5, 7, 8, 10],   // I = {0,2,3,5,7,8,10}
        };

        // Цвет кисти → тип осциллятора
        this.COLOR_TO_INSTRUMENT = {
            '#00ffd1': 'sine',
            '#ff3366': 'square',
            '#ffcc00': 'sawtooth',
            '#9900ff': 'triangle',
        };

        // Громкость 0..1 по инструменту
        this.INSTRUMENT_VOLUME = {
            sine:     0.28,
            square:   0.12,
            sawtooth: 0.14,
            triangle: 0.22,
        };
    }

    // ─── MIDI / частоты (формула 1 из статьи) ───────────────────────────────

    /** Произвольная частота → номер MIDI-ноты (формула 1) */
    freqToMidi(freq) {
        return this.A4_MIDI + 12 * Math.log2(freq / this.A4_FREQ);
    }

    /** MIDI-номер → частота */
    midiToFreq(midi) {
        return this.A4_FREQ * Math.pow(2, (midi - this.A4_MIDI) / 12);
    }

    /**
     * Нормированная Y (0–1, 0 = верх холста) → частота в диапазоне C3–C6.
     * Верх холста = высокие частоты, низ = низкие (статья, рис. 1).
     */
    yNormToFreq(yNorm) {
        const t = 1 - yNorm;
        return this.MIN_FREQ * Math.pow(this.MAX_FREQ / this.MIN_FREQ, t);
    }

    /**
     * Квантование частоты в ближайшую ноту тональности (формула 2).
     * S = { n_tonic + i | i ∈ I }
     */
    quantizeToScale(freq, tonicMidi, scale) {
        const intervals  = this.SCALES[scale] || this.SCALES.major;
        const rawMidi    = Math.round(this.freqToMidi(freq));
        const tonicClass = ((tonicMidi % 12) + 12) % 12;
        const rel        = ((rawMidi - tonicClass) % 12 + 12) % 12;

        let closest = intervals[0];
        let minDist = Infinity;
        for (const iv of intervals) {
            const d = Math.min(Math.abs(iv - rel), 12 - Math.abs(iv - rel));
            if (d < minDist) { minDist = d; closest = iv; }
        }

        const octave    = Math.floor((rawMidi - tonicClass) / 12);
        const quantMidi = tonicClass + octave * 12 + closest;
        return this.midiToFreq(quantMidi);
    }

    // ─── Определение тоники (стр. 4) ────────────────────────────────────────

    /** Самая левая точка рисунка → тоника */
    detectTonic(segments) {
        let leftmostPoint = null;
        let leftmostX     = Infinity;
        for (const seg of segments) {
            for (const pt of seg.points) {
                if (pt.x < leftmostX) { leftmostX = pt.x; leftmostPoint = pt; }
            }
        }
        if (!leftmostPoint) return Math.round(this.freqToMidi(261.63)); // C4 по умолчанию
        return Math.round(this.freqToMidi(this.yNormToFreq(leftmostPoint.y)));
    }

    // ─── Основной метод генерации (стр. 6–8) ────────────────────────────────

    /**
     * Преобразует сегменты рисунка в нотные события.
     *
     * Алгоритм по статье:
     *   T = BPM * t_max / (60 * 4)  — число тактов
     *   Для каждого такта k:
     *     - собираем все точки сегментов, чья X попадает в [k/T, (k+1)/T)
     *     - вычисляем среднюю частоту f̄_k = mean(f(y_i))
     *     - квантуем → опорная нота такта
     *     - группируем по инструменту: одинаковый цвет → интервал/аккорд,
     *       разные цвета → полифония
     *
     * @param {Array}  segments
     * @param {object} options  { bpm, duration, scale, smoothing, notesPerBeat }
     * @returns {{ events: Array<{time, freq, duration, instrument, volume}>, tonicMidi }}
     */
    buildNoteEvents(segments, options = {}) {
        const {
            bpm       = 80,
            duration  = 8,       // t_max в секундах
            scale     = 'major',
            smoothing = 30,
            notesPerBeat = 1,    // сколько нот на такт (ритмический рисунок)
        } = options;

        if (!segments?.length) return { events: [], tonicMidi: 60 };

        // Сглаживание и разметка инструментов
        const processedSegments = segments
            .filter(seg => seg.points?.length >= 2)
            .map(seg => ({
                ...seg,
                points:     this.applySmoothing(seg.points, smoothing),
                instrument: this.COLOR_TO_INSTRUMENT[seg.color] || 'sine',
                volume:     this.INSTRUMENT_VOLUME[this.COLOR_TO_INSTRUMENT[seg.color] || 'sine'],
            }));

        const tonicMidi = this.detectTonic(processedSegments);

        // Число тактов: T = BPM * t_max / (60 * 4)  (формула 3)
        const T = Math.max(1, Math.ceil(bpm * duration / (60 * 4)));
        const beatDuration = duration / T;       // длительность такта в секундах

        // Для каждого такта k собираем точки по инструментам
        // taktPoints[k] = Map<instrument, y[]>
        const taktPoints = [];
        for (let i = 0; i < T; i++) taktPoints.push(new Map());

        for (const seg of processedSegments) {
            const { points, instrument } = seg;
            for (const pt of points) {
                // Защита: x и y должны быть числами в диапазоне [0, 1]
                const xNorm = typeof pt.x === 'number' && isFinite(pt.x) ? pt.x : 0;
                const yNorm = typeof pt.y === 'number' && isFinite(pt.y) ? pt.y : 0.5;
                const k = Math.min(T - 1, Math.max(0, Math.floor(xNorm * T)));
                const taktMap = taktPoints[k];
                if (!taktMap) continue; // дополнительная защита
                if (!taktMap.has(instrument)) taktMap.set(instrument, []);
                taktMap.get(instrument).push(yNorm);
            }
        }

        const events = [];

        for (let k = 0; k < T; k++) {
            const taktMap = taktPoints[k];
            if (taktMap.size === 0) continue;

            // Время начала такта
            const taktStartSec = k * beatDuration;

            // Для каждого инструмента, присутствующего в такте
            for (const [instrument, yValues] of taktMap) {
                if (yValues.length === 0) continue;

                const volume = this.INSTRUMENT_VOLUME[instrument] || 0.2;

                if (yValues.length === 1) {
                    // Одна точка → одна нота
                    const rawFreq = this.yNormToFreq(yValues[0]);
                    const freq    = this.quantizeToScale(rawFreq, tonicMidi, scale);
                    events.push(this._makeEvent(taktStartSec, beatDuration, freq, instrument, volume, notesPerBeat));
                } else {
                    // Несколько точек одного цвета → интервал или аккорд (стр. 8)
                    // Берём среднюю Y как опорную ноту, плюс крайние для интервала
                    const sorted = [...yValues].sort((a, b) => a - b);

                    // Средняя частота (формула f̄_k)
                    const avgY   = yValues.reduce((s, y) => s + y, 0) / yValues.length;
                    const avgFreq = this.quantizeToScale(this.yNormToFreq(avgY), tonicMidi, scale);

                    // Для аккорда берём до 3 уникальных высот (минимальная, средняя, максимальная)
                    const chordYs = yValues.length >= 3
                        ? [sorted[0], avgY, sorted[sorted.length - 1]]
                        : [sorted[0], sorted[sorted.length - 1]];

                    const uniqueFreqs = new Set();
                    for (const y of chordYs) {
                        const f = this.quantizeToScale(this.yNormToFreq(y), tonicMidi, scale);
                        uniqueFreqs.add(f);
                    }

                    for (const freq of uniqueFreqs) {
                        events.push(this._makeEvent(taktStartSec, beatDuration, freq, instrument, volume * 0.75, notesPerBeat));
                    }
                }
            }
        }

        // Сортируем по времени
        events.sort((a, b) => a.time - b.time);

        return { events, tonicMidi };
    }

    /**
     * Создаёт одно или несколько нотных событий для такта
     * в зависимости от notesPerBeat (ритмический рисунок внутри такта).
     */
    _makeEvent(taktStartSec, beatDuration, freq, instrument, volume, notesPerBeat) {
        // Добавляем случайность для вариативности (стр. 7)
        const jitter = (Math.random() - 0.5) * 0.02;
        return {
            time:       Math.max(0, taktStartSec + jitter),
            freq,
            duration:   beatDuration * (0.8 / notesPerBeat),
            instrument,
            volume,
        };
    }

    // ─── Вспомогательные ─────────────────────────────────────────────────────

    /** Сглаживание точек (экспоненциальное скользящее среднее по Y) */
    applySmoothing(points, smoothingPercent) {
        if (points.length <= 1 || smoothingPercent === 0) return points;
        const factor = smoothingPercent / 100;
        const result = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const prev = result[result.length - 1];
            result.push({
                x: points[i].x,
                y: prev.y * factor + points[i].y * (1 - factor),
            });
        }
        return result;
    }

    /**
     * Вспомогательный: определяет направление линии в сегменте
     * (восходящая / нисходящая / горизонтальная).
     * Используется для сохранения «тенденции рисунка» (стр. 8).
     */
    getSegmentDirection(segment) {
        const pts = segment.points;
        if (pts.length < 2) return 0;
        const dy = pts[pts.length - 1].y - pts[0].y;
        if (Math.abs(dy) < 0.05) return 0;   // горизонталь
        return dy < 0 ? 1 : -1;              // y убывает = нота растёт (верх = высокие частоты)
    }

    /**
     * Число нот на такт в зависимости от BPM (ритмический рисунок, стр. 7).
     * Элемент случайности встроен.
     */
    selectNotesPerBeat(bpm) {
        let options;
        if (bpm >= 120)     options = [{ n: 1, p: 0.65 }, { n: 2, p: 0.35 }];
        else if (bpm >= 70) options = [{ n: 1, p: 0.50 }, { n: 2, p: 0.32 }, { n: 3, p: 0.18 }];
        else                options = [{ n: 1, p: 0.40 }, { n: 2, p: 0.30 }, { n: 3, p: 0.20 }, { n: 4, p: 0.10 }];
        const r = Math.random();
        let cum = 0;
        for (const o of options) { cum += o.p; if (r <= cum) return o.n; }
        return 1;
    }
}

export default MelodyEngine;