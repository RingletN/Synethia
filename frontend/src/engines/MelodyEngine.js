// engines/MelodyEngine.js
//
// Двухфазная архитектура:
//   Фаза 1: предобработка, переломы, роли, сырые ноты (питч без ритма)
//   Фаза 2: наложение ритмического шаблона + устранение коллизий для мелодии

class MelodyEngine {
  constructor() {
    this.A4_FREQ = 440;
    this.A4_MIDI = 69;

    this.MIN_FREQ = 130.81; // C3
    this.MAX_FREQ = 1046.5; // C6

    this.SCALES = {
      major:      [0, 2, 4, 5, 7, 9, 11],
      minor:      [0, 2, 3, 5, 7, 8, 10],
      pentatonic: [0, 2, 4, 7, 9],
      blues:      [0, 3, 5, 6, 7, 10],
      dorian:     [0, 2, 3, 5, 7, 9, 10],
    };

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

    this.INSTRUMENT_VOLUME = {
      piano:            0.28,
      guitar:           0.18,
      flute:            0.22,
      strings:          0.22,
      clarinet:         0.24,
      saxophone:        0.20,
      "guitar-electric":0.16,
      cello:            0.24,
      xylophone:        0.30,
      harp:             0.26,
    };

    // ===== ИСПРАВЛЕНИЕ: уменьшены durationMult для пауз =====
    this.RHYTHM_PATTERNS = {
      straight: {
        melody: [ { offset: 0, accentMult: 1.0, durationMult: 0.6 } ],
        chord:  [ { offset: 0, accentMult: 0.75, durationMult: 0.7 } ],
        bass:   [ { offset: 0, accentMult: 0.8,  durationMult: 0.7 } ],
      },
      waltz: {
        melody: [
          { offset: 0,    accentMult: 1.3, durationMult: 0.7 },
          { offset: 0.33, accentMult: 0.65, durationMult: 0.45 },
          { offset: 0.67, accentMult: 0.65, durationMult: 0.45 },
        ],
        chord: [
          { offset: 0,    accentMult: 0.8,  durationMult: 0.7 },
          { offset: 0.33, accentMult: 0.55, durationMult: 0.4 },
          { offset: 0.67, accentMult: 0.55, durationMult: 0.4 },
        ],
        bass: [
          { offset: 0,    accentMult: 1.0,  durationMult: 0.7 },
          { offset: 0.67, accentMult: 0.5,  durationMult: 0.4 },
        ],
      },
      rock: {
        melody: [
          { offset: 0,    accentMult: 1.4, durationMult: 0.6 },
          { offset: 0.5,  accentMult: 1.2, durationMult: 0.6 },
        ],
        chord: [
          { offset: 0,    accentMult: 0.9, durationMult: 0.6 },
          { offset: 0.25, accentMult: 0.5, durationMult: 0.4 },
          { offset: 0.5,  accentMult: 0.9, durationMult: 0.6 },
          { offset: 0.75, accentMult: 0.5, durationMult: 0.4 },
        ],
        bass: [
          { offset: 0,    accentMult: 1.2, durationMult: 0.7 },
          { offset: 0.5,  accentMult: 1.0, durationMult: 0.7 },
        ],
      },
      disco: {
        melody: [
          { offset: 0,    accentMult: 1.3, durationMult: 0.5 },
          { offset: 0.25, accentMult: 0.7, durationMult: 0.4 },
          { offset: 0.5,  accentMult: 1.2, durationMult: 0.5 },
          { offset: 0.75, accentMult: 0.7, durationMult: 0.4 },
        ],
        chord: [
          { offset: 0,    accentMult: 0.85, durationMult: 0.5 },
          { offset: 0.25, accentMult: 0.6,  durationMult: 0.4 },
          { offset: 0.5,  accentMult: 0.85, durationMult: 0.5 },
          { offset: 0.75, accentMult: 0.6,  durationMult: 0.4 },
        ],
        bass: [
          { offset: 0,    accentMult: 1.1, durationMult: 0.6 },
          { offset: 0.5,  accentMult: 0.9, durationMult: 0.6 },
        ],
      },
      jazz: {
        melody: [
          { offset: 0,    accentMult: 1.1, durationMult: 0.65 },
          { offset: 0.33, accentMult: 0.85, durationMult: 0.5 },
          { offset: 0.58, accentMult: 1.0,  durationMult: 0.6 },
          { offset: 0.83, accentMult: 0.7,  durationMult: 0.45 },
        ],
        chord: [
          { offset: 0.17, accentMult: 0.7, durationMult: 0.45 },
          { offset: 0.67, accentMult: 0.65, durationMult: 0.45 },
        ],
        bass: [
          { offset: 0,    accentMult: 1.0, durationMult: 0.6 },
          { offset: 0.25, accentMult: 0.6, durationMult: 0.4 },
          { offset: 0.5,  accentMult: 0.9, durationMult: 0.6 },
          { offset: 0.75, accentMult: 0.6, durationMult: 0.4 },
        ],
      },
    };

    this.INFLECTION_THRESHOLD  = 0.035;
    this.GAUSSIAN_SIGMA        = 2;
    this.EDGE_IGNORE_RATIO     = 0.05;
  }

