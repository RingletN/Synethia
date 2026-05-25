// SettingsPanel.jsx

import React, { useState, useRef, useEffect } from "react";
import "./SettingsPanel.css";

import LeftChevron from "../../../assets/icons/icon-chevron-left.svg";
import RightChevron from "../../../assets/icons/icon-chevron-right.svg";
import MajorBlock from "../../../assets/canvas/major-block.png";
import MinorBlock from "../../../assets/canvas/minor-block.png";
import PentatonicBlock from "../../../assets/canvas/pentatonic-block.png";
import DorianBlock from "../../../assets/canvas/dorian-block.png";
import BluesBlock from "../../../assets/canvas/blues-block.png";
import IconSettings from "../../../assets/icons/icon-settings.svg";
import IconNotes from "../../../assets/icons/icon-notes.svg";
import IconEffects from "../../../assets/icons/icon-effects.svg";
import IconTurtle from "../../../assets/icons/icon-turtle.svg";
import IconHare from "../../../assets/icons/icon-hare.svg";
import IconBox from "../../../assets/icons/icon-box.svg";
import IconScene from "../../../assets/icons/icon-scene.svg";
import IconNoDelay from "../../../assets/icons/icon-no-delay.svg";
import IconMaxDelay from "../../../assets/icons/icon-max-delay.svg";
import IconSine from "../../../assets/icons/icon-sine.svg";
import IconHighDistortion from "../../../assets/icons/icon-high-distortion.svg";
import GradientSlider from "../../../components/ui/GradientSlider";

import { useHint, useHintPush } from "../hooks/useHint";

import {
  MOODS,
  RHYTHM_LABELS,
  RHYTHM_ORDER,
} from "../../../engines/MelodyEngine/constants";

const OVERHEAD_PX = 144;

const MOOD_IMAGES = {
  major: MajorBlock,
  minor: MinorBlock,
  pentatonic: PentatonicBlock,
  dorian: DorianBlock,
  blues: BluesBlock,
};

const MOOD_HINTS = {
  major: "Светлое и уверенное — мажор звучит как солнечный день ✦",
  minor: "Меланхоличное и глубокое — минор трогает за душу ✦",
  pentatonic: "Древнее и медитативное — пентатоника уводит очень далеко ✦",
  dorian: "Загадочное и немного джазовое — дориан живёт между светом и тенью ✦",
  blues: "Страстное и надрывное — блюз звучит как честная история ✦",
};

