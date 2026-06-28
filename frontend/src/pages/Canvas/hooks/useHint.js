import { useContext, useCallback, useRef } from "react";
import { HintContext } from "../context/HintContext";

export const useHint = (text) => {
  const ctx = useContext(HintContext);
  if (!ctx) return {};
  const onMouseEnter = useCallback(() => {
    ctx.clearForced();
    ctx.setHint(text);
  }, [ctx, text]);
  const onMouseLeave = useCallback(() => {
    ctx.clearForced();
    ctx.resetHint();
  }, [ctx]);
  return { onMouseEnter, onMouseLeave };
};

export const useHintPush = (currentTextGetter) => {
  const ctx = useContext(HintContext);
  const getterRef = useRef(currentTextGetter);
  getterRef.current = currentTextGetter;
  const hoveredRef = useRef(false);

  if (!ctx)
    return { onMouseEnter: undefined, onMouseLeave: undefined, push: () => {} };

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

  const push = useCallback(
    (nextText) => {
      if (hoveredRef.current) {
        ctx.forceHint(() => nextText);
      }
    },
    [ctx],
  );

  return { onMouseEnter, onMouseLeave, push };
};

export const useHintFactory = () => {
  const ctx = useContext(HintContext);
  if (!ctx) return () => ({});
  return useCallback(
    (text) => ({
      onMouseEnter: () => {
        ctx.clearForced();
        ctx.setHint(text);
      },
      onMouseLeave: () => {
        ctx.clearForced();
        ctx.resetHint();
      },
    }),
    [ctx],
  );
};
