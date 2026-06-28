import { RHYTHM_PATTERNS } from "./constants.js";

export function applyRhythmPattern(
  rawNotes,
  beatDuration,
  rhythmPattern,
  legato = false,
  voiceMode = "offset",
  bpm = 120,
) {
  const pattern = RHYTHM_PATTERNS[rhythmPattern] || RHYTHM_PATTERNS.straight;
  const events = [];

  const jitterScale = Math.max(0.001, 0.008 * (80 / Math.max(60, bpm)));

  const groups = new Map();
  for (const note of rawNotes) {
    const key = `${note.takt}::${note.instrument}::${note.role}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  }

  for (const [, notes] of groups) {
    const { role } = notes[0];
    const patternBeats = pattern[role] || pattern.melody;

    if (role === "melody") {
      for (let idx = 0; idx < notes.length; idx++) {
        const note = notes[idx];
        const beat = patternBeats[idx % patternBeats.length];
        const taktStart = note.takt * beatDuration;
        const jitter = (Math.random() - 0.5) * jitterScale * beatDuration;
        let duration = beatDuration * beat.durationMult;
        if (legato) duration = beatDuration * 0.95;

        const accentMult = note.isInflection
          ? beat.accentMult * (note.inflectionType === "peak" ? 1.3 : 0.85)
          : beat.accentMult;

        events.push({
          time: Math.max(0, taktStart + beat.offset * beatDuration + jitter),
          duration,
          freq: note.freq,
          instrument: note.instrument,
          volume: Math.min(1, note.volume * accentMult),
          role: note.role,
          midi: note.midi,
          origTime: taktStart + beat.offset * beatDuration,
        });
      }
    } else if (role === "bass") {
      const taktStart = notes[0].takt * beatDuration;
      const accompStyle = notes[0].accompStyle;

      if (accompStyle === "bassInterval") {
        for (const beat of patternBeats) {
          const jitter =
            (Math.random() - 0.5) * jitterScale * 0.5 * beatDuration;
          for (const n of notes) {
            events.push({
              time: Math.max(
                0,
                taktStart + beat.offset * beatDuration + jitter,
              ),
              duration: beatDuration * beat.durationMult,
              freq: n.freq,
              instrument: n.instrument,
              volume: Math.min(1, n.volume * beat.accentMult),
              role: n.role,
              midi: n.midi,
            });
          }
        }
      } else {
        const rootNote = notes.find((n) => !n.isWalk) ?? notes[0];
        const walkNote = notes.find((n) => n.isWalk) ?? null;

        for (let bi = 0; bi < patternBeats.length; bi++) {
          const beat = patternBeats[bi];
          const jitter =
            (Math.random() - 0.5) * jitterScale * 0.5 * beatDuration;

          let useWalk = false;
          if (walkNote && patternBeats.length > 1) {
            if (rhythmPattern === "waltz") {
              useWalk = bi === 2;
            } else if (rhythmPattern === "jazz") {
              useWalk = bi === patternBeats.length - 2;
            } else if (rhythmPattern === "rock") {
              useWalk = bi === 1;
            } else {
              useWalk = bi === patternBeats.length - 1;
            }
          }

          const n = useWalk ? walkNote : rootNote;
          events.push({
            time: Math.max(0, taktStart + beat.offset * beatDuration + jitter),
            duration: beatDuration * beat.durationMult,
            freq: n.freq,
            instrument: n.instrument,
            volume: Math.min(1, n.volume * beat.accentMult),
            role: n.role,
            midi: n.midi,
          });
        }
      }
    } else {
      // (аккомпанемент)
      const accompStyle = notes[0].accompStyle;
      const isOrnament = notes.some((n) => n.isOrnament);
      // temporalFade — множитель из зоны перехода (0.4 .. 1.0)
      const temporalFade = notes[0].temporalFade ?? 1.0;

      if (accompStyle === "arpeggio") {
        for (const note of notes) {
          const taktStart = note.takt * beatDuration;
          const jitter =
            (Math.random() - 0.5) * jitterScale * 0.5 * beatDuration;
          events.push({
            time: Math.max(
              0,
              taktStart + note.posInTakt * beatDuration + jitter,
            ),
            duration: (beatDuration / notes.length) * 0.85,
            freq: note.freq,
            instrument: note.instrument,
            volume: Math.min(1, note.volume * temporalFade),
            role: note.role,
            midi: note.midi,
          });
        }
      } else {
        const distinctNotes = deduplicateByMidi(notes);
        const taktStart = notes[0].takt * beatDuration;
        const beatsToUse = isOrnament ? [patternBeats[0]] : patternBeats;
        // Аккомпанирующий голос: небольшой сдвиг чтобы не сливаться с мелодией
        const ornamentOffset = isOrnament
          ? beatDuration * (0.28 + Math.random() * 0.1)
          : 0;

        for (const beat of beatsToUse) {
          for (const n of distinctNotes) {
            const jitter =
              (Math.random() - 0.5) * jitterScale * 0.5 * beatDuration;
            events.push({
              time: Math.max(
                0,
                taktStart +
                  beat.offset * beatDuration +
                  ornamentOffset +
                  jitter,
              ),
              duration:
                beatDuration * beat.durationMult * (isOrnament ? 0.7 : 1.0),
              freq: n.freq,
              instrument: n.instrument,
              // Применяем temporalFade к аккомп-ноте: плавное появление/затухание
              volume: Math.min(1, n.volume * beat.accentMult * temporalFade),
              role: n.role,
              midi: n.midi,
            });
          }
        }
      }
    }
  }

  // ─── Дедупликация баса ─────────────────────────────────────────────────────
  const seenBassKeys = new Set();
  const deduplicatedEvents = events.filter((ev) => {
    if (ev.role !== "bass") return true;
    const key = `${ev.instrument}::${ev.time.toFixed(4)}::${ev.midi}`;
    if (seenBassKeys.has(key)) return false;
    seenBassKeys.add(key);
    return true;
  });
  events.length = 0;
  events.push(...deduplicatedEvents);

  // ─── Дедупликация мелодии ──────────────────────────────────────────────────
  // Каждый инструмент в каждый момент времени звучит только один раз
  const melodyEvents = events.filter((e) => e.role === "melody");
  const otherEvents = events.filter((e) => e.role !== "melody");

  const MIN_TIME_DIFF = 0.25 * beatDuration;
  const MIN_DIFF_DIFFERENT_PITCH = 0.06 * beatDuration;

  melodyEvents.sort((a, b) => a.time - b.time);
  const mergedMelody = [];
  const lastInfoByInstr = new Map();

  for (const ev of melodyEvents) {
    const last = lastInfoByInstr.get(ev.instrument);
    if (!last) {
      mergedMelody.push(ev);
      lastInfoByInstr.set(ev.instrument, {
        time: ev.time,
        midi: ev.midi,
        duration: ev.duration,
      });
      continue;
    }
    const timeDiff = ev.time - last.time;
    if (timeDiff < MIN_TIME_DIFF && ev.midi === last.midi) continue;
    if (timeDiff < MIN_DIFF_DIFFERENT_PITCH && ev.midi !== last.midi) continue;
    mergedMelody.push(ev);
    lastInfoByInstr.set(ev.instrument, {
      time: ev.time,
      midi: ev.midi,
      duration: ev.duration,
    });
  }

  // ─── Устранение секунд внутри мелодии ─────────────────────────────────────
  const noSecondsMelody = [];
  const activeByInstr = new Map();

  for (const ev of mergedMelody) {
    const active = activeByInstr.get(ev.instrument) || [];
    const stillActive = active.filter((n) => n.endTime > ev.time);

    const hasIntraConflict = stillActive.some((n) => {
      const rawDiff = Math.abs(n.midi - ev.midi);
      if (rawDiff === 0) return true;
      if (rawDiff >= 14) return false;
      const chromatic = Math.min(rawDiff % 12, 12 - (rawDiff % 12));
      return chromatic <= 2;
    });
    if (hasIntraConflict) continue;

    noSecondsMelody.push(ev);
    stillActive.push({ endTime: ev.time + ev.duration, midi: ev.midi });
    activeByInstr.set(ev.instrument, stillActive);
  }

  // ─── Устранение секунд между melody и bass ─────────────────────────────────
  const bassEvents = otherEvents.filter((e) => e.role === "bass");
  const restEvents = otherEvents.filter((e) => e.role !== "bass");

  const filteredMelody = noSecondsMelody.filter((melEv) => {
    const melEnd = melEv.time + melEv.duration;
    return !bassEvents.some((bassEv) => {
      const bassEnd = bassEv.time + bassEv.duration;
      const overlap =
        Math.min(melEnd, bassEnd) - Math.max(melEv.time, bassEv.time);
      if (overlap <= 0.05) return false;
      const interval = Math.abs(melEv.midi - bassEv.midi) % 12;
      return interval === 1 || interval === 2;
    });
  });

  // ─── Устранение секунд между двумя melody-инструментами ────────────────────
  const crossMelodyFiltered = [];
  const activeCrossMelody = [];

  for (const ev of filteredMelody.sort((a, b) => a.time - b.time)) {
    const stillActive = activeCrossMelody.filter(
      (n) => n.instrument !== ev.instrument && n.endTime > ev.time,
    );

    const hasCrossConflict = stillActive.some((n) => {
      const rawDiff = Math.abs(n.midi - ev.midi);
      if (rawDiff === 0) return true;
      if (rawDiff >= 14) return false;
      const chromatic = Math.min(rawDiff % 12, 12 - (rawDiff % 12));
      return chromatic <= 2 || chromatic === 6;
    });

    if (!hasCrossConflict) {
      crossMelodyFiltered.push(ev);
      activeCrossMelody.push({
        endTime: ev.time + ev.duration,
        midi: ev.midi,
        instrument: ev.instrument,
      });
    }
  }

  const finalEvents = [...crossMelodyFiltered, ...bassEvents, ...restEvents];
  finalEvents.sort((a, b) => a.time - b.time);
  return finalEvents;
}

function deduplicateByMidi(notes) {
  const seen = new Set();
  return notes.filter((n) => {
    if (seen.has(n.midi)) return false;
    seen.add(n.midi);
    return true;
  });
}
