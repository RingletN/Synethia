import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import BgCanvasLine from '../../assets/backgrounds/bg-canvas-line.png';
import DrawingArea from "./components/DrawingArea";
import ToolsPanel from "./components/ToolsPanel";
import SettingsPanel from "./components/SettingsPanel";
import { useDrawing } from "./hooks/useDrawing";
import { useProjectSave } from './hooks/useProjectSave';
import useMelodyPlayer from './hooks/useMelodyPlayer';
import { useAudioExporter } from './hooks/useAudioExporter';
import { imageToSegments } from "../../utils/imageToSegments";
import MelodyEngine from "../../engines/MelodyEngine";
import Button from "../../components/ui/Button";
import Loader from "../../components/ui/Loader";
import Modal from "../../components/ui/Modal";
import SaveAsModal from "../../components/ui/SaveAsModal";
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

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

    const [projectTitle, setProjectTitle] = useState('Без названия');

    // ← флаг несохранённых изменений — именно его слушает useUnsavedChanges
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [activeNote, setActiveNote] = useState(null);

    const [bpm,       setBpm]       = useState(80);
    const [duration,  setDuration]  = useState(8);
    const [scale,     setScale]     = useState('major');
    const [smoothing, setSmoothing] = useState(30);

    const [effectReverb,     setEffectReverb]     = useState(0);
    const [effectDelay,      setEffectDelay]      = useState(0);
    const [effectDistortion, setEffectDistortion] = useState(0);

    const effects = { reverb: effectReverb, delay: effectDelay, distortion: effectDistortion };

    const melodyParamsForGen = { bpm, duration, scale, smoothing };

    const [isGenerating, setIsGenerating] = useState(false);
    const [isMelodyGenerated, setIsMelodyGenerated] = useState(false);
    const [melodyEvents, setMelodyEvents] = useState([]);
    const [totalDuration, setTotalDuration] = useState(8);
    const { exportToWAV } = useAudioExporter(melodyEvents, totalDuration);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    const [bgColor, setBgColor] = useState('#0B0B1F');
    const bgColorRef    = useRef('#0B0B1F');
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
    const bgColorDebounceRef = useRef(null);

    const { engineRef, initEngine, saveToHistory, undo, redo, clear, canUndo, canRedo } =
        useDrawing(8, '#0B0B1F');

    const [searchParams] = useSearchParams();

    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const PENDING_KEY = 'pendingCanvas';
    const pendingSaveRef = useRef(false);

    useEffect(() => {
        if (!location.state?.pendingSave) return;

        const raw = sessionStorage.getItem(PENDING_KEY);
        if (!raw) return;

        const interval = setInterval(() => {
            if (!engineRef.current) return;
            clearInterval(interval);

            try {
                const saved = JSON.parse(raw);
                sessionStorage.removeItem(PENDING_KEY);

                // Восстанавливаем название только если оно не дефолтное
                if (saved.projectTitle && saved.projectTitle !== 'Без названия') {
                    setProjectTitle(saved.projectTitle);
                    const el = document.querySelector('.project-title-input');
                    if (el) el.textContent = saved.projectTitle;
                }
                if (saved.bgColor) {
                    setBgColor(saved.bgColor);
                    bgColorRef.current = saved.bgColor;
                }
                if (saved.canvasSize) setCanvasSize(saved.canvasSize);
                if (saved.bpm)       setBpm(saved.bpm);
                if (saved.duration)  setDuration(saved.duration);
                if (saved.scale)     setScale(saved.scale);
                if (saved.smoothing) setSmoothing(saved.smoothing);
                if (saved.effectReverb     !== undefined) setEffectReverb(saved.effectReverb);
                if (saved.effectDelay      !== undefined) setEffectDelay(saved.effectDelay);
                if (saved.effectDistortion !== undefined) setEffectDistortion(saved.effectDistortion);

                if (saved.segments?.length) {
                    engineRef.current.loadState({ segments: saved.segments });
                    saveToHistory(saved.bgColor || bgColorRef.current);
                }
                if (saved.melodyEvents?.length) {
                    setMelodyEvents(saved.melodyEvents);
                    setTotalDuration(saved.totalDuration ?? 8);
                    setIsMelodyGenerated(true);
                }

                pendingSaveRef.current = saved;

            } catch (e) {
                console.error('Ошибка восстановления холста:', e);
            }
        }, 50);

        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const [isLoadingProject, setIsLoadingProject] = useState(false);
    const projectLoadedRef = useRef(false);

    const openModal = useCallback((config) => {
        setModalConfig(config);
        setModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        if (modalConfig.onClose) modalConfig.onClose();
    }, [modalConfig]);

    const showModal = useCallback((title, description, variant = 'default') => {
        openModal({ title, description, variant, primaryText: 'ОК' });
    }, [openModal]);

    // ← теперь передаём hasUnsavedChanges вместо canUndo
    useUnsavedChanges(hasUnsavedChanges, openModal);

    const {
        handleSaveClick,
        showSaveAsModal,
        setShowSaveAsModal,
        handleSaveAsConfirm,
        existingProjectNames,
        currentTitle,
        setCurrentTitle,
        isSaving,
        projectId,
        setProjectId,
    } = useProjectSave({
        engineRef,
        bgColor,
        canvasSize,
        bpm,
        duration,
        scale,
        smoothing,
        effectReverb,
        effectDelay,
        effectDistortion,
        melodyEvents,
        totalDuration,
        isMelodyGenerated,
        showModal,
        onSaveSuccess: () => setHasUnsavedChanges(false), // ← сброс после сохранения
    });

    // Синхронизируем название в шапке когда хук сохранил новый title
    useEffect(() => {
        if (currentTitle && currentTitle !== projectTitle) {
            setProjectTitle(currentTitle);
            const el = document.querySelector('.project-title-input');
            if (el) el.textContent = currentTitle;
        }
    }, [currentTitle]); // eslint-disable-line react-hooks/exhaustive-deps

    // После авторизации — автосохранение если было pendingSave
    useEffect(() => {
        if (!pendingSaveRef.current) return;
        const saved = pendingSaveRef.current;

        const melodyReady = !saved.melodyEvents?.length ||
            (isMelodyGenerated && melodyEvents.length === saved.melodyEvents.length);

        if (!melodyReady) return;

        pendingSaveRef.current = null;
        handleSaveClick(saved.projectTitle ?? '');

    }, [isMelodyGenerated, melodyEvents, handleSaveClick]);

    const handleSave = useCallback(() => {
        if (!user) {
            sessionStorage.setItem(PENDING_KEY, JSON.stringify({
                projectTitle,
                bgColor,
                canvasSize,
                bpm,
                duration,
                scale,
                smoothing,
                effectReverb,
                effectDelay,
                effectDistortion,
                melodyEvents,
                totalDuration,
                segments: engineRef.current?.getAllSegments?.() ?? [],
            }));
            navigate('/auth?redirect=/canvas&pendingSave=1');
            return;
        }
        handleSaveClick(projectTitle);
    }, [user, handleSaveClick, projectTitle, bgColor, canvasSize, bpm, duration, scale,
        smoothing, effectReverb, effectDelay, effectDistortion,
        melodyEvents, totalDuration, engineRef, navigate]);

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
                threshold: 20,
                maxWidth: 850,
                lineWidth: currentLineWidth,
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

    const {
        isPlaying,
        currentTime,
        volume,
        setVolume,
        play,
        pause,
        stop,
        skip,
        seek,
    } = useMelodyPlayer(melodyEvents, totalDuration, (note) => setActiveNote(note), effects);

    const handleStrokeEnd = useCallback(() => {
        saveToHistory(bgColorRef.current);
        setHasUnsavedChanges(true); // ← помечаем что есть несохранённые изменения
    }, [saveToHistory]);

    const loadProjectRef = useRef(null);

    loadProjectRef.current = useCallback(async (projectId) => {
        if (projectLoadedRef.current) return;
        projectLoadedRef.current = true;

        setIsLoadingProject(true);
        try {
            const project = await api.get(`/api/projects/${projectId}`);

            if (project.title) {
                setProjectTitle(project.title);
                setCurrentTitle(project.title);
                const el = document.querySelector('.project-title-input');
                if (el) el.textContent = project.title;
            }

            if (project.settings) {
                const s = project.settings;
                setBpm(s.bpm);
                setDuration(s.duration);
                setScale(s.scale);
                setSmoothing(s.smoothing);
                setEffectReverb(parseFloat(s.reverb));
                setEffectDelay(parseFloat(s.delay));
                setEffectDistortion(parseFloat(s.distortion));
            }

            if (project.canvas && engineRef.current) {
                const { segments, bg_color, width, height } = project.canvas;

                const newW = width  || INITIAL_CANVAS_WIDTH;
                const newH = height || INITIAL_CANVAS_HEIGHT;
                setCanvasSize({ width: newW, height: newH });
                if (canvasPanelRef.current) {
                    canvasPanelRef.current.style.width  = `${newW}px`;
                    canvasPanelRef.current.style.height = `${newH}px`;
                }
                engineRef.current.resize(newW, newH);

                if (bg_color) {
                    setBgColor(bg_color);
                    bgColorRef.current = bg_color;
                }

                if (Array.isArray(segments) && segments.length > 0) {
                    engineRef.current.loadState({ segments });
                    saveToHistory(bg_color || bgColorRef.current);
                }
            }

            if (project.melody?.events?.length > 0) {
                setMelodyEvents(project.melody.events);
                setTotalDuration(project.melody.total_duration);
                setIsMelodyGenerated(true);
            }

            setProjectId(parseInt(projectId, 10));
            // После загрузки проекта изменений нет
            setHasUnsavedChanges(false);

        } catch (err) {
            showModal('Ошибка', `Не удалось загрузить проект: ${err.message}`, 'error');
        } finally {
            setIsLoadingProject(false);
        }
    }, [engineRef, saveToHistory, setProjectId, setCurrentTitle, showModal]);

    useEffect(() => {
        const urlProjectId = searchParams.get('project');
        if (!urlProjectId || projectLoadedRef.current) return;

        const interval = setInterval(() => {
            if (engineRef.current) {
                clearInterval(interval);
                loadProjectRef.current(urlProjectId);
            }
        }, 50);

        return () => clearInterval(interval);
    }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleGenerateMelody = useCallback(async () => {
        if (!engineRef.current) {
            showModal("Ошибка", "Движок рисования не инициализирован", "error");
            return;
        }

        stop();

        setIsGenerating(true);
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

            let events;
            try {
                ({ events } = melodyEngine.buildNoteEvents(segments, melodyParamsForGen));
            } catch (engineErr) {
                console.error('MelodyEngine error:', engineErr);
                showModal("Ошибка генерации", "Не удалось обработать рисунок. Попробуйте ещё раз.", "error");
                return;
            }

            if (!events || events.length === 0) {
                showModal("Нечего генерировать", "Не удалось извлечь ноты из рисунка.", "warning");
                return;
            }

            setMelodyEvents(events);
            setTotalDuration(duration);
            setIsMelodyGenerated(true);
            setHasUnsavedChanges(true); // ← мелодия сгенерирована — тоже несохранённое изменение
            showModal("Готово", "Мелодия успешно сгенерирована!", "success");
        } catch (err) {
            console.error(err);
            showModal("Ошибка", err.message || "Непредвиденная ошибка", "error");
        } finally {
            setIsGenerating(false);
        }
    }, [engineRef, showModal, stop, bpm, duration, scale, smoothing]);

    const handlePlayPause = useCallback(() => {
        if (isPlaying) pause();
        else play();
    }, [isPlaying, play, pause]);

    const handleVolumeChange = useCallback((e) => {
        setVolume(parseFloat(e.target.value));
    }, [setVolume]);

    const progressRef = useRef(null);
    const handleProgressClick = useCallback((e) => {
        if (!progressRef.current) return;
        const rect = progressRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        seek(ratio * totalDuration);
    }, [seek, totalDuration]);

    const formatTime = (seconds) => {
        const s = Math.max(0, seconds);
        const mins = Math.floor(s / 60);
        const secs = Math.floor(s % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progressPercent = totalDuration > 0
        ? Math.min(100, (currentTime / totalDuration) * 100)
        : 0;

    const handleDownload = useCallback((type = 'image') => {
        if (type === 'image') {
            const mainCanvas = engineRef.current?.mainCanvas;
            if (!mainCanvas) { showModal("Ошибка", "Холст не найден", "error"); return; }
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width  = mainCanvas.width;
            exportCanvas.height = mainCanvas.height;
            const ctx = exportCanvas.getContext('2d');
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            ctx.drawImage(mainCanvas, 0, 0);
            const link = document.createElement('a');
            link.download = 'drawing.png';
            link.href = exportCanvas.toDataURL('image/png');
            link.click();
        } else if (type === 'wav') {
            exportToWAV(`melody_${new Date().toISOString().slice(0,10)}.wav`);
        }
    }, [engineRef, bgColor, exportToWAV, showModal]);

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
        let rafId = null;

        const onMove = (e) => {
            if (!isDraggingRef.current || !canvasPanelRef.current || !engineRef.current) return;

            const clientX = e.clientX;
            const clientY = e.clientY;

            if (rafId !== null) cancelAnimationFrame(rafId);

            rafId = requestAnimationFrame(() => {
                rafId = null;
                if (!isDraggingRef.current || !canvasPanelRef.current || !engineRef.current) return;

                const rect = canvasPanelRef.current.getBoundingClientRect();
                const containerRect = drawBlockRef.current?.getBoundingClientRect();
                const maxW = containerRect
                    ? containerRect.width - CANVAS_BLOCK_GAP - SETTINGS_MIN_WIDTH
                    : 2000;
                const rawW = Math.round(clientX - rect.left);
                const rawH = Math.round(clientY - rect.top);
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
            });
        };

        const onUp = () => {
            isDraggingRef.current = false;
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup",   onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup",   onUp);
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [engineRef]);

    const handleCanvasReady = useCallback((canvases) => {
        initEngine(canvases);
        if (engineRef.current) {
            engineRef.current.onStrokeEnd = () => {
                saveToHistory(bgColorRef.current);
                setHasUnsavedChanges(true);
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

        if (bgColorDebounceRef.current) clearTimeout(bgColorDebounceRef.current);
        bgColorDebounceRef.current = setTimeout(() => {
            saveToHistory(color);
            setHasUnsavedChanges(true); // ← смена фона тоже изменение
        }, 800);
    }, [saveToHistory]);

    const syncLayout = useCallback(() => {
        const canvasEl  = canvasPanelRef.current;
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

    const handleUndo  = useCallback(() => undo(null, setBgColor),  [undo]);
    const handleRedo  = useCallback(() => redo(null, setBgColor),  [redo]);
    const handleClear = useCallback(() => {
        clear(bgColorRef.current);
        setIsMelodyGenerated(false);
        setMelodyEvents([]);
        stop();
        setActiveNote(null);
        setProjectId(null);
        setProjectTitle('Без названия');
        setCurrentTitle('');
        setHasUnsavedChanges(false); // ← очистка = чистое состояние
        const el = document.querySelector('.project-title-input');
        if (el) el.textContent = 'Без названия';
    }, [clear, stop, setProjectId, setCurrentTitle]);

    return (
        <div className="canvas-content">
            {isLoadingProject && (
                <div className="import-overlay" style={{ position: 'fixed', zIndex: 1000 }}>
                    <Loader size={64} color="cyan" speed={1200} />
                </div>
            )}
            <div className="canvas-bg-line">
                <img src={BgCanvasLine} alt="фоновая линия" />
            </div>
            <div className="canvas-header">
                <div className="canvas-header-text">
                    <div
                        className="project-title-input"
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => setProjectTitle(e.currentTarget.textContent)}
                        data-placeholder="Введите название проекта..."
                    />
                    <div className="divider-project" />
                </div>
                <div className="canvas-header-icons">
                    <div className="icon favourite-btn" onClick={() => setIsStarSelected(p => !p)}>
                        <img src={isStarSelected ? StarSelectedIcon : StarIcon} alt="Избранное" />
                    </div>
                    <div className="icon save-btn" onClick={isSaving ? undefined : handleSave}>
                        {isSaving
                            ? <Loader size={20} color="white" />
                            : <img src={SaveIcon} alt="Сохранить проект" />
                        }
                    </div>
                    <div
                        className="icon download-btn"
                        onClick={() => {
                            if (!isMelodyGenerated) { handleDownload('image'); return; }
                            openModal({
                                title: 'Скачать',
                                description: 'Выберите формат для скачивания',
                                primaryText: 'Мелодия (WAV)',
                                cancelText: 'Картинка (PNG)',
                                variant: 'default',
                                onPrimary: () => handleDownload('wav'),
                                onCancel: () => handleDownload('image'),
                            });
                        }}
                    >
                        <img src={DownloadIcon} alt="Скачать" />
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

                            <div className="resize-handle-horizontal"
                                 onMouseDown={handleResizeMouseDown("horizontal")} />
                            <div className="resize-handle-vertical"
                                 onMouseDown={handleResizeMouseDown("vertical")} />
                            <div className="resize-handle-corner"
                                 onMouseDown={handleResizeMouseDown("both")} />

                            {isImporting && (
                                <div className="import-overlay">
                                    <Loader size={64} color="cyan" speed={1200} />
                                </div>
                            )}

                            {isPlaying && activeNote && (
                                <ActiveNoteIndicator note={activeNote} />
                            )}
                        </div>

                        <div className="idk-panel" />
                    </div>

                    <div className="settings-block">
                        <SettingsPanel
                            bpm={bpm}                 onBpmChange={setBpm}
                            duration={duration}       onDurationChange={setDuration}
                            scale={scale}             onScaleChange={setScale}
                            smoothing={smoothing}     onSmoothingChange={setSmoothing}
                            effectReverb={effectReverb}         onReverbChange={setEffectReverb}
                            effectDelay={effectDelay}           onDelayChange={setEffectDelay}
                            effectDistortion={effectDistortion} onDistortionChange={setEffectDistortion}
                        />
                    </div>
                </div>

                {isMelodyGenerated && (
                    <div className="music-player">
                        <div className="icon" onClick={() => skip(-5)} title="−5 с">
                            <img src={SkipBackIcon} alt="Назад 5 с" />
                        </div>
                        <div className="icon" onClick={handlePlayPause}>
                            <img
                                src={isPlaying ? PauseIcon : PlayIcon}
                                alt={isPlaying ? "Пауза" : "Воспроизвести"}
                            />
                        </div>
                        <div className="icon" onClick={() => skip(5)} title="+5 с">
                            <img src={SkipForwardIcon} alt="Вперёд 5 с" />
                        </div>

                        <div
                            ref={progressRef}
                            className="progress-bar-container"
                            onClick={handleProgressClick}
                        >
                            <div
                                className="progress-fill"
                                style={{ width: `${progressPercent}%` }}
                            />
                            <div
                                className="progress-thumb"
                                style={{ left: `${progressPercent}%` }}
                            />
                        </div>

                        <p className="time-text">
                            {formatTime(currentTime)} / {formatTime(totalDuration)}
                        </p>

                        <div className="volume-control">
                            <div className="icon volume-btn">
                                <img
                                    src={
                                        volume === 0 ? VolumeNoIcon :
                                        volume < 0.5 ? VolumeLowIcon : VolumeHighIcon
                                    }
                                    alt="Громкость"
                                    className="volume-icon"
                                    onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                                />
                            </div>
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

            {/* Общая модалка для уведомлений и подтверждений */}
            <Modal
                isOpen={modalOpen}
                onClose={closeModal}
                title={modalConfig.title}
                description={modalConfig.description}
                variant={modalConfig.variant || 'default'}
                primaryText={modalConfig.primaryText || 'ОК'}
                cancelText={modalConfig.cancelText}
                onPrimary={() => {
                    setModalOpen(false);
                    modalConfig.onPrimary?.();
                }}
                onCancel={() => {
                    setModalOpen(false);
                    modalConfig.onCancel?.();
                }}
            />

            {/* Модалка с инпутом названия */}
            <SaveAsModal
                isOpen={showSaveAsModal}
                onClose={() => setShowSaveAsModal(false)}
                onSave={handleSaveAsConfirm}
                existingNames={existingProjectNames}
            />
        </div>
    );
};

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
        <div className="active-note-indicator">
            <span className="note-name">{freqToNoteName(note.freq)}</span>
            <span className="instrument">{INSTRUMENT_LABEL[note.instrument] || note.instrument}</span>
            <span className="frequency">{Math.round(note.freq)} Гц</span>
        </div>
    );
};

export default Canvas;