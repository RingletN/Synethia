import { useEffect, useCallback } from "react";

const COLORS = {
  violet: "#4D4DFF",
  cyan:   "#00F2FF",
  pink:   "#FF00FF",
  bright: "#ECECEC",
  dark:   "rgba(0, 0, 0, 0.45)",
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
  const pctStr = `${(pct * 100).toFixed(2)}%`;

  // Трек: слева — цветной градиент до позиции thumb, справа — тёмный overlay поверх градиента.
  // Два слоя background: тёмный справа от thumb идёт поверх цветного градиента.
  const trackBackground = [
    // Слой 1 (верхний): затемнение правой части
    `linear-gradient(to right, transparent ${pctStr}, ${COLORS.dark} ${pctStr})`,
    // Слой 2 (нижний): основной цветной градиент на весь трек
    `linear-gradient(to right, ${COLORS.violet}, ${COLORS.cyan}, ${COLORS.pink})`,
  ].join(", ");

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
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="gradient-slider-track"
        style={{
          "--thumb-color": thumbColor,
          background: trackBackground,
        }}
      />
    </div>
  );
}