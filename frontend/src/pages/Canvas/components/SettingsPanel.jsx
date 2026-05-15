// SettingsPanel.jsx
import React, { useState, useRef, useEffect } from 'react';
import './SettingsPanel.css';

import LeftChevron from "../../../assets/icons/icon-chevron-left.svg";
import RightChevron from "../../../assets/icons/icon-chevron-right.svg";
import MajorBlock from "../../../assets/canvas/major-block.png";
import MinorBlock from "../../../assets/canvas/minor-block.png";
import IconSettings from "../../../assets/icons/icon-settings.svg";
import IconNotes from "../../../assets/icons/icon-notes.svg";
import IconEffects from "../../../assets/icons/icon-effects.svg";
import IconTurtle from "../../../assets/icons/icon-turtle.svg";
import IconHare from "../../../assets/icons/icon-hare.svg";
import GradientSlider from "../../../components/ui/GradientSlider";

// Запас: суммарные gap-ы и паддинги внутри панели (header ~70px + gap*2 ~60px + паддинги ~14px)
const OVERHEAD_PX = 144;

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

    const panelRef = useRef(null);
    const generalContentRef = useRef(null);
    const effectsContentRef = useRef(null);
    const generalHeaderRef = useRef(null);
    const effectsHeaderRef = useRef(null);

    /**
     * Измеряем через offscreen-клон с реальной шириной, чтобы получить
     * настоящий offsetHeight даже когда контент скрыт.
     * scrollHeight не работает при display:none — поэтому используем
     * visibility:hidden + position:absolute на самом элементе.
     */
    const measureHeight = (el) => {
        if (!el) return 0;
        // Элемент всегда в DOM, скрыт через visibility:hidden + position:absolute
        // поэтому offsetHeight/scrollHeight доступны всегда
        return el.scrollHeight;
    };

    const canFitBoth = () => {
        if (!panelRef.current) return false;
        const panelH = panelRef.current.clientHeight;
        const generalHeaderH = generalHeaderRef.current?.offsetHeight ?? 0;
        const effectsHeaderH = effectsHeaderRef.current?.offsetHeight ?? 0;
        const generalContentH = measureHeight(generalContentRef.current);
        const effectsContentH = measureHeight(effectsContentRef.current);
        const needed = OVERHEAD_PX + generalHeaderH + generalContentH + effectsHeaderH + effectsContentH;
        return panelH >= needed;
    };

    const handleToggleGeneral = () => {
        const opening = !expandedGeneral;
        if (opening && expandedEffects && !canFitBoth()) {
            // Закрываем effects синхронно ДО открытия general
            setExpandedEffects(false);
        }
        setExpandedGeneral(opening);
    };

    const handleToggleEffects = () => {
        const opening = !expandedEffects;
        if (opening && expandedGeneral && !canFitBoth()) {
            // Закрываем general синхронно ДО открытия effects
            setExpandedGeneral(false);
        }
        setExpandedEffects(opening);
    };

    // При ресайзе панели — если оба открыты и перестали влезать, закрываем effects
    useEffect(() => {
        if (!panelRef.current) return;
        const observer = new ResizeObserver(() => {
            if (expandedGeneral && expandedEffects && !canFitBoth()) {
                setExpandedEffects(false);
            }
        });
        observer.observe(panelRef.current);
        return () => observer.disconnect();
    }, [expandedGeneral, expandedEffects]);

    const formatDuration = (sec) => {
        const mins = Math.floor(sec / 60);
        const remainingSec = sec % 60;
        return `${mins.toString().padStart(2, '0')}:${remainingSec.toString().padStart(2, '0')}`;
    };

    const increaseDuration = () => { if (duration + 5 <= 90) onDurationChange(duration + 5); };
    const decreaseDuration = () => { if (duration - 5 >= 5) onDurationChange(duration - 5); };
    const nextMood = () => onScaleChange(scale === 'major' ? 'minor' : 'major');
    const prevMood = () => onScaleChange(scale === 'major' ? 'minor' : 'major');
    const decreaseBpm = () => { if (bpm - 1 >= 40) onBpmChange(bpm - 1); };
    const increaseBpm = () => { if (bpm + 1 <= 180) onBpmChange(bpm + 1); };

    // Стиль для скрытого контента: элемент остаётся в DOM для измерений,
    // но не занимает место и не виден пользователю
    const hiddenStyle = {
        visibility: 'hidden',
        position: 'absolute',
        pointerEvents: 'none',
        height: 0,
        overflow: 'hidden',
    };

    return (
        <div className="settings-panel" ref={panelRef}>
            <div className="settings-panel-header-block">
                <div className="settings-panel-header">
                    <img src={IconSettings} alt="settings" className="icon settings-panel-card-header-icon" />
                    <h3 className="settings-panel-header-title">НАСТРОЙКИ</h3>
                </div>
                <div className="divider-settings" />
            </div>

            {/* Блок «Общие» */}
            <div className="settings-panel-card">
                <div
                    ref={generalHeaderRef}
                    className="settings-panel-card-header"
                    onClick={handleToggleGeneral}
                >
                    <img src={IconNotes} alt="notes" className="icon settings-panel-card-header-icon" />
                    <h3 className="settings-panel-card-header-text">ОБЩИЕ</h3>
                </div>

                {/*
                    Контент всегда в DOM. Когда закрыт — скрыт через hiddenStyle
                    (visibility:hidden + height:0), чтобы scrollHeight был измеримым.
                    Когда открыт — обычный рендер.
                */}
                <div
                    ref={generalContentRef}
                    className="settings-panel-card-content"
                    style={expandedGeneral ? undefined : hiddenStyle}
                >
                    {/* Длительность */}
                    <div className="settings-panel-control-group duration">
                        <div className="settings-panel-control-label">ДЛИТЕЛЬНОСТЬ</div>
                        <div className="settings-panel-value-row">
                            <img
                                src={LeftChevron} alt="-"
                                className="icon settings-panel-chevron"
                                onClick={decreaseDuration}
                            />
                            <span className="settings-panel-duration-text">{formatDuration(duration)}</span>
                            <img
                                src={RightChevron} alt="+"
                                className="icon settings-panel-chevron"
                                onClick={increaseDuration}
                            />
                        </div>
                    </div>

                    {/* Настроение */}
                    <div className="settings-panel-control-group mood">
                        <div className="settings-panel-control-label">НАСТРОЕНИЕ</div>
                        <div className="settings-panel-value-row">
                            <img src={LeftChevron} alt="prev" className="icon settings-panel-chevron" onClick={prevMood} />
                            <div className="settings-panel-mood-images">
                                <img
                                    src={scale === 'major' ? MajorBlock : MinorBlock}
                                    alt={scale}
                                    className="settings-panel-mood-img settings-panel-mood-img-active"
                                />
                            </div>
                            <img src={RightChevron} alt="next" className="icon settings-panel-chevron" onClick={nextMood} />
                        </div>
                    </div>

                    {/* Темп */}
                    <div className="settings-panel-control-group temp">
                        <div className="settings-panel-control-label">ТЕМП</div>
                        <div className="settings-panel-tempo-row">
                            <img src={IconTurtle} alt="slow" className="icon settings-panel-tempo-icon" onClick={decreaseBpm} />
                            <span className="settings-panel-tempo-value">{bpm}</span>
                            <img src={IconHare} alt="fast" className="icon settings-panel-tempo-icon" onClick={increaseBpm} />
                        </div>
                        <GradientSlider min={40} max={180} step={1} value={bpm} onChange={onBpmChange} />
                    </div>
                </div>
            </div>

            {/* Блок «Эффекты» */}
            <div className="settings-panel-card">
                <div
                    ref={effectsHeaderRef}
                    className="settings-panel-card-header"
                    onClick={handleToggleEffects}
                >
                    <img src={IconEffects} alt="effects" className="icon settings-panel-card-header-icon" />
                    <h3 className="settings-panel-card-header-text">ЭФФЕКТЫ</h3>
                </div>

                <div
                    ref={effectsContentRef}
                    className="settings-panel-card-content"
                    style={expandedEffects ? undefined : hiddenStyle}
                >
                    {/* Реверб */}
                    <div className="settings-panel-control-group temp">
                        <div className="settings-panel-control-label">РЕВЕРБ</div>
                        <div className="settings-panel-tempo-row">
                            <img src={IconTurtle} alt="min" className="icon settings-panel-tempo-icon" onClick={() => onReverbChange(Math.max(0, effectReverb - 0.05))} />
                            <span className="settings-panel-tempo-value">{Math.round(effectReverb * 100)}%</span>
                            <img src={IconHare} alt="max" className="icon settings-panel-tempo-icon" onClick={() => onReverbChange(Math.min(1, effectReverb + 0.05))} />
                        </div>
                        <GradientSlider min={0} max={100} step={1} value={Math.round(effectReverb * 100)} onChange={(v) => onReverbChange(v / 100)} />
                    </div>

                    {/* Дилэй */}
                    <div className="settings-panel-control-group temp">
                        <div className="settings-panel-control-label">ДИЛЭЙ</div>
                        <div className="settings-panel-tempo-row">
                            <img src={IconTurtle} alt="min" className="icon settings-panel-tempo-icon" onClick={() => onDelayChange(Math.max(0, effectDelay - 0.05))} />
                            <span className="settings-panel-tempo-value">{Math.round(effectDelay * 100)}%</span>
                            <img src={IconHare} alt="max" className="icon settings-panel-tempo-icon" onClick={() => onDelayChange(Math.min(1, effectDelay + 0.05))} />
                        </div>
                        <GradientSlider min={0} max={100} step={1} value={Math.round(effectDelay * 100)} onChange={(v) => onDelayChange(v / 100)} />
                    </div>

                    {/* Дисторшн */}
                    <div className="settings-panel-control-group temp">
                        <div className="settings-panel-control-label">ДИСТОРШН</div>
                        <div className="settings-panel-tempo-row">
                            <img src={IconTurtle} alt="min" className="icon settings-panel-tempo-icon" onClick={() => onDistortionChange(Math.max(0, effectDistortion - 0.05))} />
                            <span className="settings-panel-tempo-value">{Math.round(effectDistortion * 100)}%</span>
                            <img src={IconHare} alt="max" className="icon settings-panel-tempo-icon" onClick={() => onDistortionChange(Math.min(1, effectDistortion + 0.05))} />
                        </div>
                        <GradientSlider min={0} max={100} step={1} value={Math.round(effectDistortion * 100)} onChange={(v) => onDistortionChange(v / 100)} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;