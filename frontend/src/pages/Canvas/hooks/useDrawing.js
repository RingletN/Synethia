import { useState, useRef, useCallback } from "react";
import DrawingEngine from "../../../engines/DrawingEngine";

// Хук инкапсулирует логику работы с DrawingEngine и историей действий
export const useDrawing = (initialDuration = 8, initialBgColor = "#4D4DFF") => {
  const engineRef = useRef(null);

  // История хранится в ref, чтобы колбэки не протухали
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  // Стейт для того, чтобы React перерендерил кнопки undo/redo
  const [historyMeta, setHistoryMeta] = useState({
    canUndo: false,
    canRedo: false,
  });

  // Обновляем мета-информацию о возможности undo/redo
  const updateMeta = () => {
    setHistoryMeta({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    });
  };

  const saveToHistory = useCallback((bgColor) => {
    if (!engineRef.current) return;
    const state = {
      ...engineRef.current.getState(),
      bgColor,
    };
    historyRef.current = historyRef.current.slice(
      0,
      historyIndexRef.current + 1,
    );
    historyRef.current.push(state);
    historyIndexRef.current = historyRef.current.length - 1;
    updateMeta();
  }, []);

  const initEngine = useCallback(
    (canvases) => {
      if (engineRef.current) return;
      const engine = new DrawingEngine(canvases.main, initialDuration);
      engineRef.current = engine;
      // Передаём текущий bgColor при сохранении мазка — Canvas.jsx пробросит его через колбэк
      historyRef.current = [{ ...engine.getState(), bgColor: initialBgColor }];
      historyIndexRef.current = 0;
      updateMeta();
    },
    [initialDuration, initialBgColor],
  );

  // undo/redo теперь возвращают bgColor из состояния
  const undo = useCallback((getCurrentBgColor, onBgColorRestore) => {
    if (historyIndexRef.current <= 0 || !engineRef.current) return;
    historyIndexRef.current -= 1;
    const state = historyRef.current[historyIndexRef.current];
    engineRef.current.loadState(state);
    if (onBgColorRestore) onBgColorRestore(state.bgColor);
    updateMeta();
  }, []);

  const redo = useCallback((getCurrentBgColor, onBgColorRestore) => {
    if (
      historyIndexRef.current >= historyRef.current.length - 1 ||
      !engineRef.current
    )
      return;
    historyIndexRef.current += 1;
    const state = historyRef.current[historyIndexRef.current];
    engineRef.current.loadState(state);
    if (onBgColorRestore) onBgColorRestore(state.bgColor);
    updateMeta();
  }, []);

  const clear = useCallback((bgColor) => {
    if (!engineRef.current) return;
    engineRef.current.clear();
    historyRef.current = historyRef.current.slice(
      0,
      historyIndexRef.current + 1,
    );
    historyRef.current.push({ ...engineRef.current.getState(), bgColor });
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
