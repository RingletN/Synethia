import React, { useState, useRef, useEffect, useCallback } from "react";
import DrawingArea from "./components/DrawingArea";
import ToolsPanel from "./components/ToolsPanel";
import { useDrawing } from "./hooks/useDrawing";
import { imageToSegments } from "../../utils/imageToSegments";
import Button from "../../components/ui/Button";
import Loader from "../../components/ui/Loader";
import Modal from "../../components/ui/Modal";

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
    const [brushColor, setBrushColor] = useState('#00ffd1');
    
    // Флаг обработки фото — блокирует кнопку импорта и показывает спиннер
    const [isImporting, setIsImporting] = useState(false);

        // Для модальных окон с сообщениями
        const [modal, setModal] = useState({
            isOpen: false,
            title: '',
            description: '',
            variant: 'default', // 'default' | 'error'
        });

    const [bgColor, setBgColor] = useState('#4D4DFF');
    const bgColorRef = useRef('#4D4DFF');
    const brushColorRef = useRef('#00ffd1');

    useEffect(() => { bgColorRef.current = bgColor; }, [bgColor]);
    useEffect(() => { brushColorRef.current = brushColor; }, [brushColor]);

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

        // ==================== МОДАЛЬНЫЕ ОКНА ====================
    const showModal = useCallback((title, description, variant = 'default') => {
        setModal({
            isOpen: true,
            title,
            description,
            variant,
        });
    }, []);

    const closeModal = useCallback(() => {
        setModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    // ==================== ОБРАБОТЧИКИ ====================
    const handleBrushColorChange = useCallback((newColor) => {
        setBrushColor(newColor);
        brushColorRef.current = newColor;
        
        if (engineRef.current) {
            engineRef.current.currentColor = newColor;
        }
    }, [engineRef]);
    
    const handleImportPhoto = useCallback(async (file) => {
        if (!engineRef.current) {
            showModal("Ошибка", "Движок рисования не инициализирован", "error");
            return;
        }

        setIsImporting(true);

        try {
            const currentLineWidth = engineRef.current.getLineWidth?.() || 5;

            const segments = await imageToSegments(file, {
                threshold: 28,
                maxWidth: 850,
                color: '#00ffd1',
                lineWidth: currentLineWidth,
                instrument: 'sine',
            });

            if (segments.length === 0) {
                showModal(
                    "Контуры не найдены",
                    "На изображении не удалось обнаружить достаточно контуров.\n\nПопробуйте другое фото или уменьшите значение threshold.",
                    "default"
                );
                return;
            }

            engineRef.current.addSegments(segments);

        } catch (err) {
            console.error('Ошибка обработки изображения:', err);
            showModal(
                "Ошибка обработки фото",
                "Не удалось обработать изображение. Возможно, файл повреждён или не является изображением.",
                "error"
            );
        } finally {
            setIsImporting(false);
        }
    }, [engineRef, showModal]);

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
                    <div className="divider-project" />
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
                            currentBrushColor={brushColor}
                            onBrushColorChange={handleBrushColorChange}
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
    <div className="resize-handle-horizontal"
         onMouseDown={handleResizeMouseDown("horizontal")} />

    {/* Нижний край */}
    <div className="resize-handle-vertical"
         onMouseDown={handleResizeMouseDown("vertical")} />

    {/* Угол */}
    <div className="resize-handle-corner"
         onMouseDown={handleResizeMouseDown("both")} />

                            {/* Оверлей обработки фото */}
{isImporting && (
    <div className="import-overlay">
        <Loader size={64} color="cyan" speed={1200} />
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
                        {/* Модальное окно */}
                        <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                title={modal.title}
                description={modal.description}
                variant={modal.variant}
                primaryText="ОК"
                onPrimary={closeModal}
            />
        </div>
    );
};

export default Canvas;