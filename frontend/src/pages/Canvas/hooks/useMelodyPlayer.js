// hooks/useMelodyPlayer.js
import { useEffect, useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';

// ─── Маппинг инструментов ────────────────────────────────────────────────────
//
// Цвет → инструмент (совпадает с MelodyEngine.COLOR_TO_INSTRUMENT):
//   #00ffd1 → piano   (sine)
//   #ff3366 → guitar  (square)
//   #ffcc00 → flute   (sawtooth)
//   #9900ff → strings (triangle)
//
// Семплы из /public/samples/<instrument>/
// ВАЖНО: все файлы должны быть в формате .mp3
//
// Диапазон движка: C3–C6. Tone.Sampler интерполирует (pitch-shift)
// недостающие ноты между имеющимися сэмплами автоматически.
//

const SAMPLER_URLS = {
  piano: {
    baseUrl: '/samples/piano/',
    // Только ноты C3 и выше — они точно в диапазоне движка (C3–C6)
    // и не содержат проблемных файлов вроде A0.ogg
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
      B2: 'B2.mp3', C3: 'C3.mp3',  D3: 'D3.mp3',  E3: 'E3.mp3',
      'F#3': 'Fs3.mp3', G3: 'G3.mp3', A3: 'A3.mp3', B3: 'B3.mp3',
      C4: 'C4.mp3', D4: 'D4.mp3',  E4: 'E4.mp3',  'F#4': 'Fs4.mp3',
      G4: 'G4.mp3', A4: 'A4.mp3',  B4: 'B4.mp3',  C5: 'C5.mp3',
    },
  },

  flute: {
    baseUrl: '/samples/flute/',
    // Убраны проблемные файлы: B4, D5, Fs5, G5, B5, D6, Fs6, G6
    urls: {
      A4: 'A4.ogg',
      C5: 'C5.ogg', E5: 'E5.ogg', A5: 'A5.ogg',
      C6: 'C6.ogg', E6: 'E6.ogg', A6: 'A6.ogg',
    },
  },

  strings: {
    baseUrl: '/samples/violin/',
    // Убраны проблемные файлы: B3, D4, F4, B4, D5, F5
    urls: {
      A3: 'A3.ogg',
      C4: 'C4.ogg', E4: 'E4.ogg', G4: 'G4.ogg', A4: 'A4.ogg',
      C5: 'C5.ogg', E5: 'E5.ogg', G5: 'G5.ogg', A5: 'A5.ogg',
    },
  },
};

// Осциллятор как запасной вариант (если семпл не загрузился совсем)
const OSC_FALLBACK = {
  piano:   'sine',
  guitar:  'square',
  flute:   'sawtooth',
  strings: 'triangle',
};

// COLOR → instrument name (зеркалит MelodyEngine)
export const COLOR_TO_INSTRUMENT_NAME = {
  '#00ffd1': 'piano',
  '#ff3366': 'guitar',
  '#ffcc00': 'flute',
  '#9900ff': 'strings',
};

// instrument name → legacy oscillator key (для совместимости с events из MelodyEngine)
const LEGACY_TO_INSTRUMENT = {
  sine:     'piano',
  square:   'guitar',
  sawtooth: 'flute',
  triangle: 'strings',
};

function resolveInstrumentName(instrument) {
  return LEGACY_TO_INSTRUMENT[instrument] || instrument || 'piano';
}

// ─── Дефолтные эффекты на инструмент ────────────────────────────────────────
const DEFAULT_INSTRUMENT_EFFECTS = {
  piano:   { reverb: 0, delay: 0, distortion: 0 },
  guitar:  { reverb: 0, delay: 0, distortion: 0 },
  flute:   { reverb: 0, delay: 0, distortion: 0 },
  strings: { reverb: 0, delay: 0, distortion: 0 },
};

