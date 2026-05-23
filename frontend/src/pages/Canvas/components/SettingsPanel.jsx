// SettingsPanel.jsx
import React, { useState, useRef, useEffect } from "react";
import "./SettingsPanel.css";

import LeftChevron  from "../../../assets/icons/icon-chevron-left.svg";
import RightChevron from "../../../assets/icons/icon-chevron-right.svg";
import MajorBlock   from "../../../assets/canvas/major-block.png";
import MinorBlock   from "../../../assets/canvas/minor-block.png";
// TODO: раскомментировать когда появятся картинки:
// import PentatonicBlock from "../../../assets/canvas/pentatonic-block.png";
// import DorianBlock     from "../../../assets/canvas/dorian-block.png";
// import BluesBlock      from "../../../assets/canvas/blues-block.png";
import IconSettings from "../../../assets/icons/icon-settings.svg";
import IconNotes    from "../../../assets/icons/icon-notes.svg";
import IconEffects  from "../../../assets/icons/icon-effects.svg";
import IconTurtle   from "../../../assets/icons/icon-turtle.svg";
import IconHare     from "../../../assets/icons/icon-hare.svg";
import GradientSlider from "../../../components/ui/GradientSlider";

import { MOODS, RHYTHM_LABELS, RHYTHM_ORDER } from "../../../engines/MelodyEngine/constants";

const OVERHEAD_PX = 144;

// Картинки для настроений — пока только major и minor
// Когда добавишь png-файлы, вставь их сюда
const MOOD_IMAGES = {
  major:      MajorBlock,
  minor:      MinorBlock,
  // pentatonic: PentatonicBlock,
  // dorian:     DorianBlock,
  // blues:      BluesBlock,
};

