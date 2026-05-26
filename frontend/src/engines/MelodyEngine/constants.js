// engines/MelodyEngine/constants.js

export const A4_FREQ = 432;
export const A4_MIDI = 69;

export const MIN_FREQ = 130.81; // C3
export const MAX_FREQ = 523.25; // C5
// export const MAX_FREQ = 1046.5; // C6

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

export const MOODS = [
  { key: "major", label: "Радостно" },
  { key: "minor", label: "Грустно" },
  { key: "pentatonic", label: "Спокойно" },
  { key: "dorian", label: "Загадочно" },
  { key: "blues", label: "Томно" },
];

// Ритмы: понятные пользователю названия
export const RHYTHM_LABELS = {
  straight: "Размеренно",
  waltz: "Вальсово",
  rock: "Отрывисто",
  disco: "Пульсирующе",
  jazz: "Свободно",
};
export const RHYTHM_ORDER = ["straight", "waltz", "rock", "disco", "jazz"];

export const COLOR_TO_INSTRUMENT = {
  "#00ffd1": "piano",
  "#ff3366": "guitar",
  "#ffcc00": "flute",
  "#9900ff": "strings",
  "#ff6b35": "clarinet",
  "#00b4d8": "saxophone",
  "#f72585": "guitar-electric",
  "#0000FF": "cello",
  "#ffd60a": "xylophone",
  "#a855f7": "harp",
};

export const INSTRUMENT_VOLUME = {
  piano: 0.28,
  guitar: 0.38, // FIX: поднят с 0.28 — гитара-бас должна быть основой
  flute: 0.22,
  strings: 0.16,
  clarinet: 0.24,
  saxophone: 0.2,
  "guitar-electric": 0.22,
  cello: 0.2,
  xylophone: 0.22, // FIX: снижен с 0.30 — ксилофон играет роль украшения
  harp: 0.26,
};

export const ROLE_VOLUME_MULT = {
  melody: 1.0,
  chord: 0.5, // FIX: снижен с 0.75 — ксилофон-украшение должен быть тихим фоном
  bass: 1.1, // FIX: поднят с 0.70 — бас был почти не слышен (guitar 0.28 × 0.70 = 0.19)
};

export const RHYTHM_PATTERNS = {
  straight: {
    melody: [{ offset: 0, accentMult: 1.0, durationMult: 0.6 }],
    chord: [{ offset: 0, accentMult: 0.75, durationMult: 0.7 }],
    bass: [{ offset: 0, accentMult: 0.8, durationMult: 0.7 }],
  },

  waltz: {
    melody: [
      { offset: 0, accentMult: 1.3, durationMult: 0.7 },
      { offset: 0.33, accentMult: 0.65, durationMult: 0.45 },
      { offset: 0.67, accentMult: 0.65, durationMult: 0.45 },
    ],
    chord: [
      { offset: 0.33, accentMult: 0.55, durationMult: 0.38 },
      { offset: 0.67, accentMult: 0.55, durationMult: 0.38 },
    ],
    bass: [{ offset: 0, accentMult: 1.0, durationMult: 0.55 }],
  },

  rock: {
    melody: [
      { offset: 0, accentMult: 1.8, durationMult: 0.4 },
      { offset: 0.5, accentMult: 1.5, durationMult: 0.4 },
    ],
    chord: [
      { offset: 0, accentMult: 1.1, durationMult: 0.45 },
      { offset: 0.25, accentMult: 0.5, durationMult: 0.3 },
      { offset: 0.5, accentMult: 1.1, durationMult: 0.45 },
      { offset: 0.75, accentMult: 0.5, durationMult: 0.3 },
    ],
    bass: [
      { offset: 0, accentMult: 1.8, durationMult: 0.6 }, // FIX: 1.4→1.8, сильный удар на 1
      { offset: 0.5, accentMult: 1.4, durationMult: 0.6 }, // FIX: 1.2→1.4, чёткий удар на 3
    ],
  },

  disco: {
    melody: [
      { offset: 0, accentMult: 1.3, durationMult: 0.5 },
      { offset: 0.25, accentMult: 0.7, durationMult: 0.4 },
      { offset: 0.5, accentMult: 1.2, durationMult: 0.5 },
      { offset: 0.75, accentMult: 0.7, durationMult: 0.4 },
    ],
    chord: [
      { offset: 0, accentMult: 0.85, durationMult: 0.5 },
      { offset: 0.25, accentMult: 0.6, durationMult: 0.4 },
      { offset: 0.5, accentMult: 0.85, durationMult: 0.5 },
      { offset: 0.75, accentMult: 0.6, durationMult: 0.4 },
    ],
    bass: [
      { offset: 0, accentMult: 1.1, durationMult: 0.6 },
      { offset: 0.5, accentMult: 0.9, durationMult: 0.6 },
    ],
  },

  jazz: {
    melody: [
      { offset: 0, accentMult: 1.1, durationMult: 0.65 },
      { offset: 0.33, accentMult: 0.85, durationMult: 0.5 },
      { offset: 0.58, accentMult: 1.0, durationMult: 0.6 },
      { offset: 0.83, accentMult: 0.7, durationMult: 0.45 },
    ],
    chord: [
      { offset: 0.17, accentMult: 0.7, durationMult: 0.45 },
      { offset: 0.67, accentMult: 0.65, durationMult: 0.45 },
    ],
    bass: [
      { offset: 0, accentMult: 1.0, durationMult: 0.6 },
      { offset: 0.25, accentMult: 0.6, durationMult: 0.4 },
      { offset: 0.5, accentMult: 0.9, durationMult: 0.6 },
      { offset: 0.75, accentMult: 0.6, durationMult: 0.4 },
    ],
  },
};

export const INFLECTION_THRESHOLD = 0.035;
export const GAUSSIAN_SIGMA = 2;
export const EDGE_IGNORE_RATIO = 0.05;

export const DEFAULT_RHYTHM_PATTERN = "disco";
export const DEFAULT_LEGATO = false;
export const DEFAULT_VOICE_MODE = "random";
export const DEFAULT_NOTES_PER_BEAT = 4;

export const CHORD_PROGRESSION_SEMITONES = [0, 5, 7, 0];