  // ────────────────────────────── MIDI / частоты ──────────────────────────────
  freqToMidi(freq) {
    return this.A4_MIDI + 12 * Math.log2(freq / this.A4_FREQ);
  }
  midiToFreq(midi) {
    return this.A4_FREQ * Math.pow(2, (midi - this.A4_MIDI) / 12);
  }
  yNormToFreq(yNorm) {
    const t = 1 - Math.max(0, Math.min(1, yNorm));
    return this.MIN_FREQ * Math.pow(this.MAX_FREQ / this.MIN_FREQ, t);
  }

  quantizeToScale(freq, tonicMidi, scale, prevQuantMidi = null) {
    const intervals  = this.SCALES[scale] || this.SCALES.major;
    const rawMidi    = this.freqToMidi(freq);
    const roundedMidi = Math.round(rawMidi);
    const tonicClass = ((tonicMidi % 12) + 12) % 12;
    const rel        = (((roundedMidi - tonicClass) % 12) + 12) % 12;

    let closest = intervals[0];
    let minDist = Infinity;
    for (const iv of intervals) {
      const d = Math.min(Math.abs(iv - rel), 12 - Math.abs(iv - rel));
      if (d < minDist) { minDist = d; closest = iv; }
    }

    const octave    = Math.floor((roundedMidi - tonicClass) / 12);
    let quantMidi   = tonicClass + octave * 12 + closest;

    if (prevQuantMidi !== null) {
      const expectedUp = rawMidi > (prevQuantMidi + 0.5);
      const expectedDn = rawMidi < (prevQuantMidi - 0.5);
      if (expectedUp && quantMidi <= prevQuantMidi) {
        quantMidi = this._nextScaleStep(quantMidi, tonicClass, intervals, +1);
      } else if (expectedDn && quantMidi >= prevQuantMidi) {
        quantMidi = this._nextScaleStep(quantMidi, tonicClass, intervals, -1);
      }
    }

    quantMidi = Math.max(
      Math.round(this.freqToMidi(this.MIN_FREQ)),
      Math.min(Math.round(this.freqToMidi(this.MAX_FREQ)), quantMidi)
    );
    return { freq: this.midiToFreq(quantMidi), midi: quantMidi };
  }

  _nextScaleStep(midi, tonicClass, intervals, direction) {
    for (let d = 1; d <= 12; d++) {
      const candidate = midi + direction * d;
      const rel = (((candidate - tonicClass) % 12) + 12) % 12;
      if (intervals.includes(rel)) return candidate;
    }
    return midi;
  }

