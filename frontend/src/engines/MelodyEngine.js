// engines/MelodyEngine.js
// Преобразует сегменты рисунка в музыкальную мелодию.
// Алгоритм: X → время, Y → частота, цвет → инструмент.
//
// Этот класс — ЧИСТО алгоритмический, он не трогает Web Audio API.
// Всё воспроизведение делегировано useMelodyPlayer (Tone.js).

class MelodyEngine {
    constructor() {
        this.A4_FREQ  = 440;
        this.A4_MIDI  = 69;

        // Диапазон C3 — C6
        this.MIN_FREQ = 130.81;
        this.MAX_FREQ = 1046.50;

        this.SCALES = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
        };

        // Цвет кисти → тип осциллятора (должен совпадать с Tone.js OscillatorType)
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

    // ─────────────────────────────────────────────
    //  MIDI / частоты
    // ─────────────────────────────────────────────

    freqToMidi(freq) {
        return this.A4_MIDI + 12 * Math.log2(freq / this.A4_FREQ);
    }

    midiToFreq(midi) {
        return this.A4_FREQ * Math.pow(2, (midi - this.A4_MIDI) / 12);
    }

    /** Нормированная Y (0–1, 0 = верх) → частота в диапазоне C3–C6 */
    yNormToFreq(yNorm) {
        const t = 1 - yNorm; // верх = высокие частоты
        return this.MIN_FREQ * Math.pow(this.MAX_FREQ / this.MIN_FREQ, t);
    }

    quantizeToScale(freq, tonicMidi, scale) {
        const intervals   = this.SCALES[scale] || this.SCALES.major;
        const rawMidi     = Math.round(this.freqToMidi(freq));
        const tonicClass  = tonicMidi % 12;
        const relSemitone = ((rawMidi - tonicClass) % 12 + 12) % 12;

        let closest = intervals[0];
        let minDist = Infinity;
        for (const iv of intervals) {
            const d = Math.min(Math.abs(iv - relSemitone), 12 - Math.abs(iv - relSemitone));
            if (d < minDist) { minDist = d; closest = iv; }
        }

        const octave   = Math.floor((rawMidi - tonicClass) / 12);
        const quantMidi = tonicClass + octave * 12 + closest;
        return this.midiToFreq(quantMidi);
    }

    // ─────────────────────────────────────────────
    //  Определение тоники
    // ─────────────────────────────────────────────

    detectTonic(segments) {
        let leftmostPoint = null;
        let leftmostX     = Infinity;

        for (const seg of segments) {
            for (const pt of seg.points) {
                if (pt.x < leftmostX) { leftmostX = pt.x; leftmostPoint = pt; }
            }
        }

        if (!leftmostPoint) return Math.round(this.freqToMidi(261.63)); // C4
        return Math.round(this.freqToMidi(this.yNormToFreq(leftmostPoint.y)));
    }

    // ─────────────────────────────────────────────
    //  Построение нотной последовательности
    // ─────────────────────────────────────────────

    /**
     * Преобразует массив сегментов в массив нотных событий.
     *
     * @param {Array}  segments
     * @param {object} options  { bpm, duration, scale, smoothing }
     * @returns {{ events: Array<{time, freq, duration, instrument, volume}>, tonicMidi: number }}
     */
    buildNoteEvents(segments, options = {}) {
        const {
            bpm       = 80,
            duration  = 8,
            scale     = 'major',
            smoothing = 30,
        } = options;
    
        if (!segments?.length) return { events: [], tonicMidi: 60 };
    
        const tonicMidi    = this.detectTonic(segments);
        const beatDuration = 60 / bpm;
        const totalBeats   = Math.ceil(duration * bpm / 60);
        const maxPolyphony = 6;           // ← важный лимит
        const timeStep     = 0.125;       // 1/8 бита — хороший баланс
    
        // 1. Downsample все сегменты один раз
        const processedSegments = segments
            .filter(seg => seg.points?.length >= 3)
            .map(seg => ({
                ...seg,
                points: this.applySmoothing(seg.points, smoothing),
                instrument: this.COLOR_TO_INSTRUMENT[seg.color] || 'sine',
                volume: this.INSTRUMENT_VOLUME[this.COLOR_TO_INSTRUMENT[seg.color] || 'sine']
            }));
    
        const eventsMap = new Map(); // key = time.toFixed(3), value = array of notes
    
        for (const seg of processedSegments) {
            const { points, instrument, volume } = seg;
    
            // Разбиваем на временные слоты
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
    
                const startBeat = Math.floor(p1.x * totalBeats);
                const endBeat   = Math.floor(p2.x * totalBeats);
    
                for (let beat = startBeat; beat <= endBeat; beat++) {
                    const beatStartX = beat / totalBeats;
                    const beatEndX   = (beat + 1) / totalBeats;
    
                    // Находим пересечение отрезка с битом
                    if (p2.x <= beatStartX || p1.x >= beatEndX) continue;
    
                    const t = Math.max(beatStartX, p1.x);
                    const y = this._interpolateY(p1, p2, t);
    
                    const rawFreq = this.yNormToFreq(y);
                    const freq    = this.quantizeToScale(rawFreq, tonicMidi, scale);
    
                    const time = beat * beatDuration + (t - beatStartX) * beatDuration;
    
                    // Округляем время до ближайшего timeStep
                    const timeKey = (Math.round(time / timeStep) * timeStep).toFixed(3);
    
                    if (!eventsMap.has(timeKey)) eventsMap.set(timeKey, []);
                    
                    eventsMap.get(timeKey).push({
                        time: parseFloat(timeKey),
                        freq,
                        duration: timeStep * 0.9,
                        instrument,
                        volume,
                    });
                }
            }
        }
    
        // 2. Ограничиваем полифонию в каждом таймслоте
        const finalEvents = [];
    
        for (const [_, notes] of eventsMap) {
            if (notes.length === 0) continue;
    
            // Сортируем по "важности" (можно добавить приоритет по инструменту или громкости)
            notes.sort((a, b) => b.volume - a.volume);
    
            // Берём топ-N
            const selected = notes.slice(0, maxPolyphony);
    
            finalEvents.push(...selected);
        }
    
        finalEvents.sort((a, b) => a.time - b.time);
    
        return { 
            events: finalEvents, 
            tonicMidi 
        };
    }
    
    // Вспомогательный метод
    _interpolateY(p1, p2, x) {
        if (p1.x === p2.x) return p1.y;
        const t = (x - p1.x) / (p2.x - p1.x);
        return p1.y + t * (p2.y - p1.y);
    }

    // ─────────────────────────────────────────────
    //  Вспомогательные
    // ─────────────────────────────────────────────

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

    selectNotesPerBeat(bpm) {
        let options;
        if (bpm >= 120) {
            options = [{ n: 1, p: 0.65 }, { n: 2, p: 0.35 }];
        } else if (bpm >= 70) {
            options = [{ n: 1, p: 0.50 }, { n: 2, p: 0.32 }, { n: 3, p: 0.18 }];
        } else {
            options = [{ n: 1, p: 0.40 }, { n: 2, p: 0.30 }, { n: 3, p: 0.20 }, { n: 4, p: 0.10 }];
        }
        const r = Math.random();
        let cum = 0;
        for (const o of options) {
            cum += o.p;
            if (r <= cum) return o.n;
        }
        return 1;
    }
}

export default MelodyEngine;