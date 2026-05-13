// hooks/useAudioExporter.js
//
// Экспорт в WAV с использованием тех же самплеров, что и плеер.
// Маппинг: sine→piano, square→guitar, sawtooth→flute, triangle→strings
// Семплы берутся из /samples/<instrument>/

import * as Tone from 'tone';

// ─── Те же SAMPLER_URLS, что и в useMelodyPlayer ─────────────────────────────
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
            A4: 'A4.mp3', B4: 'B4.mp3', C5: 'C5.mp3', D5: 'D5.mp3',
            E5: 'E5.mp3', 'F#5': 'Fs5.mp3', G5: 'G5.mp3', A5: 'A5.mp3',
            B5: 'B5.mp3', C6: 'C6.mp3', D6: 'D6.mp3', E6: 'E6.mp3',
            'F#6': 'Fs6.mp3', G6: 'G6.mp3', A6: 'A6.mp3',
        },
    },
    strings: {
        baseUrl: '/samples/violin/',
        urls: {
            A3: 'A3.mp3', B3: 'B3.mp3', C4: 'C4.mp3', D4: 'D4.mp3',
            E4: 'E4.mp3', F4: 'F4.mp3', G4: 'G4.mp3', A4: 'A4.mp3',
            B4: 'B4.mp3', C5: 'C5.mp3', D5: 'D5.mp3', E5: 'E5.mp3',
            F5: 'F5.mp3', G5: 'G5.mp3', A5: 'A5.mp3',
        },
    },
};

// Маппинг legacy осциллятора → реальный инструмент
const LEGACY_TO_INSTRUMENT = {
    sine:     'piano',
    square:   'guitar',
    sawtooth: 'flute',
    triangle: 'strings',
};

function resolveInstrumentName(instrument) {
    return LEGACY_TO_INSTRUMENT[instrument] || instrument || 'piano';
}

// ─── Загрузить один семплер в Offline-контексте ───────────────────────────────
function loadSamplerOffline(instrName, destination) {
    const cfg = SAMPLER_URLS[instrName];
    if (!cfg) return Promise.resolve(null);

    return new Promise((resolve) => {
        const sampler = new Tone.Sampler({
            urls:    cfg.urls,
            baseUrl: cfg.baseUrl,
            onload:  () => resolve(sampler),
            onerror: (err) => {
                console.warn(`[Exporter] Не удалось загрузить семплер ${instrName}:`, err);
                resolve(null);
            },
        }).connect(destination);
        // Таймаут на случай зависания загрузки
        setTimeout(() => resolve(sampler), 10_000);
    });
}

export const useAudioExporter = (melodyEvents, totalDuration) => {

    const exportToWAV = async (filename = 'melody.wav') => {
        if (!melodyEvents?.length) {
            alert('Сначала сгенерируйте мелодию');
            return;
        }

        try {
            const sortedEvents = [...melodyEvents].sort((a, b) => a.time - b.time);
            console.log(`🎵 Экспорт: ${sortedEvents.length} нот, длительность ${totalDuration} с`);

            // Определяем какие инструменты нужны
            const neededInstrs = [...new Set(
                sortedEvents.map(e => resolveInstrumentName(e.instrument))
            )];
            console.log('🎼 Инструменты:', neededInstrs);

            const renderedBuffer = await Tone.Offline(async (offlineContext) => {
                const destination = offlineContext.destination;
                destination.volume.value = 0; // 0 dB — без лишнего буста

                // Загружаем семплеры
                const samplers = {};
                await Promise.all(
                    neededInstrs.map(async (instrName) => {
                        const s = await loadSamplerOffline(instrName, destination);
                        if (s) {
                            samplers[instrName] = s;
                            console.log(`✅ Семплер загружен: ${instrName}`);
                        } else {
                            console.warn(`⚠️ Семплер недоступен: ${instrName}, используем fallback`);
                        }
                    })
                );

                // Планируем ноты
                sortedEvents.forEach((note, index) => {
                    const instrName = resolveInstrumentName(note.instrument);
                    const sampler   = samplers[instrName];
                    const velocity  = Math.min(1, Math.max(0.1, (note.volume || 0.5) * 2.0));
                    const safeTime  = note.time + (index * 0.0001);

                    if (sampler && sampler.loaded) {
                        sampler.triggerAttackRelease(
                            note.freq,
                            note.duration || 0.25,
                            safeTime,
                            velocity,
                        );
                    } else {
                        // Fallback: синтезатор с тем же тембром, что использует плеер
                        const oscMap = {
                            piano:   'sine',
                            guitar:  'square',
                            flute:   'sawtooth',
                            strings: 'triangle',
                        };
                        const synth = new Tone.Synth({
                            oscillator: { type: oscMap[instrName] || 'sine' },
                            envelope:   { attack: 0.02, decay: 0.1, sustain: 0.35, release: 0.2 },
                        }).connect(destination);
                        synth.triggerAttackRelease(note.freq, note.duration || 0.25, safeTime, velocity);
                    }
                });

            }, totalDuration + 2.0);

            console.log('✅ Рендер завершён. Длина буфера:', renderedBuffer.duration.toFixed(2), 'с');

            const wavBlob = audioBufferToWav(renderedBuffer);
            downloadBlob(wavBlob, filename);
            console.log('✅ Файл сохранён:', filename);

        } catch (err) {
            console.error('Ошибка рендеринга:', err);
            alert('Ошибка при создании WAV. Попробуйте сгенерировать мелодию заново.');
        }
    };

    // ─── WAV ──────────────────────────────────────────────────────────────────
    const audioBufferToWav = (buffer) => {
        const numChannels = buffer.numberOfChannels;
        const sampleRate  = buffer.sampleRate;
        const dataLength  = buffer.length * numChannels * 2;
        const bufferLen   = 44 + dataLength;

        const arrayBuffer = new ArrayBuffer(bufferLen);
        const view        = new DataView(arrayBuffer);

        const writeString = (offset, str) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };

        writeString(0, 'RIFF');
        view.setUint32(4, bufferLen - 8, true);
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
        const a   = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    };

    return { exportToWAV };
};