import React from "react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import BgHomeLine from "../../assets/backgrounds/bg-home-line1.png";
import BgHomeLine2 from "../../assets/backgrounds/bg-home-line2.png";
import MainLine from "../../assets/home/main-karakulya.png";
import Arrow1 from "../../assets/home/arrow1.svg";
import Arrow2 from "../../assets/home/arrow2.svg";
import PhotoBefore from "../../assets/home/photo-before.png";
import PhotoAfter from "../../assets/home/photo-after.png";
import Step1 from "../../assets/home/step1.svg";
import Step2 from "../../assets/home/step2.svg";
import Step3 from "../../assets/home/step3.svg";
import StepsSection from "./StepsSection";
import Button from "../../components/ui/Button/Button";

import "./Home.css";

const Home = () => {
  const navigate = useNavigate();

  const importInputRef = useRef(null);

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    // Кладём файл в sessionStorage как base64, затем переходим
    const reader = new FileReader();
    reader.onload = () => {
      sessionStorage.setItem(
        "pendingImportFile",
        JSON.stringify({
          name: file.name,
          type: file.type,
          data: reader.result, // base64 data URL
        }),
      );
      navigate("/canvas", { state: { autoImport: true } });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="home-content">
      <input
        ref={importInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      <div className="main-poster">
        <div className="home-bg-line">
          <img src={BgHomeLine} alt="фоновая линия" />
        </div>
        <img src={MainLine} className="main-line" alt="MainLine" />
        <div className="main-slogan">
          <h1>НАРИСУЙ СВОЙ ЗВУК</h1>
          <p>преврати рисунок в мелодию</p>
        </div>
        {/* <button>НАЧАТЬ РИСОВАТЬ</button> */}
        <Button variant="accent" onClick={() => navigate("/canvas")}>
          НАЧАТЬ РИСОВАТЬ
        </Button>
      </div>

      <div className="photo-convert-block">
        <div className="home-bg-line2">
          <img src={BgHomeLine2} alt="фоновая линия 2" />
        </div>
        <div className="photo-slogan">
          <h1>ЗАГРУЗИ ФОТО</h1>
          <div className="photo-slogan-description">
            <div className="cyan-line"></div>
            <p>
              Мы автоматически извлечем контуры из изображения.
              <br />
              Система подберёт наиболее близкие оттенки из палитры инструментов.
            </p>
          </div>
        </div>
        <div className="photo-before-after">
          <div className="box">
            <img src={PhotoBefore} className="photo-block" alt="Photo Before" />
          </div>
          <img src={Arrow1} className="arrow1" alt="Arrow1" />
          <div className="box">
            <img src={PhotoAfter} className="photo-block" alt="Photo After" />
          </div>
        </div>
        <Button variant="accent" onClick={handleImportClick}>
          ИМПОРТИРОВАТЬ ИЗОБРАЖЕНИЕ
        </Button>
      </div>

      <StepsSection />

      <div className="last-slogan-block">
        <h1>ГОТОВ ПРЕВРАТИТЬ ХОЛСТ В МУЗЫКУ?</h1>
        <Button variant="accent" onClick={() => navigate("/canvas")}>
          НАЧАТЬ ТВОРИТЬ
        </Button>
      </div>
    </div>
  );
};

export default Home;
