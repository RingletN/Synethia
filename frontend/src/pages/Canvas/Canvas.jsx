import React, { useState } from "react";
// import BgCanvasLine from '../../assets/backgrounds/bg-canvas-line.png';
import SortIcon from "../../assets/icons/icon-sort.svg";
import StarIcon from "../../assets/icons/icon-star.svg";
import StarSelectedIcon from "../../assets/icons/icon-star-selected.svg";
import SaveIcon from "../../assets/icons/icon-save.svg";
import DownloadIcon from "../../assets/icons/icon-download.svg";
import TrashIcon from "../../assets/icons/icon-trash.svg";
import QuestionIcon from "../../assets/icons/icon-question.svg";
import CameraIcon from "../../assets/icons/icon-import-photo.svg";
import BrushIcon from "../../assets/icons/icon-brush.svg";
import BrushSelectedIcon from "../../assets/icons/icon-brush-selected.svg";
import EraserIcon from "../../assets/icons/icon-eraser.svg";
import EraserSelectedIcon from "../../assets/icons/icon-eraser-selected.svg";
import UndoIcon from "../../assets/icons/icon-undo.svg";
import UndoBlockedIcon from "../../assets/icons/icon-undo-blocked.svg";
import RedoIcon from "../../assets/icons/icon-redo.svg";
import RedoBlockedIcon from "../../assets/icons/icon-redo-blocked.svg";
import ClearCanvasIcon from "../../assets/icons/icon-clear-canvas.svg";

import Button from "../../components/ui/Button";
import "./Canvas.css";

const Canvas = () => {
  return (
    <div className="canvas-content">
      {/* <div className="projects-bg-line">
                <img src={BgCanvasLine} alt="фоновая линия" />
            </div> */}

      <div className="canvas-header">
        <div className="canvas-header-text">
          <h2>Введите название проекта...</h2>
          <div className="divider" />
        </div>
        <div className="canvas-header-icons">
          <div className="add-faivorite-btn">
            <img src={StarIcon} alt="Добавить в избранное" />
          </div>
          <div className="remove-faivorite-btn">
            <img src={StarSelectedIcon} alt="Удалить из избранного" />
          </div>
          <div className="save-btn">
            <img src={SaveIcon} alt="Сохранить проект" />
          </div>
          <div className="download-btn">
            <img src={DownloadIcon} alt="Скачать файлы" />
          </div>
          <div className="delete-btn">
            <img src={TrashIcon} alt="Удалить проект" />
          </div>
          <div className="question-btn">
            <img src={QuestionIcon} alt="Обучение" />
          </div>
        </div>
      </div>
      <div className="workspace-area">
        <div className="canvas-block">
          <div className="draw-block">
            <div className="tools-panel">
              <div className="import-photo-btn">
                <img src={CameraIcon} alt="Импортировать фото" />
              </div>
              <div className="choose-brush-btn">
                <img src={BrushIcon} alt="Кисть" />
                <img src={BrushSelectedIcon} alt="Кисть" />
              </div>
              <div className="choose-eraser-btn">
                <img src={EraserIcon} alt="Ластик" />
                <img src={EraserSelectedIcon} alt="Ластик" />
              </div>
              <div className="undo-btn">
                <img src={UndoIcon} alt="Назад" />
                <img src={UndoBlockedIcon} alt="Назад" />
              </div>
              <div className="redo-btn">
                <img src={RedoIcon} alt="Вперед" />
                <img src={RedoBlockedIcon} alt="Вперед" />
              </div>
              <div className="clear-canvas-btn">
                <img src={ClearCanvasIcon} alt="Очистка холста" />
              </div>
            </div>

            <div className="canvas-panel"></div>
            <div className="idk-panel">
              {/* пока не знаю что сюда разместить */}
            </div>
          </div>
          <div className="settings-block"></div>
        </div>

        <div className="music-player"></div>
        <Button variant="primary">СГЕНЕРИРОВАТЬ МЕЛОДИЮ</Button>
      </div>
    </div>
  );
};

export default Canvas;
