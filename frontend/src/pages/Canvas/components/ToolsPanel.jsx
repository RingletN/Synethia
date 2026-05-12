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
    onImportPhoto,       // новый проп: (file: File) => void
    isImporting,         // новый проп: boolean — показываем спиннер/блокируем кнопку
}, ref) => {
    const [showPicker, setShowPicker] = useState(false);
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
    const pickerRef = useRef(null);
    const iconRef = useRef(null);
    const fileInputRef = useRef(null);  // реф на скрытый input[file]

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                pickerRef.current && !pickerRef.current.contains(e.target) &&
                iconRef.current && !iconRef.current.contains(e.target)
            ) {
                setShowPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleIconClick = () => {
        const rect = iconRef.current.getBoundingClientRect();
        setPickerPos({
            top: rect.bottom + 10,
            left: rect.left - 100
        });
        setShowPicker(prev => !prev);
    };

    const selectBrush = () => {
        setIsBrushSelected(true);
        engine?.setInstrument('sine');
        engine?.setEraserMode(false);
    };

    const selectEraser = () => {
        setIsBrushSelected(false);
        engine?.setEraserMode(true);
    };

    // Открываем диалог выбора файла
    const handleImportClick = () => {
        if (isImporting) return;
        fileInputRef.current?.click();
    };

    // Когда пользователь выбрал файл — пробрасываем наверх
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Сбрасываем input, чтобы можно было повторно загрузить тот же файл
        e.target.value = '';
        if (onImportPhoto) onImportPhoto(file);
    };

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

            <div className="icon" onClick={selectBrush}>
                <img src={isBrushSelected ? BrushSelectedIcon : BrushIcon} alt="Кисть" />
            </div>

            <div className="icon" onClick={selectEraser}>
                <img src={!isBrushSelected ? EraserSelectedIcon : EraserIcon} alt="Ластик" />
            </div>

            <div className="icon" onClick={onUndo}>
                <img src={canUndo ? UndoIcon : UndoBlockedIcon} alt="Назад" />
            </div>

            <div className="icon" onClick={onRedo}>
                <img src={canRedo ? RedoIcon : RedoBlockedIcon} alt="Вперёд" />
            </div>

            <div className="icon" onClick={onClear}>
                <img src={ClearCanvasIcon} alt="Очистить" />
            </div>

            <div className="icon" ref={iconRef} onClick={handleIconClick}>
                <IconCanvasBg color={currentBgColor} />
            </div>

            {showPicker && (
                <div
                    ref={pickerRef}
                    className="color-picker-popup"
                    style={{
                        position: 'fixed',
                        top: pickerPos.top,
                        left: 2 * pickerPos.left,
                        zIndex: 1000,
                    }}
                >
                    <ColorPicker
                        color={currentBgColor}
                        onChange={onBackgroundColorChange}
                    />
                </div>
            )}
        </div>
    );
});

// Маленький SVG-спиннер пока идёт обработка
const ImportingSpinner = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

const ColorPicker = ({ color, onChange }) => {
    return (
        <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
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
    );
};

export default ToolsPanel;