/**
 * @param {Array}    events              — нотные события из MelodyEngine
 * @param {number}   totalDuration       — длина мелодии в секундах
 * @param {Function} onNotePlay          — колбэк при воспроизведении ноты
 * @param {object}   globalEffects       — { reverb, delay, distortion } 0..1 для всей мелодии
 * @param {object}   instrumentEffects   — { piano: {reverb,delay,distortion}, guitar: {...}, ... }
 */
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
  const [loadingState, setLoadingState] = useState({}); // { piano: 'loading'|'ready'|'error' }

  const partRef          = useRef(null);
  const eventsRef        = useRef(events);
  const totalDurationRef = useRef(totalDuration);
  const onNotePlayRef    = useRef(onNotePlay);
  const volumeRef        = useRef(volume);
  const endTimerRef      = useRef(null);

  const globalEffectsRef     = useRef(globalEffects);
  const instrumentEffectsRef = useRef(instrumentEffects);

  // Узлы эффектов: глобальные
  const globalFxRef = useRef({ reverb: null, delay: null, distortion: null });
  // Узлы эффектов: на инструмент { piano: { reverb, delay, distortion }, ... }
  const instrFxRef  = useRef({});
  // Сэмплеры { piano: Tone.Sampler, ... }
  const samplersRef = useRef({});

  // Синхронизируем рефы
  useEffect(() => { eventsRef.current        = events;        }, [events]);
  useEffect(() => { totalDurationRef.current = totalDuration; }, [totalDuration]);
  useEffect(() => { onNotePlayRef.current    = onNotePlay;    }, [onNotePlay]);

  // ── Применяем глобальные эффекты сразу при изменении ──────────────────────
  useEffect(() => {
    globalEffectsRef.current = globalEffects;
    const fx = globalFxRef.current;
    const { reverb = 0, delay = 0, distortion = 0 } = globalEffects;
    if (fx.reverb)     fx.reverb.wet.value     = reverb;
    if (fx.delay)      fx.delay.wet.value      = delay;
    if (fx.distortion) fx.distortion.wet.value = distortion;
  }, [globalEffects]);

  // ── Применяем per-instrument эффекты сразу при изменении ──────────────────
  useEffect(() => {
    instrumentEffectsRef.current = instrumentEffects;
    for (const [instr, fxNodes] of Object.entries(instrFxRef.current)) {
      const vals = instrumentEffects[instr] || DEFAULT_INSTRUMENT_EFFECTS[instr] || {};
      if (fxNodes.reverb)     fxNodes.reverb.wet.value     = vals.reverb     ?? 0;
      if (fxNodes.delay)      fxNodes.delay.wet.value      = vals.delay      ?? 0;
      if (fxNodes.distortion) fxNodes.distortion.wet.value = vals.distortion ?? 0;
    }
  }, [instrumentEffects]);

  // ── Громкость ──────────────────────────────────────────────────────────────
  useEffect(() => {
    volumeRef.current = volume;
    if (Tone.getContext().state === 'running') {
      Tone.getDestination().volume.value =
        volume === 0 ? -Infinity : 20 * Math.log10(volume);
    }
  }, [volume]);

  // ── Поллинг позиции транспорта ─────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (Tone.getTransport().state === 'started') {
        setCurrentTime(Tone.getTransport().seconds);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  // ── Инициализация глобального fx-chain (один раз) ─────────────────────────
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
    return fx.distortion; // начало цепочки
  }, []);

  // ── Инициализация per-instrument fx-chain ─────────────────────────────────
  const getInstrFxChain = useCallback((instrName) => {
    if (!instrFxRef.current[instrName]) {
      const vals = instrumentEffectsRef.current[instrName] || DEFAULT_INSTRUMENT_EFFECTS[instrName] || {};
      const reverb     = new Tone.Reverb({ decay: 2.0, wet: vals.reverb     ?? 0 });
      const delay      = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.25, wet: vals.delay ?? 0 });
      const distortion = new Tone.Distortion({ distortion: 0.5, wet: vals.distortion ?? 0 });
      // цепочка: distortion → delay → reverb → globalChain
      distortion.connect(delay);
      delay.connect(reverb);
      reverb.connect(getGlobalFxChain());
      instrFxRef.current[instrName] = { reverb, delay, distortion };
    }
    return instrFxRef.current[instrName].distortion; // начало per-instrument цепочки
  }, [getGlobalFxChain]);

  // ── Загрузка семплера для инструмента ─────────────────────────────────────
  const loadSampler = useCallback(async (instrName) => {
    // Если уже есть и loaded — возвращаем сразу
    const existing = samplersRef.current[instrName];
    if (existing?.loaded) return existing;

    const cfg = SAMPLER_URLS[instrName];
    if (!cfg) return null;

    // Если уже идёт загрузка (есть объект но ещё не loaded) — ждём через Tone.loaded()
    if (existing && !existing.loaded) {
      try {
        await Tone.loaded();
        return existing.loaded ? existing : null;
      } catch (_) { return null; }
    }

    console.log(`🎵 Загружаем ${instrName}... baseUrl = ${cfg.baseUrl}`);
    setLoadingState(prev => ({ ...prev, [instrName]: 'loading' }));

    // Создаём семплер и сразу подключаем к fx-chain
    const sampler = new Tone.Sampler({
      urls:    cfg.urls,
      baseUrl: cfg.baseUrl,
      onerror: (err) => {
        console.error(`❌ Ошибка файла семплера ${instrName}:`, err);
        // Не фатально — Tone.Sampler продолжит с остальными нотами
      },
    });

    // Сохраняем ссылку сразу, чтобы повторные вызовы не создавали дубли
    samplersRef.current[instrName] = sampler;

    try {
      // Tone.loaded() ждёт загрузки ВСЕХ буферов, созданных к этому моменту
      await Tone.loaded();
      sampler.connect(getInstrFxChain(instrName));
      console.log(`✅ ${instrName} загружен, sampler.loaded =`, sampler.loaded);
      setLoadingState(prev => ({ ...prev, [instrName]: sampler.loaded ? 'ready' : 'error' }));
      return sampler.loaded ? sampler : null;
    } catch (err) {
      console.error(`❌ Tone.loaded() упал для ${instrName}:`, err);
      setLoadingState(prev => ({ ...prev, [instrName]: 'error' }));
      delete samplersRef.current[instrName];
      return null;
    }
  }, [getInstrFxChain]);

  // ── Получить семплер (синхронно из кеша) или null ─────────────────────────
  // Вызывается только внутри Part callback (уже после preloadSamplers)
  const getCachedSampler = useCallback((instrName) => {
    const s = samplersRef.current[instrName];
    return (s?.loaded) ? s : null;
  }, []);

  // ── Предзагрузка семплеров ─────────────────────────────────────────────────
  const preloadSamplers = useCallback(async (evs) => {
    if (!evs?.length) return;
    const needed = new Set(evs.map(e => resolveInstrumentName(e.instrument)));
    await Promise.all([...needed].map(name => loadSampler(name)));
  }, [loadSampler]);

  // ── АВТО-ПРЕДЗАГРУЗКА при изменении events ────────────────────────────────
  // Запускается сразу после генерации мелодии, не ждёт нажатия Play.
  // Tone.start() не нужен для загрузки файлов — только для воспроизведения.
  useEffect(() => {
    if (!events?.length) return;
    preloadSamplers(events);
  }, [events, preloadSamplers]);

  // ── Создание Part из текущих событий ──────────────────────────────────────
  const createPart = useCallback(() => {
    if (partRef.current) {
      partRef.current.stop();
      partRef.current.dispose();
      partRef.current = null;
    }

    const currentEvents = eventsRef.current;
    if (!currentEvents?.length) return null;

    getGlobalFxChain();

    const part = new Tone.Part((time, note) => {
      const { freq, duration, instrument, volume: noteVol } = note;
      const instrName = resolveInstrumentName(instrument);

      const sampler = getCachedSampler(instrName);
      if (sampler) {
        const velocity = Math.min(1, noteVol * volumeRef.current * 2.0);
        sampler.triggerAttackRelease(freq, duration, time, velocity);
      } else {
        // Fallback-осциллятор (если семплер не загрузился)
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
  }, [getGlobalFxChain, getInstrFxChain, getCachedSampler]);

  // ── Внутренняя пауза ──────────────────────────────────────────────────────
  const _stopTransport = useCallback(() => {
    if (endTimerRef.current) {
      clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }
    Tone.getTransport().pause();
    setIsPlaying(false);
  }, []);

  // ── Публичные методы ───────────────────────────────────────────────────────

  const stop = useCallback(() => {
    if (endTimerRef.current) {
      clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }
    Tone.getTransport().stop();
    setIsPlaying(false);
    setCurrentTime(0);
    if (partRef.current) {
      partRef.current.dispose();
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
      // Семплеры должны уже грузиться с момента генерации мелодии.
      // Если вдруг ещё нет — ждём.
      await preloadSamplers(eventsRef.current);

      const newPart = createPart();
      if (!newPart) return;
      partRef.current = newPart;
      partRef.current.start(0);
    }

    transport.start();
    setIsPlaying(true);

    const remaining = (totalDurationRef.current - transport.seconds) * 1000;
    endTimerRef.current = setTimeout(() => {
      stop();
    }, Math.max(remaining, 0));
  }, [createPart, stop, preloadSamplers]);

  // Если events изменились — сбрасываем part (новая мелодия)
  useEffect(() => {
    if (!isPlaying && partRef.current) {
      partRef.current.dispose();
      partRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      if (partRef.current) {
        try { partRef.current.stop(); partRef.current.dispose(); } catch (_) {}
      }
      for (const s of Object.values(samplersRef.current)) {
        try { s.dispose(); } catch (_) {}
      }
      for (const fxNodes of Object.values(instrFxRef.current)) {
        try { fxNodes.reverb.dispose(); fxNodes.delay.dispose(); fxNodes.distortion.dispose(); } catch (_) {}
      }
      const gfx = globalFxRef.current;
      try { gfx.reverb?.dispose(); gfx.delay?.dispose(); gfx.distortion?.dispose(); } catch (_) {}
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
    loadingState, // { piano: 'loading'|'ready'|'error', ... }
    preloadSamplers, // экспортируем на случай ручного вызова
  };
};

export default useMelodyPlayer;