// ToolsPanel.jsx — с подключёнными подсказками
// Изменения помечены комментарием // [HINT]

import React, { forwardRef, useState, useRef, useEffect } from "react";
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

// [HINT] импортируем хуки
import { useHint, useHintPush, useHintFactory } from "../hooks/useHint"; // поправь путь

export const INSTRUMENT_COLORS = [
  { color: "#00ffd1", instrument: "piano",          label: "Пианино",       icon: "🎹" },
  { color: "#ff3366", instrument: "guitar",         label: "Гитара",        icon: "🎸" },
  { color: "#ffcc00", instrument: "flute",          label: "Флейта",        icon: "🪈" },
  { color: "#9900ff", instrument: "strings",        label: "Скрипка",       icon: "🎻" },
  { color: "#ff6b35", instrument: "clarinet",       label: "Кларнет",       icon: "🎷" },
  { color: "#00b4d8", instrument: "saxophone",      label: "Саксофон",      icon: "🎷" },
  { color: "#f72585", instrument: "guitar-electric",label: "Электрогитара", icon: "🎸" },
  { color: "#7bed9f", instrument: "cello",          label: "Виолончель",    icon: "🎻" },
  { color: "#ffd60a", instrument: "xylophone",      label: "Ксилофон",      icon: "🎶" },
  { color: "#a855f7", instrument: "harp",           label: "Арфа",          icon: "🎵" },
];

// [HINT] подсказки для каждого инструмента
const INSTRUMENT_HINTS = {
  piano:          "Чистый и прозрачный — пианино звучит как рассвет ✦",
  guitar:         "Тёплый и живой — гитара дышит вместе с вами ✦",
  flute:          "Лёгкая и воздушная — флейта парит над мелодией ✦",
  strings:        "Глубокий и волнующий — скрипка говорит там, где слов не хватает ✦",
  clarinet:       "Мягкий и певучий — кларнет обволакивает теплом ✦",
  saxophone:      "Дерзкий и джазовый — саксофон знает все ваши секреты ✦",
  "guitar-electric": "Острый и дерзкий — электрогитара не знает покоя ✦",
  cello:          "Бархатный и задумчивый — виолончель говорит из глубины ✦",
  xylophone:      "Звонкий и игривый — ксилофон превращает всё в праздник ✦",
  harp:           "Нежная и сказочная — арфа звучит как сон ✦",
};

