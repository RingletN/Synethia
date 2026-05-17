// hooks/useMelodyPlayer.js
import { useEffect, useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';

// ─── Сэмплеры для всех 10 инструментов ──────────────────────────────────────
const SAMPLER_URLS = {
  piano: {
    baseUrl: '/samples/piano/',
    urls: {
      C3: 'C3.ogg', 'D#3': 'Ds3.ogg', 'F#3': 'Fs3.ogg',
      A3: 'A3.ogg', C4: 'C4.ogg', 'D#4': 'Ds4.ogg', 'F#4': 'Fs4.ogg',
      A4: 'A4.ogg', C5: 'C5.ogg', 'D#5': 'Ds5.ogg', 'F#5': 'Fs5.ogg',
      A5: 'A5.ogg', C6: 'C6.ogg',
    },
  },
  guitar: {
    baseUrl: '/samples/guitar-acoustic/',
    urls: {
      E2: 'E2.mp3', 'F#2': 'Fs2.mp3', G2: 'G2.mp3', A2: 'A2.mp3',
      B2: 'B2.mp3', C3: 'C3.mp3', D3: 'D3.mp3', E3: 'E3.mp3',
      'F#3': 'Fs3.mp3', G3: 'G3.mp3', A3: 'A3.mp3', B3: 'B3.mp3',
      C4: 'C4.mp3', D4: 'D4.mp3', E4: 'E4.mp3', 'F#4': 'Fs4.mp3',
      G4: 'G4.mp3', A4: 'A4.mp3', B4: 'B4.mp3', C5: 'C5.mp3',
    },
  },
  flute: {
    baseUrl: '/samples/flute/',
    urls: {
      A4: 'A4.ogg',
      C5: 'C5.ogg', E5: 'E5.ogg', A5: 'A5.ogg',
      C6: 'C6.ogg', E6: 'E6.ogg', A6: 'A6.ogg',
    },
  },
  strings: {
    baseUrl: '/samples/violin/',
    urls: {
      A3: 'A3.ogg',
      C4: 'C4.ogg', E4: 'E4.ogg', G4: 'G4.ogg', A4: 'A4.ogg',
      C5: 'C5.ogg', E5: 'E5.ogg', G5: 'G5.ogg', A5: 'A5.ogg',
    },
  },
  clarinet: {
    baseUrl: '/samples/clarinet/',
    urls: {
      D3: 'D3.mp3', F3: 'F3.mp3', 'A#3': 'As3.mp3',
      D4: 'D4.mp3', F4: 'F4.mp3', 'A#4': 'As4.mp3',
      D5: 'D5.mp3', F5: 'F5.mp3', 'A#5': 'As5.mp3',
      D6: 'D6.mp3',
    },
  },
  saxophone: {
    baseUrl: '/samples/saxophone/',
    urls: {
      'A#3': 'As3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3',
      'F#4': 'Fs4.mp3', A4: 'A4.mp3', C5: 'C5.mp3',
      'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3',
    },
  },
  'guitar-electric': {
    baseUrl: '/samples/guitar-electric/',
    urls: {
      'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3',
      C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
      A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3',
      'F#5': 'Fs5.mp3', A5: 'A5.mp3',
    },
  },
  cello: {
    baseUrl: '/samples/cello/',
    urls: {
      E2: 'E2.mp3', A2: 'A2.mp3', D3: 'D3.mp3',
      G3: 'G3.mp3', C4: 'C4.mp3', E4: 'E4.mp3',
      A4: 'A4.mp3',
    },
  },
  xylophone: {
    baseUrl: '/samples/xylophone/',
    urls: {
      G4: 'G4.mp3',
      C5: 'C5.mp3', G5: 'G5.mp3', C6: 'C6.mp3', G6: 'G6.mp3',
    },
  },
  harp: {
    baseUrl: '/samples/harp/',
    urls: {
      C3: 'C3.mp3', G3: 'G3.mp3',
      C5: 'C5.mp3', G5: 'G5.mp3',
    },
  },
};

const OSC_FALLBACK = {
  piano:             'sine',
  guitar:            'square',
  flute:             'sawtooth',
  strings:           'triangle',
  clarinet:          'sine',
  saxophone:         'sawtooth',
  'guitar-electric': 'square',
  cello:             'triangle',
  xylophone:         'sine',
  harp:              'sine',
};

export const COLOR_TO_INSTRUMENT_NAME = {
  '#00ffd1': 'piano',
  '#ff3366': 'guitar',
  '#ffcc00': 'flute',
  '#9900ff': 'strings',
  '#ff6b35': 'clarinet',
  '#00b4d8': 'saxophone',
  '#f72585': 'guitar-electric',
  '#7bed9f': 'cello',
  '#ffd60a': 'xylophone',
  '#a855f7': 'harp',
};

const LEGACY_TO_INSTRUMENT = {
  sine:     'piano',
  square:   'guitar',
  sawtooth: 'flute',
  triangle: 'strings',
};

function resolveInstrumentName(instrument) {
  if (SAMPLER_URLS[instrument]) return instrument;
  return LEGACY_TO_INSTRUMENT[instrument] || 'piano';
}

const DEFAULT_INSTRUMENT_EFFECTS = Object.fromEntries(
  Object.keys(SAMPLER_URLS).map(k => [k, { reverb: 0, delay: 0, distortion: 0 }])
);

// ─── ГЛОБАЛЬНЫЙ КЭШ СЭМПЛЕРОВ ────────────────────────────────────────────────
// Живёт на уровне модуля — не сбрасывается при размонтировании компонентов.
// Сэмплеры создаются один раз и переиспользуются всеми экземплярами хука.
// Это решает проблему "No available buffers" — сэмплер никогда не dispose'ится.
const _samplerCache   = {};  // instrName → Tone.Sampler
const _samplerReady   = {};  // instrName → boolean
const _samplerPromise = {};  // instrName → Promise (защита от двойного создания)

async function getOrLoadSampler(instrName, getFxChain) {
  // Уже готов
  if (_samplerReady[instrName]) {
    return _samplerCache[instrName];
  }

  // Уже грузится — ждём тот же промис
  if (_samplerPromise[instrName]) {
    return _samplerPromise[instrName];
  }

  const cfg = SAMPLER_URLS[instrName];
  if (!cfg) {
    console.warn(`[Player] Нет конфига для инструмента: ${instrName}`);
    return null;
  }

  _samplerPromise[instrName] = new Promise((resolve) => {
    const sampler = new Tone.Sampler({
      urls:    cfg.urls,
      baseUrl: cfg.baseUrl,
      onload: () => {
        _samplerReady[instrName] = true;
        _samplerCache[instrName] = sampler;
        sampler.connect(getFxChain(instrName));
        console.log(`✅ ${instrName} загружен`);
        resolve(sampler);
      },
      onerror: (err) => {
        console.error(`❌ Ошибка семплера ${instrName}:`, err);
        delete _samplerPromise[instrName];
        resolve(null);
      },
    });
    // Кладём в кэш сразу (ещё не ready, но объект уже есть)
    _samplerCache[instrName] = sampler;
  });

  return _samplerPromise[instrName];
}

// ─── ХУК ─────────────────────────────────────────────────────────────────────

const useMelodyPlayer = (
  events,
  totalDuration,
  onNotePlay,
  globalEffects = {},
  instrumentEffects = {},
) => {
  const [isPlaying, setIsPlaying]       = useState(false);
  const [currentTime, setCurrentTime]   = useState(0);
  const [volume, setVolume]             = useState(0.5);
  const [loadingState, setLoadingState] = useState({});

  const partRef          = useRef(null);
  const eventsRef        = useRef(events);
  const totalDurationRef = useRef(totalDuration);
  const onNotePlayRef    = useRef(onNotePlay);
  const volumeRef        = useRef(volume);
  const endTimerRef      = useRef(null);
  const isPlayingRef     = useRef(false);

  const globalEffectsRef     = useRef(globalEffects);
  const instrumentEffectsRef = useRef(instrumentEffects);

  const globalFxRef = useRef({ reverb: null, delay: null, distortion: null });
  const instrFxRef  = useRef({});

  useEffect(() => { eventsRef.current        = events;        }, [events]);
  useEffect(() => { totalDurationRef.current = totalDuration; }, [totalDuration]);
  useEffect(() => { onNotePlayRef.current    = onNotePlay;    }, [onNotePlay]);

  useEffect(() => {
    globalEffectsRef.current = globalEffects;
    const fx = globalFxRef.current;
    const { reverb = 0, delay = 0, distortion = 0 } = globalEffects;
    if (fx.reverb)     fx.reverb.wet.value     = reverb;
    if (fx.delay)      fx.delay.wet.value      = delay;
    if (fx.distortion) fx.distortion.wet.value = distortion;
  }, [globalEffects]);

  useEffect(() => {
    instrumentEffectsRef.current = instrumentEffects;
    for (const [instr, fxNodes] of Object.entries(instrFxRef.current)) {
      const vals = instrumentEffects[instr] || DEFAULT_INSTRUMENT_EFFECTS[instr] || {};
      if (fxNodes.reverb)     fxNodes.reverb.wet.value     = vals.reverb     ?? 0;
      if (fxNodes.delay)      fxNodes.delay.wet.value      = vals.delay      ?? 0;
      if (fxNodes.distortion) fxNodes.distortion.wet.value = vals.distortion ?? 0;
    }
  }, [instrumentEffects]);

  useEffect(() => {
    volumeRef.current = volume;
    if (Tone.getContext().state === 'running') {
      Tone.getDestination().volume.value =
        volume === 0 ? -Infinity : 20 * Math.log10(volume);
    }
  }, [volume]);

  // Тикаем currentTime только если этот экземпляр плеера активен
  useEffect(() => {
    const id = setInterval(() => {
      if (isPlayingRef.current && Tone.getTransport().state === 'started') {
        setCurrentTime(Tone.getTransport().seconds);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  const getGlobalFxChain = useCallback(() => {
    const fx = globalFxRef.current;
    if (!fx.reverb) {
      const { reverb = 0, delay = 0, distortion = 0 } = globalEffectsRef.current;
      fx.reverb     = new Tone.Reverb({ decay: 2.5, wet: reverb }).toDestination();
      fx.delay      = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: delay });
      fx.distortion = new Tone.Distortion({ distortion: 0.6, wet: distortion });
      fx.distortion.connect(fx.delay);
      fx.delay.connect(fx.reverb);
    }
    return fx.distortion;
  }, []);

  const getInstrFxChain = useCallback((instrName) => {
    if (!instrFxRef.current[instrName]) {
      const vals = instrumentEffectsRef.current[instrName] || DEFAULT_INSTRUMENT_EFFECTS[instrName] || {};
      const reverb     = new Tone.Reverb({ decay: 2.0, wet: vals.reverb     ?? 0 });
      const delay      = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.25, wet: vals.delay ?? 0 });
      const distortion = new Tone.Distortion({ distortion: 0.5, wet: vals.distortion ?? 0 });
      distortion.connect(delay);
      delay.connect(reverb);
      reverb.connect(getGlobalFxChain());
      instrFxRef.current[instrName] = { reverb, delay, distortion };
    }
    return instrFxRef.current[instrName].distortion;
  }, [getGlobalFxChain]);

  const preloadSamplers = useCallback(async (evs) => {
    if (!evs?.length) return;
    const needed = new Set(evs.map(e => resolveInstrumentName(e.instrument)));
    await Promise.all([...needed].map(async (name) => {
      setLoadingState(prev => ({ ...prev, [name]: 'loading' }));
      const s = await getOrLoadSampler(name, getInstrFxChain);
      setLoadingState(prev => ({ ...prev, [name]: s ? 'ready' : 'error' }));
    }));
  }, [getInstrFxChain]);

  useEffect(() => {
    if (!events?.length) return;
    preloadSamplers(events);
  }, [events, preloadSamplers]);

  const createPart = useCallback(() => {
    if (partRef.current) {
      try { partRef.current.stop(); partRef.current.dispose(); } catch (_) {}
      partRef.current = null;
    }

    const currentEvents = eventsRef.current;
    if (!currentEvents?.length) return null;

    getGlobalFxChain();

    const part = new Tone.Part((time, note) => {
      const { freq, duration, instrument, volume: noteVol } = note;
      const instrName = resolveInstrumentName(instrument);

      // Берём из глобального кэша — он никогда не dispose'ится между рендерами
      const sampler = _samplerReady[instrName] ? _samplerCache[instrName] : null;

      if (sampler) {
        const velocity = Math.min(1, noteVol * volumeRef.current * 2.0);
        sampler.triggerAttackRelease(freq, duration, time, velocity);
      } else {
        // Фоллбэк на осциллятор если сэмплер ещё не готов
        const oscType = OSC_FALLBACK[instrName] || 'sine';
        const synth = new Tone.Synth({
          oscillator: { type: oscType },
          envelope:   { attack: 0.02, decay: 0.1, sustain: 0.35, release: 0.2 },
        });
        const gainNode = new Tone.Gain(noteVol * volumeRef.current);
        synth.connect(gainNode);
        gainNode.connect(getInstrFxChain(instrName));
        synth.triggerAttackRelease(freq, duration, time);
        const cleanupDelay = (Tone.Time(duration).toSeconds() + 0.5) * 1000;
        setTimeout(() => {
          try { synth.dispose(); } catch (_) {}
          try { gainNode.dispose(); } catch (_) {}
        }, cleanupDelay);
      }

      if (onNotePlayRef.current) onNotePlayRef.current(note);
    }, currentEvents.map(ev => ({ time: ev.time, ...ev })));

    part.loop = false;
    return part;
  }, [getGlobalFxChain, getInstrFxChain]);

  const _stopTransport = useCallback(() => {
    if (endTimerRef.current) {
      clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }
    Tone.getTransport().pause();
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (endTimerRef.current) {
      clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }
    Tone.getTransport().stop();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    if (partRef.current) {
      try { partRef.current.stop(); partRef.current.dispose(); } catch (_) {}
      partRef.current = null;
    }
  }, []);

  const pause = useCallback(() => { _stopTransport(); }, [_stopTransport]);

  const skip = useCallback((seconds) => {
    const transport = Tone.getTransport();
    const newTime = Math.min(
      Math.max(transport.seconds + seconds, 0),
      totalDurationRef.current
    );
    transport.seconds = newTime;
    setCurrentTime(newTime);
  }, []);

  const seek = useCallback((seconds) => {
    const transport = Tone.getTransport();
    const newTime = Math.min(Math.max(seconds, 0), totalDurationRef.current);
    transport.seconds = newTime;
    setCurrentTime(newTime);
  }, []);

  const play = useCallback(async () => {
    await Tone.start();
    Tone.getDestination().volume.value =
      volumeRef.current === 0 ? -Infinity : 20 * Math.log10(volumeRef.current);

    const transport = Tone.getTransport();

    if (!partRef.current) {
      // Ждём загрузки через глобальный кэш — onload гарантирует готовность буферов
      await preloadSamplers(eventsRef.current);
      const newPart = createPart();
      if (!newPart) return;
      partRef.current = newPart;
      partRef.current.start(0);
    }

    transport.start();
    isPlayingRef.current = true;
    setIsPlaying(true);

    const remaining = (totalDurationRef.current - transport.seconds) * 1000;
    endTimerRef.current = setTimeout(() => {
      stop();
    }, Math.max(remaining, 0));
  }, [createPart, stop, preloadSamplers]);

  useEffect(() => {
    if (!isPlaying && partRef.current) {
      try { partRef.current.dispose(); } catch (_) {}
      partRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Cleanup при размонтировании — НЕ трогаем глобальный кэш сэмплеров!
  useEffect(() => {
    return () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      if (partRef.current) {
        try { partRef.current.stop(); partRef.current.dispose(); } catch (_) {}
      }
      for (const fxNodes of Object.values(instrFxRef.current)) {
        try { fxNodes.reverb.dispose(); fxNodes.delay.dispose(); fxNodes.distortion.dispose(); } catch (_) {}
      }
      const gfx = globalFxRef.current;
      try { gfx.reverb?.dispose(); gfx.delay?.dispose(); gfx.distortion?.dispose(); } catch (_) {}
      isPlayingRef.current = false;
      Tone.getTransport().stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isPlaying,
    currentTime,
    totalDuration: totalDurationRef.current,
    volume,
    setVolume,
    play,
    pause,
    stop,
    skip,
    seek,
    loadingState,
    preloadSamplers,
  };
};

export default useMelodyPlayer;