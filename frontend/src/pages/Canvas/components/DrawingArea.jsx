import React, { useRef, useEffect } from 'react';

// onReady вызывается ОДИН РАЗ при монтировании.
// После инициализации размером canvas управляет engine.resize() напрямую через DOM.
// Атрибуты width/height на <canvas> React НЕ обновляет после первого рендера —
// иначе браузер сбросит содержимое холста при каждом ре-рендере.
const DrawingArea = ({ width, height, onReady }) => {

    const mainRef = useRef(null);
    const gridRef = useRef(null);
    const initializedRef = useRef(false);

    // После монтирования, когда канвасы уже в DOM, вызываем onReady с их рефами для инициализации движка.
    useEffect(() => {
        if (initializedRef.current) return;
        if (mainRef.current && gridRef.current) {
            initializedRef.current = true;
            onReady({
                main: mainRef.current,
                grid: gridRef.current,
            });
        }
    }, []); // пустой массив — только при mount

    return (
        // div-обёртка получает актуальные размеры для правильного layout и clip
        <div style={{ position: 'relative', width, height}}>
            {/*
                Атрибуты width/height здесь статичны - они задают начальный размер буфера.
                После mount engine.resize() меняет canvas.width / canvas.height напрямую.
                style width/height: 100% - чтобы canvas визуально занимал весь div,
                но это только CSS-масштабирование; реальный буфер меняет engine.
            */}
            <canvas
                ref={gridRef}
                width={width}
                height={height}
                style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
            />
            <canvas
                ref={mainRef}
                width={width}
                height={height}
                style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}
            />
        </div>
    );
};

export default DrawingArea;