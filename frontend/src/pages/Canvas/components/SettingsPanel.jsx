// SettingsPanel.jsx
import React, { useState } from 'react';
import './SettingsPanel.css'; // импорт обычного CSS

import LeftChevron from "../../../assets/icons/icon-chevron-left.svg";
import RightChevron from "../../../assets/icons/icon-chevron-right.svg";
import MajorBlock from "../../../assets/canvas/major-block.png";
import MinorBlock from "../../../assets/canvas/minor-block.png";
import IconSettings from "../../../assets/icons/icon-settings.svg";
import IconNotes from "../../../assets/icons/icon-notes.svg";
import IconEffects from "../../../assets/icons/icon-effects.svg";
import IconTurtle from "../../../assets/icons/icon-turtle.svg";
import IconHare from "../../../assets/icons/icon-hare.svg";

const SettingsPanel = ({
    bpm,
    onBpmChange,
    duration,
    onDurationChange,
    scale,
    onScaleChange,
    effectReverb,
    onReverbChange,
    effectDelay,
    onDelayChange,
    effectDistortion,
    onDistortionChange,
}) => {
    const [expandedGeneral, setExpandedGeneral] = useState(false);
    const [expandedEffects, setExpandedEffects] = useState(false);

    const formatDuration = (sec) => {
        const mins = Math.floor(sec / 60);
        const remainingSec = sec % 60;
        return `${mins.toString().padStart(2, '0')}:${remainingSec.toString().padStart(2, '0')}`;
    };

    const increaseDuration = () => {
        if (duration + 5 <= 90) onDurationChange(duration + 5);
    };
    const decreaseDuration = () => {
        if (duration - 5 >= 5) onDurationChange(duration - 5);
    };

    const nextMood = () => {
        onScaleChange(scale === 'major' ? 'minor' : 'major');
    };
    const prevMood = () => {
        onScaleChange(scale === 'major' ? 'minor' : 'major');
    };
    const setMajor = () => onScaleChange('major');
    const setMinor = () => onScaleChange('minor');

    const decreaseBpm = () => {
        if (bpm - 1 >= 40) onBpmChange(bpm - 1);
    };
    const increaseBpm = () => {
        if (bpm + 1 <= 180) onBpmChange(bpm + 1);
    };

    return (
        <div className="settings-panel">
            <div className="settings-panel-header">
                <img src={IconSettings} alt="settings" className=" icon settings-panel-card-header-icon" />
                <h3 className="settings-panel-header-title">НАСТРОЙКИ</h3>
            </div>

            {/* Блок «Общие» */}
            <div className="settings-panel-card">
                <div className="settings-panel-card-header" onClick={() => setExpandedGeneral(!expandedGeneral)}>
                        <img src={IconNotes} alt="notes" className=" icon settings-panel-card-header-icon" />
                        <h3 className="settings-panel-card-header-text">ОБЩИЕ</h3>
                </div>
                {expandedGeneral && (
                    <div className="settings-panel-card-content">
                        {/* Длительность */}
                        <div className="settings-panel-control-group">
                            <div className="settings-panel-control-label">ДЛИТЕЛЬНОСТЬ</div>
                            <div className="settings-panel-value-row">
                                <img
                                    src={LeftChevron}
                                    alt="-"
                                    className={`settings-panel-chevron ${duration <= 5 ? 'settings-panel-chevron-disabled' : ''}`}
                                    onClick={decreaseDuration}
                                />
                                <span className="settings-panel-duration-text">{formatDuration(duration)}</span>
                                <img
                                    src={RightChevron}
                                    alt="+"
                                    className={`settings-panel-chevron ${duration >= 90 ? 'settings-panel-chevron-disabled' : ''}`}
                                    onClick={increaseDuration}
                                />
                            </div>
                        </div>

                        {/* Настроение */}
                        <div className="settings-panel-control-group">
                            <div className="settings-panel-control-label">НАСТРОЕНИЕ</div>
                            <div className="settings-panel-value-row">
                                <img
                                    src={LeftChevron}
                                    alt="prev"
                                    className="settings-panel-chevron"
                                    onClick={prevMood}
                                />
                                <div className="settings-panel-mood-images">
                                    <img
                                        src={MajorBlock}
                                        alt="major"
                                        className={`settings-panel-mood-img ${scale === 'major' ? 'settings-panel-mood-img-active' : ''}`}
                                        onClick={setMajor}
                                    />
                                    <img
                                        src={MinorBlock}
                                        alt="minor"
                                        className={`settings-panel-mood-img ${scale === 'minor' ? 'settings-panel-mood-img-active' : ''}`}
                                        onClick={setMinor}
                                    />
                                </div>
                                <img
                                    src={RightChevron}
                                    alt="next"
                                    className="settings-panel-chevron"
                                    onClick={nextMood}
                                />
                            </div>
                        </div>

                        {/* Темп */}
                        <div className="settings-panel-control-group">
                            <div className="settings-panel-control-label">ТЕМП</div>
                            <div className="settings-panel-tempo-row">
                                <img
                                    src={IconTurtle}
                                    alt="slow"
                                    className="settings-panel-tempo-icon"
                                    onClick={decreaseBpm}
                                />
                                <span className="settings-panel-tempo-value">{bpm}</span>
                                <img
                                    src={IconHare}
                                    alt="fast"
                                    className="settings-panel-tempo-icon"
                                    onClick={increaseBpm}
                                />
                            </div>
                            <input
                                type="range"
                                min={40}
                                max={180}
                                step={1}
                                value={bpm}
                                onChange={(e) => onBpmChange(Number(e.target.value))}
                                className="settings-panel-slider"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Блок «Эффекты» */}
            <div className="settings-panel-card">
                <div className="settings-panel-card-header" onClick={() => setExpandedEffects(!expandedEffects)}>
                        <img src={IconEffects} alt="effects" className="icon settings-panel-card-header-icon" />
                        <h3 className="settings-panel-card-header-text">ЭФФЕКТЫ</h3>
                </div>
                {expandedEffects && (
                    <div className="settings-panel-card-content">
                        <div className="settings-panel-effect-slider-row">
                            <div className="settings-panel-effect-label-row">
                                <span>Реверб</span>
                                <span className="settings-panel-effect-value">{Math.round(effectReverb * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(effectReverb * 100)}
                                onChange={(e) => onReverbChange(Number(e.target.value) / 100)}
                                className="settings-panel-slider"
                            />
                        </div>
                        <div className="settings-panel-effect-slider-row">
                            <div className="settings-panel-effect-label-row">
                                <span>Дилэй</span>
                                <span className="settings-panel-effect-value">{Math.round(effectDelay * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(effectDelay * 100)}
                                onChange={(e) => onDelayChange(Number(e.target.value) / 100)}
                                className="settings-panel-slider"
                            />
                        </div>
                        <div className="settings-panel-effect-slider-row">
                            <div className="settings-panel-effect-label-row">
                                <span>Дисторшн</span>
                                <span className="settings-panel-effect-value">{Math.round(effectDistortion * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(effectDistortion * 100)}
                                onChange={(e) => onDistortionChange(Number(e.target.value) / 100)}
                                className="settings-panel-slider"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPanel;