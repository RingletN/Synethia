// StepsSection.jsx
import React from "react";
import Step1 from "../../assets/home/step1.svg";
import Step2 from "../../assets/home/step2.svg";
import Step3 from "../../assets/home/step3.svg";
import Arrow2 from "../../assets/home/arrow2.svg";
import "./StepsSection.css";

const StepsSection = () => {
  return (
    <div className="steps-block">
      <h1>ТРИ ШАГА К МЕЛОДИИ</h1>

      {/* Десктопная версия */}
      <div className="steps-desktop">
        <div className="steps-icons">
          <img src={Step1} className="icon-step" alt="Step1" />
          <img src={Arrow2} className="arrow2" alt="Arrow2" />
          <img src={Step2} className="icon-step" alt="Step2" />
          <img src={Arrow2} className="arrow2" alt="Arrow2" />
          <img src={Step3} className="icon-step" alt="Step3" />
        </div>
        <div className="steps-description">
          <div className="description-block">
            <h1>Нарисуй</h1>
            <p>Создай свой уникальный эскиз прямо на нашем холсте</p>
          </div>
          <div className="description-block">
            <h1>Обработай</h1>
            <p>Настрой будущую мелодию под себя</p>
          </div>
          <div className="description-block">
            <h1>Слушай</h1>
            <p>Твой рисунок зазвучит уникальной композицией</p>
          </div>
        </div>
      </div>

      {/* Мобильная версия */}
      <div className="steps-mobile">
        <div className="step-item">
          <img src={Step1} className="icon-step" alt="Step1" />
          <div className="description-block">
            <h1>Нарисуй</h1>
            <p>Создай свой уникальный эскиз прямо на нашем холсте</p>
          </div>
        </div>
        <img src={Arrow2} className="arrow2" alt="Arrow2" />
        <div className="step-item">
          <img src={Step2} className="icon-step" alt="Step2" />
          <div className="description-block">
            <h1>Обработай</h1>
            <p>Настрой будущую мелодию под себя</p>
          </div>
        </div>
        <img src={Arrow2} className="arrow2" alt="Arrow2" />
        <div className="step-item">
          <img src={Step3} className="icon-step" alt="Step3" />
          <div className="description-block">
            <h1>Слушай</h1>
            <p>Твой рисунок зазвучит уникальной композицией</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepsSection;
