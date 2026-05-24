import React, { useRef, useEffect } from "react";

const DrawingArea = ({ width, height, onReady }) => {
  const mainRef = useRef(null);
  const initializedRef = useRef(false);
  const sizeSetRef = useRef(false);

   // Устанавливаем реальные размеры canvas один раз при монтировании
   useEffect(() => {
    const canvas = mainRef.current;
    if (canvas && width && height && !sizeSetRef.current) {
      canvas.width = width;
      canvas.height = height;
      sizeSetRef.current = true;
    }
  }, [width, height]);

  // Сообщаем родителю, что холст готов, только когда размеры заданы
  useEffect(() => {
    const canvas = mainRef.current;
    if (!initializedRef.current && canvas && canvas.width > 0 && canvas.height > 0 && onReady) {
      initializedRef.current = true;
      onReady({ main: canvas });
    }
  }, [width, height, onReady]); // зависимость от размеров, чтобы дождаться их установки

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <canvas
        ref={mainRef}
        style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }}
      />
    </div>
  );
};

export default DrawingArea;