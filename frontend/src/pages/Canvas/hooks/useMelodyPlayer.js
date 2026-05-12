// useMelodyPlayer.js
import { useEffect, useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';

const instrumentToOscType = (instrument) => {
  switch (instrument) {
    case 'square':   return 'square';
    case 'sawtooth': return 'sawtooth';
    case 'triangle': return 'triangle';
    default:         return 'sine';
  }
};

const useMelodyPlayer = (events, totalDuration, onNotePlay) => {
  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume]         = useState(0.5);

  const partRef          = useRef(null);
  const eventsRef        = useRef(events);
  const totalDurationRef = useRef(totalDuration);
  const onNotePlayRef    = useRef(onNotePlay);
  const volumeRef        = useRef(volume);
  const endTimerRef      = useRef(null);

  // Синхронизируем рефы с пропсами
  useEffect(() => { eventsRef.current        = events;        }, [events]);
  useEffect(() => { totalDurationRef.current = totalDuration; }, [totalDuration]);
  useEffect(() => { onNotePlayRef.current    = onNotePlay;    }, [onNotePlay]);

  // Громкость — применяем сразу, если контекст уже живой
  useEffect(() => {
    volumeRef.current = volume;
    if (Tone.getContext().state === 'running') {
      Tone.getDestination().volume.value =
        volume === 0 ? -Infinity : 20 * Math.log10(volume);
    }
  }, [volume]);

  // Поллинг позиции транспорта
  useEffect(() => {
    const id = setInterval(() => {
      if (Tone.getTransport().state === 'started') {
        setCurrentTime(Tone.getTransport().seconds);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  // ── Создание Part из текущих событий ───────────────────────────────────────
  const createPart = useCallback(() => {
    if (partRef.current) {
      partRef.current.stop();
      partRef.current.dispose();
      partRef.current = null;
    }

    const currentEvents = eventsRef.current;
    if (!currentEvents?.length) return null;

    // Реверб — один на всё время жизни хука
    if (!createPart._reverb) {
      createPart._reverb = new Tone.Reverb({ decay: 1.2, wet: 0.25 }).toDestination();
    }
    const reverb = createPart._reverb;

    const part = new Tone.Part((time, note) => {
      const { freq, duration, instrument, volume: noteVol } = note;

      const synth = new Tone.Synth({
        oscillator: { type: instrumentToOscType(instrument) },
        envelope:   { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.1 },
        // НЕ вызываем .toDestination() — маршрут управляем вручную
      });

      const gainNode = new Tone.Gain(noteVol * volumeRef.current);

      // Правильная цепочка: synth → gainNode → reverb → Destination
      synth.connect(gainNode);
      gainNode.connect(reverb);

      synth.triggerAttackRelease(freq, duration, time);

      // Чистим ноду после релиза, чтобы не копился мусор
      const cleanupDelay = (Tone.Time(duration).toSeconds() + 0.5) * 1000;
      setTimeout(() => {
        try { synth.dispose(); } catch (_) {}
        try { gainNode.dispose(); } catch (_) {}
      }, cleanupDelay);

      if (onNotePlayRef.current) onNotePlayRef.current(note);
    }, currentEvents.map(ev => ({ time: ev.time, ...ev })));

    part.loop = false;
    return part;
  }, []);

  // ── Внутренняя остановка без сброса позиции ────────────────────────────────
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
    // Уничтожаем part — при следующем play создадим свежий
    if (partRef.current) {
      partRef.current.dispose();
      partRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    _stopTransport();
  }, [_stopTransport]);

  const skip = useCallback((seconds) => {
    const transport = Tone.getTransport();
    const newTime = Math.min(
      Math.max(transport.seconds + seconds, 0),
      totalDurationRef.current
    );
    transport.seconds = newTime;
    setCurrentTime(newTime);
  }, []);

  const play = useCallback(async () => {
    await Tone.start(); // пробуждаем AudioContext
    Tone.getDestination().volume.value =
      volumeRef.current === 0 ? -Infinity : 20 * Math.log10(volumeRef.current);

    const transport = Tone.getTransport();

    // Если part не существует (первый запуск или после stop) — создаём
    if (!partRef.current) {
      const newPart = createPart();
      if (!newPart) return;
      partRef.current = newPart;
      partRef.current.start(0); // запланировать от начала транспорта
    }
    // Если transport уже был остановлен полностью и position = 0 — start заново
    // Если был на паузе — просто resume (Transport.start продолжит с текущей позиции)

    transport.start();
    setIsPlaying(true);

    // Авто-стоп по окончании мелодии
    const remaining = (totalDurationRef.current - transport.seconds) * 1000;
    endTimerRef.current = setTimeout(() => {
      stop();
    }, Math.max(remaining, 0));
  }, [createPart, stop]);

  // Если events изменились — сбрасываем part, чтобы при следующем play пересоздался
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
        partRef.current.stop();
        partRef.current.dispose();
      }
      if (createPart._reverb) {
        createPart._reverb.dispose();
        createPart._reverb = null;
      }
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
  };
};

export default useMelodyPlayer;