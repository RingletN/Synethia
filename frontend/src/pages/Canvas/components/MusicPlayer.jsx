// MusicPlayer.jsx — с подключёнными подсказками
// Изменения помечены комментарием // [HINT]

import React, { useRef, useState, useEffect, useCallback } from "react";

import PauseIcon      from "../../../assets/icons/icon-pause.svg";
import PlayIcon       from "../../../assets/icons/icon-play.svg";
import SkipBackIcon   from "../../../assets/icons/icon-skip-back.svg";
import SkipForwardIcon from "../../../assets/icons/icon-skip-forward.svg";
import VolumeHighIcon from "../../../assets/icons/icon-volume-high.svg";
import VolumeLowIcon  from "../../../assets/icons/icon-volume-low.svg";
import VolumeNoIcon   from "../../../assets/icons/icon-volume-no.svg";

// [HINT] импортируем хуки
import { useHint, useHintPush } from "../hooks/useHint"; // поправь путь

const formatTime = (seconds) => {
  const s    = Math.max(0, seconds);
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const MusicPlayer = ({
  isPlaying,
  currentTime,
  totalDuration,
  volume,
  onVolumeChange,
  onPlayPause,
  onSkip,
  onSeek,
}) => {
  const progressRef    = useRef(null);
  const volumeTrackRef = useRef(null);
  const isDraggingProgressRef = useRef(false);
  const isDraggingVolumeRef   = useRef(false);

  // [HINT] статичные хинты (состояние не меняется в момент клика)
  const hintSkipBack    = useHint("Перемотать на 5 секунд назад ✦");
  const hintSkipForward = useHint("Перемотать на 5 секунд вперёд ✦");
  const hintProgress    = useHint("Нажмите или перетащите, чтобы перемотать ✦");
  const hintTime        = useHint("Текущее время / общая длительность ✦");
  const hintVolumeSlider = useHint("Перетащите, чтобы изменить громкость ✦");

  // [HINT] ИСПРАВЛЕНО: toggle-хинты — обновляются сразу при клике, без ухода курсора.
  // Используем useHintToggle: при клике вызываем onAfterClick() и подсказка меняется мгновенно.
  // useHintPush: push вызывается с уже вычисленным следующим текстом
  const hintPlayPause  = useHintPush(() => isPlaying ? "Поставить на паузу ✦" : "Воспроизвести музыку ✦");
  const hintVolumeIcon = useHintPush(() => volume === 0 ? "Включить звук ✦" : "Выключить звук ✦");

  const handleProgressClick = useCallback(
    (e) => {
      if (!progressRef.current) return;
      const rect  = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(ratio * totalDuration);
    },
    [onSeek, totalDuration],
  );

  const handleProgressMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      isDraggingProgressRef.current = true;
      if (!progressRef.current) return;
      const rect  = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(ratio * totalDuration);
    },
    [onSeek, totalDuration],
  );

  const handleVolumeMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      isDraggingVolumeRef.current = true;
      if (!volumeTrackRef.current) return;
      const rect  = volumeTrackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onVolumeChange(ratio);
    },
    [onVolumeChange],
  );

  useEffect(() => {
    const onMove = (e) => {
      if (isDraggingProgressRef.current && progressRef.current) {
        const rect  = progressRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeek(ratio * totalDuration);
      }
      if (isDraggingVolumeRef.current && volumeTrackRef.current) {
        const rect  = volumeTrackRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onVolumeChange(ratio);
      }
    };
    const onUp = () => {
      isDraggingProgressRef.current = false;
      isDraggingVolumeRef.current   = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onSeek, totalDuration, onVolumeChange]);

  const progressPercent =
    totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  const VolumeIcon =
    volume === 0 ? VolumeNoIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

  return (
    <div className="music-player">

      {/* Перемотать назад */}
      <div className="icon" onClick={() => onSkip(-5)} title="−5 с" {...hintSkipBack}> {/* [HINT] */}
        <img src={SkipBackIcon} alt="Назад 5 с" />
      </div>

      {/* Play / Pause */}
      {/* [HINT] ИСПРАВЛЕНО: onAfterClick вызывается сразу после клика — подсказка меняется без ухода курсора */}
      <div
        className="icon"
        onClick={() => { onPlayPause(); hintPlayPause.push(isPlaying ? "Воспроизвести музыку ✦" : "Поставить на паузу ✦"); }}
        onMouseEnter={hintPlayPause.onMouseEnter}
        onMouseLeave={hintPlayPause.onMouseLeave}
      >
        <img src={isPlaying ? PauseIcon : PlayIcon} alt={isPlaying ? "Пауза" : "Воспроизвести"} />
      </div>

      {/* Перемотать вперёд */}
      <div className="icon" onClick={() => onSkip(5)} title="+5 с" {...hintSkipForward}> {/* [HINT] */}
        <img src={SkipForwardIcon} alt="Вперёд 5 с" />
      </div>

      {/* Прогресс-бар */}
      <div
        ref={progressRef}
        className="progress-bar-container"
        onClick={handleProgressClick}
        onMouseDown={handleProgressMouseDown}
        {...hintProgress} // [HINT]
      >
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        <div className="progress-thumb" style={{ left: `${progressPercent}%` }} />
      </div>

      {/* Время */}
      <p className="time-text" {...hintTime}> {/* [HINT] */}
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </p>

      {/* Громкость */}
      <div className="volume-control">
        {/* [HINT] ИСПРАВЛЕНО: иконка звука — toggle-хинт, onAfterClick обновляет подсказку мгновенно */}
        <div
          className="icon volume-btn"
          onMouseEnter={hintVolumeIcon.onMouseEnter}
          onMouseLeave={hintVolumeIcon.onMouseLeave}
        >
          <img
            src={VolumeIcon}
            alt="Громкость"
            className="volume-icon"
            onClick={() => {
              const nextVol = volume === 0 ? 0.5 : 0;
              onVolumeChange(nextVol);
              hintVolumeIcon.push(nextVol === 0 ? "Включить звук ✦" : "Выключить звук ✦");
            }}
          />
        </div>

        {/* Слайдер громкости */}
        <div
          ref={volumeTrackRef}
          className="volume-slider-track"
          onClick={(e) => {
            const rect  = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            onVolumeChange(ratio);
          }}
          onMouseDown={handleVolumeMouseDown}
          {...hintVolumeSlider} // [HINT]
        >
          <div className="volume-slider-fill" style={{ width: `${volume * 100}%` }} />
          <div className="volume-slider-thumb" style={{ left: `${volume * 100}%` }} />
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;