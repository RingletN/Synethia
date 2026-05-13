// ToolsPanel.jsx
import React, { forwardRef, useState, useRef, useEffect } from 'react';
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
import IconCanvasBg from '../../../components/ui/IconCanvasBg';

// ─── Маппинг: цвет → инструмент (должен совпадать с MelodyEngine и useMelodyPlayer) ──
export const INSTRUMENT_COLORS = [
    { color: '#00ffd1', instrument: 'sine',     label: 'Пианино',  icon: '🎹' },
    { color: '#ff3366', instrument: 'square',   label: 'Гитара',   icon: '🎸' },
    { color: '#ffcc00', instrument: 'sawtooth', label: 'Флейта',   icon: '🪈' },
    { color: '#9900ff', instrument: 'triangle', label: 'Скрипка',  icon: '🎻' },
];

// ─── Кружок инструмента (показывает текущий цвет кисти) ──────────────────────
const InstrumentDot = ({ color, size = 52 }) => (
    <svg width={size} height={size} viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="14" fill={color} opacity="0.92" />
        <circle cx="26" cy="26" r="14" fill="none" stroke={color} strokeWidth="2" opacity="0.5" />
        <circle cx="26" cy="26" r="20" fill="none" stroke={color} strokeWidth="1.5" opacity="0.2" />
    </svg>
);

