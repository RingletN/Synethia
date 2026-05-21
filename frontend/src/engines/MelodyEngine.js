// engines/MelodyEngine.js
//
// Архитектура — двухфазная:
//   Фаза 1 (Pitch Pipeline):
//     1. preprocessSegments   — фильтр, сортировка точек по X, гауссово сглаживание
//     2. detectInflections    — переломные точки (смена направления линии)
//     3. assignRoles          — melody / chord / bass по плотности переломов и позиции Y
//     4. buildRawNotes        — сэмплирование линии в такты, сохранение направления
//
//   Фаза 2 (Rhythm Pipeline):
//     5. applyRhythmPattern   — назначить time/duration из ритмического шаблона
//     6. applyAccents         — velocity из inflection + ритм

class MelodyEngine {
  constructor() {
    this.A4_FREQ = 440;
    this.A4_MIDI = 69;

    // Диапазон C3–C6
    this.MIN_FREQ = 130.81; // C3
    this.MAX_FREQ = 1046.5; // C6

    // Лады
    this.SCALES = {
      major:      [0, 2, 4, 5, 7, 9, 11],
      minor:      [0, 2, 3, 5, 7, 8, 10],
      pentatonic: [0, 2, 4, 7, 9],
      blues:      [0, 3, 5, 6, 7, 10],
      dorian:     [0, 2, 3, 5, 7, 9, 10],
    };

    // Цвет → инструмент
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

    // Базовая громкость по инструменту (множитель, не абсолют)
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

    // ─── Ритмические шаблоны ────────────────────────────────────────────────
    // offset [0..1] внутри такта, accentMult — множитель громкости,
    // durationMult — множитель длительности ноты (от beatDuration)
    this.RHYTHM_PATTERNS = {
      // Каждую долю — ровно
      straight: {
        melody: [
          { offset: 0,    accentMult: 1.0, durationMult: 0.85 },
        ],
        chord: [
          { offset: 0,    accentMult: 0.75, durationMult: 0.95 },
        ],
        bass: [
          { offset: 0,    accentMult: 0.8,  durationMult: 0.9 },
        ],
      },

      waltz: {
        melody: [
          { offset: 0,    accentMult: 1.3,  durationMult: 0.9 },
          { offset: 0.33, accentMult: 0.65, durationMult: 0.45 },
          { offset: 0.67, accentMult: 0.65, durationMult: 0.45 },
        ],
        chord: [
          { offset: 0,    accentMult: 0.8,  durationMult: 0.95 },
          { offset: 0.33, accentMult: 0.55, durationMult: 0.4  },
          { offset: 0.67, accentMult: 0.55, durationMult: 0.4  },
        ],
        bass: [
          { offset: 0,    accentMult: 1.0,  durationMult: 0.9 },
          { offset: 0.67, accentMult: 0.5,  durationMult: 0.4 },
        ],
      },

      rock: {
        melody: [
          { offset: 0,    accentMult: 1.4,  durationMult: 0.8 },
          { offset: 0.5,  accentMult: 1.2,  durationMult: 0.8 },
        ],
        chord: [
          { offset: 0,    accentMult: 0.9,  durationMult: 0.75 },
          { offset: 0.25, accentMult: 0.5,  durationMult: 0.5  },
          { offset: 0.5,  accentMult: 0.9,  durationMult: 0.75 },
          { offset: 0.75, accentMult: 0.5,  durationMult: 0.5  },
        ],
        bass: [
          { offset: 0,    accentMult: 1.2,  durationMult: 0.85 },
          { offset: 0.5,  accentMult: 1.0,  durationMult: 0.85 },
        ],
      },

      disco: {
        melody: [
          { offset: 0,    accentMult: 1.3,  durationMult: 0.7 },
          { offset: 0.25, accentMult: 0.7,  durationMult: 0.5 },
          { offset: 0.5,  accentMult: 1.2,  durationMult: 0.7 },
          { offset: 0.75, accentMult: 0.7,  durationMult: 0.5 },
        ],
        chord: [
          { offset: 0,    accentMult: 0.85, durationMult: 0.6 },
          { offset: 0.25, accentMult: 0.6,  durationMult: 0.5 },
          { offset: 0.5,  accentMult: 0.85, durationMult: 0.6 },
          { offset: 0.75, accentMult: 0.6,  durationMult: 0.5 },
        ],
        bass: [
          { offset: 0,    accentMult: 1.1,  durationMult: 0.8 },
          { offset: 0.5,  accentMult: 0.9,  durationMult: 0.8 },
        ],
      },

      jazz: {
        melody: [
          { offset: 0,    accentMult: 1.1,  durationMult: 0.75 },
          { offset: 0.33, accentMult: 0.85, durationMult: 0.6  },
          { offset: 0.58, accentMult: 1.0,  durationMult: 0.7  },
          { offset: 0.83, accentMult: 0.7,  durationMult: 0.5  },
        ],
        chord: [
          { offset: 0.17, accentMult: 0.7,  durationMult: 0.5 },
          { offset: 0.67, accentMult: 0.65, durationMult: 0.5 },
        ],
        bass: [
          { offset: 0,    accentMult: 1.0,  durationMult: 0.8 },
          { offset: 0.25, accentMult: 0.6,  durationMult: 0.5 },
          { offset: 0.5,  accentMult: 0.9,  durationMult: 0.8 },
          { offset: 0.75, accentMult: 0.6,  durationMult: 0.5 },
        ],
      },
    };

    // Параметры детекции переломных точек
    this.INFLECTION_THRESHOLD  = 0.035; // минимальная дельта Y для смены направления
    this.GAUSSIAN_SIGMA        = 2;     // сглаживание перед детекцией
    this.EDGE_IGNORE_RATIO     = 0.05;  // игнорировать 5% с каждого конца сегмента
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MIDI / частоты
  // ═══════════════════════════════════════════════════════════════════════════

  freqToMidi(freq) {
    return this.A4_MIDI + 12 * Math.log2(freq / this.A4_FREQ);
  }

  midiToFreq(midi) {
    return this.A4_FREQ * Math.pow(2, (midi - this.A4_MIDI) / 12);
  }

  yNormToFreq(yNorm) {
    // yNorm: 0 = верх холста (высокая нота), 1 = низ (низкая нота)
    const t = 1 - Math.max(0, Math.min(1, yNorm));
    return this.MIN_FREQ * Math.pow(this.MAX_FREQ / this.MIN_FREQ, t);
  }

  /**
   * Квантование с сохранением направления движения.
   * Если prevMidi задан — гарантируем, что квантованная нота
   * не инвертирует направление относительно предыдущей.
   */
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

    // Коррекция направления: если prevQuantMidi задан и мелодия идёт вверх (rawMidi > prevMidi),
    // но квантование опустило ноту — поднять на полтона вверх по ладу
    if (prevQuantMidi !== null) {
      const expectedUp = rawMidi > (prevQuantMidi + 0.5);
      const expectedDn = rawMidi < (prevQuantMidi - 0.5);
      if (expectedUp && quantMidi <= prevQuantMidi) {
        // Найти следующую ступень лада выше
        quantMidi = this._nextScaleStep(quantMidi, tonicClass, intervals, +1);
      } else if (expectedDn && quantMidi >= prevQuantMidi) {
        quantMidi = this._nextScaleStep(quantMidi, tonicClass, intervals, -1);
      }
    }

    // Зажим в диапазон
    quantMidi = Math.max(
      Math.round(this.freqToMidi(this.MIN_FREQ)),
      Math.min(Math.round(this.freqToMidi(this.MAX_FREQ)), quantMidi)
    );

    return { freq: this.midiToFreq(quantMidi), midi: quantMidi };
  }

