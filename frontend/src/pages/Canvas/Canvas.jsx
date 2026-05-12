import React, { useState, useRef, useEffect, useCallback } from "react";
import DrawingArea from "./components/DrawingArea";
import ToolsPanel from "./components/ToolsPanel";
import { useDrawing } from "./hooks/useDrawing";
import { imageToSegments } from "../../utils/imageToSegments";
import Button from "../../components/ui/Button";

import StarIcon from "../../assets/icons/icon-star.svg";
import StarSelectedIcon from "../../assets/icons/icon-star-selected.svg";
import SaveIcon from "../../assets/icons/icon-save.svg";
import DownloadIcon from "../../assets/icons/icon-download.svg";
import TrashIcon from "../../assets/icons/icon-trash.svg";
import QuestionIcon from "../../assets/icons/icon-question.svg";

import "./Canvas.css";

const CANVAS_BLOCK_GAP = 46;
const SETTINGS_MIN_WIDTH = 200;
const CANVAS_MIN_SIZE = 600;
const INITIAL_CANVAS_WIDTH = 750;
const INITIAL_CANVAS_HEIGHT = 600;

const Canvas = () => {

    const [canvasSize, setCanvasSize] = useState({
        width: INITIAL_CANVAS_WIDTH,
        height: INITIAL_CANVAS_HEIGHT,
    });

    const [isBrushSelected, setIsBrushSelected] = useState(true);
    const [isStarSelected, setIsStarSelected] = useState(false);

    // Флаг обработки фото — блокирует кнопку импорта и показывает спиннер
    const [isImporting, setIsImporting] = useState(false);

    const [bgColor, setBgColor] = useState('#4D4DFF');
    const bgColorRef = useRef('#4D4DFF');

    useEffect(() => { bgColorRef.current = bgColor; }, [bgColor]);

    const toolsPanelRef = useRef(null);
    const canvasPanelRef = useRef(null);
    const drawBlockRef = useRef(null);

    const pendingResizeRef = useRef(null);
    const isDraggingRef = useRef(false);
    const dragDir = useRef(null);

    const currentSizeRef = useRef({
        w: INITIAL_CANVAS_WIDTH,
        h: INITIAL_CANVAS_HEIGHT,
    });

    const { engineRef, initEngine, saveToHistory, undo, redo, clear, canUndo, canRedo } =
        useDrawing(8, '#4D4DFF');

    const handleDownload = useCallback(() => {
        const mainCanvas = engineRef.current?.mainCanvas;
        if (!mainCanvas) return;

        const { width, height } = mainCanvas;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = width;
        exportCanvas.height = height;
        const ctx = exportCanvas.getContext('2d');

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(mainCanvas, 0, 0);

        const link = document.createElement('a');
        link.download = 'drawing.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }, [bgColor, engineRef]);

    /**
     * Обработчик импорта фото.
     * 1. Запускаем edge detection (async, не блокирует UI).
     * 2. Передаём сегменты в DrawingEngine через addSegments.
     * 3. Сохраняем шаг в историю.
     */
    const handleImportPhoto = useCallback(async (file) => {
        if (!engineRef.current) return;
        setIsImporting(true);

        try {
            const segments = await imageToSegments(file, {
                threshold: 28,       // чувствительность: меньше = больше контуров
                maxWidth: 800,       // масштаб для обработки (не влияет на холст)
                color: '#00ffd1',    // цвет контуров = цвет инструмента sine
                lineWidth: 1.5,
                instrument: 'sine',
            });

            if (segments.length === 0) {
                console.warn('imageToSegments: контуры не найдены');
                return;
            }

            // addSegments сам вызовет onStrokeEnd → saveToHistory
            engineRef.current.addSegments(segments);

        } catch (err) {
            console.error('Ошибка обработки изображения:', err);
        } finally {
            setIsImporting(false);
        }
    }, [engineRef]);

    const handleResizeMouseDown = useCallback(
        (dir) => (e) => {
            e.preventDefault();
            isDraggingRef.current = true;
            dragDir.current = dir;

            currentSizeRef.current = {
                w: canvasPanelRef.current?.clientWidth ?? INITIAL_CANVAS_WIDTH,
                h: canvasPanelRef.current?.clientHeight ?? INITIAL_CANVAS_HEIGHT,
            };
        },
        [],
    );

    useEffect(() => {
        const onMove = (e) => {
            if (
                !isDraggingRef.current ||
                !canvasPanelRef.current ||
                !engineRef.current
            )
                return;

            const rect = canvasPanelRef.current.getBoundingClientRect();
            const containerRect = drawBlockRef.current?.getBoundingClientRect();

            const maxW = containerRect
                ? containerRect.width - CANVAS_BLOCK_GAP - SETTINGS_MIN_WIDTH
                : 2000;

            const rawW = Math.round(e.clientX - rect.left);
            const rawH = Math.round(e.clientY - rect.top);

            const newW =
                dragDir.current !== "vertical"
                    ? Math.min(maxW, Math.max(CANVAS_MIN_SIZE, rawW))
                    : currentSizeRef.current.w;

            const newH =
                dragDir.current !== "horizontal"
                    ? Math.max(CANVAS_MIN_SIZE, rawH)
                    : currentSizeRef.current.h;

            engineRef.current.resize(newW, newH);
            canvasPanelRef.current.style.width = `${newW}px`;
            canvasPanelRef.current.style.height = `${newH}px`;
            setCanvasSize({ width: newW, height: newH });
        };

        const onUp = () => {
            isDraggingRef.current = false;
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);

        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [engineRef]);

    const handleCanvasReady = useCallback((canvases) => {
        initEngine(canvases);
        if (engineRef.current) {
            engineRef.current.onStrokeEnd = () => saveToHistory(bgColorRef.current);
        }
    }, [initEngine, saveToHistory, engineRef]);

    useEffect(() => {
        if (!pendingResizeRef.current || !engineRef.current) return;
        const { width, height } = pendingResizeRef.current;
        pendingResizeRef.current = null;
        engineRef.current.resize(width, height);
    });

    const handleBgColorChange = useCallback((color) => {
        setBgColor(color);
        bgColorRef.current = color;
        saveToHistory(color);
    }, [saveToHistory]);

    const syncLayout = useCallback(() => {
        const canvasEl = canvasPanelRef.current;
        const container = drawBlockRef.current;
        if (!canvasEl || !container) return;

        const maxW = Math.max(
            CANVAS_MIN_SIZE,
            container.offsetWidth - CANVAS_BLOCK_GAP - SETTINGS_MIN_WIDTH,
        );

        canvasEl.style.maxWidth = `${maxW}px`;
    }, []);

    useEffect(() => {
        const obs = new ResizeObserver(() => requestAnimationFrame(syncLayout));
        if (drawBlockRef.current) obs.observe(drawBlockRef.current);
        return () => obs.disconnect();
    }, [syncLayout]);

    const handleUndo = useCallback(() => undo(null, setBgColor), [undo]);
    const handleRedo = useCallback(() => redo(null, setBgColor), [redo]);
    const handleClear = useCallback(() => clear(bgColorRef.current), [clear]);

    return (
        <div className="canvas-content">
            <div className="canvas-header">
                <div className="canvas-header-text">
                    <input
                        className="project-title-input"
                        placeholder="Введите название проекта..."
                    />
                    <div className="divider" />
                </div>
                <div className="canvas-header-icons">
                    <div
                        className="icon favourite-btn"
                        onClick={() => setIsStarSelected((prev) => !prev)}
                    >
                        <img
                            src={isStarSelected ? StarSelectedIcon : StarIcon}
                            alt="Избранное"
                        />
                    </div>
                    <div className="icon save-btn">
                        <img src={SaveIcon} alt="Сохранить проект" />
                    </div>
                    <div className="icon download-btn" onClick={handleDownload}>
                        <img src={DownloadIcon} alt="Скачать файлы" />
                    </div>
                    <div className="icon delete-btn">
                        <img src={TrashIcon} alt="Удалить проект" />
                    </div>
                    <div className="icon question-btn">
                        <img src={QuestionIcon} alt="Обучение" />
                    </div>
                </div>
            </div>

            <div className="workspace-area">
                <div className="canvas-block" ref={drawBlockRef}>
                    <div className="draw-block">
                        <ToolsPanel
                            ref={toolsPanelRef}
                            engine={engineRef.current}
                            onUndo={handleUndo}
                            onRedo={handleRedo}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            onClear={handleClear}
                            isBrushSelected={isBrushSelected}
                            setIsBrushSelected={setIsBrushSelected}
                            onBackgroundColorChange={handleBgColorChange}
                            currentBgColor={bgColor}
                            onImportPhoto={handleImportPhoto}
                            isImporting={isImporting}
                        />

                        <div
                            className="canvas-panel"
                            ref={canvasPanelRef}
                            style={{
                                width: canvasSize.width,
                                height: canvasSize.height,
                                backgroundColor: bgColor,
                            }}
                        >
                            <DrawingArea
                                width={canvasSize.width}
                                height={canvasSize.height}
                                onReady={handleCanvasReady}
                            />

                            {/* Правый край */}
                            <div
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    right: -4,
                                    width: 8,
                                    height: "100%",
                                    cursor: "ew-resize",
                                    zIndex: 10,
                                }}
                                onMouseDown={handleResizeMouseDown("horizontal")}
                            />

                            {/* Нижний край */}
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: -4,
                                    left: 0,
                                    width: "100%",
                                    height: 8,
                                    cursor: "ns-resize",
                                    zIndex: 10,
                                }}
                                onMouseDown={handleResizeMouseDown("vertical")}
                            />

                            {/* Угол */}
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    right: 0,
                                    width: 16,
                                    height: 16,
                                    cursor: "nwse-resize",
                                    zIndex: 11,
                                }}
                                onMouseDown={handleResizeMouseDown("both")}
                            />

                            {/* Оверлей «обработка...» */}
                            {isImporting && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.35)',
                                        zIndex: 20,
                                        borderRadius: 'inherit',
                                        backdropFilter: 'blur(2px)',
                                        color: '#00ffd1',
                                        fontSize: '14px',
                                        letterSpacing: '0.1em',
                                        fontWeight: 500,
                                        gap: '10px',
                                        flexDirection: 'column',
                                    }}
                                >
                                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                                        <circle cx="18" cy="18" r="14" stroke="#00ffd1" strokeWidth="3" strokeDasharray="60 30">
                                            <animateTransform
                                                attributeName="transform"
                                                type="rotate"
                                                from="0 18 18"
                                                to="360 18 18"
                                                dur="0.9s"
                                                repeatCount="indefinite"
                                            />
                                        </circle>
                                    </svg>
                                    Извлекаю контуры…
                                </div>
                            )}
                        </div>

                        <div className="idk-panel" />
                    </div>

                    <div className="settings-block" />
                </div>

                <div className="music-player" />
                <Button variant="primary">СГЕНЕРИРОВАТЬ МЕЛОДИЮ</Button>
            </div>
        </div>
    );
};

export default Canvas;