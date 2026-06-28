import React, {
  forwardRef,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import ImportPhotoIcon from "../../../assets/icons/icon-import-photo.svg";
import BrushIcon from "../../../assets/icons/icon-brush.svg";
import BrushSelectedIcon from "../../../assets/icons/icon-brush-selected.svg";
import EraserIcon from "../../../assets/icons/icon-eraser.svg";
import EraserSelectedIcon from "../../../assets/icons/icon-eraser-selected.svg";
import UndoIcon from "../../../assets/icons/icon-undo.svg";
import UndoBlockedIcon from "../../../assets/icons/icon-undo-blocked.svg";
import RedoIcon from "../../../assets/icons/icon-redo.svg";
import RedoBlockedIcon from "../../../assets/icons/icon-redo-blocked.svg";
import ClearCanvasIcon from "../../../assets/icons/icon-clear-canvas.svg";
import IconCanvasBg from "../../../components/ui/CustomIcons/IconCanvasBg";
import IconBrushColor from "../../../components/ui/CustomIcons/IconBrushColor";
import CloseIcon from "../../../assets/icons/icon-close.svg";
import { useHint, useHintPush, useHintFactory } from "../hooks/useHint";

export const INSTRUMENT_COLORS = [
  { color: "#00ffd1", instrument: "piano", label: "Пианино", icon: "🎹" },
  { color: "#B87333", instrument: "guitar", label: "Гитара", icon: "🎸" },
  { color: "#EB58DA", instrument: "flute", label: "Флейта", icon: "🪈" },
  { color: "#9900ff", instrument: "strings", label: "Скрипка", icon: "🎻" },
  { color: "#ff6b35", instrument: "clarinet", label: "Кларнет", icon: "🎷" },
  { color: "#00b4d8", instrument: "saxophone", label: "Саксофон", icon: "🎷" },
  {
    color: "#f72585",
    instrument: "guitar-electric",
    label: "Электрогитара",
    icon: "🎸",
  },
  { color: "#0000FF", instrument: "cello", label: "Виолончель", icon: "🎻" },
  { color: "#ffd60a", instrument: "xylophone", label: "Ксилофон", icon: "🎶" },
  { color: "#C9A0DC", instrument: "harp", label: "Арфа", icon: "🎵" },
];

// [HINT] подсказки для каждого инструмента
const INSTRUMENT_HINTS = {
  piano: "Чистое и прозрачное пианино",
  guitar: "Тёплая и живая гитара",
  flute: "Лёгкая и воздушная флейта",
  strings: "Глубокая и волнующая скрипка",
  clarinet: "Мягкий и певучий кларнет",
  saxophone: "Дерзкий и джазовый саксофон",
  "guitar-electric": "Острая и дерзкая электрогитара",
  cello: "Бархатная и задумчивая виолончель",
  xylophone: "Звонкий и игривый ксилофон",
  harp: "Нежная и сказочная арфа",
};

// ─── Попап выбора инструмента/цвета ──────────────────────────────────────────
const InstrumentPicker = ({ currentColor, onChange, onClose, anchorRef }) => {
  const pickerRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);
  const getHint = useHintFactory();

  useLayoutEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 12,
        left: rect.left + 5,
      });
      setReady(true);
    }
  }, [anchorRef]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={pickerRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 1000,
        opacity: ready ? 1 : 0,
        transition: "opacity 0.15s ease",
        padding: "3px",
        borderRadius: "40px",
        // background: "linear-gradient(135deg, var(--color-cyan, #00ffd1), var(--color-violet, #9900ff), var(--color-pink, #B87333))",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        width: "fit-content",
        maxWidth: "min(94vw, 560px)",
      }}
    >
      <div
        style={{
          position: "relative",
          background: "#ffffff",
          borderRadius: "37px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: "70vh",
          overflowY: "auto",
          overflowX: "hidden",
          fontFamily: "var(--font-montserrat)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-montserrat)",
              fontSize: 24,
              color: "var(--color-bright)",
              textTransform: "uppercase",
              fontWeight: "var(--font-weight-semibold)",
              paddingLeft: 4,
            }}
          >
            Инструмент
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть"
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              transition: "background 0.15s, transform 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f0f0f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <img src={CloseIcon} alt="" style={{ width: 22, height: 22 }} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "max-content max-content",
            gap: "10px 16px",
          }}
        >
          {INSTRUMENT_COLORS.map(({ color, label, instrument }) => {
            const isActive = color === currentColor;
            const hint = getHint(INSTRUMENT_HINTS[instrument] ?? label);
            return (
              <button
                key={color}
                onClick={() => {
                  onChange(color);
                  onClose();
                }}
                {...hint}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: "30px",
                  border: isActive
                    ? `2px solid ${color}`
                    : "2px solid transparent",
                  background: isActive ? `${color}18` : "#f5f5f7",
                  color: isActive ? "var(--color-bright)" : "var(--color-pale)",
                  fontFamily: "var(--font-montserrat)",
                  fontSize: 20,
                  fontWeight: isActive ? "var(--font-weight-semibold)" : 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isActive ? `0 0 0 1px ${color}40` : "none",
                  textAlign: "left",
                  width: "100%",
                  lineHeight: 1.3,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#eaeaea";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#f5f5f7";
                  }
                }}
              >
                <IconBrushColor
                  color={color}
                  size={28}
                  style={{
                    flexShrink: 0,
                    filter: isActive
                      ? `drop-shadow(0 0 6px ${color}80)`
                      : "none",
                    transition: "filter 0.2s",
                  }}
                />
                <span style={{ flex: 1, letterSpacing: "0.01em" }}>
                  {label}
                </span>
                {isActive && (
                  <span
                    style={{
                      fontSize: 13,
                      opacity: 0.85,
                      color,
                      marginLeft: 2,
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Главный компонент ─────────────────────────────────────────────────────────
const ToolsPanel = forwardRef(
  (
    {
      engine,
      onUndo,
      onRedo,
      canUndo,
      canRedo,
      onClear,
      isBrushSelected,
      setIsBrushSelected,
      currentBgColor,
      onBackgroundColorChange,
      currentBrushColor,
      onBrushColorChange,
      onImportPhoto,
      isImporting,
    },
    ref,
  ) => {
    const [showInstrumentPicker, setShowInstrumentPicker] = useState(false);
    const [showBgPicker, setShowBgPicker] = useState(false);

    const instrPickerAnchorRef = useRef(null);
    const bgPickerRef = useRef(null);
    const bgIconRef = useRef(null);
    const fileInputRef = useRef(null);

    // [HINT] хинты для статичных кнопок
    const hintImport = useHint("Загрузите фото");
    const hintInstrument = useHint("Выберите инструмент");
    const hintUndo = useHint(
      canUndo ? "Отменить последнее действие " : "Нечего отменять ",
    );
    const hintRedo = useHint(
      canRedo ? "Вернуть отменённое действие " : "Нечего возвращать ",
    );
    const hintClear = useHint("Очистить холст — музыка тоже сотрётся ");
    const hintBg = useHint("Задайте атмосферу фона");

    const hintBrush = useHintPush(() =>
      isBrushSelected ? "Кисть активна" : "Переключиться на кисть ",
    );
    const hintEraser = useHintPush(() =>
      !isBrushSelected
        ? "Ластик активен — сотрите лишнее "
        : "Ластик — музыка станет чище ",
    );

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (
          bgPickerRef.current &&
          !bgPickerRef.current.contains(e.target) &&
          bgIconRef.current &&
          !bgIconRef.current.contains(e.target)
        ) {
          setShowBgPicker(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleBgIconClick = () => {
      setShowBgPicker((prev) => !prev);
      setShowInstrumentPicker(false);
    };

    const handleInstrColorClick = () => {
      setShowInstrumentPicker((prev) => !prev);
      setShowBgPicker(false);
    };

    const handleInstrumentChange = (color) => {
      onBrushColorChange(color);
      if (engine) {
        engine.currentColor = color;
        engine.setEraserMode?.(false);
      }
      setIsBrushSelected(true);
    };

    const selectBrush = () => {
      setIsBrushSelected(true);
      engine?.setEraserMode?.(false);
      // push с уже известным следующим текстом (после клика кисть будет активна)
      hintBrush.push("Кисть активна");
    };

    const selectEraser = () => {
      setIsBrushSelected(false);
      engine?.setEraserMode?.(true);
      // push с уже известным следующим текстом (после клика ластик будет активен)
      hintEraser.push("Ластик активен — сотрите лишнее ");
    };

    const handleImportClick = () => {
      if (isImporting) return;
      fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      if (onImportPhoto) onImportPhoto(file);
    };

    const currentInstrData =
      INSTRUMENT_COLORS.find((i) => i.color === currentBrushColor) ||
      INSTRUMENT_COLORS[0];

    const bgPickerPos = (() => {
      if (!bgIconRef.current) return { top: 0, left: 0 };
      const rect = bgIconRef.current.getBoundingClientRect();
      return { top: rect.bottom + 10, left: rect.left - 100 };
    })();

    return (
      <div className="tools-panel" ref={ref}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {/* Импорт фото */}
        <div
          className={`icon import-photo-btn${isImporting ? " importing" : ""}`}
          onClick={handleImportClick}
          title="Импортировать фото и извлечь контуры"
          style={{
            opacity: isImporting ? 0.5 : 1,
            cursor: isImporting ? "wait" : "pointer",
          }}
          {...hintImport}
        >
          {isImporting ? (
            <ImportingSpinner />
          ) : (
            <img src={ImportPhotoIcon} alt="Импортировать фото" />
          )}
        </div>

        {/* Выбор инструмента/цвета */}
        <div
          ref={instrPickerAnchorRef}
          className="icon brush-color-btn"
          onClick={handleInstrColorClick}
          title={`Инструмент: ${currentInstrData.label}`}
          {...hintInstrument}
          style={{
            position: "relative",
            outline: showInstrumentPicker
              ? `2px solid ${currentInstrData.color}`
              : "2px solid transparent",
            borderRadius: "50%",
            transition: "outline 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconBrushColor
            color={currentBrushColor}
            size={52}
            style={{
              filter: `drop-shadow(0 0 6px ${currentBrushColor}80)`,
              transition: "filter 0.2s",
            }}
          />
        </div>

        {showInstrumentPicker && (
          <InstrumentPicker
            currentColor={currentBrushColor}
            onChange={handleInstrumentChange}
            onClose={() => setShowInstrumentPicker(false)}
            anchorRef={instrPickerAnchorRef}
          />
        )}

        {/* Кисть */}
        <div
          className="icon"
          onClick={selectBrush}
          title="Кисть"
          onMouseEnter={hintBrush.onMouseEnter}
          onMouseLeave={hintBrush.onMouseLeave}
        >
          <img
            src={isBrushSelected ? BrushSelectedIcon : BrushIcon}
            alt="Кисть"
          />
        </div>

        {/* Ластик */}
        <div
          className="icon"
          onClick={selectEraser}
          title="Ластик"
          onMouseEnter={hintEraser.onMouseEnter}
          onMouseLeave={hintEraser.onMouseLeave}
        >
          <img
            src={!isBrushSelected ? EraserSelectedIcon : EraserIcon}
            alt="Ластик"
          />
        </div>

        {/* Undo */}
        <div className="icon" onClick={onUndo} title="Отменить" {...hintUndo}>
          {" "}
          <img src={canUndo ? UndoIcon : UndoBlockedIcon} alt="Отменить" />
        </div>

        {/* Redo */}
        <div className="icon" onClick={onRedo} title="Вернуть" {...hintRedo}>
          {" "}
          <img src={canRedo ? RedoIcon : RedoBlockedIcon} alt="Вернуть" />
        </div>

        {/* Очистить */}
        <div
          className="icon"
          onClick={onClear}
          title="Очистить холст"
          {...hintClear}
        >
          {" "}
          <img src={ClearCanvasIcon} alt="Очистить" />
        </div>

        {/* Цвет фона */}
        <div
          className="icon"
          ref={bgIconRef}
          onClick={handleBgIconClick}
          title="Цвет фона"
          {...hintBg}
        >
          {" "}
          <IconCanvasBg color={currentBgColor} />
        </div>

        {showBgPicker && (
          <div
            ref={bgPickerRef}
            className="color-picker-popup"
            style={{
              position: "fixed",
              top: bgPickerPos.top,
              left: 2 * bgPickerPos.left,
              zIndex: 1000,
            }}
          >
            <input
              type="color"
              value={currentBgColor}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
              style={{
                width: "160px",
                height: "160px",
                padding: "4px",
                border: "none",
                borderRadius: "14px",
                cursor: "pointer",
                boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
                background: "#1a1a2e",
              }}
            />
          </div>
        )}
      </div>
    );
  },
);

const ImportingSpinner = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="40 20"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 12 12"
        to="360 12 12"
        dur="0.8s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

export default ToolsPanel;