// ─── Попап выбора инструмента/цвета ──────────────────────────────────────────
const InstrumentPicker = ({ currentColor, onChange, onClose, anchorRef }) => {
  const pickerRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  // [HINT] фабрика хинтов для использования в обычном map (не в хуке напрямую)
  const getHint = useHintFactory();

  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 10, left: rect.left - 10 });
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
        background: "rgba(18, 18, 30, 0.97)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: "14px 12px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 190,
        maxHeight: "80vh",
        overflowY: "auto",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 4,
          paddingLeft: 6,
        }}
      >
        Инструмент
      </span>
      {INSTRUMENT_COLORS.map(({ color, label, icon, instrument }) => {
        const isActive = color === currentColor;
        // [HINT] каждая кнопка инструмента имеет свою подсказку
        const hint = getHint(INSTRUMENT_HINTS[instrument] ?? `${label} ✦`);
        return (
          <button
            key={color}
            onClick={() => { onChange(color); onClose(); }}
            {...hint} // [HINT]
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 10px",
              borderRadius: 10,
              border: "1.5px solid",
              borderColor: isActive ? color : "transparent",
              background: isActive ? `${color}18` : "rgba(255,255,255,0.04)",
              color: isActive ? color : "rgba(255,255,255,0.7)",
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s",
              width: "100%",
              textAlign: "left",
            }}
          >
            <IconBrushColor
              color={color}
              size={22}
              style={{
                flexShrink: 0,
                filter: isActive ? `drop-shadow(0 0 4px ${color}80)` : "none",
              }}
            />
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span style={{ letterSpacing: "0.03em" }}>{label}</span>
            {isActive && (
              <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.7 }}>✓</span>
            )}
          </button>
        );
      })}
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
    const hintImport     = useHint("Загрузите фото — мы извлечём контуры и превратим их в мелодию ✦");
    const hintInstrument = useHint("Выберите инструмент — у каждого свой голос ✦");
    const hintUndo       = useHint(canUndo ? "Отменить последнее действие ✦" : "Нечего отменять ✦");
    // [HINT] ИСПРАВЛЕНО: «повторить» → «вернуть отменённое действие»
    const hintRedo       = useHint(canRedo ? "Вернуть отменённое действие ✦" : "Нечего возвращать ✦");
    const hintClear      = useHint("Начать с чистого листа — музыка тоже сотрётся ✦");
    // [HINT] ИСПРАВЛЕНО: фон не влияет на мелодию — убираем это из подсказки
    const hintBg         = useHint("Задайте атмосферу — выберите цвет фона холста ✦");

    // useHintPush: push вызывается с уже вычисленным следующим текстом — нет проблемы async setState
    const hintBrush = useHintPush(
      () => isBrushSelected
        ? "Кисть активна — каждая линия влияет на мелодию ✦"
        : "Переключиться на кисть ✦"
    );
    const hintEraser = useHintPush(
      () => !isBrushSelected
        ? "Ластик активен — сотрите лишнее ✦"
        : "Ластик — сотрите лишнее, музыка станет чище ✦"
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
      return () => document.removeEventListener("mousedown", handleClickOutside);
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
      hintBrush.push("Кисть активна — каждая линия влияет на мелодию ✦");
    };

    const selectEraser = () => {
      setIsBrushSelected(false);
      engine?.setEraserMode?.(true);
      // push с уже известным следующим текстом (после клика ластик будет активен)
      hintEraser.push("Ластик активен — сотрите лишнее ✦");
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
          style={{ opacity: isImporting ? 0.5 : 1, cursor: isImporting ? "wait" : "pointer" }}
          {...hintImport} // [HINT]
        >
          {isImporting ? <ImportingSpinner /> : <img src={ImportPhotoIcon} alt="Импортировать фото" />}
        </div>

        {/* Выбор инструмента/цвета */}
        <div
          ref={instrPickerAnchorRef}
          className="icon brush-color-btn"
          onClick={handleInstrColorClick}
          title={`Инструмент: ${currentInstrData.label}`}
          {...hintInstrument} // [HINT]
          style={{
            position: "relative",
            outline: showInstrumentPicker ? `2px solid ${currentInstrData.color}` : "2px solid transparent",
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
            style={{ filter: `drop-shadow(0 0 6px ${currentBrushColor}80)`, transition: "filter 0.2s" }}
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
        {/* [HINT] onMouseEnter/onMouseLeave из useHintToggle, клик вызывает onAfterClick */}
        <div
          className="icon"
          onClick={selectBrush}
          title="Кисть"
          onMouseEnter={hintBrush.onMouseEnter}
          onMouseLeave={hintBrush.onMouseLeave}
        >
          <img src={isBrushSelected ? BrushSelectedIcon : BrushIcon} alt="Кисть" />
        </div>

        {/* Ластик */}
        <div
          className="icon"
          onClick={selectEraser}
          title="Ластик"
          onMouseEnter={hintEraser.onMouseEnter}
          onMouseLeave={hintEraser.onMouseLeave}
        >
          <img src={!isBrushSelected ? EraserSelectedIcon : EraserIcon} alt="Ластик" />
        </div>

        {/* Undo */}
        <div className="icon" onClick={onUndo} title="Отменить" {...hintUndo}> {/* [HINT] */}
          <img src={canUndo ? UndoIcon : UndoBlockedIcon} alt="Отменить" />
        </div>

        {/* Redo — ИСПРАВЛЕНО: alt и title тоже поправлены */}
        <div className="icon" onClick={onRedo} title="Вернуть" {...hintRedo}> {/* [HINT] */}
          <img src={canRedo ? RedoIcon : RedoBlockedIcon} alt="Вернуть" />
        </div>

        {/* Очистить */}
        <div className="icon" onClick={onClear} title="Очистить холст" {...hintClear}> {/* [HINT] */}
          <img src={ClearCanvasIcon} alt="Очистить" />
        </div>

        {/* Цвет фона */}
        <div className="icon" ref={bgIconRef} onClick={handleBgIconClick} title="Цвет фона" {...hintBg}> {/* [HINT] */}
          <IconCanvasBg color={currentBgColor} />
        </div>

        {showBgPicker && (
          <div
            ref={bgPickerRef}
            className="color-picker-popup"
            style={{ position: "fixed", top: bgPickerPos.top, left: 2 * bgPickerPos.left, zIndex: 1000 }}
          >
            <input
              type="color"
              value={currentBgColor}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
              style={{
                width: "160px", height: "160px", padding: "4px",
                border: "none", borderRadius: "14px", cursor: "pointer",
                boxShadow: "0 10px 40px rgba(0,0,0,0.6)", background: "#1a1a2e",
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
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="40 20">
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
    </circle>
  </svg>
);

export default ToolsPanel;