const RHYTHM_HINTS = {
  quarter: "Ровный и уверенный — четверти держат пульс ✦",
  eighth: "Живой и подвижный — восьмые добавляют энергии ✦",
  triplet: "Качающий и джазовый — триоли дают ощущение свинга ✦",
  syncopated: "Неожиданный и танцевальный — синкопы сдвигают акценты ✦",
  dotted: "Пунктирный и маршевый — точка добавляет импульс ✦",
  mixed: "Непредсказуемый и живой — смешанный ритм всегда удивляет ✦",
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

  const panelRef = useRef(null);
  const generalContentRef = useRef(null);
  const effectsContentRef = useRef(null);
  const generalHeaderRef = useRef(null);
  const effectsHeaderRef = useRef(null);

  // ── Статичные хинты на целые блоки ──────────────────────────────────────
  const hintSettingsTitle = useHint("Настройте музыку под своё настроение ✦");
  const hintGeneralCard = useHint("Базовые параметры вашей композиции ✦");
  const hintEffectsCard = useHint("Добавьте глубину и характер звуку ✦");
  const hintDurationBlock = useHint(
    "Изменяйте итоговую длительность мелодии ✦",
  );
  const hintTempoBlock = useHint(
    "Быстро или медленно — выберите дыхание музыки ✦",
  );
  const hintReverbBlock = useHint(
    "Реверб — насколько большой зал, в котором звучит музыка ✦",
  );
  const hintDelayBlock = useHint(
    "Дилэй — звук отражается и возвращается волнами ✦",
  );
  const hintDistortBlock = useHint(
    "Дисторшн — добавьте шероховатость и характер ✦",
  );

  // ── Хинты для шевронов настроения и ритма ───────────────────────────────
  // useHintPush: при наведении показывает текущий хинт,
  // при клике на шеврон — сразу правильный следующий (без ожидания рендера)
  const moodHint = useHintPush(
    () => MOOD_HINTS[scale] ?? "Выберите настроение ✦",
  );
  const rhythmHint = useHintPush(
    () => RHYTHM_HINTS[rhythmPattern] ?? "Задайте пульс мелодии ✦",
  );

  // ── Утилиты ─────────────────────────────────────────────────────────────
  const measureHeight = (el) => (el ? el.scrollHeight : 0);

  const canFitBoth = () => {
    if (!panelRef.current) return false;
    const panelH = panelRef.current.clientHeight;
    const generalHeaderH = generalHeaderRef.current?.offsetHeight ?? 0;
    const effectsHeaderH = effectsHeaderRef.current?.offsetHeight ?? 0;
    const generalContentH = measureHeight(generalContentRef.current);
    const effectsContentH = measureHeight(effectsContentRef.current);
    return (
      panelH >=
      OVERHEAD_PX +
        generalHeaderH +
        generalContentH +
        effectsHeaderH +
        effectsContentH
    );
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
      if (expandedGeneral && expandedEffects && !canFitBoth())
        setExpandedEffects(false);
    });
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [expandedGeneral, expandedEffects]);

  const moodIndex = MOODS.findIndex((m) => m.key === scale);
  const currentMood = MOODS[moodIndex] ?? MOODS[0];

  // Вычисляем nextKey ДО setState — и сразу пушим правильный текст хинта
  const prevMood = () => {
    const nextIdx = (moodIndex - 1 + MOODS.length) % MOODS.length;
    const nextKey = MOODS[nextIdx].key;
    onScaleChange(nextKey);
    moodHint.push(MOOD_HINTS[nextKey] ?? "Выберите настроение ✦");
  };
  const nextMood = () => {
    const nextIdx = (moodIndex + 1) % MOODS.length;
    const nextKey = MOODS[nextIdx].key;
    onScaleChange(nextKey);
    moodHint.push(MOOD_HINTS[nextKey] ?? "Выберите настроение ✦");
  };

  const rhythmIndex = RHYTHM_ORDER.indexOf(rhythmPattern);
  const prevRhythm = () => {
    const nextIdx =
      (rhythmIndex - 1 + RHYTHM_ORDER.length) % RHYTHM_ORDER.length;
    const nextKey = RHYTHM_ORDER[nextIdx];
    onRhythmPatternChange(nextKey);
    rhythmHint.push(RHYTHM_HINTS[nextKey] ?? "Задайте пульс мелодии ✦");
  };
  const nextRhythm = () => {
    const nextIdx = (rhythmIndex + 1) % RHYTHM_ORDER.length;
    const nextKey = RHYTHM_ORDER[nextIdx];
    onRhythmPatternChange(nextKey);
    rhythmHint.push(RHYTHM_HINTS[nextKey] ?? "Задайте пульс мелодии ✦");
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const decreaseDuration = () => {
    if (duration - 5 >= 5) onDurationChange(duration - 5);
  };
  const increaseDuration = () => {
    if (duration + 5 <= 90) onDurationChange(duration + 5);
  };
  const decreaseBpm = () => {
    if (bpm - 1 >= 40) onBpmChange(bpm - 1);
  };
  const increaseBpm = () => {
    if (bpm + 1 <= 180) onBpmChange(bpm + 1);
  };

  const hiddenStyle = {
    visibility: "hidden",
    position: "absolute",
    pointerEvents: "none",
    height: 0,
    overflow: "hidden",
  };

  return (
    <div className="settings-panel" ref={panelRef}>
      {/* ── Заголовок ── */}
      <div className="settings-panel-header-block" {...hintSettingsTitle}>
        <div className="settings-panel-header">
          <img
            src={IconSettings}
            alt="settings"
            className="icon settings-panel-card-header-icon"
          />
          <h3 className="settings-panel-header-title">НАСТРОЙКИ</h3>
        </div>
        <div className="divider-settings" />
      </div>

      {/* ── Блок «Общие» ── */}
      <div className="settings-panel-card" {...hintGeneralCard}>
        <div
          ref={generalHeaderRef}
          className="settings-panel-card-header"
          onClick={handleToggleGeneral}
        >
          <img
            src={IconNotes}
            alt="notes"
            className="icon settings-panel-card-header-icon"
          />
          <h3 className="settings-panel-card-header-text">ОБЩИЕ</h3>
        </div>

        <div
          ref={generalContentRef}
          className="settings-panel-card-content"
          style={expandedGeneral ? undefined : hiddenStyle}
        >
          {/* Длительность — хинт на весь блок */}
          <div
            className="settings-panel-control-group duration"
            {...hintDurationBlock}
          >
            <div className="settings-panel-control-label">ДЛИТЕЛЬНОСТЬ</div>
            <div className="settings-panel-value-row">
              <img
                src={LeftChevron}
                alt="-"
                className="icon settings-panel-chevron"
                onClick={decreaseDuration}
              />
              <span className="settings-panel-duration-text">
                {formatDuration(duration)}
              </span>
              <img
                src={RightChevron}
                alt="+"
                className="icon settings-panel-chevron"
                onClick={increaseDuration}
              />
            </div>
          </div>

          {/* Настроение — весь блок: onMouseEnter/Leave только эти два, push вызываем в кликах */}
          <div
            className="settings-panel-control-group mood"
            onMouseEnter={moodHint.onMouseEnter}
            onMouseLeave={moodHint.onMouseLeave}
          >
            <div className="settings-panel-control-label">НАСТРОЕНИЕ</div>
            <div className="settings-panel-value-row">
              <img
                src={LeftChevron}
                alt="prev"
                className="icon settings-panel-chevron"
                onClick={prevMood}
              />
              <div className="settings-panel-mood-images">
                {MOOD_IMAGES[currentMood.key] ? (
                  <img
                    src={MOOD_IMAGES[currentMood.key]}
                    alt={currentMood.label}
                    className="settings-panel-mood-img settings-panel-mood-img-active"
                  />
                ) : (
                  <span className="settings-panel-mood-text-label">
                    {currentMood.label}
                  </span>
                )}
              </div>
              <img
                src={RightChevron}
                alt="next"
                className="icon settings-panel-chevron"
                onClick={nextMood}
              />
            </div>
          </div>

          {/* Ритм — весь блок */}
          <div
            className="settings-panel-control-group mood"
            onMouseEnter={rhythmHint.onMouseEnter}
            onMouseLeave={rhythmHint.onMouseLeave}
          >
            <div className="settings-panel-control-label">РИТМ</div>
            <div className="settings-panel-value-row">
              <img
                src={LeftChevron}
                alt="prev"
                className="icon settings-panel-chevron"
                onClick={prevRhythm}
              />
              <span className="settings-panel-rhythm-text">
                {RHYTHM_LABELS[rhythmPattern] ?? rhythmPattern}
              </span>
              <img
                src={RightChevron}
                alt="next"
                className="icon settings-panel-chevron"
                onClick={nextRhythm}
              />
            </div>
          </div>

          {/* Темп — хинт на весь блок */}
          <div
            className="settings-panel-control-group temp"
            {...hintTempoBlock}
          >
            <div className="settings-panel-control-label">ТЕМП</div>
            <div className="settings-panel-tempo-row">
              <img
                src={IconTurtle}
                alt="slow"
                className="icon settings-panel-tempo-icon"
                onClick={decreaseBpm}
              />
              <span className="settings-panel-tempo-value">{bpm}</span>
              <img
                src={IconHare}
                alt="fast"
                className="icon settings-panel-tempo-icon"
                onClick={increaseBpm}
              />
            </div>
            <GradientSlider
              min={40}
              max={180}
              step={1}
              value={bpm}
              onChange={onBpmChange}
            />
          </div>
        </div>
      </div>

      {/* ── Блок «Эффекты» ── */}
      <div className="settings-panel-card" {...hintEffectsCard}>
        <div
          ref={effectsHeaderRef}
          className="settings-panel-card-header"
          onClick={handleToggleEffects}
        >
          <img
            src={IconEffects}
            alt="effects"
            className="icon settings-panel-card-header-icon"
          />
          <h3 className="settings-panel-card-header-text">ЭФФЕКТЫ</h3>
        </div>

        <div
          ref={effectsContentRef}
          className="settings-panel-card-content"
          style={expandedEffects ? undefined : hiddenStyle}
        >
          {/* Реверб */}
          <div
            className="settings-panel-control-group temp"
            {...hintReverbBlock}
          >
            <div className="settings-panel-control-label">ПРОСТРАНСТВО</div>
            <div className="settings-panel-tempo-row">
              <img
                src={IconBox}
                alt="min"
                className="icon settings-panel-tempo-icon"
                onClick={() => onReverbChange(Math.max(0, effectReverb - 0.05))}
              />
              <span className="settings-panel-tempo-value">
                {Math.round(effectReverb * 100)}%
              </span>
              <img
                src={IconScene}
                alt="max"
                className="icon settings-panel-tempo-icon"
                onClick={() => onReverbChange(Math.min(1, effectReverb + 0.05))}
              />
            </div>
            <GradientSlider
              min={0}
              max={100}
              step={1}
              value={Math.round(effectReverb * 100)}
              onChange={(v) => onReverbChange(v / 100)}
            />
          </div>

          {/* Дилэй */}
          <div
            className="settings-panel-control-group temp"
            {...hintDelayBlock}
          >
            <div className="settings-panel-control-label">ЭХО</div>
            <div className="settings-panel-tempo-row">
              <img
                src={IconNoDelay}
                alt="min"
                className="icon settings-panel-tempo-icon"
                onClick={() => onDelayChange(Math.max(0, effectDelay - 0.05))}
              />
              <span className="settings-panel-tempo-value">
                {Math.round(effectDelay * 100)}%
              </span>
              <img
                src={IconMaxDelay}
                alt="max"
                className="icon settings-panel-tempo-icon"
                onClick={() => onDelayChange(Math.min(1, effectDelay + 0.05))}
              />
            </div>
            <GradientSlider
              min={0}
              max={100}
              step={1}
              value={Math.round(effectDelay * 100)}
              onChange={(v) => onDelayChange(v / 100)}
            />
          </div>

          {/* Дисторшн */}
          <div
            className="settings-panel-control-group temp"
            {...hintDistortBlock}
          >
            <div className="settings-panel-control-label">ИСКАЖЕНИЕ</div>
            <div className="settings-panel-tempo-row">
              <img
                src={IconSine}
                alt="min"
                className="icon settings-panel-tempo-icon"
                onClick={() =>
                  onDistortionChange(Math.max(0, effectDistortion - 0.05))
                }
              />
              <span className="settings-panel-tempo-value">
                {Math.round(effectDistortion * 100)}%
              </span>
              <img
                src={IconHighDistortion}
                alt="max"
                className="icon settings-panel-tempo-icon"
                onClick={() =>
                  onDistortionChange(Math.min(1, effectDistortion + 0.05))
                }
              />
            </div>
            <GradientSlider
              min={0}
              max={100}
              step={1}
              value={Math.round(effectDistortion * 100)}
              onChange={(v) => onDistortionChange(v / 100)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
