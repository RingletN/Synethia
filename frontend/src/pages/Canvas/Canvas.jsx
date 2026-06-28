import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api";
import { HintProvider } from "./context/HintContext";
import HintPanel from "./components/HintPanel";
import { useHint, useHintPush } from "./hooks/useHint";
import BgCanvasLine from "../../assets/backgrounds/bg-canvas-line.png";
import DrawingArea from "./components/DrawingArea";
import ToolsPanel from "./components/ToolsPanel";
import SettingsPanel from "./components/SettingsPanel";
import { useDrawing } from "./hooks/useDrawing";
import { useProjectSave } from "./hooks/useProjectSave";
import useMelodyPlayer from "../../hooks/useMelodyPlayer";
import { useAudioExporter } from "./hooks/useAudioExporter";
import { imageToSegments } from "../../utils/imageToSegments";
import { COLOR_TO_INSTRUMENT } from "../../engines/MelodyEngine/constants";
import MelodyEngine from "../../engines/MelodyEngine/MelodyEngine";
import Button from "../../components/ui/Button/Button";
import Loader from "../../components/ui/Loader";
import SaveAsModal from "../../components/ui/Modal/SaveAsModal";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import Modal from "../../components/ui/Modal/Modal";
import StarIcon from "../../assets/icons/icon-star.svg";
import StarSelectedIcon from "../../assets/icons/icon-star-selected.svg";
import SaveIcon from "../../assets/icons/icon-save.svg";
import DownloadIcon from "../../assets/icons/icon-download.svg";
import TrashIcon from "../../assets/icons/icon-trash.svg";
import QuestionIcon from "../../assets/icons/icon-question.svg";
import { Joyride } from "react-joyride";
import "./Canvas.css";
import MusicPlayer from "./components/MusicPlayer";
import { useCanvasResize } from "./hooks/useCanvasResize";

const melodyEngine = new MelodyEngine();

// ─── Конфигурация тура
const tourSteps = [
  {
    target: '[data-tour="canvas"]',
    content:
      "🎨 Это ваш холст - рисуйте, и линии превратятся в музыку. " +
      "Высота линии - это высота ноты: чем выше на холсте, тем выше звук, " +
      "чем ниже - тем ниже звук. Мелодия проигрывается слева направо - " +
      "так же, как вы её рисуете. А цвет линии определяет, каким " +
      "инструментом она прозвучит (например, разные цвета - разные тембры). " +
      "Попробуйте - и услышите свой рисунок.",
    placement: "right",
  },
  {
    target: '[data-tour="project-title"]',
    content: "✏️ Название проекта – дайте имя своему творению.",
    placement: "bottom",
    skipScroll: true,
  },
  {
    target: ".canvas-header-icons",
    content:
      "⭐ Здесь собраны основные действия с проектом: добавить в избранное, " +
      "сохранить, скачать рисунок или мелодию и удалить проект. Если Вы захотите " +
      "вернуться к руководству - нажмите знак вопроса.",
    placement: "bottom",
    skipScroll: true,
  },
  {
    target: ".import-photo-btn",
    content:
      "🖼️ Импорт фото – загрузите изображение, контуры превратятся в ноты.",
    placement: "right",
  },
  {
    target: ".brush-color-btn",
    content: "🎹 Инструмент – выберите цвет кисти и музыкальный инструмент.",
    placement: "right",
  },
  {
    target: ".settings-block",
    content:
      "⚙️ Панель настроек – здесь можно задать темп, длительность " +
      "мелодии, лад, ритм и эффекты звучания." +
      " Эти параметры влияют на то, как будет " +
      "звучать сгенерированная мелодия. Экспериментируйте!",
    placement: "left",
  },
  {
    target: '[data-tour="generate-btn"]',
    content: "🎶 Главная кнопка! Превратит рисунок в музыку.",
    placement: "top",
  },
];

