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
    this.MIN_FREQ = 130.81; // C3
    this.MAX_FREQ = 1046.5; // C6

    // Лады (статья, стр. 5–6)
    this.SCALES = {
      major: [0, 2, 4, 5, 7, 9, 11],
      minor: [0, 2, 3, 5, 7, 8, 10],
    };

    // Цвет кисти → ключ инструмента (совпадает с useMelodyPlayer и ToolsPanel)
    this.COLOR_TO_INSTRUMENT = {
      "#00ffd1": "piano",
      "#ff3366": "guitar",
      "#ffcc00": "flute",
      "#9900ff": "strings",
      "#ff6b35": "clarinet",
      "#00b4d8": "saxophone",
      "#f72585": "guitar-electric",
      "#7bed9f": "cello",
      "#ffd60a": "xylophone",
      "#a855f7": "harp",
    };

    // Громкость 0..1 по инструменту
    this.INSTRUMENT_VOLUME = {
      piano: 0.28,
      guitar: 0.18,
      flute: 0.22,
      strings: 0.22,
      clarinet: 0.24,
      saxophone: 0.2,
      "guitar-electric": 0.16,
      cello: 0.24,
      xylophone: 0.3,
      harp: 0.26,
    };
  }

  // ─── MIDI / частоты ──────────────────────────────────────────────────────

  freqToMidi(freq) {
    return this.A4_MIDI + 12 * Math.log2(freq / this.A4_FREQ);
  }

  midiToFreq(midi) {
    return this.A4_FREQ * Math.pow(2, (midi - this.A4_MIDI) / 12);
  }

  yNormToFreq(yNorm) {
    const t = 1 - yNorm;
    return this.MIN_FREQ * Math.pow(this.MAX_FREQ / this.MIN_FREQ, t);
  }

  quantizeToScale(freq, tonicMidi, scale) {
    const intervals = this.SCALES[scale] || this.SCALES.major;
    const rawMidi = Math.round(this.freqToMidi(freq));
    const tonicClass = ((tonicMidi % 12) + 12) % 12;
    const rel = (((rawMidi - tonicClass) % 12) + 12) % 12;

    let closest = intervals[0];
    let minDist = Infinity;
    for (const iv of intervals) {
      const d = Math.min(Math.abs(iv - rel), 12 - Math.abs(iv - rel));
      if (d < minDist) {
        minDist = d;
        closest = iv;
      }
    }

    const octave = Math.floor((rawMidi - tonicClass) / 12);
    const quantMidi = tonicClass + octave * 12 + closest;
    return this.midiToFreq(quantMidi);
  }

  // ─── Определение тоники ──────────────────────────────────────────────────

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
    if (!leftmostPoint) return Math.round(this.freqToMidi(261.63));
    return Math.round(this.freqToMidi(this.yNormToFreq(leftmostPoint.y)));
  }

  // ─── Основной метод генерации ────────────────────────────────────────────

  buildNoteEvents(segments, options = {}) {
    const {
      bpm = 80,
      duration = 8,
      scale = "major",
      smoothing = 30,
      notesPerBeat = 1,
    } = options;

    if (!segments?.length) return { events: [], tonicMidi: 60 };

    const processedSegments = segments
      .filter((seg) => seg.points?.length >= 2)
      .map((seg) => {
        const instrument = this.COLOR_TO_INSTRUMENT[seg.color] || "piano";
        return {
          ...seg,
          points: this.applySmoothing(seg.points, smoothing),
          instrument,
          volume: this.INSTRUMENT_VOLUME[instrument] || 0.22,
        };
      });

    const tonicMidi = this.detectTonic(processedSegments);

    const T = Math.max(1, Math.ceil((bpm * duration) / (60 * 4)));
    const beatDuration = duration / T;

    const taktPoints = [];
    for (let i = 0; i < T; i++) taktPoints.push(new Map());

    for (const seg of processedSegments) {
      const { points, instrument } = seg;
      for (const pt of points) {
        const xNorm = typeof pt.x === "number" && isFinite(pt.x) ? pt.x : 0;
        const yNorm = typeof pt.y === "number" && isFinite(pt.y) ? pt.y : 0.5;
        const k = Math.min(T - 1, Math.max(0, Math.floor(xNorm * T)));
        const taktMap = taktPoints[k];
        if (!taktMap) continue;
        if (!taktMap.has(instrument)) taktMap.set(instrument, []);
        taktMap.get(instrument).push(yNorm);
      }
    }

    const events = [];

    for (let k = 0; k < T; k++) {
      const taktMap = taktPoints[k];
      if (taktMap.size === 0) continue;

      const taktStartSec = k * beatDuration;

      for (const [instrument, yValues] of taktMap) {
        if (yValues.length === 0) continue;

        const volume = this.INSTRUMENT_VOLUME[instrument] || 0.2;

        if (yValues.length === 1) {
          const rawFreq = this.yNormToFreq(yValues[0]);
          const freq = this.quantizeToScale(rawFreq, tonicMidi, scale);
          events.push(
            this._makeEvent(
              taktStartSec,
              beatDuration,
              freq,
              instrument,
              volume,
              notesPerBeat,
            ),
          );
        } else {
          const sorted = [...yValues].sort((a, b) => a - b);
          const avgY = yValues.reduce((s, y) => s + y, 0) / yValues.length;

          const chordYs =
            yValues.length >= 3
              ? [sorted[0], avgY, sorted[sorted.length - 1]]
              : [sorted[0], sorted[sorted.length - 1]];

          const uniqueFreqs = new Set();
          for (const y of chordYs) {
            const f = this.quantizeToScale(
              this.yNormToFreq(y),
              tonicMidi,
              scale,
            );
            uniqueFreqs.add(f);
          }

          for (const freq of uniqueFreqs) {
            events.push(
              this._makeEvent(
                taktStartSec,
                beatDuration,
                freq,
                instrument,
                volume * 0.75,
                notesPerBeat,
              ),
            );
          }
        }
      }
    }

    events.sort((a, b) => a.time - b.time);
    return { events, tonicMidi };
  }

  _makeEvent(
    taktStartSec,
    beatDuration,
    freq,
    instrument,
    volume,
    notesPerBeat,
  ) {
    const jitter = (Math.random() - 0.5) * 0.02;
    return {
      time: Math.max(0, taktStartSec + jitter),
      freq,
      duration: beatDuration * (0.8 / notesPerBeat),
      instrument,
      volume,
    };
  }

  // ─── Вспомогательные ─────────────────────────────────────────────────────

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

  getSegmentDirection(segment) {
    const pts = segment.points;
    if (pts.length < 2) return 0;
    const dy = pts[pts.length - 1].y - pts[0].y;
    if (Math.abs(dy) < 0.05) return 0;
    return dy < 0 ? 1 : -1;
  }

  selectNotesPerBeat(bpm) {
    let options;
    if (bpm >= 120)
      options = [
        { n: 1, p: 0.65 },
        { n: 2, p: 0.35 },
      ];
    else if (bpm >= 70)
      options = [
        { n: 1, p: 0.5 },
        { n: 2, p: 0.32 },
        { n: 3, p: 0.18 },
      ];
    else
      options = [
        { n: 1, p: 0.4 },
        { n: 2, p: 0.3 },
        { n: 3, p: 0.2 },
        { n: 4, p: 0.1 },
      ];
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
