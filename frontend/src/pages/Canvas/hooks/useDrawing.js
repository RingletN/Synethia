// components/Canvas/hooks/useDrawing.js
import { useState, useRef, useCallback } from 'react';
import DrawingEngine from '../../../engines/DrawingEngine';

// Хук инкапсулирует логику работы с DrawingEngine и историей действий.
// Он возвращает реф на движок, функции для управления историей (undo/redo/clear) и флаги canUndo/canRedo.
export const useDrawing = (initialDuration = 8) => { // initialDuration — длительность звука, которую движок использует по умолчанию для новых мазков
    
    const engineRef = useRef(null);

    // История хранится в ref, чтобы колбэки не протухали
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);

    // Стейт для того, чтобы React перерендерил кнопки undo/redo
    const [historyMeta, setHistoryMeta] = useState({ canUndo: false, canRedo: false });

    // Обновляем мета-информацию о возможности undo/redo
    const updateMeta = () => {
        setHistoryMeta({
            canUndo: historyIndexRef.current > 0,
            canRedo: historyIndexRef.current < historyRef.current.length - 1,
        });
    };

    // Сохраняем текущее состояние движка в историю. Вызывается после каждого завершённого мазка.
    const saveToHistory = useCallback(() => {
        if (!engineRef.current) return;
        const state = engineRef.current.getState();

        // Обрезаем "будущее" если оно было (после undo)
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        historyRef.current.push(state);
        historyIndexRef.current = historyRef.current.length - 1;

        updateMeta();
    }, []);

    // Инициализация движка с канвасами. Вызывается один раз при монтировании.
    const initEngine = useCallback((canvases) => {
        if (engineRef.current) return;
        const engine = new DrawingEngine(
            canvases.main,
            canvases.grid,
            initialDuration
        );
        // Сохраняем начальное (пустое) состояние как точку отсчёта
        engineRef.current = engine;

        // Вешаем колбэк: каждый завершённый мазок, потом автосохранение в историю
        engine.onStrokeEnd = saveToHistory;

        // Сохраняем пустое начальное состояние
        historyRef.current = [engine.getState()];
        historyIndexRef.current = 0;
        updateMeta();
    }, [initialDuration, saveToHistory]);

    // Undo/redo/clear — просто навигируем по сохранённым состояниям и загружаем их в движок.
    const undo = useCallback(() => {
        if (historyIndexRef.current <= 0 || !engineRef.current) return;
        historyIndexRef.current -= 1;
        engineRef.current.loadState(historyRef.current[historyIndexRef.current]);
        updateMeta();
    }, []);

    const redo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1 || !engineRef.current) return;
        historyIndexRef.current += 1;
        engineRef.current.loadState(historyRef.current[historyIndexRef.current]);
        updateMeta();
    }, []);

    const clear = useCallback(() => {
        if (!engineRef.current) return;
        engineRef.current.clear();
        // Сохраняем очищенное состояние в историю (можно undo после clear)
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        historyRef.current.push(engineRef.current.getState());
        historyIndexRef.current = historyRef.current.length - 1;
        updateMeta();
    }, []);

    return {
        engineRef,
        initEngine,
        saveToHistory,
        undo,
        redo,
        clear,
        canUndo: historyMeta.canUndo,
        canRedo: historyMeta.canRedo,
    };
};