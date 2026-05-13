// useMelodyPlayer.js
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
// Семплы берём из бесплатных CDN:
//   - Salamander Grand Piano  (tonejs/examples)
//   - VSCO2-rs Community Edition (nbrosowsky/tonejs-instruments)
//

const SAMPLER_URLS = {
  piano: {
    baseUrl: '/samples/piano/',
    urls: {
      A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
      A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
      A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
      A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
      A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
      A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
      A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
      A7: 'A7.mp3', C8: 'C8.mp3',
    },
  },
  guitar: {
    baseUrl: '/samples/guitar/',
    urls: {
      E2:  'E2.mp3',  'F#2': 'Fs2.mp3', G2:  'G2.mp3',  A2:  'A2.mp3',
      B2:  'B2.mp3',  C3:   'C3.mp3',   D3:  'D3.mp3',   E3:  'E3.mp3',
      'F#3': 'Fs3.mp3', G3: 'G3.mp3',  A3:  'A3.mp3',   B3:  'B3.mp3',
      C4:  'C4.mp3',  D4:   'D4.mp3',   E4:  'E4.mp3',   'F#4': 'Fs4.mp3',
      G4:  'G4.mp3',  A4:   'A4.mp3',   B4:  'B4.mp3',   C5:  'C5.mp3',
    },
  },
  flute: {
    baseUrl: '/samples/flute/',
    urls: {
      A4:  'A4.mp3',  B4:   'B4.mp3',  C5:  'C5.mp3',  D5:  'D5.mp3',
      E5:  'E5.mp3',  'F#5': 'Fs5.mp3', G5: 'G5.mp3',  A5:  'A5.mp3',
      B5:  'B5.mp3',  C6:   'C6.mp3',  D6:  'D6.mp3',  E6:  'E6.mp3',
      'F#6': 'Fs6.mp3', G6: 'G6.mp3', A6:  'A6.mp3',
    },
  },
  strings: {
    baseUrl: '/samples/violin/',
    urls: {
      A3:  'A3.mp3',  B3:  'B3.mp3',  C4:  'C4.mp3',  D4:  'D4.mp3',
      E4:  'E4.mp3',  F4:  'F4.mp3',  G4:  'G4.mp3',  A4:  'A4.mp3',
      B4:  'B4.mp3',  C5:  'C5.mp3',  D5:  'D5.mp3',  E5:  'E5.mp3',
      F5:  'F5.mp3',  G5:  'G5.mp3',  A5:  'A5.mp3',
    },
  },
};

// Осциллятор как запасной вариант (если семпл не загрузился)
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
  // instrument может быть 'sine'/'square'/... или 'piano'/'guitar'/...
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
    if (samplersRef.current[instrName]) return samplersRef.current[instrName];

    const cfg = SAMPLER_URLS[instrName];
    if (!cfg) return null;

    setLoadingState(prev => ({ ...prev, [instrName]: 'loading' }));

    return new Promise((resolve) => {
      const sampler = new Tone.Sampler({
        urls:    cfg.urls,
        baseUrl: cfg.baseUrl,
        onload: () => {
          // подключаем к per-instrument fx
          sampler.connect(getInstrFxChain(instrName));
          samplersRef.current[instrName] = sampler;
          setLoadingState(prev => ({ ...prev, [instrName]: 'ready' }));
          resolve(sampler);
        },
        onerror: (err) => {
          console.warn(`[useMelodyPlayer] Семпл ${instrName} не загрузился:`, err);
          setLoadingState(prev => ({ ...prev, [instrName]: 'error' }));
          resolve(null); // fallback ниже
        },
      });
    });
  }, [getInstrFxChain]);

  // ── Получить или создать семплер/синт для инструмента ─────────────────────
  const getSamplerOrSynth = useCallback(async (instrName) => {
    // Попробуем существующий семплер
    const existing = samplersRef.current[instrName];
    if (existing && existing.loaded) return { node: existing, isSampler: true };

    // Грузим семплер
    const sampler = await loadSampler(instrName);
    if (sampler && sampler.loaded) return { node: sampler, isSampler: true };

    // Fallback: осциллятор
    const oscType = OSC_FALLBACK[instrName] || 'sine';
    const synth = new Tone.Synth({
      oscillator: { type: oscType },
      envelope:   { attack: 0.02, decay: 0.1, sustain: 0.35, release: 0.2 },
    });
    synth.connect(getInstrFxChain(instrName));
    return { node: synth, isSampler: false };
  }, [loadSampler, getInstrFxChain]);

  // ── Предзагрузка семплеров для инструментов в текущих events ──────────────
  const preloadSamplers = useCallback(async (evs) => {
    if (!evs?.length) return;
    const needed = new Set(evs.map(e => resolveInstrumentName(e.instrument)));
    await Promise.all([...needed].map(name => loadSampler(name)));
  }, [loadSampler]);

  // ── Создание Part из текущих событий ──────────────────────────────────────
  const createPart = useCallback(() => {
    if (partRef.current) {
      partRef.current.stop();
      partRef.current.dispose();
      partRef.current = null;
    }

    const currentEvents = eventsRef.current;
    if (!currentEvents?.length) return null;

    // Инициализируем глобальный fx-chain заранее
    getGlobalFxChain();

    const part = new Tone.Part((time, note) => {
      const { freq, duration, instrument, volume: noteVol } = note;
      const instrName = resolveInstrumentName(instrument);

      const sampler = samplersRef.current[instrName];
      if (sampler && sampler.loaded) {
        // Используем семплер напрямую (уже подключён к fx-chain)
        // Громкость через temporary gain
        const gain = new Tone.Gain(noteVol * volumeRef.current * 1.5);
        // Перенаправляем: sampler → gain → instrFxChain
        // (sampler уже подключён к instrFxChain, поэтому создадим отдельный gainNode перед ним)
        // Удобнее просто задать volume на самом самплере на время ноты не получится без параметра velocity
        // — используем velocity (0..1):
        const velocity = Math.min(1, noteVol * volumeRef.current * 2.0);
        sampler.triggerAttackRelease(freq, duration, time, velocity);

        setTimeout(() => {
          try { gain.dispose(); } catch (_) {}
        }, (Tone.Time(duration).toSeconds() + 1) * 1000);
      } else {
        // Fallback-осциллятор
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
      // Убеждаемся, что семплеры загружены
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

  // Если events изменились — сбрасываем part
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
  };
};

export default useMelodyPlayer;