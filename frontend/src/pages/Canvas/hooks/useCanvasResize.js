import { useState, useRef, useCallback, useEffect } from "react";

const CANVAS_BLOCK_GAP = 46;
const SETTINGS_MIN_WIDTH = 200;
const CANVAS_MIN_WIDTH = 780;
const CANVAS_MIN_HEIGHT = 700;
const INITIAL_CANVAS_WIDTH = 780;
const INITIAL_CANVAS_HEIGHT = 700;

export const useCanvasResize = (engineRef, canvasPanelRef, drawBlockRef) => {
  const [canvasSize, setCanvasSize] = useState({
    width: INITIAL_CANVAS_WIDTH,
    height: INITIAL_CANVAS_HEIGHT,
  });

  const isDraggingRef = useRef(false);
  const dragDirRef = useRef(null);

  const applySize = useCallback(
    (newW, newH) => {
      if (engineRef.current) {
        engineRef.current._doResize(newW, newH);
      }
      setCanvasSize({ width: newW, height: newH });
    },
    [engineRef],
  );

  const handleResizeMouseDown = useCallback(
    (dir) => (e) => {
      e.preventDefault();
      isDraggingRef.current = true;
      dragDirRef.current = dir;
    },
    [],
  );

  // Отслеживание drag-ресайза мышью
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
        if (!isDraggingRef.current || !canvasPanelRef.current) return;

        const rect = canvasPanelRef.current.getBoundingClientRect();
        const containerRect = drawBlockRef.current?.getBoundingClientRect();
        const maxW = containerRect
          ? containerRect.width - CANVAS_BLOCK_GAP - SETTINGS_MIN_WIDTH
          : 2000;

        const rawW = Math.round(clientX - rect.left);
        const rawH = Math.round(clientY - rect.top);

        const newW =
          dragDirRef.current !== "vertical"
            ? Math.min(maxW, Math.max(CANVAS_MIN_WIDTH, rawW))
            : canvasPanelRef.current.clientWidth;
        const newH =
          dragDirRef.current !== "horizontal"
            ? Math.max(CANVAS_MIN_HEIGHT, rawH)
            : canvasPanelRef.current.clientHeight;

        applySize(newW, newH);
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
  }, [engineRef, canvasPanelRef, drawBlockRef, applySize]);

  // ResizeObserver — сжимает холст пропорционально при сужении окна браузера
  useEffect(() => {
    const container = drawBlockRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (!canvasPanelRef.current || !engineRef.current) return;

      const containerWidth = drawBlockRef.current?.offsetWidth ?? 0;
      const maxW = Math.max(
        CANVAS_MIN_WIDTH,
        containerWidth - CANVAS_BLOCK_GAP - SETTINGS_MIN_WIDTH,
      );
      const currentW = canvasPanelRef.current.clientWidth;

      if (currentW > maxW) {
        const currentH = canvasPanelRef.current.clientHeight;
        const ratio = maxW / currentW;
        const newH = Math.max(CANVAS_MIN_HEIGHT, Math.round(currentH * ratio));
        applySize(maxW, newH);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [engineRef, canvasPanelRef, drawBlockRef, applySize]);

  // syncLayout — обновляет только maxWidth панели, содержимое не трогает
  const syncLayout = useCallback(() => {
    const canvasEl = canvasPanelRef.current;
    const container = drawBlockRef.current;
    if (!canvasEl || !container) return;
    const maxW = Math.max(
      CANVAS_MIN_WIDTH,
      container.offsetWidth - CANVAS_BLOCK_GAP - SETTINGS_MIN_WIDTH,
    );
    canvasEl.style.maxWidth = `${maxW}px`;
  }, [canvasPanelRef, drawBlockRef]);

  return {
    canvasSize,
    setCanvasSize,
    handleResizeMouseDown,
    syncLayout,
    scheduleResize: useCallback((w, h) => applySize(w, h), [applySize]),
  };
};