// ─── Попап выбора инструмента/цвета ──────────────────────────────────────────
const InstrumentPicker = ({ currentColor, onChange, onClose, anchorRef }) => {
    const pickerRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (anchorRef?.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 10, left: rect.left - 10 });
        }
    }, [anchorRef]);

    useEffect(() => {
        const handleOutside = (e) => {
            if (
                pickerRef.current && !pickerRef.current.contains(e.target) &&
                anchorRef?.current && !anchorRef.current.contains(e.target)
            ) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [onClose, anchorRef]);

    return (
        <div
            ref={pickerRef}
            style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                zIndex: 1000,
                background: 'rgba(18, 18, 30, 0.97)',
                backdropFilter: 'blur(18px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: '14px 12px',
                boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minWidth: 160,
            }}
        >
            <span style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 4,
                paddingLeft: 6,
            }}>
                Инструмент
            </span>
            {INSTRUMENT_COLORS.map(({ color, label, icon }) => {
                const isActive = color === currentColor;
                return (
                    <button
                        key={color}
                        onClick={() => { onChange(color); onClose(); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1.5px solid',
                            borderColor: isActive ? color : 'transparent',
                            background: isActive ? `${color}18` : 'rgba(255,255,255,0.04)',
                            color: isActive ? color : 'rgba(255,255,255,0.7)',
                            fontSize: 13,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            width: '100%',
                            textAlign: 'left',
                        }}
                    >
                        <span style={{
                            width: 14, height: 14, borderRadius: '50%',
                            background: color,
                            display: 'inline-block',
                            flexShrink: 0,
                            boxShadow: isActive ? `0 0 8px ${color}80` : 'none',
                        }} />
                        <span style={{ fontSize: 15 }}>{icon}</span>
                        <span style={{ letterSpacing: '0.03em' }}>{label}</span>
                        {isActive && (
                            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>✓</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

// ─── Главный компонент ─────────────────────────────────────────────────────────
const ToolsPanel = forwardRef(({
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
}, ref) => {
    const [showInstrumentPicker, setShowInstrumentPicker] = useState(false);
    const [showBgPicker,         setShowBgPicker]         = useState(false);

    const instrPickerAnchorRef = useRef(null);
    const bgPickerRef          = useRef(null);
    const bgIconRef            = useRef(null);
    const fileInputRef         = useRef(null);

    // ── Закрытие пикера фона при клике снаружи ────────────────────────────────
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                bgPickerRef.current && !bgPickerRef.current.contains(e.target) &&
                bgIconRef.current   && !bgIconRef.current.contains(e.target)
            ) {
                setShowBgPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleBgIconClick = () => {
        setShowBgPicker(prev => !prev);
        setShowInstrumentPicker(false);
    };

    const handleInstrColorClick = () => {
        setShowInstrumentPicker(prev => !prev);
        setShowBgPicker(false);
    };

    const handleInstrumentChange = (color) => {
        onBrushColorChange(color);
        // Синхронизируем режим кисти с движком
        if (engine) {
            engine.currentColor = color;
            engine.setEraserMode?.(false);
        }
        setIsBrushSelected(true);
    };

    const selectBrush = () => {
        setIsBrushSelected(true);
        engine?.setEraserMode?.(false);
    };

    const selectEraser = () => {
        setIsBrushSelected(false);
        engine?.setEraserMode?.(true);
    };

    const handleImportClick = () => {
        if (isImporting) return;
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (onImportPhoto) onImportPhoto(file);
    };

    // Подсветка текущего инструмента
    const currentInstrData = INSTRUMENT_COLORS.find(i => i.color === currentBrushColor)
        || INSTRUMENT_COLORS[0];

    // Позиция попапа цвета фона
    const bgPickerPos = (() => {
        if (!bgIconRef.current) return { top: 0, left: 0 };
        const rect = bgIconRef.current.getBoundingClientRect();
        return { top: rect.bottom + 10, left: rect.left - 100 };
    })();

    return (
        <div className="tools-panel" ref={ref}>
            {/* Скрытый input для выбора файла */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            {/* Импорт фото */}
            <div
                className={`icon import-photo-btn${isImporting ? ' importing' : ''}`}
                onClick={handleImportClick}
                title="Импортировать фото и извлечь контуры"
                style={{ opacity: isImporting ? 0.5 : 1, cursor: isImporting ? 'wait' : 'pointer' }}
            >
                {isImporting
                    ? <ImportingSpinner />
                    : <img src={ImportPhotoIcon} alt="Импортировать фото" />
                }
            </div>

            {/* Выбор инструмента/цвета кисти */}
            <div
                ref={instrPickerAnchorRef}
                className="icon brush-color-btn"
                onClick={handleInstrColorClick}
                title={`Инструмент: ${currentInstrData.label}`}
                style={{
                    position: 'relative',
                    outline: showInstrumentPicker
                        ? `2px solid ${currentInstrData.color}`
                        : '2px solid transparent',
                    borderRadius: '50%',
                    transition: 'outline 0.15s',
                }}
            >
                <InstrumentDot color={currentBrushColor} size={52} />
            </div>

            {/* Попап выбора инструмента */}
            {showInstrumentPicker && (
                <InstrumentPicker
                    currentColor={currentBrushColor}
                    onChange={handleInstrumentChange}
                    onClose={() => setShowInstrumentPicker(false)}
                    anchorRef={instrPickerAnchorRef}
                />
            )}

            {/* Кисть */}
            <div className="icon" onClick={selectBrush} title="Кисть">
                <img src={isBrushSelected ? BrushSelectedIcon : BrushIcon} alt="Кисть" />
            </div>

            {/* Ластик */}
            <div className="icon" onClick={selectEraser} title="Ластик">
                <img src={!isBrushSelected ? EraserSelectedIcon : EraserIcon} alt="Ластик" />
            </div>

            {/* Undo */}
            <div className="icon" onClick={onUndo} title="Отменить">
                <img src={canUndo ? UndoIcon : UndoBlockedIcon} alt="Назад" />
            </div>

            {/* Redo */}
            <div className="icon" onClick={onRedo} title="Повторить">
                <img src={canRedo ? RedoIcon : RedoBlockedIcon} alt="Вперёд" />
            </div>

            {/* Очистить */}
            <div className="icon" onClick={onClear} title="Очистить холст">
                <img src={ClearCanvasIcon} alt="Очистить" />
            </div>

            {/* Цвет фона */}
            <div className="icon" ref={bgIconRef} onClick={handleBgIconClick} title="Цвет фона">
                <IconCanvasBg color={currentBgColor} />
            </div>

            {showBgPicker && (
                <div
                    ref={bgPickerRef}
                    className="color-picker-popup"
                    style={{
                        position: 'fixed',
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
                            width: '160px',
                            height: '160px',
                            padding: '4px',
                            border: 'none',
                            borderRadius: '14px',
                            cursor: 'pointer',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                            background: '#1a1a2e',
                        }}
                    />
                </div>
            )}
        </div>
    );
});

// Маленький SVG-спиннер
const ImportingSpinner = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="40 20">
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