  _nextScaleStep(midi, tonicClass, intervals, direction) {
    // Перебираем полутоны в нужную сторону пока не найдём ступень лада
    for (let d = 1; d <= 12; d++) {
      const candidate = midi + direction * d;
      const rel = (((candidate - tonicClass) % 12) + 12) % 12;
      if (intervals.includes(rel)) return candidate;
    }
    return midi; // fallback — не должно случаться
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ФАЗА 1-A: Предобработка сегментов
  // ═══════════════════════════════════════════════════════════════════════════

  preprocessSegments(segments) {
    return segments
      .filter(seg => seg.points?.length >= 5)
      .map(seg => {
        const instrument = this.COLOR_TO_INSTRUMENT[seg.color] || "piano";

        // Фильтруем некорректные точки и сортируем по X
        const sorted = seg.points
          .filter(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y))
          .sort((a, b) => a.x - b.x);

        // Убираем дублирующиеся X (оставляем среднее Y)
        const deduped = this._deduplicateByX(sorted);

        // Гауссово сглаживание Y для стабильной детекции переломов
        const smoothed = this._gaussianSmoothY(deduped, this.GAUSSIAN_SIGMA);

        return {
          ...seg,
          instrument,
          volume:         this.INSTRUMENT_VOLUME[instrument] || 0.22,
          points:         sorted,    // оригинальные точки (для питча)
          smoothedPoints: smoothed,  // сглаженные (для детекции переломов)
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
    const half   = Math.floor(kernel.length / 2);

    return points.map((pt, i) => {
      let weightedY = 0;
      let totalW    = 0;
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

  _gaussianKernel(sigma) {
    const size   = Math.max(3, Math.round(sigma * 3) * 2 + 1);
    const half   = Math.floor(size / 2);
    const kernel = [];
    let sum      = 0;
    for (let i = -half; i <= half; i++) {
      const v = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel.push(v);
      sum += v;
    }
    return kernel.map(v => v / sum);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ФАЗА 1-B: Детекция переломных точек
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Возвращает массив { x, y, type: 'peak'|'valley', takt }
   * Игнорирует крайние EDGE_IGNORE_RATIO точек сегмента.
   */
  detectInflections(seg, T) {
    const pts       = seg.smoothedPoints;
    if (pts.length < 5) return [];

    const edgeIgnore = Math.floor(pts.length * this.EDGE_IGNORE_RATIO);
    const inner      = pts.slice(edgeIgnore, pts.length - edgeIgnore);
    if (inner.length < 3) return [];

    const threshold  = this.INFLECTION_THRESHOLD;
    const inflections = [];
    let prevDir      = null; // +1 вверх (y уменьшается), -1 вниз (y увеличивается)

    for (let i = 1; i < inner.length - 1; i++) {
      const dy = inner[i + 1].y - inner[i - 1].y; // в координатах холста (вниз = +)
      if (Math.abs(dy) < threshold) continue;

      const dir = dy > 0 ? -1 : +1; // музыкальное направление (+1 = нота выше)

      if (prevDir !== null && dir !== prevDir) {
        const pt   = inner[i];
        const type = dir === +1 ? 'valley' : 'peak'; // мы только что сменили с пика → долина и наоборот
        const takt = Math.min(T - 1, Math.max(0, Math.floor(pt.x * T)));
        inflections.push({ x: pt.x, y: pt.y, type, takt });
        prevDir = dir;
      } else if (prevDir === null) {
        prevDir = dir;
      }
    }

    return inflections;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ФАЗА 1-C: Назначение ролей инструментам
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Группирует сегменты по инструменту, считает метрики,
   * назначает роли: 'melody' | 'chord' | 'bass'
   *
   * Логика:
   *  - Если инструмент один — только melody
   *  - Инструмент с наименьшей плотностью переломов → chord (или bass, если Y низкий)
   *  - Остальные → melody
   */
  assignRoles(processedSegs, T) {
    // Группируем по инструменту
    const byInstrument = new Map();
    for (const seg of processedSegs) {
      if (!byInstrument.has(seg.instrument)) {
        byInstrument.set(seg.instrument, { segs: [], inflectionCount: 0, avgY: 0 });
      }
      byInstrument.get(seg.instrument).segs.push(seg);
    }

    // Если только один инструмент — всё мелодия
    if (byInstrument.size === 1) {
      const [instr, data] = [...byInstrument.entries()][0];
      data.segs.forEach(seg => seg.role = 'melody');
      return;
    }

    // Считаем метрики для каждого инструмента
    for (const [instr, data] of byInstrument) {
      let totalInflections = 0;
      let totalY           = 0;
      let totalPoints      = 0;

      for (const seg of data.segs) {
        const inf      = this.detectInflections(seg, T);
        totalInflections += inf.length;

        for (const pt of seg.points) {
          totalY      += pt.y;
          totalPoints++;
        }
      }

      data.inflectionDensity = totalPoints > 0
        ? totalInflections / (totalPoints / 10)  // переломов на каждые 10 точек
        : 0;
      data.avgY = totalPoints > 0 ? totalY / totalPoints : 0.5;
    }

    // Инструмент с минимальной плотностью переломов — аккомпанемент
    let minDensity  = Infinity;
    let accompInstr = null;
    for (const [instr, data] of byInstrument) {
      if (data.inflectionDensity < minDensity) {
        minDensity  = data.inflectionDensity;
        accompInstr = instr;
      }
    }

    // Назначаем роли
    for (const [instr, data] of byInstrument) {
      if (instr === accompInstr) {
        // Аккомпанемент: если средний Y > 0.6 (низко на холсте) → bass, иначе → chord
        const role = data.avgY > 0.6 ? 'bass' : 'chord';
        data.segs.forEach(seg => seg.role = role);
      } else {
        data.segs.forEach(seg => seg.role = 'melody');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ФАЗА 1-D: Сборка «сырых» нот (без ритма)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Для каждого такта каждого сегмента сэмплируем N точек,
   * получаем питч с сохранением направления.
   * Возвращает rawNote: { takt, posInTakt, pitch (midi), freq, instrument, role, volume, isInflection, inflectionType }
   */
  buildRawNotes(processedSegs, tonicMidi, T, scale, notesPerBeat) {
    const rawNotes = [];

    for (const seg of processedSegs) {
      const { points, instrument, role, volume } = seg;
      if (points.length < 2) continue;

      // Находим переломные точки этого сегмента
      const inflections = this.detectInflections(seg, T);
      const inflectionTakts = new Set(inflections.map(inf => inf.takt));
      const inflectionMap   = new Map(inflections.map(inf => [inf.takt, inf]));

      let prevMidi = null;

      for (let k = 0; k < T; k++) {
        // Точки этого такта (по X-диапазону)
        const taktXMin = k / T;
        const taktXMax = (k + 1) / T;
        const taktPts  = points.filter(pt => pt.x >= taktXMin && pt.x < taktXMax);

        if (taktPts.length === 0) continue;

        // Адаптивное N: больше нот там, где есть перелом
        const isInflectionTakt = inflectionTakts.has(k);
        const N = isInflectionTakt
          ? Math.min(4, notesPerBeat + 1)
          : notesPerBeat;

        if (role === 'chord' || role === 'bass') {
          // Для аккомпанемента — особая логика (см. buildAccompanimentNotes)
          rawNotes.push(...this._buildAccompanimentNote(
            seg, k, taktPts, inflections, tonicMidi, scale, T
          ));
          continue;
        }

        // Мелодия: сэмплируем N точек равномерно по позиции в такте
        const samples = this._samplePoints(taktPts, N);

        for (let i = 0; i < samples.length; i++) {
          const yNorm   = samples[i].y;
          const rawFreq = this.yNormToFreq(yNorm);
          const { freq, midi } = this.quantizeToScale(rawFreq, tonicMidi, scale, prevMidi);

          rawNotes.push({
            takt:            k,
            posInTakt:       i / N,           // [0..1) внутри такта
            freq,
            midi,
            instrument,
            role,
            volume,
            isInflection:    isInflectionTakt && i === Math.floor(N / 2),
            inflectionType:  inflectionMap.get(k)?.type ?? null,
          });

          prevMidi = midi;
        }
      }
    }

    return rawNotes;
  }

  /**
   * Сэмплирование N точек из набора, равномерно по позиции X внутри такта.
   * Использует медиану для устойчивости к выбросам.
   */
  _samplePoints(taktPts, N) {
    if (taktPts.length <= N) return taktPts;

    const result = [];
    const chunkSize = taktPts.length / N;

    for (let i = 0; i < N; i++) {
      const from  = Math.floor(i * chunkSize);
      const to    = Math.floor((i + 1) * chunkSize);
      const chunk = taktPts.slice(from, to);

      // Медианный Y
      const sorted = [...chunk].sort((a, b) => a.y - b.y);
      const median = sorted[Math.floor(sorted.length / 2)];
      result.push(median);
    }

    return result;
  }

  /**
   * Аккомпанемент: анализирует форму сегмента и выбирает стратегию.
   *
   * Стратегии:
   *  - flat:       линия почти ровная → тянуть тонику / квинту
   *  - arpeggio:   одна арка (рост-спад или наоборот) → арпеджио вверх/вниз
   *  - pulse:      2+ перелома → пульсирующий аккорд
   */
  _buildAccompanimentNote(seg, k, taktPts, inflections, tonicMidi, scale, T) {
    const { instrument, role, volume } = seg;
    const totalInflections = inflections.length;
    const notes = [];

    // Определяем среднюю высоту такта
    const avgY = taktPts.reduce((s, p) => s + p.y, 0) / taktPts.length;

    if (totalInflections === 0) {
      // ── flat: тянем тонику или квинту ──────────────────────────────────
      const baseMidi   = tonicMidi;
      const targetMidi = role === 'bass'
        ? baseMidi - 12                   // октавой ниже для баса
        : baseMidi + (scale === 'major' ? 7 : 7); // квинта для chord
      notes.push({
        takt:          k,
        posInTakt:     0,
        freq:          this.midiToFreq(targetMidi),
        midi:          targetMidi,
        instrument,
        role,
        volume:        volume * 0.75,
        isInflection:  false,
        inflectionType:null,
        accompStyle:   'flat',
      });

    } else if (totalInflections <= 2) {
      // ── arpeggio: арпеджио тоника→терция→квинта→октава ─────────────────
      const intervals  = this.SCALES[scale] || this.SCALES.major;
      const arpeggioSteps = [0, intervals[2], intervals[4], 12]; // тоника, терция, квинта, октава

      // Направление арпеджио по форме сегмента
      const firstY   = taktPts[0].y;
      const lastY    = taktPts[taktPts.length - 1].y;
      const goingUp  = lastY < firstY; // y уменьшается = нота растёт
      const steps    = goingUp ? arpeggioSteps : [...arpeggioSteps].reverse();

      steps.forEach((step, i) => {
        const midi = tonicMidi + step + (role === 'bass' ? -12 : 0);
        notes.push({
          takt:          k,
          posInTakt:     i / steps.length,
          freq:          this.midiToFreq(midi),
          midi,
          instrument,
          role,
          volume:        volume * (i === 0 ? 0.85 : 0.6),
          isInflection:  false,
          inflectionType:null,
          accompStyle:   'arpeggio',
        });
      });

    } else {
      // ── pulse: пульсирующий аккорд (тоника + терция + квинта) ───────────
      const intervals = this.SCALES[scale] || this.SCALES.major;
      const chordMidis = [
        tonicMidi + (role === 'bass' ? -12 : 0),
        tonicMidi + intervals[2],
        tonicMidi + intervals[4],
      ];

      chordMidis.forEach(midi => {
        notes.push({
          takt:          k,
          posInTakt:     0,
          freq:          this.midiToFreq(midi),
          midi,
          instrument,
          role,
          volume:        volume * 0.65,
          isInflection:  false,
          inflectionType:null,
          accompStyle:   'pulse',
        });
      });
    }

    return notes;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ФАЗА 2: Ритмический шаблон → финальные события
  // ═══════════════════════════════════════════════════════════════════════════

  applyRhythmPattern(rawNotes, beatDuration, rhythmPattern) {
    const pattern = this.RHYTHM_PATTERNS[rhythmPattern] || this.RHYTHM_PATTERNS.straight;
    const events  = [];

    // Группируем rawNotes по (takt, instrument, role)
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
        // Мелодия: каждая сырая нота → ближайшая ритмическая позиция
        notes.forEach((note, idx) => {
          const beat = patternBeats[idx % patternBeats.length];
          const taktStart = note.takt * beatDuration;
          const jitter    = (Math.random() - 0.5) * 0.018; // ±9 мс
          const accentMult = note.isInflection
            ? beat.accentMult * (note.inflectionType === 'peak' ? 1.3 : 0.85)
            : beat.accentMult;

          events.push({
            time:       Math.max(0, taktStart + beat.offset * beatDuration + jitter),
            duration:   beatDuration * beat.durationMult,
            freq:       note.freq,
            instrument: note.instrument,
            volume:     Math.min(1, note.volume * accentMult),
            role:       note.role,
          });
        });

      } else {
        // Аккомпанемент: привязываем к ритм-паттерну для роли
        const accompStyle = notes[0].accompStyle;

        if (accompStyle === 'arpeggio') {
          // Арпеджио: каждая нота — своя позиция внутри такта
          notes.forEach((note) => {
            const taktStart = note.takt * beatDuration;
            const jitter    = (Math.random() - 0.5) * 0.01;
            events.push({
              time:       Math.max(0, taktStart + note.posInTakt * beatDuration + jitter),
              duration:   beatDuration / notes.length * 0.85,
              freq:       note.freq,
              instrument: note.instrument,
              volume:     Math.min(1, note.volume),
              role:       note.role,
            });
          });

        } else {
          // flat / pulse: используем ритм-паттерн роли
          const distinctFreqs = [...new Set(notes.map(n => n.freq))];
          const taktStart = notes[0].takt * beatDuration;

          patternBeats.forEach((beat) => {
            distinctFreqs.forEach((freq) => {
              const jitter = (Math.random() - 0.5) * 0.012;
              events.push({
                time:       Math.max(0, taktStart + beat.offset * beatDuration + jitter),
                duration:   beatDuration * beat.durationMult,
                freq,
                instrument: notes[0].instrument,
                volume:     Math.min(1, notes[0].volume * beat.accentMult),
                role:       notes[0].role,
              });
            });
          });
        }
      }
    }

    events.sort((a, b) => a.time - b.time);
    return events;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ОПРЕДЕЛЕНИЕ ТОНИКИ
  // ═══════════════════════════════════════════════════════════════════════════

  detectTonic(processedSegs) {
    let leftmostPoint = null;
    let leftmostX     = Infinity;
    for (const seg of processedSegs) {
      for (const pt of seg.points) {
        if (pt.x < leftmostX) { leftmostX = pt.x; leftmostPoint = pt; }
      }
    }
    if (!leftmostPoint) return Math.round(this.freqToMidi(261.63)); // C4
    return Math.round(this.freqToMidi(this.yNormToFreq(leftmostPoint.y)));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ПУБЛИЧНЫЙ API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Главный метод. Принимает те же аргументы, что и старый buildNoteEvents,
   * плюс новый параметр rhythmPattern.
   *
   * @param {Array}  segments      — массив сегментов { points, color }
   * @param {Object} options
   *   @param {number} bpm           — удары в минуту (default 80)
   *   @param {number} duration      — длительность в секундах (default 8)
   *   @param {string} scale         — 'major'|'minor'|'pentatonic'|'blues'|'dorian' (default 'major')
   *   @param {number} notesPerBeat  — нот на такт для мелодии (default 2)
   *   @param {string} rhythmPattern — 'straight'|'waltz'|'rock'|'disco'|'jazz' (default 'straight')
   *
   * @returns {{ events: Array, tonicMidi: number, roles: Object }}
   */
  buildNoteEvents(segments, options = {}) {
    const {
      bpm           = 80,
      duration      = 8,
      scale         = "major",
      notesPerBeat  = 2,
      rhythmPattern = "straight",
    } = options;

    if (!segments?.length) return { events: [], tonicMidi: 60, roles: {} };

    // ── Фаза 1 ──────────────────────────────────────────────────────────────

    const processedSegs = this.preprocessSegments(segments);
    if (processedSegs.length === 0) return { events: [], tonicMidi: 60, roles: {} };

    const tonicMidi   = this.detectTonic(processedSegs);
    const T           = Math.max(1, Math.ceil((bpm * duration) / (60 * 4)));
    const beatDuration = duration / T;

    this.assignRoles(processedSegs, T);

    const rawNotes = this.buildRawNotes(
      processedSegs, tonicMidi, T, scale, notesPerBeat
    );

    // ── Фаза 2 ──────────────────────────────────────────────────────────────

    const events = this.applyRhythmPattern(rawNotes, beatDuration, rhythmPattern);

    // Карта ролей для отладки / UI
    const roles = {};
    for (const seg of processedSegs) {
      roles[seg.instrument] = seg.role;
    }

    return { events, tonicMidi, roles };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // УТИЛИТЫ (совместимость со старым кодом)
  // ═══════════════════════════════════════════════════════════════════════════

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

  /**
   * Быстрый способ регенерировать только ритм без пересчёта питча.
   * Удобно при смене жанра пользователем.
   *
   * @param {Array}  rawNotes      — результат buildRawNotes (сохраните его)
   * @param {number} beatDuration
   * @param {string} rhythmPattern
   */
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
  
    // Группируем по такту
    const byTakt = new Map();
    for (const ev of events) {
      const takt = Math.floor(ev.time / beatDuration);
      if (!byTakt.has(takt)) byTakt.set(takt, []);
      byTakt.get(takt).push(ev);
    }
  
    for (let k = 0; k < T; k++) {
      const taktEvents = byTakt.get(k) || [];
      lines.push(`\n  [Такт ${String(k + 1).padStart(2, "0")}]  t=${(k * beatDuration).toFixed(2)}s`);
  
      if (taktEvents.length === 0) {
        lines.push("    (пусто)");
        continue;
      }
  
      for (const ev of taktEvents.sort((a, b) => a.time - b.time)) {
        const midi     = Math.round(this.freqToMidi(ev.freq));
        const noteName = midiToName(midi);
        const volBar   = "█".repeat(Math.round(ev.volume * 10)).padEnd(10, "░");
        const durStr   = ev.duration.toFixed(3) + "s";
        const timeStr  = ev.time.toFixed(3) + "s";
        lines.push(
          `    ${timeStr}  ${noteName.padEnd(4)} midi:${String(midi).padStart(3)}  ` +
          `dur:${durStr}  vol:${volBar}  [${ev.role.padEnd(6)}] ${ev.instrument}`
        );
      }
    }
  
    lines.push("\n═══════════════════════════════════════════\n");
    return lines.join("\n");
  }
  
}

export default MelodyEngine;