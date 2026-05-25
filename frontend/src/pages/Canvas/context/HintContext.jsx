// HintContext.jsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

const DEFAULT_HINT =
  "Добро пожаловать ✦ Начните рисовать и создайте свою музыку";

export const HintContext = createContext(null);

export const HintProvider = ({ children }) => {
  const [hint, setHintRaw] = useState(DEFAULT_HINT);
  // Храним стек: элемент, над которым курсор сейчас, может форсировать обновление
  const forcedHintRef = useRef(null);

  const setHint = useCallback((text) => {
    setHintRaw(text || DEFAULT_HINT);
  }, []);

  const resetHint = useCallback(() => {
    // Если есть принудительный хинт (курсор не уходил, но состояние изменилось) —
    // восстанавливаем его, иначе сбрасываем на дефолт
    if (forcedHintRef.current) {
      setHintRaw(forcedHintRef.current());
    } else {
      setHintRaw(DEFAULT_HINT);
    }
  }, []);

  // forceHint — вызывается при клике, когда курсор остаётся на элементе.
  // Принимает геттер () => string, чтобы всегда читать актуальное значение.
  const forceHint = useCallback((getter) => {
    forcedHintRef.current = getter;
    setHintRaw(getter());
  }, []);

  const clearForced = useCallback(() => {
    forcedHintRef.current = null;
  }, []);

  return (
    <HintContext.Provider
      value={{ hint, setHint, resetHint, forceHint, clearForced, DEFAULT_HINT }}
    >
      {children}
    </HintContext.Provider>
  );
};

export const useHintContext = () => useContext(HintContext);
