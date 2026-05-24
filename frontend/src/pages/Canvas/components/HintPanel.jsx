// HintPanel.jsx
// Вставь вместо пустого .hint-panel в Canvas.jsx

import React, { useContext, useState, useEffect, useRef } from "react";
import { HintContext } from "../context/HintContext"; // поправь путь

const HintPanel = () => {
  const { hint } = useContext(HintContext);
  const [displayed, setDisplayed] = useState(hint);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    // Плавная смена: fade out → смена текста → fade in
    setVisible(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDisplayed(hint);
      setVisible(true);
    }, 120);
    return () => clearTimeout(timerRef.current);
  }, [hint]);

  return (
    <div className="hint-panel">
      <p
        style={{
          margin: 0,
          padding: "0 8px",
          transition: "opacity 0.12s ease",
          opacity: visible ? 1 : 0,
          color: "var(--color-bright, #fff)",
          fontSize: "var(--font-size-small, 14px)",
          fontFamily: "var(--font-montserrat, sans-serif)",
          fontWeight: 500,
          letterSpacing: "0.03em",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {displayed}
      </p>
    </div>
  );
};

export default HintPanel;
