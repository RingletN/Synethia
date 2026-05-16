// src/pages/Canvas/hooks/useProjectSave.js
import { useState, useCallback } from 'react';
import api from '../../../api'; // src/api.js

/**
 * @param {object} params
 * @param {React.RefObject} params.engineRef       — DrawingEngine ref
 * @param {string}  params.bgColor                 — текущий цвет фона
 * @param {object}  params.canvasSize              — { width, height }
 * @param {number}  params.bpm
 * @param {number}  params.duration
 * @param {string}  params.scale
 * @param {number}  params.smoothing
 * @param {number}  params.effectReverb
 * @param {number}  params.effectDelay
 * @param {number}  params.effectDistortion
 * @param {Array}   params.melodyEvents            — [] если мелодия не генерировалась
 * @param {number}  params.totalDuration
 * @param {boolean} params.isMelodyGenerated
 * @param {Function} params.showModal              — (title, description, variant) => void
 */
export const useProjectSave = ({
    engineRef,
    bgColor,
    canvasSize,
    bpm,
    duration,
    scale,
    smoothing,
    effectReverb,
    effectDelay,
    effectDistortion,
    melodyEvents,
    totalDuration,
    isMelodyGenerated,
    showModal,
}) => {
    const [isSaving, setIsSaving] = useState(false);
    // project_id хранится после первого сохранения — для последующих обновлений
    const [projectId, setProjectId] = useState(null);

    const save = useCallback(async (title) => {
        if (!engineRef.current) {
            showModal('Ошибка', 'Движок рисования не инициализирован', 'error');
            return;
        }

        const segments = engineRef.current.getAllSegments();

        const payload = {
            // Если проект уже был сохранён — передаём id для обновления
            ...(projectId ? { project_id: projectId } : {}),

            title: title || 'Без названия',

            canvas: {
                segments,
                bg_color: bgColor,
                width:    canvasSize.width,
                height:   canvasSize.height,
            },

            settings: {
                bpm,
                duration,
                scale,
                smoothing,
                reverb:      effectReverb,
                delay:       effectDelay,
                distortion:  effectDistortion,
            },

            // Мелодию прикладываем только если она была сгенерирована
            ...(isMelodyGenerated && melodyEvents.length > 0
                ? { melody: { events: melodyEvents, total_duration: totalDuration } }
                : {}),
        };

        setIsSaving(true);
        try {
            const data = await api.post('/api/projects', payload);
            setProjectId(data.project_id);
            showModal('Сохранено', 'Проект успешно сохранён!', 'success');
        } catch (err) {
            showModal('Ошибка сохранения', err.message || 'Неизвестная ошибка', 'error');
        } finally {
            setIsSaving(false);
        }
    }, [
        engineRef, bgColor, canvasSize, bpm, duration, scale, smoothing,
        effectReverb, effectDelay, effectDistortion, melodyEvents, totalDuration,
        isMelodyGenerated, showModal, projectId,
    ]);

    return { save, isSaving, projectId, setProjectId };
};