// engines/MelodyEngine.js
// Преобразует сегменты рисунка в музыкальную мелодию.
// Алгоритм основан на статье: X → время, Y → частота, цвет → инструмент.

class MelodyEngine {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.scheduledSources = []; // все запланированные осцилляторы
        this.stopCallbacks = [];    // колбэки для остановки

        // Частота A4 и её MIDI-номер (стандарт)
        this.A4_FREQ = 440;
        this.A4_MIDI = 69;

        // Диапазон: C3 (130.81 Гц) — C6 (1046.50 Гц)
        this.MIN_FREQ = 130.81;
        this.MAX_FREQ = 1046.50;

        // Интервалы ладов (полутоны от тоники)
        this.SCALES = {
            major:  [0, 2, 4, 5, 7, 9, 11],
            minor:  [0, 2, 3, 5, 7, 8, 10],
        };

        // Цвет кисти → тип осциллятора
        this.COLOR_TO_INSTRUMENT = {
            '#00ffd1': 'sine',
            '#ff3366': 'square',
            '#ffcc00': 'sawtooth',
            '#9900ff': 'triangle',
        };

        // Громкость по инструменту
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

    /** Частота → MIDI-номер (формула 1 из статьи) */
    freqToMidi(freq) {
        return this.A4_MIDI + 12 * Math.log2(freq / this.A4_FREQ);
    }

    /** MIDI-номер → частота */
    midiToFreq(midi) {
        return this.A4_FREQ * Math.pow(2, (midi - this.A4_MIDI) / 12);
    }

    /** Нормированная Y (0–1, 0 = верх) → частота в диапазоне C3–C6 */
    yNormToFreq(yNorm) {
        // Верх холста = высокие частоты, низ = низкие
        const t = 1 - yNorm;
        return this.MIN_FREQ * Math.pow(this.MAX_FREQ / this.MIN_FREQ, t);
    }

    /**
     * Квантизует частоту в ближайшую ноту заданной тональности.
     * @param {number} freq  - произвольная частота
     * @param {number} tonicMidi - MIDI-номер тоники
     * @param {'major'|'minor'} scale
     * @returns {number} частота квантизованной ноты
     */
    quantizeToScale(freq, tonicMidi, scale) {
        const intervals = this.SCALES[scale] || this.SCALES.major;
        const rawMidi = Math.round(this.freqToMidi(freq));

        // Смещение от тоники (по модулю 12)
        const tonicClass = tonicMidi % 12;
        const relSemitone = ((rawMidi - tonicClass) % 12 + 12) % 12;

        // Ближайший интервал лада
        let closest = intervals[0];
        let minDist = Infinity;
        for (const iv of intervals) {
            const d = Math.abs(iv - relSemitone);
            const dWrapped = Math.min(d, 12 - d);
            if (dWrapped < minDist) {
                minDist = dWrapped;
                closest = iv;
            }
        }

        const octave = Math.floor((rawMidi - tonicClass) / 12);
        const quantMidi = tonicClass + octave * 12 + closest;
        return this.midiToFreq(quantMidi);
    }

    // ─────────────────────────────────────────────
    //  Определение тоники
    // ─────────────────────────────────────────────

    /**
     * Находит тонику: самая левая точка всех сегментов → её Y → MIDI.
     * @param {Array} segments
     * @returns {number} tonicMidi
     */
    detectTonic(segments) {
        let leftmostPoint = null;
        let leftmostX = Infinity;

        for (const seg of segments) {
            for (const pt of seg.points) {
                if (pt.x < leftmostX) {
                    leftmostX = pt.x;
                    leftmostPoint = pt;
                }
            }
        }

        if (!leftmostPoint) return this.freqToMidi(261.63); // C4 по умолчанию

        const freq = this.yNormToFreq(leftmostPoint.y);
        return Math.round(this.freqToMidi(freq));
    }

    // ─────────────────────────────────────────────
    //  Построение нотной последовательности
    // ─────────────────────────────────────────────

