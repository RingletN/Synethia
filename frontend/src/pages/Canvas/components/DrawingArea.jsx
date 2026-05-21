import React, { useRef, useEffect } from "react";

const DrawingArea = ({ width, height, onReady }) => {
  const mainRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (mainRef.current) {
      initializedRef.current = true;
      onReady({ main: mainRef.current });
    }
  }, [onReady]);

  return (
    <div style={{ position: "relative", width, height }}>
      <canvas
        ref={mainRef}
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
      />
    </div>
  );
};

export default DrawingArea;
