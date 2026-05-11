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
    onBackgroundColorChange
}, ref) => {
    const [showPicker, setShowPicker] = useState(false);
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
    const pickerRef = useRef(null);
    const iconRef = useRef(null);

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
            left: rect.left - 100   // центрируем красиво
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

    return (
        <div className="tools-panel" ref={ref}>
            <div className="icon import-photo-btn">
                <img src={ImportPhotoIcon} alt="Импортировать фото" />
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
            left: 2*pickerPos.left,
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