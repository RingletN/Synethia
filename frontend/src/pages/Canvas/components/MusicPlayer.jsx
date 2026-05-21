import React, { useRef, useState, useEffect, useCallback } from "react";

import PauseIcon from "../../../assets/icons/icon-pause.svg";
import PlayIcon from "../../../assets/icons/icon-play.svg";
import SkipBackIcon from "../../../assets/icons/icon-skip-back.svg";
import SkipForwardIcon from "../../../assets/icons/icon-skip-forward.svg";
import VolumeHighIcon from "../../../assets/icons/icon-volume-high.svg";
import VolumeLowIcon from "../../../assets/icons/icon-volume-low.svg";
import VolumeNoIcon from "../../../assets/icons/icon-volume-no.svg";

const formatTime = (seconds) => {
  const s = Math.max(0, seconds);
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
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
  const progressRef = useRef(null);
  const volumeTrackRef = useRef(null);
  const isDraggingProgressRef = useRef(false);
  const isDraggingVolumeRef = useRef(false);

  const handleProgressClick = useCallback(
    (e) => {
      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      onSeek(ratio * totalDuration);
    },
    [onSeek, totalDuration],
  );

  const handleProgressMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      isDraggingProgressRef.current = true;
      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      onSeek(ratio * totalDuration);
    },
    [onSeek, totalDuration],
  );

  const handleVolumeMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      isDraggingVolumeRef.current = true;
      if (!volumeTrackRef.current) return;
      const rect = volumeTrackRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      onVolumeChange(ratio);
    },
    [onVolumeChange],
  );

  useEffect(() => {
    const onMove = (e) => {
      if (isDraggingProgressRef.current && progressRef.current) {
        const rect = progressRef.current.getBoundingClientRect();
        const ratio = Math.max(
          0,
          Math.min(1, (e.clientX - rect.left) / rect.width),
        );
        onSeek(ratio * totalDuration);
      }
      if (isDraggingVolumeRef.current && volumeTrackRef.current) {
        const rect = volumeTrackRef.current.getBoundingClientRect();
        const ratio = Math.max(
          0,
          Math.min(1, (e.clientX - rect.left) / rect.width),
        );
        onVolumeChange(ratio);
      }
    };
    const onUp = () => {
      isDraggingProgressRef.current = false;
      isDraggingVolumeRef.current = false;
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
      <div className="icon" onClick={() => onSkip(-5)} title="−5 с">
        <img src={SkipBackIcon} alt="Назад 5 с" />
      </div>
      <div className="icon" onClick={onPlayPause}>
        <img
          src={isPlaying ? PauseIcon : PlayIcon}
          alt={isPlaying ? "Пауза" : "Воспроизвести"}
        />
      </div>
      <div className="icon" onClick={() => onSkip(5)} title="+5 с">
        <img src={SkipForwardIcon} alt="Вперёд 5 с" />
      </div>

      <div
        ref={progressRef}
        className="progress-bar-container"
        onClick={handleProgressClick}
        onMouseDown={handleProgressMouseDown}
      >
        <div
          className="progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
        <div
          className="progress-thumb"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      <p className="time-text">
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </p>

      <div className="volume-control">
        <div className="icon volume-btn">
          <img
            src={VolumeIcon}
            alt="Громкость"
            className="volume-icon"
            onClick={() => onVolumeChange(volume === 0 ? 0.5 : 0)}
          />
        </div>
        <div
          ref={volumeTrackRef}
          className="volume-slider-track"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(
              0,
              Math.min(1, (e.clientX - rect.left) / rect.width),
            );
            onVolumeChange(ratio);
          }}
          onMouseDown={handleVolumeMouseDown}
        >
          <div
            className="volume-slider-fill"
            style={{ width: `${volume * 100}%` }}
          />
          <div
            className="volume-slider-thumb"
            style={{ left: `${volume * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
