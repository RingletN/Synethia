// hooks/useAudioExporter.js
import * as Tone from 'tone';

export const useAudioExporter = (melodyEvents, totalDuration) => {

  const exportToWAV = async (filename = 'melody.wav') => {
    if (!melodyEvents?.length) {
      alert('Сначала сгенерируйте мелодию');
      return;
    }

    try {
      // Сортируем ноты по времени — ОЧЕНЬ ВАЖНО!
      const sortedEvents = [...melodyEvents].sort((a, b) => a.time - b.time);

      console.log(`🎵 Рендерим ${sortedEvents.length} нот, длительность ${totalDuration}с`);

      const renderedBuffer = await Tone.Offline((context) => {
        
        const destination = context.destination;
        destination.volume.value = 6; // boost

        const synths = {
          sine:     new Tone.Synth({ oscillator: { type: 'sine' },     envelope: { attack: 0.02, decay: 0.12, sustain: 0.55, release: 0.35 } }).toDestination(),
          square:   new Tone.Synth({ oscillator: { type: 'square' },   envelope: { attack: 0.02, decay: 0.1,  sustain: 0.45, release: 0.3  } }).toDestination(),
          sawtooth: new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.15, sustain: 0.5,  release: 0.35 } }).toDestination(),
          triangle: new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.12, sustain: 0.55, release: 0.35 } }).toDestination(),
        };

        sortedEvents.forEach((note, index) => {
          const synth = synths[note.instrument] || synths.sine;
          const vol = Math.max(0.65, (note.volume || 0.8) * 1.7);

          // Добавляем небольшое смещение, если времена одинаковые
          const safeTime = note.time + (index * 0.0001);

          synth.triggerAttackRelease(
            note.freq,
            note.duration || 0.25,
            safeTime,
            vol
          );
        });

      }, totalDuration + 2.0);

      console.log('✅ Рендер завершён. Длительность буфера:', renderedBuffer.duration.toFixed(2), 'сек');

      const wavBlob = audioBufferToWav(renderedBuffer);
      downloadBlob(wavBlob, filename);

      console.log('✅ Файл сохранён:', filename);

    } catch (err) {
      console.error('Ошибка рендеринга:', err);
      alert('Ошибка при создании WAV. Попробуйте сгенерировать мелодию заново.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  const audioBufferToWav = (buffer) => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const dataLength = buffer.length * numChannels * 2;
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = buffer.getChannelData(ch)[i] || 0;
        sample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, sample * 32767, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return { exportToWAV };
};