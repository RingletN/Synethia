import React, { useState, useRef, useEffect, useCallback } from "react";
import DrawingArea from "./components/DrawingArea";
import ToolsPanel from "./components/ToolsPanel";
import { useDrawing } from "./hooks/useDrawing";
import useMelodyPlayer from './hooks/useMelodyPlayer'; 
import { imageToSegments } from "../../utils/imageToSegments";
import MelodyEngine from "../../engines/MelodyEngine";
import Button from "../../components/ui/Button";
import Loader from "../../components/ui/Loader";
import Modal from "../../components/ui/Modal";

import StarIcon from "../../assets/icons/icon-star.svg";
import StarSelectedIcon from "../../assets/icons/icon-star-selected.svg";
import SaveIcon from "../../assets/icons/icon-save.svg";
import DownloadIcon from "../../assets/icons/icon-download.svg";
import TrashIcon from "../../assets/icons/icon-trash.svg";
import QuestionIcon from "../../assets/icons/icon-question.svg";
import PauseIcon from "../../assets/icons/icon-pause.svg";
import PlayIcon from "../../assets/icons/icon-play.svg";
import SkipBackIcon from "../../assets/icons/icon-skip-back.svg";
import SkipForwardIcon from "../../assets/icons/icon-skip-forward.svg";
import VolumeHighIcon from "../../assets/icons/icon-volume-high.svg";
import VolumeLowIcon from "../../assets/icons/icon-volume-low.svg";
import VolumeNoIcon from "../../assets/icons/icon-volume-no.svg";
import * as Tone from 'tone';

import "./Canvas.css";

const CANVAS_BLOCK_GAP   = 46;
const SETTINGS_MIN_WIDTH = 200;
const CANVAS_MIN_SIZE    = 600;
const INITIAL_CANVAS_WIDTH  = 750;
const INITIAL_CANVAS_HEIGHT = 600;

// Одиночный экземпляр MelodyEngine на всё время жизни компонента
const melodyEngine = new MelodyEngine();

const Canvas = () => {
    const [canvasSize, setCanvasSize] = useState({
        width:  INITIAL_CANVAS_WIDTH,
        height: INITIAL_CANVAS_HEIGHT,
    });

    const [isBrushSelected, setIsBrushSelected] = useState(true);
    const [isStarSelected,  setIsStarSelected]  = useState(false);
    const [brushColor, setBrushColor] = useState('#00ffd1');
    const [isImporting, setIsImporting] = useState(false);

    // ── Состояние мелодии ──────────────────────────────────────────
    const [activeNote,   setActiveNote]   = useState(null);  // текущая нота (для анимации)

    // Параметры генерации (базовые, без UI — заложим основу)
    const melodyParams = useRef({
        bpm:      80,
        duration: 8,
        scale:    'major',
        smoothing: 30,
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [isMelodyGenerated, setIsMelodyGenerated] = useState(false);
    const [melodyEvents, setMelodyEvents] = useState([]);
    const [totalDuration, setTotalDuration] = useState(8);

    // ── Цвет фона ──────────────────────────────────────────────────
    const [modal, setModal] = useState({
        isOpen: false, title: '', description: '', variant: 'default',
    });
    const [bgColor, setBgColor] = useState('#4D4DFF');
    const bgColorRef    = useRef('#4D4DFF');
    const brushColorRef = useRef('#00ffd1');

    useEffect(() => { bgColorRef.current    = bgColor;    }, [bgColor]);
    useEffect(() => { brushColorRef.current = brushColor; }, [brushColor]);

    const toolsPanelRef  = useRef(null);
    const canvasPanelRef = useRef(null);
    const drawBlockRef   = useRef(null);
    const pendingResizeRef = useRef(null);
    const isDraggingRef    = useRef(false);
    const dragDir          = useRef(null);
    const currentSizeRef   = useRef({ w: INITIAL_CANVAS_WIDTH, h: INITIAL_CANVAS_HEIGHT });

    const { engineRef, initEngine, saveToHistory, undo, redo, clear, canUndo, canRedo } =
        useDrawing(8, '#4D4DFF');

    // ── Модальные окна ─────────────────────────────────────────────
    const showModal = useCallback((title, description, variant = 'default') => {
        setModal({ isOpen: true, title, description, variant });
    }, []);
    const closeModal = useCallback(() => {
        setModal(prev => ({ ...prev, isOpen: false }));
    }, []);

    // ── Обработчики ────────────────────────────────────────────────
    const handleBrushColorChange = useCallback((newColor) => {
        setBrushColor(newColor);
        brushColorRef.current = newColor;
        if (engineRef.current) engineRef.current.currentColor = newColor;
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
                threshold: 28, maxWidth: 850,
                color: '#00ffd1', lineWidth: currentLineWidth, instrument: 'sine',
            });
            if (segments.length === 0) {
                showModal(
                    "Контуры не найдены",
                    "На изображении не удалось обнаружить достаточно контуров.\n\nПопробуйте другое фото или уменьшите значение threshold.",
                );
                return;
            }
            engineRef.current.addSegments(segments);
        } catch (err) {
            console.error('Ошибка обработки изображения:', err);
            showModal("Ошибка обработки фото", "Не удалось обработать изображение.", "error");
        } finally {
            setIsImporting(false);
        }
    }, [engineRef, showModal]);

    // ── Генерация и воспроизведение мелодии ───────────────────────

    /**
     * Строит нотные события из текущих сегментов холста.
     * Вызывается каждый раз перед воспроизведением (или при изменении параметров).
     */
    const handleStrokeEnd = useCallback(() => {
        saveToHistory(bgColorRef.current);
    }, [saveToHistory]);

    const handleGenerateMelody = useCallback(async () => {
        if (!engineRef.current) {
          showModal("Ошибка", "Движок рисования не инициализирован", "error");
          return;
        }
      
        setIsGenerating(true);
        // Имитируем небольшую задержку, чтобы лоадер был заметен (опционально)
        await new Promise(resolve => setTimeout(resolve, 100));
      
        try {
          const segments = engineRef.current.getAllSegments();
          if (!segments || segments.length === 0) {
            showModal(
              "Нечего генерировать",
              "Нарисуйте что-нибудь на холсте или импортируйте изображение.",
              "warning"
            );
            return;
          }
      
          const { events, tonicMidi } = melodyEngine.buildNoteEvents(segments, melodyParams.current);
          if (!events.length) throw new Error("Не удалось построить нотные события");
      
          setMelodyEvents(events);
          setTotalDuration(melodyParams.current.duration);
          setIsMelodyGenerated(true);
          showModal("Успешно", "Мелодия успешно сгенерирована!", "success");
        } catch (err) {
          console.error(err);
          showModal("Ошибка генерации", err.message || "Не удалось создать мелодию", "error");
          setIsMelodyGenerated(false);
        } finally {
          setIsGenerating(false);
        }
      }, [engineRef, showModal]);

