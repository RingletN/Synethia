// engines/MelodyEngine/rhythmEngine.js
// Фаза 2: наложение ритмического паттерна + контрапункт + устранение коллизий

import { RHYTHM_PATTERNS } from "./constants.js";

export function applyRhythmPattern(rawNotes, beatDuration, rhythmPattern, legato = false, voiceMode = 'offset', bpm = 120) {
  const pattern = RHYTHM_PATTERNS[rhythmPattern] || RHYTHM_PATTERNS.straight;
  const events  = [];

  // FIX: уменьшен jitter — слишком большой jitter создавал грязь особенно на медленных BPM
  const jitterScale = Math.max(0.001, 0.008 * (80 / Math.max(60, bpm)));

  const groups = new Map();
  for (const note of rawNotes) {
    const key = `${note.takt}::${note.instrument}::${note.role}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  }

  for (const [, notes] of groups) {
    const { role }     = notes[0];
    const patternBeats = pattern[role] || pattern.melody;

    if (role === 'melody') {
      for (let idx = 0; idx < notes.length; idx++) {
        const note      = notes[idx];
        const beat      = patternBeats[idx % patternBeats.length];
        const taktStart = note.takt * beatDuration;
        const jitter    = (Math.random() - 0.5) * jitterScale * beatDuration;
        let duration    = beatDuration * beat.durationMult;
        if (legato) duration = beatDuration * 0.95;

        const accentMult = note.isInflection
          ? beat.accentMult * (note.inflectionType === 'peak' ? 1.3 : 0.85)
          : beat.accentMult;

        events.push({
          time:       Math.max(0, taktStart + beat.offset * beatDuration + jitter),
          duration,
          freq:       note.freq,
          instrument: note.instrument,
          volume:     Math.min(1, note.volume * accentMult),
          role:       note.role,
          midi:       note.midi,
          origTime:   taktStart + beat.offset * beatDuration,
        });
      }

    } else if (role === 'bass') {
      const taktStart   = notes[0].takt * beatDuration;
      const accompStyle = notes[0].accompStyle;

      if (accompStyle === 'bassInterval') {
        for (const beat of patternBeats) {
          const jitter = (Math.random() - 0.5) * jitterScale * 0.5 * beatDuration;
          for (const n of notes) {
            events.push({
              time:       Math.max(0, taktStart + beat.offset * beatDuration + jitter),
              duration:   beatDuration * beat.durationMult,
              freq:       n.freq,
              instrument: n.instrument,
              volume:     Math.min(1, n.volume * beat.accentMult),
              role:       n.role,
              midi:       n.midi,
            });
          }
        }
      } else {
        // bassWalk: паттерно-зависимое место проходящей ноты
        const rootNote = notes.find(n => !n.isWalk) ?? notes[0];
        const walkNote = notes.find(n =>  n.isWalk) ?? null;

        for (let bi = 0; bi < patternBeats.length; bi++) {
          const beat   = patternBeats[bi];
          const jitter = (Math.random() - 0.5) * jitterScale * 0.5 * beatDuration;

          let useWalk = false;
          if (walkNote && patternBeats.length > 1) {
            if (rhythmPattern === 'waltz') {
              useWalk = bi === 2;                          // 3я доля
            } else if (rhythmPattern === 'jazz') {
              useWalk = bi === patternBeats.length - 2;   // предпоследний (офф-бит)
            } else if (rhythmPattern === 'rock') {
              useWalk = bi === 1;                          // 2й бит (синкопа)
            } else {
              useWalk = bi === patternBeats.length - 1;   // straight/disco: последний
            }
          }

          const n = useWalk ? walkNote : rootNote;
          events.push({
            time:       Math.max(0, taktStart + beat.offset * beatDuration + jitter),
            duration:   beatDuration * beat.durationMult,
            freq:       n.freq,
            instrument: n.instrument,
            volume:     Math.min(1, n.volume * beat.accentMult),
            role:       n.role,
            midi:       n.midi,
          });
        }
      }

    } else {
      // chord / ornament
      const accompStyle = notes[0].accompStyle;
      const isOrnament  = notes.some(n => n.isOrnament);

      if (accompStyle === 'arpeggio') {
        for (const note of notes) {
          const taktStart = note.takt * beatDuration;
          const jitter    = (Math.random() - 0.5) * jitterScale * 0.5 * beatDuration;
          events.push({
            time:       Math.max(0, taktStart + note.posInTakt * beatDuration + jitter),
            duration:   beatDuration / notes.length * 0.85,
            freq:       note.freq,
            instrument: note.instrument,
            volume:     Math.min(1, note.volume),
            role:       note.role,
            midi:       note.midi,
          });
        }
      } else {
        const distinctNotes = deduplicateByMidi(notes);
        const taktStart     = notes[0].takt * beatDuration;

        // Ornament: берём только первую долю паттерна (одна нота в такт),
        // со сдвигом ~треть такта — звучит как ответ на главную мелодию
        const beatsToUse = isOrnament ? [patternBeats[0]] : patternBeats;
        const ornamentOffset = isOrnament ? beatDuration * (0.28 + Math.random() * 0.10) : 0;

        for (const beat of beatsToUse) {
          for (const n of distinctNotes) {
            const jitter = (Math.random() - 0.5) * jitterScale * 0.5 * beatDuration;
            events.push({
              time:       Math.max(0, taktStart + beat.offset * beatDuration + ornamentOffset + jitter),
              duration:   beatDuration * beat.durationMult * (isOrnament ? 0.7 : 1.0),
              freq:       n.freq,
              instrument: n.instrument,
              volume:     Math.min(1, n.volume * beat.accentMult),
              role:       n.role,
              midi:       n.midi,
            });
          }
        }
      }
    }
  }

  // ─── Дедупликация баса ───────────────────────────────────────────────────────
  // FIX: если один инструмент-бас имел несколько сегментов, группировка takt::instr::role
  // объединяет их в одну группу, но buildBassNote может сгенерировать дублирующие события.
  // Убираем точные дубли (одинаковые time+midi+instrument).
  const seenBassKeys = new Set();
  const deduplicatedEvents = events.filter(ev => {
    if (ev.role !== 'bass') return true;
    const key = `${ev.instrument}::${ev.time.toFixed(4)}::${ev.midi}`;
    if (seenBassKeys.has(key)) return false;
    seenBassKeys.add(key);
    return true;
  });
  events.length = 0;
  events.push(...deduplicatedEvents);

  // ─── Контрапункт ─────────────────────────────────────────────────────────────
  const melodyEventsAll = events.filter(e => e.role === 'melody' && e.origTime !== undefined);
  const byTakt = new Map();
  for (const ev of melodyEventsAll) {
    const takt = Math.floor(ev.origTime / beatDuration);
    if (!byTakt.has(takt)) byTakt.set(takt, []);
    byTakt.get(takt).push(ev);
  }

  for (const [, evs] of byTakt) {
    const instruments = [...new Set(evs.map(ev => ev.instrument))];
    if (instruments.length <= 1) continue;
    const firstTime  = Math.min(...evs.map(ev => ev.origTime));
    const firstInstr = evs.find(ev => ev.origTime === firstTime).instrument;
    const ordered    = [firstInstr, ...instruments.filter(i => i !== firstInstr)];

    let shiftAmount = 0;
    if      (voiceMode === 'offset') shiftAmount = 0.5 * beatDuration;
    // FIX: random режим давал сдвиг 0.33-0.58 beatDuration — слишком большой разброс.
    // Уменьшен до 0.25-0.40 чтобы инструменты не налезали на следующий такт.
    else if (voiceMode === 'random') shiftAmount = beatDuration * (0.25 + Math.random() * 0.15);

    for (let idx = 1; idx < ordered.length; idx++) {
      const instr = ordered[idx];
      for (const ev of evs) {
        if (ev.instrument === instr) {
          ev.time   = Math.max(0, ev.time + shiftAmount);
          ev.volume = Math.min(1, ev.volume * 0.9);
        }
      }
    }
  }

  // ─── Дедупликация мелодии ─────────────────────────────────────────────────────
  const melodyEvents = events.filter(e => e.role === 'melody');
  const otherEvents  = events.filter(e => e.role !== 'melody');

  const MIN_TIME_DIFF            = 0.25 * beatDuration;
  const MIN_DIFF_DIFFERENT_PITCH = 0.06 * beatDuration;

  melodyEvents.sort((a, b) => a.time - b.time);
  const mergedMelody    = [];
  const lastInfoByInstr = new Map();

  for (const ev of melodyEvents) {
    const last = lastInfoByInstr.get(ev.instrument);
    if (!last) {
      mergedMelody.push(ev);
      lastInfoByInstr.set(ev.instrument, { time: ev.time, midi: ev.midi, duration: ev.duration });
      continue;
    }
    const timeDiff = ev.time - last.time;
    if (timeDiff < MIN_TIME_DIFF            && ev.midi === last.midi) continue;
    if (timeDiff < MIN_DIFF_DIFFERENT_PITCH && ev.midi !== last.midi) continue;
    mergedMelody.push(ev);
    lastInfoByInstr.set(ev.instrument, { time: ev.time, midi: ev.midi, duration: ev.duration });
  }

  // ─── Устранение секунд внутри мелодии ────────────────────────────────────────
  // FIX: вместо raw % 12 берём min(raw%12, 12 - raw%12) — настоящий хром. интервал.
  // Это ловит случай B3(59)↔C4(60): было 1%12=1 ✓, но также ловило ложные срабатывания
  // когда interval после % давал 6 (тритон) на самом деле являясь квинтой через октаву.
  // Фильтруем только реальные секунды (1,2) — тритон внутри одного голоса не убираем,
  // т.к. мелодия генерируется по гамме и тритонов там не бывает.
  const noSecondsMelody = [];
  const activeByInstr   = new Map();

  for (const ev of mergedMelody) {
    const active      = activeByInstr.get(ev.instrument) || [];
    const stillActive = active.filter(n => n.endTime > ev.time);

    const hasIntraConflict = stillActive.some(n => {
      const interval = Math.abs(n.midi - ev.midi) % 12;
      // FIX: добавлен унисон (0) внутри одного инструмента — две одинаковые ноты подряд
      // создают дублирование. Секунды (1,2) по-прежнему фильтруем.
      return interval === 0 || interval === 1 || interval === 2;
    });
    if (hasIntraConflict) continue;

    noSecondsMelody.push(ev);
    stillActive.push({ endTime: ev.time + ev.duration, midi: ev.midi });
    activeByInstr.set(ev.instrument, stillActive);
  }

  // ─── Устранение секунд между melody и bass ───────────────────────────────────
  // Фильтруем только малые секунды (1,2 пт) — самые неприятные на слух.
  // Унисон (0) и тритон (6) НЕ фильтруем: унисон между разными октавами звучит нормально,
  // тритон в разных регистрах (бас внизу, мелодия вверху) — это просто характерный цвет.
  const bassEvents = otherEvents.filter(e => e.role === 'bass');
  const restEvents = otherEvents.filter(e => e.role !== 'bass');

  const filteredMelody = noSecondsMelody.filter(melEv => {
    const melEnd = melEv.time + melEv.duration;
    return !bassEvents.some(bassEv => {
      const bassEnd = bassEv.time + bassEv.duration;
      const overlap = Math.min(melEnd, bassEnd) - Math.max(melEv.time, bassEv.time);
      if (overlap <= 0.05) return false;
      // Просто % 12 — без инверсии. Иначе септима(10) воспринимается как секунда(2).
      const interval = Math.abs(melEv.midi - bassEv.midi) % 12;
      return interval === 1 || interval === 2;
    });
  });

  // FIX: дополнительный проход — убираем секунды между разными melody-инструментами.
  // Когда 3 инструмента играют мелодию одновременно, их ноты могут образовывать кластеры.
  const crossMelodyFiltered = [];
  const activeCrossMelody   = [];

  for (const ev of filteredMelody.sort((a, b) => a.time - b.time)) {
    // Очищаем завершившиеся ноты других инструментов
    const stillActive = activeCrossMelody.filter(n =>
      n.instrument !== ev.instrument && n.endTime > ev.time
    );

    const hasCrossConflict = stillActive.some(n => {
      const interval = Math.abs(n.midi - ev.midi) % 12;
      return interval === 1 || interval === 2;
    });

    if (!hasCrossConflict) {
      crossMelodyFiltered.push(ev);
      activeCrossMelody.push({ endTime: ev.time + ev.duration, midi: ev.midi, instrument: ev.instrument });
    }
  }

  const finalEvents = [...crossMelodyFiltered, ...bassEvents, ...restEvents];
  finalEvents.sort((a, b) => a.time - b.time);
  return finalEvents;
}

function deduplicateByMidi(notes) {
  const seen = new Set();
  return notes.filter(n => {
    if (seen.has(n.midi)) return false;
    seen.add(n.midi);
    return true;
  });
}