// engines/MelodyEngine/rhythmEngine.js
// Фаза 2: наложение ритмического паттерна + контрапункт + устранение коллизий

import { RHYTHM_PATTERNS } from "./constants.js";

export function applyRhythmPattern(rawNotes, beatDuration, rhythmPattern, legato = false, voiceMode = 'offset', bpm = 120) {
  const pattern = RHYTHM_PATTERNS[rhythmPattern] || RHYTHM_PATTERNS.straight;
  const events  = [];

  // Jitter масштабируется с BPM — на высоком BPM меньше дрожания
  const jitterScale = Math.max(0.003, 0.018 * (80 / Math.max(60, bpm)));

  // Группируем ноты по (такт × инструмент × роль)
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
      const taktStart  = notes[0].takt * beatDuration;
      const accompStyle = notes[0].accompStyle;

      if (accompStyle === 'bassInterval') {
        // Несколько нот баса — играем интервал одновременно на каждый бит паттерна
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
        // Обычный bassWalk: один раз за такт
        const bassNote = notes[0];
        for (const beat of patternBeats) {
          const jitter = (Math.random() - 0.5) * jitterScale * 0.5 * beatDuration;
          events.push({
            time:       Math.max(0, taktStart + beat.offset * beatDuration + jitter),
            duration:   beatDuration * beat.durationMult,
            freq:       bassNote.freq,
            instrument: bassNote.instrument,
            volume:     Math.min(1, bassNote.volume * beat.accentMult),
            role:       bassNote.role,
            midi:       bassNote.midi,
          });
        }
      }

    } else {
      // Аккомпанемент (chord)
      const accompStyle = notes[0].accompStyle;

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
        // flatChord / pulse — накладываем на ритмические биты из паттерна
        const distinctNotes = deduplicateByMidi(notes);
        const taktStart     = notes[0].takt * beatDuration;
        for (const beat of patternBeats) {
          for (const n of distinctNotes) {
            const jitter = (Math.random() - 0.5) * jitterScale * 0.5 * beatDuration;
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
      }
    }
  }

  // ─── Контрапункт: смещение одновременных мелодических голосов ────────────────
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
    else if (voiceMode === 'random') shiftAmount = beatDuration * (0.33 + Math.random() * 0.25);
    // voiceMode === 'unison' → shiftAmount остаётся 0

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

  // ─── Дедупликация мелодии (убираем слишком близкие ноты) ─────────────────────
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
      lastInfoByInstr.set(ev.instrument, { time: ev.time, midi: ev.midi });
      continue;
    }
    const timeDiff = ev.time - last.time;
    // Фильтруем повторяющуюся ноту (одинаковый midi слишком близко)
    if (timeDiff < MIN_TIME_DIFF            && ev.midi === last.midi) continue;
    if (timeDiff < MIN_DIFF_DIFFERENT_PITCH && ev.midi !== last.midi) continue;
    mergedMelody.push(ev);
    lastInfoByInstr.set(ev.instrument, { time: ev.time, midi: ev.midi });
  }

  const finalEvents = [...mergedMelody, ...otherEvents];
  finalEvents.sort((a, b) => a.time - b.time);
  return finalEvents;
}

// ─── хелпер: убираем дубликаты по midi ───────────────────────────────────────
function deduplicateByMidi(notes) {
  const seen = new Set();
  return notes.filter(n => {
    if (seen.has(n.midi)) return false;
    seen.add(n.midi);
    return true;
  });
}