// Стили для тура
const tourStyles = {
  options: {
    primaryColor: "#00ffd1",
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    arrowColor: "#12121e",
    zIndex: 2000,
  },
  buttonPrimary: {
    backgroundColor: "#00ffd1",
    color: "#0B0B1F",
    borderRadius: "40px",
    fontWeight: "bold",
    padding: "10px 22px",
    fontFamily: "Montserrat, sans-serif",
    fontSize: "24px",
    whiteSpace: "nowrap",
    border: "none",
    cursor: "pointer",
  },
  buttonBack: {
    color: "#ccc",
    fontFamily: "Montserrat, sans-serif",
    fontSize: "24px",
    background: "transparent",
    border: "none",
    outline: "none",
    boxShadow: "none",
    cursor: "pointer",
  },
  buttonSkip: {
    color: "#ccc",
    fontFamily: "Montserrat, sans-serif",
    fontSize: "24px",
    background: "transparent",
    border: "none",
    outline: "none",
    boxShadow: "none",
    cursor: "pointer",
  },
  tooltip: {
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
    borderRadius: "16px",
    padding: "20px",
    fontSize: "24px",
    lineHeight: 1.6,
    fontFamily: "Montserrat, sans-serif",
    boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
    border: "1px solid rgba(0,0,0,0.1)",
    maxWidth: "600px",
    minWidth: "600px",
  },
  overlay: {
    backgroundColor: "rgba(0,0,0,0.7)",
  },
};