  // ────────────────────────────── Предобработка ──────────────────────────────
  preprocessSegments(segments) {
    return segments
      .filter(seg => seg.points?.length >= 5)
      .map(seg => {
        const instrument = this.COLOR_TO_INSTRUMENT[seg.color] || "piano";
        const sorted = seg.points
          .filter(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y))
          .sort((a, b) => a.x - b.x);
        const deduped = this._deduplicateByX(sorted);
        const smoothed = this._gaussianSmoothY(deduped, this.GAUSSIAN_SIGMA);
        return {
          ...seg,
          instrument,
          volume: this.INSTRUMENT_VOLUME[instrument] || 0.22,
          points: sorted,
          smoothedPoints: smoothed,
        };
      });
  }

  _deduplicateByX(sortedPoints) {
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

  _gaussianSmoothY(points, sigma) {
    if (points.length <= 2) return points;
    const kernel = this._gaussianKernel(sigma);
    const half = Math.floor(kernel.length / 2);
    return points.map((pt, i) => {
      let weightedY = 0, totalW = 0;
      for (let k = 0; k < kernel.length; k++) {
        const idx = i + k - half;
        if (idx >= 0 && idx < points.length) {
          weightedY += points[idx].y * kernel[k];
          totalW += kernel[k];
        }
      }
      return { x: pt.x, y: weightedY / totalW };
    });
  }

  _gaussianKernel(sigma) {
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

  // ────────────────────────────── Переломные точки ────────────────────────────
  detectInflections(seg, T) {
    const pts = seg.smoothedPoints;
    if (pts.length < 5) return [];
    const edgeIgnore = Math.floor(pts.length * this.EDGE_IGNORE_RATIO);
    const inner = pts.slice(edgeIgnore, pts.length - edgeIgnore);
    if (inner.length < 3) return [];

    const inflections = [];
    let prevDir = null;
    for (let i = 1; i < inner.length - 1; i++) {
      const dy = inner[i + 1].y - inner[i - 1].y;
      if (Math.abs(dy) < this.INFLECTION_THRESHOLD) continue;
      const dir = dy > 0 ? -1 : +1;
      if (prevDir !== null && dir !== prevDir) {
        const pt = inner[i];
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

  // ────────────────────────────── Роли инструментов ───────────────────────────
  assignRoles(processedSegs, T) {
    const byInstrument = new Map();
    for (const seg of processedSegs) {
      if (!byInstrument.has(seg.instrument)) {
        byInstrument.set(seg.instrument, { segs: [], inflectionCount: 0, avgY: 0 });
      }
      byInstrument.get(seg.instrument).segs.push(seg);
    }

    if (byInstrument.size === 1) {
      for (const seg of processedSegs) seg.role = 'melody';
      return;
    }

    for (const [instr, data] of byInstrument) {
      let totalInflections = 0, totalY = 0, totalPoints = 0;
      for (const seg of data.segs) {
        const inf = this.detectInflections(seg, T);
        totalInflections += inf.length;
        for (const pt of seg.points) {
          totalY += pt.y;
          totalPoints++;
        }
      }
      data.inflectionDensity = totalPoints > 0 ? totalInflections / (totalPoints / 10) : 0;
      data.avgY = totalPoints > 0 ? totalY / totalPoints : 0.5;
    }

    let minDensity = Infinity, accompInstr = null;
    for (const [instr, data] of byInstrument) {
      if (data.inflectionDensity < minDensity) {
        minDensity = data.inflectionDensity;
        accompInstr = instr;
      }
    }

    for (const [instr, data] of byInstrument) {
      const role = (instr === accompInstr) ? (data.avgY > 0.6 ? 'bass' : 'chord') : 'melody';
      data.segs.forEach(seg => seg.role = role);
    }
  }

  // ────────────────────────────── Сырые ноты (без ритма) ──────────────────────
  buildRawNotes(processedSegs, tonicMidi, T, scale, notesPerBeat) {
    const rawNotes = [];

    for (const seg of processedSegs) {
      const { points, instrument, role, volume } = seg;
      if (points.length < 2) continue;

      // Средний midi для ограничения диапазона мелодии
      let avgMidi = null;
      if (role === 'melody') {
        let sumMidi = 0;
        for (const pt of points) sumMidi += this.freqToMidi(this.yNormToFreq(pt.y));
        avgMidi = sumMidi / points.length;
      }

      const inflections = this.detectInflections(seg, T);
      const inflectionTakts = new Set(inflections.map(inf => inf.takt));
      const inflectionMap = new Map(inflections.map(inf => [inf.takt, inf]));

      // Для интерполяции: собираем Y по тактам заранее
      // taktYMap[k] = медианный Y точек в такте k (или null если пусто)
      const taktYMap = new Array(T).fill(null);
      for (let k = 0; k < T; k++) {
        const taktXMin = k / T;
        const taktXMax = (k + 1) / T;
        const taktPts = points.filter(pt => pt.x >= taktXMin && pt.x < taktXMax);
        if (taktPts.length > 0) {
          const sorted = [...taktPts].sort((a, b) => a.y - b.y);
          taktYMap[k] = sorted[Math.floor(sorted.length / 2)].y;
        }
      }

      // Интерполируем пустые такты внутри диапазона сегмента
      const segMinTakt = Math.floor(points[0].x * T);
      const segMaxTakt = Math.min(T - 1, Math.floor(points[points.length - 1].x * T));
      for (let k = segMinTakt; k <= segMaxTakt; k++) {
        if (taktYMap[k] !== null) continue;
        // Ищем ближайшие непустые такты слева и справа
        let leftK = k - 1, rightK = k + 1;
        while (leftK >= segMinTakt && taktYMap[leftK] === null) leftK--;
        while (rightK <= segMaxTakt && taktYMap[rightK] === null) rightK++;
        const leftY  = leftK  >= segMinTakt  ? taktYMap[leftK]  : null;
        const rightY = rightK <= segMaxTakt  ? taktYMap[rightK] : null;
        if (leftY !== null && rightY !== null) {
          const t = (k - leftK) / (rightK - leftK);
          taktYMap[k] = leftY + (rightY - leftY) * t; // линейная интерполяция
        } else if (leftY !== null) {
          taktYMap[k] = leftY;
        } else if (rightY !== null) {
          taktYMap[k] = rightY;
        }
      }

      let prevMidi = null;

      for (let k = 0; k < T; k++) {
        const taktXMin = k / T;
        const taktXMax = (k + 1) / T;
        let taktPts = points.filter(pt => pt.x >= taktXMin && pt.x < taktXMax);

        // Если пусто — подставляем интерполированную точку
        if (taktPts.length === 0) {
          if (taktYMap[k] === null) continue;
          taktPts = [{ x: (taktXMin + taktXMax) / 2, y: taktYMap[k], interpolated: true }];
        }

        const isInflectionTakt = inflectionTakts.has(k);
        const N = isInflectionTakt ? Math.min(4, notesPerBeat + 1) : notesPerBeat;

        if (role === 'chord' || role === 'bass') {
          const accompNotes = this._buildAccompanimentNote(seg, k, taktPts, inflections, tonicMidi, scale, T);
          rawNotes.push(...accompNotes);
          continue;
        }

        // Мелодия — сэмплируем N точек
        // Если точек мало (< N) — дополняем шагами по ладу от последней известной ноты
        const samples = this._samplePoints(taktPts, N);
        for (let i = 0; i < samples.length; i++) {
          const yNorm = samples[i].y;
          const rawFreq = this.yNormToFreq(yNorm);
          let { freq, midi } = this.quantizeToScale(rawFreq, tonicMidi, scale, prevMidi);

          // Ограничение диапазона ±12 полутонов от среднего
          if (avgMidi !== null) {
            if (midi > avgMidi + 12) { midi = Math.round(avgMidi + 12); freq = this.midiToFreq(midi); }
            if (midi < avgMidi - 12) { midi = Math.round(avgMidi - 12); freq = this.midiToFreq(midi); }
          }

          rawNotes.push({
            takt: k,
            posInTakt: i / N,
            freq,
            midi,
            instrument,
            role,
            volume,
            isInflection: isInflectionTakt && i === Math.floor(N / 2),
            inflectionType: inflectionMap.get(k)?.type ?? null,
            interpolated: !!(samples[i].interpolated),
          });
          prevMidi = midi;
        }

        // Если семплов получилось меньше N (мало точек в такте) — добираем шагами по ладу
        if (samples.length < N && prevMidi !== null) {
          const intervals = this.SCALES[scale] || this.SCALES.major;
          const tonicClass = ((tonicMidi % 12) + 12) % 12;
          // Определяем направление по соседним тактам
          const nextY = taktYMap[k + 1];
          const direction = (nextY !== null && nextY < taktYMap[k]) ? +1 : -1;
          for (let i = samples.length; i < N; i++) {
            const stepMidi = this._nextScaleStep(prevMidi, tonicClass, intervals, direction);
            const stepFreq = this.midiToFreq(stepMidi);
            rawNotes.push({
              takt: k,
              posInTakt: i / N,
              freq: stepFreq,
              midi: stepMidi,
              instrument,
              role,
              volume: volume * 0.85,
              isInflection: false,
              inflectionType: null,
              interpolated: true,
            });
            prevMidi = stepMidi;
          }
        }
      }
    }
    return rawNotes;
  }

  _samplePoints(taktPts, N) {
    if (taktPts.length <= N) return taktPts;
    const result = [];
    const chunkSize = taktPts.length / N;
    for (let i = 0; i < N; i++) {
      const from = Math.floor(i * chunkSize);
      const to = Math.floor((i + 1) * chunkSize);
      const chunk = taktPts.slice(from, to);
      const sorted = [...chunk].sort((a, b) => a.y - b.y);
      const median = sorted[Math.floor(sorted.length / 2)];
      result.push(median);
    }
    return result;
  }

  // ===== ИСПРАВЛЕНИЕ: бас идёт по квинтовому прогрессии I-IV-V-I =====
  _buildAccompanimentNote(seg, k, taktPts, inflections, tonicMidi, scale, T) {
    const { instrument, role, volume } = seg;
    const notes = [];

    const hasInflectionInTakt = inflections.some(inf => inf.takt === k);

    if (role === 'bass') {
      // Прогрессия I-IV-V-I по секциям трека (каждая четверть трека — своя ступень)
      // I=тоника, IV=кварта(+5 полутонов), V=квинта(+7), затем снова I
      const PROGRESSION = [0, 5, 7, 0]; // полутоны от тоники
      const sectionLen  = Math.max(1, Math.floor(T / PROGRESSION.length));
      const progIdx     = Math.min(PROGRESSION.length - 1, Math.floor(k / sectionLen));
      const progOffset  = PROGRESSION[progIdx];

      // На переломных тактах — добавляем проходящую квинту
      const baseMidi  = tonicMidi + progOffset - 12; // октавой ниже
      const passMidi  = tonicMidi + progOffset + 7 - 12; // + квинта

      notes.push({
        takt: k, posInTakt: 0,
        freq: this.midiToFreq(baseMidi), midi: baseMidi,
        instrument, role, volume: volume * 0.85,
        isInflection: false, inflectionType: null, accompStyle: 'bassWalk',
      });

      if (hasInflectionInTakt) {
        // Проходящая нота на середине такта
        notes.push({
          takt: k, posInTakt: 0.5,
          freq: this.midiToFreq(passMidi), midi: passMidi,
          instrument, role, volume: volume * 0.6,
          isInflection: false, inflectionType: null, accompStyle: 'bassWalk',
        });
      }
      return notes;
    }

    // Для аккордов (chord) – старая логика
    const totalInflections = inflections.length;
    const avgY = taktPts.reduce((s, p) => s + p.y, 0) / taktPts.length;

    if (totalInflections === 0) {
      const targetMidi = tonicMidi + (scale === 'major' ? 7 : 7);
      notes.push({
        takt: k, posInTakt: 0, freq: this.midiToFreq(targetMidi), midi: targetMidi,
        instrument, role, volume: volume * 0.75, isInflection: false, inflectionType: null, accompStyle: 'flat',
      });
    } else if (totalInflections <= 2) {
      const intervals = this.SCALES[scale] || this.SCALES.major;
      const arpeggioSteps = [0, intervals[2], intervals[4], 12];
      const goingUp = (taktPts[taktPts.length - 1].y < taktPts[0].y);
      const steps = goingUp ? arpeggioSteps : [...arpeggioSteps].reverse();
      steps.forEach((step, i) => {
        const midi = tonicMidi + step;
        notes.push({
          takt: k, posInTakt: i / steps.length, freq: this.midiToFreq(midi), midi,
          instrument, role, volume: volume * (i === 0 ? 0.85 : 0.6),
          isInflection: false, inflectionType: null, accompStyle: 'arpeggio',
        });
      });
    } else {
      const intervals = this.SCALES[scale] || this.SCALES.major;
      const chordMidis = [tonicMidi, tonicMidi + intervals[2], tonicMidi + intervals[4]];
      chordMidis.forEach(midi => {
        notes.push({
          takt: k, posInTakt: 0, freq: this.midiToFreq(midi), midi,
          instrument, role, volume: volume * 0.65,
          isInflection: false, inflectionType: null, accompStyle: 'pulse',
        });
      });
    }
    return notes;
  }

  // ────────────────────────────── Наложение ритма + устранение коллизий ────────
  applyRhythmPattern(rawNotes, beatDuration, rhythmPattern) {
    const pattern = this.RHYTHM_PATTERNS[rhythmPattern] || this.RHYTHM_PATTERNS.straight;
    const events = [];

    // Группировка по такту, инструменту и роли
    const groups = new Map();
    for (const note of rawNotes) {
      const key = `${note.takt}::${note.instrument}::${note.role}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(note);
    }

    for (const [, notes] of groups) {
      const { role } = notes[0];
      const patternBeats = pattern[role] || pattern.melody;

      if (role === 'melody') {
        for (let idx = 0; idx < notes.length; idx++) {
          const note = notes[idx];
          const beat = patternBeats[idx % patternBeats.length];
          const taktStart = note.takt * beatDuration;
          const jitter = (Math.random() - 0.5) * 0.018;
          const accentMult = note.isInflection
            ? beat.accentMult * (note.inflectionType === 'peak' ? 1.3 : 0.85)
            : beat.accentMult;
          events.push({
            time: Math.max(0, taktStart + beat.offset * beatDuration + jitter),
            duration: beatDuration * beat.durationMult,
            freq: note.freq,
            instrument: note.instrument,
            volume: Math.min(1, note.volume * accentMult),
            role: note.role,
            midi: note.midi,
            origTime: taktStart + beat.offset * beatDuration,
          });
        }
      } else {
        // Аккомпанемент (chord/bass)
        const accompStyle = notes[0].accompStyle;
        if (accompStyle === 'arpeggio') {
          for (const note of notes) {
            const taktStart = note.takt * beatDuration;
            const jitter = (Math.random() - 0.5) * 0.01;
            events.push({
              time: Math.max(0, taktStart + note.posInTakt * beatDuration + jitter),
              duration: beatDuration / notes.length * 0.85,
              freq: note.freq,
              instrument: note.instrument,
              volume: Math.min(1, note.volume),
              role: note.role,
            });
          }
        } else {
          const distinctFreqs = [...new Set(notes.map(n => n.freq))];
          const taktStart = notes[0].takt * beatDuration;
          for (const beat of patternBeats) {
            for (const freq of distinctFreqs) {
              const jitter = (Math.random() - 0.5) * 0.012;
              events.push({
                time: Math.max(0, taktStart + beat.offset * beatDuration + jitter),
                duration: beatDuration * beat.durationMult,
                freq,
                instrument: notes[0].instrument,
                volume: Math.min(1, notes[0].volume * beat.accentMult),
                role: notes[0].role,
              });
            }
          }
        }
      }
    }

    // ── устранение коллизий: два melody-инструмента в одном такте ──────────────
    // Второй инструмент сдвигается на половину beatDuration (контрапункт)
    const melodyByTakt = new Map(); // takt → Set of instruments уже размещённых
    for (const ev of events) {
      if (ev.role !== 'melody') continue;
      const takt = Math.floor(ev.origTime / beatDuration);
      if (!melodyByTakt.has(takt)) melodyByTakt.set(takt, new Set());
      melodyByTakt.get(takt).add(ev.instrument);
    }

    // Собираем порядок инструментов-мелодий (первый встреченный = главный)
    const melodyInstrOrder = [];
    for (const ev of events) {
      if (ev.role === 'melody' && !melodyInstrOrder.includes(ev.instrument)) {
        melodyInstrOrder.push(ev.instrument);
      }
    }

    // Применяем сдвиг ко второму и далее инструментам
    for (const ev of events) {
      if (ev.role !== 'melody') continue;
      const instrIdx = melodyInstrOrder.indexOf(ev.instrument);
      if (instrIdx > 0) {
        // Сдвиг на instrIdx * 0.5 доли такта, но не больше 0.75
        const shift = Math.min(0.75, instrIdx * 0.5) * beatDuration;
        ev.time = Math.max(0, ev.time + shift);
        // Слегка тише, чтобы не перебивал первый голос
        ev.volume = Math.min(1, ev.volume * (1 - instrIdx * 0.1));
      }
    }

    // ── финальная сортировка и удаление слишком близких нот одного инструмента ──
    const melodyEvents = events.filter(e => e.role === 'melody');
    const otherEvents  = events.filter(e => e.role !== 'melody');
    const MIN_TIME_DIFF = 0.05 * beatDuration;

    melodyEvents.sort((a, b) => a.time - b.time);

    // Дедупликация по каждому инструменту отдельно (а не глобально)
    const mergedMelody = [];
    const lastTimeByInstr = new Map();
    for (const ev of melodyEvents) {
      const lastTime = lastTimeByInstr.get(ev.instrument) ?? -Infinity;
      if (ev.time - lastTime < MIN_TIME_DIFF) {
        // Слишком близко для этого инструмента — пропускаем
        continue;
      }
      mergedMelody.push(ev);
      lastTimeByInstr.set(ev.instrument, ev.time);
    }

    const finalEvents = [...mergedMelody, ...otherEvents];
    finalEvents.sort((a, b) => a.time - b.time);
    return finalEvents;
  }

  // ────────────────────────────── Тоника ─────────────────────────────────────
  detectTonic(processedSegs) {
    let leftmostPoint = null;
    let leftmostX = Infinity;
    for (const seg of processedSegs) {
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

  // ────────────────────────────── Публичный API ──────────────────────────────
  buildNoteEvents(segments, options = {}) {
    const {
      bpm = 80,
      duration = 8,
      scale = "major",
      notesPerBeat = 2,
      rhythmPattern = "straight",
    } = options;

    if (!segments?.length) return { events: [], tonicMidi: 60, roles: {} };

    const processedSegs = this.preprocessSegments(segments);
    if (processedSegs.length === 0) return { events: [], tonicMidi: 60, roles: {} };

    const tonicMidi = this.detectTonic(processedSegs);
    const T = Math.max(1, Math.ceil((bpm * duration) / (60 * 4)));
    const beatDuration = duration / T;

    this.assignRoles(processedSegs, T);
    const rawNotes = this.buildRawNotes(processedSegs, tonicMidi, T, scale, notesPerBeat);
    const events = this.applyRhythmPattern(rawNotes, beatDuration, rhythmPattern);

    const roles = {};
    for (const seg of processedSegs) roles[seg.instrument] = seg.role;
    return { events, tonicMidi, roles };
  }

  // Утилиты (для совместимости)
  getSegmentDirection(segment) {
    const pts = segment.points;
    if (pts.length < 2) return 0;
    const dy = pts[pts.length - 1].y - pts[0].y;
    if (Math.abs(dy) < 0.05) return 0;
    return dy < 0 ? 1 : -1;
  }

  selectNotesPerBeat(bpm) {
    let options;
    if (bpm >= 120)      options = [{ n: 1, p: 0.5 }, { n: 2, p: 0.5 }];
    else if (bpm >= 70)  options = [{ n: 1, p: 0.35 }, { n: 2, p: 0.45 }, { n: 3, p: 0.2 }];
    else                 options = [{ n: 1, p: 0.25 }, { n: 2, p: 0.35 }, { n: 3, p: 0.25 }, { n: 4, p: 0.15 }];
    let cum = 0;
    const r = Math.random();
    for (const o of options) { cum += o.p; if (r <= cum) return o.n; }
    return 2;
  }

  regenerateRhythm(rawNotes, beatDuration, rhythmPattern) {
    return this.applyRhythmPattern(rawNotes, beatDuration, rhythmPattern);
  }

  exportDebugLog(events, roles, tonicMidi, options = {}) {
    const { bpm = 80, scale = "major", rhythmPattern = "straight", duration = 8 } = options;
    const T = Math.max(1, Math.ceil((bpm * duration) / (60 * 4)));
    const beatDuration = duration / T;
    const midiToName = (midi) => {
      const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
      return names[((midi % 12) + 12) % 12] + Math.floor(midi / 12 - 1);
    };
    const lines = [];
    lines.push("═══════════════════════════════════════════");
    lines.push("  MELODY ENGINE DEBUG LOG");
    lines.push("═══════════════════════════════════════════");
    lines.push(`  BPM: ${bpm} | Scale: ${scale} | Pattern: ${rhythmPattern}`);
    lines.push(`  Duration: ${duration}s | Тактов: ${T} | Тоника: ${midiToName(tonicMidi)} (midi ${tonicMidi})`);
    lines.push("");
    lines.push("─── Роли инструментов ──────────────────────");
    for (const [instr, role] of Object.entries(roles)) {
      lines.push(`  ${instr.padEnd(18)} → ${role}`);
    }
    lines.push("");
    lines.push("─── События по тактам ──────────────────────");
    const byTakt = new Map();
    for (const ev of events) {
      const takt = Math.floor(ev.time / beatDuration);
      if (!byTakt.has(takt)) byTakt.set(takt, []);
      byTakt.get(takt).push(ev);
    }
    for (let k = 0; k < T; k++) {
      const taktEvents = byTakt.get(k) || [];
      lines.push(`\n  [Такт ${String(k + 1).padStart(2, "0")}]  t=${(k * beatDuration).toFixed(2)}s`);
      if (taktEvents.length === 0) { lines.push("    (пусто)"); continue; }
      for (const ev of taktEvents.sort((a, b) => a.time - b.time)) {
        const midi = Math.round(this.freqToMidi(ev.freq));
        const noteName = midiToName(midi);
        const volBar = "█".repeat(Math.round(ev.volume * 10)).padEnd(10, "░");
        const durStr = ev.duration.toFixed(3) + "s";
        const timeStr = ev.time.toFixed(3) + "s";
        lines.push(`    ${timeStr}  ${noteName.padEnd(4)} midi:${String(midi).padStart(3)}  dur:${durStr}  vol:${volBar}  [${ev.role.padEnd(6)}] ${ev.instrument}${ev.interpolated ? '  ~interp' : ''}`);
      }
    }
    lines.push("\n═══════════════════════════════════════════\n");
    return lines.join("\n");
  }
}

export default MelodyEngine;