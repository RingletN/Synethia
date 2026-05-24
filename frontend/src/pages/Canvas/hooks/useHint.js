// useHint.js

import { useContext, useCallback, useRef } from "react";
import { HintContext } from "../context/HintContext";

/**
 * Статичный хинт.
 */
export const useHint = (text) => {
  const ctx = useContext(HintContext);
  if (!ctx) return {};
  const onMouseEnter = useCallback(() => { ctx.clearForced(); ctx.setHint(text); }, [ctx, text]);
  const onMouseLeave = useCallback(() => { ctx.clearForced(); ctx.resetHint(); }, [ctx]);
  return { onMouseEnter, onMouseLeave };
};

/**
 * useHintPush — универсальный хинт для элементов, меняющих состояние.
 * Работает для шевронов, toggle-кнопок — везде, где следующий текст
 * известен в момент клика (обходит async setState).
 *
 * currentTextGetter — геттер текста при наведении (БЕЗ useCallback).
 * Возвращает { onMouseEnter, onMouseLeave, push(nextText) }.
 *
 * push(nextText) вызывай с уже вычисленным следующим текстом.
 * Текст пушится только если курсор над элементом.
 *
 * Примеры:
 *   // Шеврон настроения:
 *   const h = useHintPush(() => MOOD_HINTS[scale]);
 *   onClick={() => { const k = nextKey(); onChange(k); h.push(MOOD_HINTS[k]); }}
 *
 *   // Toggle play/pause:
 *   const h = useHintPush(() => isPlaying ? "Пауза ✦" : "Играть ✦");
 *   onClick={() => { const next = !isPlaying; onPlayPause(); h.push(next ? "Пауза ✦" : "Играть ✦"); }}
 */
export const useHintPush = (currentTextGetter) => {
  const ctx = useContext(HintContext);
  const getterRef = useRef(currentTextGetter);
  getterRef.current = currentTextGetter;
  const hoveredRef = useRef(false);

  if (!ctx) return { onMouseEnter: undefined, onMouseLeave: undefined, push: () => {} };

  const onMouseEnter = useCallback(() => {
    hoveredRef.current = true;
    ctx.clearForced();
    ctx.setHint(getterRef.current());
  }, [ctx]);

  const onMouseLeave = useCallback(() => {
    hoveredRef.current = false;
    ctx.clearForced();
    ctx.resetHint();
  }, [ctx]);

  const push = useCallback((nextText) => {
    if (hoveredRef.current) {
      ctx.forceHint(() => nextText);
    }
  }, [ctx]);

  return { onMouseEnter, onMouseLeave, push };
};

/**
 * useHintFactory — для map-циклов.
 */
export const useHintFactory = () => {
  const ctx = useContext(HintContext);
  if (!ctx) return () => ({});
  return useCallback((text) => ({
    onMouseEnter: () => { ctx.clearForced(); ctx.setHint(text); },
    onMouseLeave: () => { ctx.clearForced(); ctx.resetHint(); },
  }), [ctx]);
};