const CustomTooltip = ({
  step,
  index,
  size,
  continuous,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}) => {
  const isLastStep = index === size - 1;

  return (
    <div
      {...tooltipProps}
      style={{
        ...tourStyles.tooltip,
        position: "relative",
        padding: "24px 32px",
        maxWidth: "700px",
        minWidth: "500px",
      }}
    >
      {/* крестик закрытия в правом верхнем углу, как в дефолтном тултипе */}
      <button
        {...closeProps}
        aria-label="Закрыть"
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          outline: "none",
          boxShadow: "none",
          color: "#ccc",
          fontSize: "28px",
          lineHeight: 1,
          cursor: "pointer",
          padding: 0,
        }}
      >
        ×
      </button>

      <div
        style={{
          fontSize: "24px",
          fontFamily: "Montserrat, sans-serif",
          paddingRight: "28px",
        }}
      >
        {step.content}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "24px",
          justifyContent: "space-between",
        }}
      >
        <button {...skipProps} style={tourStyles.buttonSkip}>
          Пропустить
        </button>

        <div style={{ display: "flex", gap: "12px" }}>
          {index > 0 && (
            <button {...backProps} style={tourStyles.buttonBack}>
              Назад
            </button>
          )}
          {continuous && (
            <button {...primaryProps} style={tourStyles.buttonPrimary}>
              {isLastStep ? "Завершить" : `Далее (${index + 1} из ${size})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
// Общие опции тура
const tourOptions = {
  skipBeacon: true,
  showProgress: true,
  buttons: ["skip", "back", "close", "primary"],
  skipScroll: false,
  scrollOffset: 120,
  scrollDuration: 300,
  blockTargetInteraction: false,
  overlayClickAction: false, // клик по затемнению не закрывает тур случайно
};

const tourLocale = {
  back: "Назад",
  close: "Закрыть",
  last: "Завершить",
  next: "Далее",
  nextWithProgress: "Далее ({current} из {total})",
  skip: "Пропустить",
};

const CanvasInner = ({
  // состояния
  isBrushSelected,
  setIsBrushSelected,
  isFavorite,
  brushColor,
  isImporting,
  projectTitle,
  setProjectTitle,
  bpm,
  setBpm,
  duration,
  setDuration,
  scale,
  setScale,
  rhythmPattern,
  setRhythmPattern,
  effectReverb,
  setEffectReverb,
  effectDelay,
  setEffectDelay,
  effectDistortion,
  setEffectDistortion,
  isGenerating,
  isMelodyGenerated,
  totalDuration,
  modalOpen,
  modalConfig,
  bgColor,
  isLoadingProject,
  showSaveAsModal,
  setShowSaveAsModal,
  existingProjectNames,
  // рефы
  toolsPanelRef,
  canvasPanelRef,
  drawBlockRef,
  engineRef,
  // хуки рисования
  canUndo,
  canRedo,
  canvasSize,
  handleResizeMouseDown,
  // плеер
  isPlaying,
  currentTime,
  volume,
  setVolume,
  // хэндлеры
  handleUndo,
  handleRedo,
  handleClear,
  handleBgColorChange,
  handleBrushColorChange,
  handleImportPhoto,
  handleCanvasReady,
  handleToggleFavorite,
  handleSave,
  handleDownload,
  handleDeleteProject,
  handleGenerateMelody,
  handlePlayPause,
  handleSaveAsConfirm,
  setCurrentTitle,
  skip,
  seek,
  openModal,
  closeModal,
}) => {
  const [runTour, setRunTour] = useState(false);

  // Флаг, что тур уже был показан (храним в localStorage)
  const [tourCompleted, setTourCompleted] = useState(() => {
    return localStorage.getItem("synethia_tour_completed") === "true";
  });

  // Запуск тура
  const startTour = () => {
    setRunTour(true);
  };

  // Обработчик событий тура
  const handleTourEvent = (data) => {
    const { status, type } = data;

    if (status === "finished" || status === "skipped") {
      setRunTour(false);
      localStorage.setItem("synethia_tour_completed", "true");
      setTourCompleted(true);
      return;
    }

    if (type === "error:target_not_found") {
      // Таргет шага не найден в DOM — пропускаем тур целиком, чтобы
      // не зависнуть на затемнённом экране без возможности продолжить
      console.warn("Joyride: элемент шага не найден, тур остановлен", data);
      setRunTour(false);
    }
  };

  // Автоматический запуск при первом рендере, если тур ещё не показывали
  useEffect(() => {
    if (!tourCompleted) {
      const timer = setTimeout(() => startTour(), 700);
      return () => clearTimeout(timer);
    }
  }, [tourCompleted]);

  // ── хинты ──────────────────────────

  const hintCanvas = useHint(
    canUndo ? "Каждый штрих повлияет на мелодию" : "Музыка рождается из линий",
  );

  // useHintPush: при клике пушим уже вычисленный следующий текст
  const hintFavorite = useHintPush(() =>
    isFavorite ? "Убрать из избранного" : "Добавить в избранное",
  );

  const hintSave = useHint("Сохранить проект");
  const hintDownload = useHint("Скачать рисунок или мелодию");
  const hintDelete = useHint("Удалить проект или очистить холст");
  const hintQuestion = useHint("Как пользоваться приложением");
  const hintTitle = useHint("Дайте название своему шедевру");

  const hintGenerate = useHint(
    isGenerating
      ? "Генерируем мелодию, подождите…"
      : isMelodyGenerated
        ? "Перегенерировать мелодию по рисунку"
        : "Преобразовать рисунок в музыку",
  );

  return (
    <div className="canvas-content">
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        onEvent={handleTourEvent}
        styles={tourStyles}
        locale={tourLocale}
        options={tourOptions}
        scrollToFirstStep={false}
        tooltipComponent={CustomTooltip}
      />
      {isLoadingProject && (
        <div
          className="import-overlay"
          style={{ position: "fixed", zIndex: 1000 }}
        >
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
            data-tour="project-title"
            contentEditable
            suppressContentEditableWarning
            {...hintTitle}
            onInput={(e) => {
              setProjectTitle(e.currentTarget.textContent);
              setCurrentTitle(e.currentTarget.textContent);
            }}
            data-placeholder="Введите название проекта..."
          />
          <div className="divider-project" />
        </div>
        <div className="canvas-header-icons">
          <div
            className="icon favourite-btn"
            data-tour="favorite"
            onClick={() => {
              handleToggleFavorite();
              hintFavorite.push(
                isFavorite ? "Добавить в избранное" : "Убрать из избранного",
              );
            }}
            onMouseEnter={hintFavorite.onMouseEnter}
            onMouseLeave={hintFavorite.onMouseLeave}
          >
            <img
              src={isFavorite ? StarSelectedIcon : StarIcon}
              alt="Избранное"
            />
          </div>
          <div
            className="icon save-btn"
            data-tour="save"
            onClick={handleSave}
            {...hintSave}
          >
            <img src={SaveIcon} alt="Сохранить проект" />
          </div>
          <div
            className="icon download-btn"
            data-tour="download"
            {...hintDownload}
            onClick={() => {
              if (!isMelodyGenerated) {
                handleDownload("image");
                return;
              }
              openModal({
                title: "Скачать",
                description: "Выберите формат для скачивания",
                primaryText: "Мелодия (WAV)",
                cancelText: "Картинка (PNG)",
                variant: "warning",
                onPrimary: () => handleDownload("wav"),
                onCancel: () => handleDownload("image"),
              });
            }}
          >
            <img src={DownloadIcon} alt="Скачать" />
          </div>
          <div
            className="icon delete-btn"
            data-tour="delete"
            onClick={handleDeleteProject}
            {...hintDelete}
          >
            <img src={TrashIcon} alt="Удалить проект" />
          </div>
          <div
            className="icon question-btn"
            data-tour="question"
            onClick={startTour}
            {...hintQuestion}
          >
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
              data-tour="canvas"
              ref={canvasPanelRef}
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
                backgroundColor: bgColor,
              }}
              {...hintCanvas}
            >
              <DrawingArea
                width={canvasSize.width}
                height={canvasSize.height}
                onReady={handleCanvasReady}
              />

              <div
                className="resize-handle-horizontal"
                onMouseDown={handleResizeMouseDown("horizontal")}
              />
              <div
                className="resize-handle-vertical"
                onMouseDown={handleResizeMouseDown("vertical")}
              />
              <div
                className="resize-handle-corner"
                onMouseDown={handleResizeMouseDown("both")}
              />

              {isImporting && (
                <div className="import-overlay">
                  <Loader size={64} color="cyan" speed={1200} />
                </div>
              )}
            </div>
            <HintPanel />
          </div>

          <div className="settings-block">
            <SettingsPanel
              bpm={bpm}
              onBpmChange={setBpm}
              duration={duration}
              onDurationChange={setDuration}
              scale={scale}
              onScaleChange={setScale}
              rhythmPattern={rhythmPattern}
              onRhythmPatternChange={setRhythmPattern}
              effectReverb={effectReverb}
              onReverbChange={setEffectReverb}
              effectDelay={effectDelay}
              onDelayChange={setEffectDelay}
              effectDistortion={effectDistortion}
              onDistortionChange={setEffectDistortion}
            />
          </div>
        </div>

        {isMelodyGenerated && (
          <MusicPlayer
            isPlaying={isPlaying}
            currentTime={currentTime}
            totalDuration={totalDuration}
            volume={volume}
            onVolumeChange={setVolume}
            onPlayPause={handlePlayPause}
            onSkip={skip}
            onSeek={seek}
          />
        )}
      </div>

      <Button
        data-tour="generate-btn"
        variant="accent"
        onClick={handleGenerateMelody}
        disabled={isGenerating}
        {...hintGenerate}
      >
        {isGenerating ? "ИДЁТ ГЕНЕРАЦИЯ…" : "СГЕНЕРИРОВАТЬ МЕЛОДИЮ"}
      </Button>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalConfig.title}
        description={modalConfig.description}
        variant={modalConfig.variant || "default"}
        primaryText={modalConfig.primaryText || "ОК"}
        cancelText={modalConfig.cancelText}
        onPrimary={() => {
          closeModal();
          modalConfig.onPrimary?.();
        }}
        onCancel={() => {
          closeModal();
          modalConfig.onCancel?.();
        }}
      />

      <SaveAsModal
        isOpen={showSaveAsModal}
        onClose={() => setShowSaveAsModal(false)}
        onSave={handleSaveAsConfirm}
        existingNames={existingProjectNames}
      />
    </div>
  );
};

// ─── Canvas — содержит всю логику, рендерит HintProvider - CanvasInner ────────
const Canvas = () => {
  // --- Состояния ---
  const [isBrushSelected, setIsBrushSelected] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [brushColor, setBrushColor] = useState("#00ffd1");
  const [isImporting, setIsImporting] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [bpm, setBpm] = useState(80);
  const [duration, setDuration] = useState(20);
  const [scale, setScale] = useState("major");
  const [rhythmPattern, setRhythmPattern] = useState("rock");

  const [effectReverb, setEffectReverb] = useState(0);
  const [effectDelay, setEffectDelay] = useState(0);
  const [effectDistortion, setEffectDistortion] = useState(0);

  const effects = {
    reverb: effectReverb,
    delay: effectDelay,
    distortion: effectDistortion,
  };
  const melodyParamsForGen = { bpm, duration, scale, rhythmPattern };

  const [isGenerating, setIsGenerating] = useState(false);
  const [isMelodyGenerated, setIsMelodyGenerated] = useState(false);
  const [melodyEvents, setMelodyEvents] = useState([]);
  const [totalDuration, setTotalDuration] = useState(8);
  const { exportToWAV } = useAudioExporter(melodyEvents, totalDuration);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({});
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const bgColorRef = useRef("#FFFFFF");
  const brushColorRef = useRef("#00ffd1");

  useEffect(() => {
    bgColorRef.current = bgColor;
  }, [bgColor]);
  useEffect(() => {
    brushColorRef.current = brushColor;
  }, [brushColor]);

  const toolsPanelRef = useRef(null);
  const canvasPanelRef = useRef(null);
  const drawBlockRef = useRef(null);
  const bgColorDebounceRef = useRef(null);

  // --- Хук рисования ---
  const {
    engineRef,
    initEngine,
    saveToHistory,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
  } = useDrawing(8, "#FFFFFF");

  // --- Хук ресайза ---
  const {
    canvasSize,
    setCanvasSize,
    handleResizeMouseDown,
    syncLayout,
    scheduleResize,
  } = useCanvasResize(engineRef, canvasPanelRef, drawBlockRef);

  // --- Другие хуки и логика ---
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const PENDING_KEY = "pendingCanvas";
  const pendingSaveRef = useRef(false);

  // Восстановление pendingSave
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
        if (saved.projectTitle) {
          setProjectTitle(saved.projectTitle);
          const el = document.querySelector(".project-title-input");
          if (el) el.textContent = saved.projectTitle;
        }
        if (saved.bgColor) {
          setBgColor(saved.bgColor);
          bgColorRef.current = saved.bgColor;
        }
        if (saved.canvasSize) setCanvasSize(saved.canvasSize);
        if (saved.bpm) setBpm(saved.bpm);
        if (saved.duration) setDuration(saved.duration);
        if (saved.scale) setScale(saved.scale);
        if (saved.rhythmPattern) setRhythmPattern(saved.rhythmPattern);
        if (saved.effectReverb !== undefined)
          setEffectReverb(saved.effectReverb);
        if (saved.effectDelay !== undefined) setEffectDelay(saved.effectDelay);
        if (saved.effectDistortion !== undefined)
          setEffectDistortion(saved.effectDistortion);
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
        console.error("Ошибка восстановления холста:", e);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

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

  const showModal = useCallback(
    (title, description, variant = "default") => {
      openModal({ title, description, variant, primaryText: "ОК" });
    },
    [openModal],
  );

  useUnsavedChanges(hasUnsavedChanges, openModal);

  const {
    handleSaveClick,
    showSaveAsModal,
    setShowSaveAsModal,
    handleSaveAsConfirm,
    existingProjectNames,
    currentTitle,
    setCurrentTitle,
    projectId,
    setProjectId,
  } = useProjectSave({
    engineRef,
    bgColor,
    canvasSize,
    bpm,
    duration,
    scale,
    rhythmPattern,
    effectReverb,
    effectDelay,
    effectDistortion,
    melodyEvents,
    totalDuration,
    isMelodyGenerated,
    showModal,
    onSaveSuccess: () => setHasUnsavedChanges(false),
  });

  useEffect(() => {
    if (currentTitle && currentTitle !== projectTitle) {
      setProjectTitle(currentTitle);
      const el = document.querySelector(".project-title-input");
      if (el) el.textContent = currentTitle;
    }
  }, [currentTitle]);

  useEffect(() => {
    if (!pendingSaveRef.current) return;
    const saved = pendingSaveRef.current;

    if (!saved.projectTitle?.trim()) {
      pendingSaveRef.current = null;
      setShowSaveAsModal(true);
      return;
    }
    const melodyReady =
      !saved.melodyEvents?.length ||
      (isMelodyGenerated && melodyEvents.length === saved.melodyEvents.length);
    if (!melodyReady) return;
    pendingSaveRef.current = null;
    handleSaveClick(saved.projectTitle ?? "");
  }, [isMelodyGenerated, melodyEvents, handleSaveClick]);

  const handleSave = useCallback(() => {
    if (!user) {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          projectTitle: projectTitle.trim(),
          bgColor,
          canvasSize,
          bpm,
          duration,
          scale,
          rhythmPattern,
          effectReverb,
          effectDelay,
          effectDistortion,
          melodyEvents,
          totalDuration,
          segments: engineRef.current?.getAllSegments?.() ?? [],
        }),
      );
      navigate("/auth?redirect=/canvas&pendingSave=1");
      return;
    }
    const trimmed = projectTitle.trim();
    if (!trimmed) {
      setShowSaveAsModal(true);
      return;
    }
    handleSaveClick(trimmed);
  }, [
    user,
    handleSaveClick,
    setShowSaveAsModal,
    projectTitle,
    bgColor,
    canvasSize,
    bpm,
    duration,
    scale,
    effectReverb,
    effectDelay,
    effectDistortion,
    melodyEvents,
    totalDuration,
    engineRef,
    navigate,
  ]);

  const handleBrushColorChange = useCallback(
    (newColor) => {
      setBrushColor(newColor);
      brushColorRef.current = newColor;
      if (engineRef.current) engineRef.current.currentColor = newColor;
    },
    [engineRef],
  );

  const handleImportPhoto = useCallback(
    async (file) => {
      if (!engineRef.current) {
        showModal("Ошибка", "Движок рисования не инициализирован", "error");
        return;
      }
      setIsImporting(true);
      try {
        const currentLineWidth = engineRef.current.getLineWidth?.() || 5;

        const palette = Object.entries(COLOR_TO_INSTRUMENT).map(
          ([color, instrument]) => ({ color, instrument }),
        );

        const segments = await imageToSegments(file, {
          threshold: 90,
          maxWidth: 700,
          minSegmentLen: 20,
          maxSegments: 400,
          simplifyEps: 0.004,
          // lineWidth: currentLineWidth,
          lineWidth: 12,
          palette,
        });

        if (segments.length === 0) {
          showModal(
            "Контуры не найдены",
            "На изображении не удалось обнаружить достаточно контуров.\n\nПопробуйте другое фото",
          );
          return;
        }
        engineRef.current.addSegments(segments);
      } catch (err) {
        console.error("Ошибка обработки изображения:", err);
        showModal(
          "Ошибка обработки фото",
          "Не удалось обработать изображение.",
          "error",
        );
      } finally {
        setIsImporting(false);
      }
    },
    [engineRef, showModal],
  );

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
  } = useMelodyPlayer(melodyEvents, totalDuration, null, effects);

  const handleStrokeEnd = useCallback(() => {
    saveToHistory(bgColorRef.current);
    setHasUnsavedChanges(true);
  }, [saveToHistory]);

  const loadProjectRef = useRef(null);
  loadProjectRef.current = useCallback(
    async (projectId) => {
      if (projectLoadedRef.current) return;
      projectLoadedRef.current = true;
      setIsLoadingProject(true);
      try {
        const project = await api.get(`/api/projects/${projectId}`);
        if (project.title) {
          setProjectTitle(project.title);
          setCurrentTitle(project.title);
          const el = document.querySelector(".project-title-input");
          if (el) el.textContent = project.title;
        }
        if (project.settings) {
          const s = project.settings;
          setBpm(s.bpm);
          setDuration(s.duration);
          setScale(s.scale);
          setRhythmPattern(s.rhythm_pattern || "rock");
          setEffectReverb(parseFloat(s.reverb));
          setEffectDelay(parseFloat(s.delay));
          setEffectDistortion(parseFloat(s.distortion));
        }
        if (project.canvas && engineRef.current) {
          const { segments, bg_color, width, height } = project.canvas;
          const newW = width || 750;
          const newH = height || 600;
          setCanvasSize({ width: newW, height: newH });
          requestAnimationFrame(() => {
            engineRef.current?._doResize(newW, newH);
          });

          if (bg_color) {
            setBgColor(bg_color);
            bgColorRef.current = bg_color;
          }
          if (Array.isArray(segments) && segments.length > 0) {
            engineRef.current.loadState({ segments });
            saveToHistory(bg_color || bgColorRef.current);
          }
        }
        if (project.is_favorite !== undefined)
          setIsFavorite(Boolean(project.is_favorite));
        if (project.melody?.events?.length > 0) {
          setMelodyEvents(project.melody.events);
          setTotalDuration(project.melody.total_duration);
          setIsMelodyGenerated(true);
        }
        setProjectId(parseInt(projectId, 10));
        setHasUnsavedChanges(false);
      } catch (err) {
        showModal(
          "Ошибка",
          `Не удалось загрузить проект: ${err.message}`,
          "error",
        );
      } finally {
        setIsLoadingProject(false);
      }
    },
    [
      engineRef,
      saveToHistory,
      setProjectId,
      setCurrentTitle,
      showModal,
      canvasPanelRef,
      setCanvasSize,
    ],
  );

  useEffect(() => {
    const urlProjectId = searchParams.get("project");
    if (!urlProjectId || projectLoadedRef.current) return;
    const interval = setInterval(() => {
      if (engineRef.current) {
        clearInterval(interval);
        loadProjectRef.current(urlProjectId);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [searchParams]);

  const handleGenerateMelody = useCallback(async () => {
    if (!engineRef.current) {
      showModal("Ошибка", "Движок рисования не инициализирован", "error");
      return;
    }
    stop();
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      const segments = engineRef.current.getAllSegments();
      console.log(
        "🎨 segments при генерации:",
        segments.map((s) => ({ color: s.color, points: s.points?.length })),
      );
      if (!segments || segments.length === 0) {
        showModal(
          "Нечего генерировать",
          "Нарисуйте что-нибудь на холсте или импортируйте изображение.",
          "warning",
        );
        return;
      }
      let events;
      try {
        ({ events } = melodyEngine.buildNoteEvents(
          segments,
          melodyParamsForGen,
        ));
        // --- DEBUG EXPORT ---
        const {
          events: eventsForLog,
          tonicMidi,
          roles,
        } = melodyEngine.buildNoteEvents(segments, melodyParamsForGen);
        const log = melodyEngine.exportDebugLog(
          eventsForLog,
          roles,
          tonicMidi,
          melodyParamsForGen,
        );
        const blob = new Blob([log], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `melody-debug-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        // --- END DEBUG ---
      } catch (engineErr) {
        console.error("MelodyEngine error:", engineErr);
        showModal(
          "Ошибка генерации",
          "Не удалось обработать рисунок. Попробуйте ещё раз.",
          "error",
        );
        return;
      }
      if (!events || events.length === 0) {
        showModal(
          "Нечего генерировать",
          "Не удалось извлечь ноты из рисунка.",
          "warning",
        );
        return;
      }
      setMelodyEvents(events);
      setTotalDuration(duration);
      setIsMelodyGenerated(true);
      setHasUnsavedChanges(true);
      showModal("Готово", "Мелодия успешно сгенерирована!", "success");
    } catch (err) {
      console.error(err);
      showModal("Ошибка", err.message || "Непредвиденная ошибка", "error");
    } finally {
      setIsGenerating(false);
    }
  }, [engineRef, showModal, stop, bpm, duration, scale, melodyParamsForGen]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const handleDownload = useCallback(
    (type = "image") => {
      if (type === "image") {
        const mainCanvas = engineRef.current?.mainCanvas;
        if (!mainCanvas) {
          showModal("Ошибка", "Холст не найден", "error");
          return;
        }
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = mainCanvas.width;
        exportCanvas.height = mainCanvas.height;
        const ctx = exportCanvas.getContext("2d");
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        ctx.drawImage(mainCanvas, 0, 0);
        const link = document.createElement("a");
        link.download = "drawing.png";
        link.href = exportCanvas.toDataURL("image/png");
        link.click();
      } else if (type === "wav") {
        exportToWAV(`melody_${new Date().toISOString().slice(0, 10)}.wav`);
      }
    },
    [engineRef, bgColor, exportToWAV, showModal],
  );

  const handleCanvasReady = useCallback(
    (canvases) => {
      initEngine(canvases);
      if (engineRef.current) {
        engineRef.current.onStrokeEnd = handleStrokeEnd;
      }
      // автоимпорт, если есть
      const raw = sessionStorage.getItem("pendingImportFile");
      if (raw && location.state?.autoImport) {
        sessionStorage.removeItem("pendingImportFile");
        try {
          const { name, type, data } = JSON.parse(raw);
          fetch(data)
            .then((r) => r.blob())
            .then((blob) => {
              const file = new File([blob], name, { type });
              handleImportPhoto(file);
            });
        } catch (e) {
          console.error("Ошибка автоимпорта:", e);
        }
      }
    },
    [initEngine, handleStrokeEnd, handleImportPhoto, location.state],
  );

  const handleBgColorChange = useCallback(
    (color) => {
      setBgColor(color);
      bgColorRef.current = color;
      if (bgColorDebounceRef.current) clearTimeout(bgColorDebounceRef.current);
      bgColorDebounceRef.current = setTimeout(() => {
        saveToHistory(color);
        setHasUnsavedChanges(true);
      }, 800);
    },
    [saveToHistory],
  );

  const handleUndo = useCallback(() => undo(null, setBgColor), [undo]);
  const handleRedo = useCallback(() => redo(null, setBgColor), [redo]);
  const handleClear = useCallback(() => {
    clear(bgColorRef.current);
    setIsMelodyGenerated(false);
    setMelodyEvents([]);
    stop();
    setProjectId(null);
    setProjectTitle("");
    setCurrentTitle("");
    setIsFavorite(false);
    setHasUnsavedChanges(false);
    const el = document.querySelector(".project-title-input");
    if (el) el.textContent = "";
  }, [clear, stop, setProjectId, setCurrentTitle]);

  const handleToggleFavorite = useCallback(async () => {
    setIsFavorite((prev) => !prev);
    if (!projectId) return;
    try {
      await api.patch(`/api/projects/${projectId}/favorite`);
    } catch (err) {
      setIsFavorite((prev) => !prev);
      showModal(
        "Ошибка",
        "Не удалось обновить избранное. Попробуйте ещё раз.",
        "error",
      );
    }
  }, [projectId, showModal]);

  const handleDeleteProject = useCallback(() => {
    openModal({
      title: "Удалить проект",
      description: projectId
        ? `Вы уверены, что хотите удалить проект «${projectTitle}»? Это действие необратимо.`
        : "Очистить холст? Несохранённые изменения будут потеряны.",
      variant: "warning",
      primaryText: "Удалить",
      cancelText: "Отмена",
      onPrimary: async () => {
        setModalOpen(false);
        if (projectId) {
          try {
            await api.delete(`/api/projects/${projectId}`);
          } catch (err) {
            showModal(
              "Ошибка",
              "Не удалось удалить проект. Попробуйте ещё раз.",
              "error",
            );
            return;
          }
        }
        handleClear();
        setIsFavorite(false);
      },
      onCancel: () => setModalOpen(false),
    });
  }, [projectId, projectTitle, openModal, showModal, handleClear]);

  useEffect(() => {
    const obs = new ResizeObserver(() => requestAnimationFrame(syncLayout));
    if (drawBlockRef.current) obs.observe(drawBlockRef.current);
    return () => obs.disconnect();
  }, [syncLayout]);

  return (
    <HintProvider>
      <CanvasInner
        // состояния
        isBrushSelected={isBrushSelected}
        setIsBrushSelected={setIsBrushSelected}
        isFavorite={isFavorite}
        brushColor={brushColor}
        isImporting={isImporting}
        projectTitle={projectTitle}
        setProjectTitle={setProjectTitle}
        bpm={bpm}
        setBpm={setBpm}
        duration={duration}
        setDuration={setDuration}
        scale={scale}
        setScale={setScale}
        rhythmPattern={rhythmPattern}
        setRhythmPattern={setRhythmPattern}
        effectReverb={effectReverb}
        setEffectReverb={setEffectReverb}
        effectDelay={effectDelay}
        setEffectDelay={setEffectDelay}
        effectDistortion={effectDistortion}
        setEffectDistortion={setEffectDistortion}
        isGenerating={isGenerating}
        isMelodyGenerated={isMelodyGenerated}
        totalDuration={totalDuration}
        modalOpen={modalOpen}
        modalConfig={modalConfig}
        bgColor={bgColor}
        isLoadingProject={isLoadingProject}
        showSaveAsModal={showSaveAsModal}
        setShowSaveAsModal={setShowSaveAsModal}
        existingProjectNames={existingProjectNames}
        // рефы
        toolsPanelRef={toolsPanelRef}
        canvasPanelRef={canvasPanelRef}
        drawBlockRef={drawBlockRef}
        engineRef={engineRef}
        // хуки рисования
        canUndo={canUndo}
        canRedo={canRedo}
        canvasSize={canvasSize}
        handleResizeMouseDown={handleResizeMouseDown}
        // плеер
        isPlaying={isPlaying}
        currentTime={currentTime}
        volume={volume}
        setVolume={setVolume}
        // хэндлеры
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        handleClear={handleClear}
        handleBgColorChange={handleBgColorChange}
        handleBrushColorChange={handleBrushColorChange}
        handleImportPhoto={handleImportPhoto}
        handleCanvasReady={handleCanvasReady}
        handleToggleFavorite={handleToggleFavorite}
        handleSave={handleSave}
        handleDownload={handleDownload}
        handleDeleteProject={handleDeleteProject}
        handleGenerateMelody={handleGenerateMelody}
        handlePlayPause={handlePlayPause}
        handleSaveAsConfirm={handleSaveAsConfirm}
        setCurrentTitle={setCurrentTitle}
        skip={skip}
        seek={seek}
        openModal={openModal}
        closeModal={closeModal}
      />
    </HintProvider>
  );
};

export default Canvas;
