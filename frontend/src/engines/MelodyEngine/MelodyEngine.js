// engines/MelodyEngine/MelodyEngine.js
//
// Двухфазная архитектура:
//   Фаза 1: предобработка, переломы, роли, сырые ноты (питч без ритма)
//   Фаза 2: наложение ритмического шаблона + устранение коллизий для мелодии
//
// Публичный API:
//   buildNoteEvents(segments, options) → { events, tonicMidi, roles }
//   regenerateRhythm(rawNotes, beatDuration, rhythmPattern, legato, voiceMode) → events
//   exportDebugLog(events, roles, tonicMidi, options) → string

import {
  DEFAULT_RHYTHM_PATTERN,
  DEFAULT_LEGATO,
  DEFAULT_VOICE_MODE,
  DEFAULT_NOTES_PER_BEAT,
} from "./constants.js";
import { preprocessSegments, detectTonic } from "./preprocessor.js";
import { assignRoles }                      from "./roleAssigner.js";
import { buildRawNotes, getSegmentDirection, selectNotesPerBeat } from "./noteBuilder.js";
import { applyRhythmPattern }               from "./rhythmEngine.js";
import { exportDebugLog }                   from "./debugLogger.js";

class MelodyEngine {
  constructor() {
    this.defaultRhythmPattern = DEFAULT_RHYTHM_PATTERN;
    this.defaultLegato        = DEFAULT_LEGATO;
    this.defaultVoiceMode     = DEFAULT_VOICE_MODE;
    this.defaultNotesPerBeat  = DEFAULT_NOTES_PER_BEAT;
  }

  buildNoteEvents(segments, options = {}) {
    const {
      bpm           = 80,
      duration      = 8,
      scale         = "major",
      rhythmPattern = "straight",
      legato        = this.defaultLegato,
      voiceMode     = this.defaultVoiceMode,
    } = options;

    // Адаптируем количество нот к BPM, если не задано явно
    const notesPerBeat = options.notesPerBeat ?? selectNotesPerBeat(bpm);

    if (!segments?.length) return { events: [], tonicMidi: 60, roles: {} };

    const processedSegs = preprocessSegments(segments);
    if (processedSegs.length === 0) return { events: [], tonicMidi: 60, roles: {} };

    const tonicMidi   = detectTonic(processedSegs);
    const T           = Math.max(1, Math.ceil((bpm * duration) / (60 * 4)));
    const beatDuration = duration / T;

    assignRoles(processedSegs, T);
    const rawNotes = buildRawNotes(processedSegs, tonicMidi, T, scale, notesPerBeat);
    // FIX: передаём bpm в applyRhythmPattern для динамического jitter
    const events   = applyRhythmPattern(rawNotes, beatDuration, rhythmPattern, legato, voiceMode, bpm);

    const roles = {};
    for (const seg of processedSegs) roles[seg.instrument] = seg.role;
    return { events, tonicMidi, roles };
  }

  regenerateRhythm(rawNotes, beatDuration, rhythmPattern, legato = this.defaultLegato, voiceMode = this.defaultVoiceMode, bpm = 120) {
    return applyRhythmPattern(rawNotes, beatDuration, rhythmPattern, legato, voiceMode, bpm);
  }

  exportDebugLog(events, roles, tonicMidi, options = {}) {
    return exportDebugLog(events, roles, tonicMidi, {
      legato:    this.defaultLegato,
      voiceMode: this.defaultVoiceMode,
      ...options,
    });
  }

  getSegmentDirection(segment)  { return getSegmentDirection(segment); }
  selectNotesPerBeat(bpm)       { return selectNotesPerBeat(bpm); }
}

export default MelodyEngine;