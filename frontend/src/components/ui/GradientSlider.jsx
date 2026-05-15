import { useEffect, useCallback } from "react";

const COLORS = {
  violet: "#4D4DFF",
  cyan:   "#00F2FF",
  pink:   "#FF00FF",
  bright: "#ECECEC",
};

const STATIC_STYLE_ID = "gradient-slider-static";
const STATIC_CSS = `
  .gradient-slider-track {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    background: linear-gradient(to right, ${COLORS.violet}, ${COLORS.cyan}, ${COLORS.pink});
    box-shadow: 0 2px 8px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2);
  }
  .gradient-slider-track::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 3px solid ${COLORS.bright};
    cursor: pointer;
    background: var(--thumb-color);
    box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.25);
    transition: background-color 0.15s ease;
  }
  .gradient-slider-track::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 3px solid ${COLORS.bright};
    cursor: pointer;
    background: var(--thumb-color);
    box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.25);
    transition: background-color 0.15s ease;
  }
`;

function ensureStaticStyles() {
  if (!document.getElementById(STATIC_STYLE_ID)) {
    const tag = document.createElement("style");
    tag.id = STATIC_STYLE_ID;
    tag.textContent = STATIC_CSS;
    document.head.appendChild(tag);
  }
}

function getThumbColor(pct) {
  if (pct < 1 / 3) return COLORS.violet;
  if (pct < 2 / 3) return COLORS.cyan;
  return COLORS.pink;
}

/**
 * GradientSlider
 *
 * Props:
 *   min        {number}   — минимальное значение (default 40)
 *   max        {number}   — максимальное значение (default 180)
 *   step       {number}   — шаг (default 1)
 *   value      {number}   — текущее значение (controlled)
 *   onChange   {function} — (newValue: number) => void
 *   style      {object}   — дополнительные стили для обёртки
 *   className  {string}   — дополнительный класс для обёртки
 */
export default function GradientSlider({
  min = 40,
  max = 180,
  step = 1,
  value,
  onChange,
  style,
  className,
}) {
  useEffect(() => { ensureStaticStyles(); }, []);

  const pct = (value - min) / (max - min);
  const thumbColor = getThumbColor(pct);
  const rightPct = (1 - pct) * 100;

  const handleChange = useCallback(
    (e) => onChange?.(Number(e.target.value)),
    [onChange]
  );

  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        width: "100%",
        ...style,
      }}
    >
      {/* --thumb-color задаётся inline на конкретный элемент, не глобально */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="gradient-slider-track"
        style={{ "--thumb-color": thumbColor }}
      />
      {/* Затемнение правой части — полностью через inline стили, изолировано */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: 0,
          transform: "translateY(-50%)",
          height: "4px",
          borderRadius: "0 2px 2px 0",
          background: "rgba(0, 0, 0, 0.4)",
          pointerEvents: "none",
          width: `${rightPct}%`,
        }}
      />
    </div>
  );
}