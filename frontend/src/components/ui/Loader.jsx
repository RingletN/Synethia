import { useEffect, useRef } from "react";

const COLORS = {
  pink: "#FF00FF",
  cyan: "#00F2FF",
  violet: "#4D4DFF",
  bright: "#ECECEC",
  pale: "#BEBEBE",
};

const BLADE_COUNT = 8;
const BASE_OPACITY = 0.18;

export default function Loader({
  size = 80,
  color = "cyan",
  speed = 1400,
  bladeW = 22,
  bladeH = 38,
}) {
  const activeColor = COLORS[color] ?? color;
  const radius = size * 0.28;

  const blades = Array.from({ length: BLADE_COUNT }, (_, i) => {
    const angle = (360 / BLADE_COUNT) * i;
    const normalizedIndex = i / BLADE_COUNT;

    // Лопасти в хвосте — тёмные, голова — яркая
    let opacity = BASE_OPACITY + normalizedIndex * 0.15;
    if (i === BLADE_COUNT - 2) opacity = 0.6;
    if (i === BLADE_COUNT - 1) opacity = 1;

    return { angle, opacity, isHead: i === BLADE_COUNT - 1 };
  });

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        animation: `loader-rotate ${speed}ms linear infinite`,
      }}
    >
      <style>{`
        @keyframes loader-rotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {blades.map(({ angle, opacity, isHead }, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: bladeW,
            height: bladeH,
            borderRadius: 40,
            background: isHead ? activeColor : `rgba(255,255,255,${opacity})`,
            opacity: isHead ? 1 : opacity,
            left: "50%",
            top: "50%",
            marginLeft: -bladeW / 2,
            marginTop: -bladeH,
            transformOrigin: "50% 100%",
            transform: `rotate(${angle}deg) translateY(-${radius}px)`,
          }}
        />
      ))}
    </div>
  );
}
