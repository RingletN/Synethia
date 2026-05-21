import { useState, useRef, useCallback, useEffect } from "react";

const CANVAS_BLOCK_GAP = 46;
const SETTINGS_MIN_WIDTH = 200;
const CANVAS_MIN_SIZE = 600;
const INITIAL_CANVAS_WIDTH = 750;
const INITIAL_CANVAS_HEIGHT = 600;

export const useCanvasResize = (engineRef, canvasPanelRef, drawBlockRef) => {
  const [canvasSize, setCanvasSize] = useState({
    width: INITIAL_CANVAS_WIDTH,
    height: INITIAL_CANVAS_HEIGHT,
  });

  const isDraggingRef = useRef(false);
  const dragDirRef = useRef(null);
  const currentSizeRef = useRef({
    w: INITIAL_CANVAS_WIDTH,
    h: INITIAL_CANVAS_HEIGHT,
  });
  const pendingResizeRef = useRef(null);

  const handleResizeMouseDown = useCallback(
    (dir) => (e) => {
      e.preventDefault();
      isDraggingRef.current = true;
      dragDirRef.current = dir;
      currentSizeRef.current = {
        w: canvasPanelRef.current?.clientWidth ?? INITIAL_CANVAS_WIDTH,
        h: canvasPanelRef.current?.clientHeight ?? INITIAL_CANVAS_HEIGHT,
      };
    },
    [canvasPanelRef],
  );

  // Эффект для отслеживания движения мыши при ресайзе
  useEffect(() => {
    let rafId = null;

    const onMove = (e) => {
      if (
        !isDraggingRef.current ||
        !canvasPanelRef.current ||
        !engineRef.current
      )
        return;

      const clientX = e.clientX;
      const clientY = e.clientY;

      if (rafId !== null) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (
          !isDraggingRef.current ||
          !canvasPanelRef.current ||
          !engineRef.current
        )
          return;

        const rect = canvasPanelRef.current.getBoundingClientRect();
        const containerRect = drawBlockRef.current?.getBoundingClientRect();
        const maxW = containerRect
          ? containerRect.width - CANVAS_BLOCK_GAP - SETTINGS_MIN_WIDTH
          : 2000;
        const rawW = Math.round(clientX - rect.left);
        const rawH = Math.round(clientY - rect.top);
        const newW =
          dragDirRef.current !== "vertical"
            ? Math.min(maxW, Math.max(CANVAS_MIN_SIZE, rawW))
            : currentSizeRef.current.w;
        const newH =
          dragDirRef.current !== "horizontal"
            ? Math.max(CANVAS_MIN_SIZE, rawH)
            : currentSizeRef.current.h;

        engineRef.current.resize(newW, newH);
        canvasPanelRef.current.style.width = `${newW}px`;
        canvasPanelRef.current.style.height = `${newH}px`;
        setCanvasSize({ width: newW, height: newH });
      });
    };

    const onUp = () => {
      isDraggingRef.current = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [engineRef, canvasPanelRef, drawBlockRef]);

  const syncLayout = useCallback(() => {
    const canvasEl = canvasPanelRef.current;
    const container = drawBlockRef.current;
    if (!canvasEl || !container) return;
    const maxW = Math.max(
      CANVAS_MIN_SIZE,
      container.offsetWidth - CANVAS_BLOCK_GAP - SETTINGS_MIN_WIDTH,
    );
    canvasEl.style.maxWidth = `${maxW}px`;
  }, [canvasPanelRef, drawBlockRef]);

  // Отложенный ресайз (если нужно применить позже)
  const scheduleResize = useCallback((width, height) => {
    pendingResizeRef.current = { width, height };
  }, []);

  // Применяем отложенный ресайз, когда движок готов
  useEffect(() => {
    if (!pendingResizeRef.current || !engineRef.current) return;
    const { width, height } = pendingResizeRef.current;
    pendingResizeRef.current = null;
    engineRef.current.resize(width, height);
  }, [engineRef]);

  return {
    canvasSize,
    setCanvasSize,
    handleResizeMouseDown,
    syncLayout,
    scheduleResize,
  };
};