const SettingsPanel = ({
  bpm,
  onBpmChange,
  duration,
  onDurationChange,
  scale,
  onScaleChange,
  rhythmPattern,
  onRhythmPatternChange,
  effectReverb,
  onReverbChange,
  effectDelay,
  onDelayChange,
  effectDistortion,
  onDistortionChange,
}) => {
  const [expandedGeneral, setExpandedGeneral] = useState(false);
  const [expandedEffects, setExpandedEffects] = useState(false);

  const panelRef          = useRef(null);
  const generalContentRef = useRef(null);
  const effectsContentRef = useRef(null);
  const generalHeaderRef  = useRef(null);
  const effectsHeaderRef  = useRef(null);

  const measureHeight = (el) => {
    if (!el) return 0;
    return el.scrollHeight;
  };

  const canFitBoth = () => {
    if (!panelRef.current) return false;
    const panelH          = panelRef.current.clientHeight;
    const generalHeaderH  = generalHeaderRef.current?.offsetHeight ?? 0;
    const effectsHeaderH  = effectsHeaderRef.current?.offsetHeight ?? 0;
    const generalContentH = measureHeight(generalContentRef.current);
    const effectsContentH = measureHeight(effectsContentRef.current);
    const needed = OVERHEAD_PX + generalHeaderH + generalContentH + effectsHeaderH + effectsContentH;
    return panelH >= needed;
  };

  const handleToggleGeneral = () => {
    const opening = !expandedGeneral;
    if (opening && expandedEffects && !canFitBoth()) setExpandedEffects(false);
    setExpandedGeneral(opening);
  };

  const handleToggleEffects = () => {
    const opening = !expandedEffects;
    if (opening && expandedGeneral && !canFitBoth()) setExpandedGeneral(false);
    setExpandedEffects(opening);
  };

  useEffect(() => {
    if (!panelRef.current) return;
    const observer = new ResizeObserver(() => {
      if (expandedGeneral && expandedEffects && !canFitBoth()) setExpandedEffects(false);
    });
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [expandedGeneral, expandedEffects]);

  // ── Навигация по настроениям ──────────────────────────────────────────────
  const moodIndex   = MOODS.findIndex(m => m.key === scale);
  const currentMood = MOODS[moodIndex] ?? MOODS[0];

  const prevMood = () => {
    const idx = (moodIndex - 1 + MOODS.length) % MOODS.length;
    onScaleChange(MOODS[idx].key);
  };
  const nextMood = () => {
    const idx = (moodIndex + 1) % MOODS.length;
    onScaleChange(MOODS[idx].key);
  };

  // ── Навигация по ритмам ───────────────────────────────────────────────────
  const rhythmIndex = RHYTHM_ORDER.indexOf(rhythmPattern);

  const prevRhythm = () => {
    const idx = (rhythmIndex - 1 + RHYTHM_ORDER.length) % RHYTHM_ORDER.length;
    onRhythmPatternChange(RHYTHM_ORDER[idx]);
  };
  const nextRhythm = () => {
    const idx = (rhythmIndex + 1) % RHYTHM_ORDER.length;
    onRhythmPatternChange(RHYTHM_ORDER[idx]);
  };

  // ── Длительность и темп ───────────────────────────────────────────────────
  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const s    = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const decreaseDuration = () => { if (duration - 5 >= 5)   onDurationChange(duration - 5); };
  const increaseDuration = () => { if (duration + 5 <= 90)  onDurationChange(duration + 5); };
  const decreaseBpm      = () => { if (bpm - 1 >= 40)       onBpmChange(bpm - 1); };
  const increaseBpm      = () => { if (bpm + 1 <= 180)      onBpmChange(bpm + 1); };

  const hiddenStyle = {
    visibility:    "hidden",
    position:      "absolute",
    pointerEvents: "none",
    height:        0,
    overflow:      "hidden",
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

      {/* ── Блок «Общие» ── */}
      <div className="settings-panel-card">
        <div ref={generalHeaderRef} className="settings-panel-card-header" onClick={handleToggleGeneral}>
          <img src={IconNotes} alt="notes" className="icon settings-panel-card-header-icon" />
          <h3 className="settings-panel-card-header-text">ОБЩИЕ</h3>
        </div>

        <div
          ref={generalContentRef}
          className="settings-panel-card-content"
          style={expandedGeneral ? undefined : hiddenStyle}
        >
          {/* Длительность */}
          <div className="settings-panel-control-group duration">
            <div className="settings-panel-control-label">ДЛИТЕЛЬНОСТЬ</div>
            <div className="settings-panel-value-row">
              <img src={LeftChevron}  alt="-" className="icon settings-panel-chevron" onClick={decreaseDuration} />
              <span className="settings-panel-duration-text">{formatDuration(duration)}</span>
              <img src={RightChevron} alt="+" className="icon settings-panel-chevron" onClick={increaseDuration} />
            </div>
          </div>

          {/* Настроение */}
          <div className="settings-panel-control-group mood">
            <div className="settings-panel-control-label">НАСТРОЕНИЕ</div>
            <div className="settings-panel-value-row">
              <img src={LeftChevron}  alt="prev" className="icon settings-panel-chevron" onClick={prevMood} />

              <div className="settings-panel-mood-images">
                {MOOD_IMAGES[currentMood.key] ? (
                  // Есть картинка — показываем её
                  <img
                    src={MOOD_IMAGES[currentMood.key]}
                    alt={currentMood.label}
                    className="settings-panel-mood-img settings-panel-mood-img-active"
                  />
                ) : (
                  // Картинки нет — показываем текстовый лейбл
                  <span className="settings-panel-mood-text-label">
                    {currentMood.label}
                  </span>
                )}
              </div>

              <img src={RightChevron} alt="next" className="icon settings-panel-chevron" onClick={nextMood} />
            </div>
          </div>

          {/* Ритм */}
          <div className="settings-panel-control-group mood">
            <div className="settings-panel-control-label">РИТМ</div>
            <div className="settings-panel-value-row">
              <img src={LeftChevron}  alt="prev" className="icon settings-panel-chevron" onClick={prevRhythm} />
              <span className="settings-panel-rhythm-text">
                {RHYTHM_LABELS[rhythmPattern] ?? rhythmPattern}
              </span>
              <img src={RightChevron} alt="next" className="icon settings-panel-chevron" onClick={nextRhythm} />
            </div>
          </div>

          {/* Темп */}
          <div className="settings-panel-control-group temp">
            <div className="settings-panel-control-label">ТЕМП</div>
            <div className="settings-panel-tempo-row">
              <img src={IconTurtle} alt="slow" className="icon settings-panel-tempo-icon" onClick={decreaseBpm} />
              <span className="settings-panel-tempo-value">{bpm}</span>
              <img src={IconHare}   alt="fast" className="icon settings-panel-tempo-icon" onClick={increaseBpm} />
            </div>
            <GradientSlider min={40} max={180} step={1} value={bpm} onChange={onBpmChange} />
          </div>
        </div>
      </div>

      {/* ── Блок «Эффекты» ── */}
      <div className="settings-panel-card">
        <div ref={effectsHeaderRef} className="settings-panel-card-header" onClick={handleToggleEffects}>
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
              <img src={IconHare}   alt="max" className="icon settings-panel-tempo-icon" onClick={() => onReverbChange(Math.min(1, effectReverb + 0.05))} />
            </div>
            <GradientSlider min={0} max={100} step={1} value={Math.round(effectReverb * 100)} onChange={(v) => onReverbChange(v / 100)} />
          </div>

          {/* Дилэй */}
          <div className="settings-panel-control-group temp">
            <div className="settings-panel-control-label">ДИЛЭЙ</div>
            <div className="settings-panel-tempo-row">
              <img src={IconTurtle} alt="min" className="icon settings-panel-tempo-icon" onClick={() => onDelayChange(Math.max(0, effectDelay - 0.05))} />
              <span className="settings-panel-tempo-value">{Math.round(effectDelay * 100)}%</span>
              <img src={IconHare}   alt="max" className="icon settings-panel-tempo-icon" onClick={() => onDelayChange(Math.min(1, effectDelay + 0.05))} />
            </div>
            <GradientSlider min={0} max={100} step={1} value={Math.round(effectDelay * 100)} onChange={(v) => onDelayChange(v / 100)} />
          </div>

          {/* Дисторшн */}
          <div className="settings-panel-control-group temp">
            <div className="settings-panel-control-label">ДИСТОРШН</div>
            <div className="settings-panel-tempo-row">
              <img src={IconTurtle} alt="min" className="icon settings-panel-tempo-icon" onClick={() => onDistortionChange(Math.max(0, effectDistortion - 0.05))} />
              <span className="settings-panel-tempo-value">{Math.round(effectDistortion * 100)}%</span>
              <img src={IconHare}   alt="max" className="icon settings-panel-tempo-icon" onClick={() => onDistortionChange(Math.min(1, effectDistortion + 0.05))} />
            </div>
            <GradientSlider min={0} max={100} step={1} value={Math.round(effectDistortion * 100)} onChange={(v) => onDistortionChange(v / 100)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;