    /**
     * Преобразует массив сегментов в массив нотных событий.
     *
     * @param {Array}  segments   - сегменты из DrawingEngine
     * @param {object} options
     *   @param {number}          options.bpm       - темп (по умолчанию 80)
     *   @param {number}          options.duration  - длительность (сек, по умолчанию 8)
     *   @param {'major'|'minor'} options.scale     - лад
     *   @param {number}          options.smoothing - сглаживание 0–100
     *
     * @returns {{ events: Array, tonicMidi: number }}
     *   events: [{ time, freq, duration, instrument, volume }]
     */
    buildNoteEvents(segments, options = {}) {
        const {
            bpm      = 80,
            duration = 8,
            scale    = 'major',
            smoothing = 30,
        } = options;

        if (!segments || segments.length === 0) return { events: [], tonicMidi: 60 };

        const tonicMidi = this.detectTonic(segments);

        // Число тактов (формула 3 из статьи: T = BPM * t_max / (60 * 4))
        const beatDuration = 60 / bpm;          // длительность одного бита (сек)
        const totalBeats   = Math.ceil(duration * bpm / 60);

        const events = [];

        for (const seg of segments) {
            if (!seg.points || seg.points.length < 2) continue;

            const instrument = this.COLOR_TO_INSTRUMENT[seg.color] || 'sine';
            const volume     = this.INSTRUMENT_VOLUME[instrument];
            const smoothed   = this.applySmoothing(seg.points, smoothing);

            for (let beat = 0; beat < totalBeats; beat++) {
                const beatStartX = beat / totalBeats;
                const beatEndX   = (beat + 1) / totalBeats;

                // Точки, попавшие в этот такт
                const pts = smoothed.filter(p => p.x >= beatStartX && p.x < beatEndX);
                if (pts.length === 0) continue;

                // Средняя Y → частота → квантизация (формула среднего из статьи)
                const avgY   = pts.reduce((s, p) => s + p.y, 0) / pts.length;
                const rawFreq = this.yNormToFreq(avgY);
                const freq   = this.quantizeToScale(rawFreq, tonicMidi, scale);

                // Количество нот в такте — зависит от BPM (элемент случайности)
                const notesPerBeat = this.selectNotesPerBeat(bpm);
                const noteDur      = beatDuration / notesPerBeat;

                for (let i = 0; i < notesPerBeat; i++) {
                    events.push({
                        time:       beat * beatDuration + i * noteDur,
                        freq,
                        duration:   noteDur * 0.85, // небольшой зазор между нотами
                        instrument,
                        volume,
                    });
                }
            }
        }

        // Сортируем по времени
        events.sort((a, b) => a.time - b.time);
        return { events, tonicMidi };
    }

    // ─────────────────────────────────────────────
    //  Вспомогательные
    // ─────────────────────────────────────────────

    /** Сглаживание точек (экспоненциальное скользящее среднее) */
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

    /** Выбирает количество нот на такт с учётом вероятностей и BPM */
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

    // ─────────────────────────────────────────────
    //  Web Audio воспроизведение
    // ─────────────────────────────────────────────

    _initCtx() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    }

    /** Инициализирует простой ревербератор (цепочка задержек) */
    _initReverb() {
        if (this._reverbGain) return;
        const ctx = this.audioContext;

        this._reverbGain = ctx.createGain();
        this._reverbGain.gain.value = 0.35;

        const delay1 = ctx.createDelay(); delay1.delayTime.value = 0.08;
        const delay2 = ctx.createDelay(); delay2.delayTime.value = 0.18;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 900;
        const fb = ctx.createGain(); fb.gain.value = 0.35;

        delay1.connect(filter);
        filter.connect(delay2);
        delay2.connect(fb);
        fb.connect(delay1);
        delay2.connect(this._reverbGain);
        this._reverbGain.connect(ctx.destination);
    }

    /**
     * Воспроизводит нотные события.
     * @param {Array}    events           - результат buildNoteEvents().events
     * @param {number}   totalDuration    - полная длительность (сек)
     * @param {Function} onNotePlay       - колбэк при проигрывании каждой ноты (опционально)
     * @param {Function} onEnd            - колбэк по окончании
     */
    async play(events, totalDuration, onNotePlay, onEnd) {
        if (this.isPlaying) {
            this.stop();
            return;
        }
        if (!events || events.length === 0) return;

        const ctx = this._initCtx();
        if (ctx.state === 'suspended') await ctx.resume();
        this._initReverb();

        this.isPlaying = true;
        this.scheduledSources = [];

        const startTime = ctx.currentTime + 0.05; // небольшой буфер

        for (const ev of events) {
            const t       = startTime + ev.time;
            const dur     = ev.duration;
            const vol     = ev.volume;
            const osc     = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = ev.instrument;
            osc.frequency.value = ev.freq;

            // Огибающая: attack → sustain → release
            gainNode.gain.setValueAtTime(0, t);
            gainNode.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.2));
            gainNode.gain.setValueAtTime(vol, t + dur * 0.65);
            gainNode.gain.linearRampToValueAtTime(0, t + dur);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);        // прямой сигнал
            if (this._reverbGain) {
                gainNode.connect(this._reverbDelay1 || this._reverbGain); // реверб
            }

            osc.start(t);
            osc.stop(t + dur + 0.01);
            this.scheduledSources.push(osc);

            // Колбэк с задержкой через setTimeout (не блокирует)
            if (typeof onNotePlay === 'function') {
                const delay = ev.time * 1000;
                const timerId = setTimeout(() => {
                    if (this.isPlaying) onNotePlay(ev);
                }, delay);
                this.stopCallbacks.push(() => clearTimeout(timerId));
            }
        }

        // Ждём конца
        const endTimer = setTimeout(() => {
            this.isPlaying = false;
            this.scheduledSources = [];
            if (typeof onEnd === 'function') onEnd();
        }, (totalDuration + 0.5) * 1000);
        this.stopCallbacks.push(() => clearTimeout(endTimer));
    }

    /** Останавливает воспроизведение */
    stop() {
        this.scheduledSources.forEach(osc => {
            try { osc.stop(); } catch (_) {}
        });
        this.scheduledSources = [];
        this.stopCallbacks.forEach(cb => cb());
        this.stopCallbacks = [];
        this.isPlaying = false;
    }

    getIsPlaying() { return this.isPlaying; }
}

export default MelodyEngine;