// Подключим плеер
const {
    isPlaying,
    currentTime,
    volume,
    setVolume,
    play,
    pause,
    stop,
    skip
  } = useMelodyPlayer(melodyEvents, totalDuration, (note) => setActiveNote(note));
  
  // Обработчик нажатия на Play/Pause
  const handlePlayPause = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);
  
  // Функция для изменения громкости (0..1)
  const handleVolumeChange = useCallback((e) => {
    setVolume(parseFloat(e.target.value));
  }, [setVolume]);
  
  // Утилита для форматирования времени (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

    // ── Скачать ────────────────────────────────────────────────────
    const handleDownload = useCallback(() => {
        const mainCanvas = engineRef.current?.mainCanvas;
        if (!mainCanvas) return;
        const { width, height } = mainCanvas;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width  = width;
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

    // ── Ресайз холста ──────────────────────────────────────────────
    const handleResizeMouseDown = useCallback((dir) => (e) => {
        e.preventDefault();
        isDraggingRef.current = true;
        dragDir.current = dir;
        currentSizeRef.current = {
            w: canvasPanelRef.current?.clientWidth  ?? INITIAL_CANVAS_WIDTH,
            h: canvasPanelRef.current?.clientHeight ?? INITIAL_CANVAS_HEIGHT,
        };
    }, []);

    useEffect(() => {
        const onMove = (e) => {
            if (!isDraggingRef.current || !canvasPanelRef.current || !engineRef.current) return;
            const rect = canvasPanelRef.current.getBoundingClientRect();
            const containerRect = drawBlockRef.current?.getBoundingClientRect();
            const maxW = containerRect
                ? containerRect.width - CANVAS_BLOCK_GAP - SETTINGS_MIN_WIDTH
                : 2000;
            const rawW = Math.round(e.clientX - rect.left);
            const rawH = Math.round(e.clientY - rect.top);
            const newW = dragDir.current !== "vertical"
                ? Math.min(maxW, Math.max(CANVAS_MIN_SIZE, rawW))
                : currentSizeRef.current.w;
            const newH = dragDir.current !== "horizontal"
                ? Math.max(CANVAS_MIN_SIZE, rawH)
                : currentSizeRef.current.h;
            engineRef.current.resize(newW, newH);
            canvasPanelRef.current.style.width  = `${newW}px`;
            canvasPanelRef.current.style.height = `${newH}px`;
            setCanvasSize({ width: newW, height: newH });
        };
        const onUp = () => { isDraggingRef.current = false; };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup",   onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup",   onUp);
        };
    }, [engineRef]);

    const handleCanvasReady = useCallback((canvases) => {
        initEngine(canvases);
        if (engineRef.current) {
            engineRef.current.onStrokeEnd = () => {
                saveToHistory(bgColorRef.current);
                engineRef.current.onStrokeEnd = handleStrokeEnd;
            };
        }
    }, [initEngine, saveToHistory, engineRef, handleStrokeEnd]);

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
        const canvasEl   = canvasPanelRef.current;
        const container  = drawBlockRef.current;
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

    const handleUndo  = useCallback(() => undo(null, setBgColor),  [undo]);
    const handleRedo  = useCallback(() => redo(null, setBgColor),  [redo]);
    const handleClear = useCallback(() => {
        clear(bgColorRef.current);
        setIsMelodyGenerated(false);
        setMelodyEvents([]);
        stop(); // останавливаем Tone.Transport
        setActiveNote(null);
      }, [clear, stop]);

    // ── Рендер ─────────────────────────────────────────────────────
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
                    <div className="icon favourite-btn" onClick={() => setIsStarSelected(p => !p)}>
                        <img src={isStarSelected ? StarSelectedIcon : StarIcon} alt="Избранное" />
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
                                width:           canvasSize.width,
                                height:          canvasSize.height,
                                backgroundColor: bgColor,
                            }}
                        >
                            <DrawingArea
                                width={canvasSize.width}
                                height={canvasSize.height}
                                onReady={handleCanvasReady}
                            />

                            {/* Ресайз-хендлы */}
                            <div className="resize-handle-horizontal"
                                 onMouseDown={handleResizeMouseDown("horizontal")} />
                            <div className="resize-handle-vertical"
                                 onMouseDown={handleResizeMouseDown("vertical")} />
                            <div className="resize-handle-corner"
                                 onMouseDown={handleResizeMouseDown("both")} />

                            {/* Оверлей импорта фото */}
                            {isImporting && (
                                <div className="import-overlay">
                                    <Loader size={64} color="cyan" speed={1200} />
                                </div>
                            )}

                            {/* Индикатор активной ноты во время воспроизведения */}
                            {isPlaying && activeNote && (
                                <ActiveNoteIndicator note={activeNote} />
                            )}
                        </div>

                        <div className="idk-panel" />
                    </div>

                    <div className="settings-block" />
                </div>

            {isMelodyGenerated && (
  <div className="music-player">
    {/* Кнопка Play/Pause */}
    <div className="icon" onClick={handlePlayPause}>
      <img src={isPlaying ? PauseIcon : PlayIcon} alt={isPlaying ? "Пауза" : "Воспроизвести"} />
    </div>

    {/* Skip назад */}
    <div className="icon" onClick={() => skip(-5)}>
      <img src={SkipBackIcon} alt="Назад 5 с" />
    </div>

    {/* Skip вперёд */}
    <div className="icon" onClick={() => skip(5)}>
      <img src={SkipForwardIcon} alt="Вперёд 5 с" />
    </div>

    {/* Текущее время / длительность */}
    <span className="time-display">
      {formatTime(currentTime)} / {formatTime(totalDuration)}
    </span>

    {/* Регулятор громкости */}
    <div className="volume-control">
      <img
        src={
          volume === 0 ? VolumeNoIcon :
          volume < 0.5 ? VolumeLowIcon : VolumeHighIcon
        }
        alt="Громкость"
        className="volume-icon"
      />
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={handleVolumeChange}
        className="volume-slider"
      />
    </div>
  </div>
)}
</div>
                    
<Button
  variant="primary"
  onClick={handleGenerateMelody}
  disabled={isGenerating}
>
  {isGenerating ? <Loader size={24} color="white" /> : "СГЕНЕРИРОВАТЬ МЕЛОДИЮ"}
</Button>


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

// ─── Маленький индикатор текущей ноты ────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const freqToNoteName = (freq) => {
    if (!freq) return '';
    const midi  = Math.round(69 + 12 * Math.log2(freq / 440));
    const note  = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${note}${octave}`;
};

const INSTRUMENT_LABEL = {
    sine:     'Синус',
    square:   'Квадрат',
    sawtooth: 'Пила',
    triangle: 'Треугольник',
};

const ActiveNoteIndicator = ({ note }) => {
    if (!note) return null;
    return (
        <div style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(6px)',
            borderRadius: 10,
            padding: '6px 12px',
            color: '#fff',
            fontSize: 13,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 20,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
        }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>
                {freqToNoteName(note.freq)}
            </span>
            <span style={{ opacity: 0.7 }}>
                {INSTRUMENT_LABEL[note.instrument] || note.instrument}
            </span>
            <span style={{ opacity: 0.5 }}>
                {Math.round(note.freq)} Гц
            </span>
        </div>
    );
};

export default Canvas;