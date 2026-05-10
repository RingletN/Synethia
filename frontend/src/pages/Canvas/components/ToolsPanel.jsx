import React, { forwardRef } from 'react';
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

const ToolsPanel = forwardRef(({
    engine,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onClear,
    isBrushSelected,
    setIsBrushSelected
}, ref) => {

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
        </div>
    );
});

export default ToolsPanel;