import React, { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as Tone from "tone";
import api from "../../api";
import Modal from "../../components/ui/Modal";
import PlusIcon from "../../assets/projects/plus.svg";
import StarIcon from "../../assets/icons/icon-star.svg";
import StarSelectedIcon from "../../assets/icons/icon-star-selected.svg";
import DownloadIcon from "../../assets/icons/icon-download.svg";
import TrashIcon from "../../assets/icons/icon-trash.svg";
import PlayIcon from "../../assets/icons/icon-play-mini.svg";
import PauseIcon from "../../assets/icons/icon-pause-mini.svg";
import "./ProjectCard.css";
import useMelodyPlayer from "../Canvas/hooks/useMelodyPlayer";
import { useAudioExporter } from "../Canvas/hooks/useAudioExporter";

// ─── Карточка «Создать новый проект» ─────────────────────────────────────────
export const CreateCard = ({ onClick }) => (
  <div className="project-card project-card--create" onClick={onClick}>
    <div className="project-card-create-inner">
      <img src={PlusIcon} alt="Создать" className="project-card-plus icon" />
      <span className="project-card-create-label">
        Создать новый
        <br />
        проект
      </span>
    </div>
  </div>
);

// ─── Превью холста ────────────────────────────────────────────────────────────
const CanvasPreview = ({ bgColor, segments, origW = 750, origH = 600 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = bgColor ?? "#0B0B1F";
    ctx.fillRect(0, 0, W, H);

    if (!segments?.length) return;

    segments.forEach((seg) => {
      const pts = seg.points;
      if (!pts || pts.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = seg.color ?? "#ffffff";
      ctx.lineWidth = seg.lineWidth ?? 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(pts[0].x * W, pts[0].y * H);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * W, pts[i].y * H);
      }
      ctx.stroke();
    });
  }, [bgColor, segments, origW, origH]);

  return (
    <canvas
      ref={canvasRef}
      className="project-card-preview-canvas"
      width={472}
      height={266}
    />
  );
};

// ─── Мини-плеер ──────────────────────────────────────────────────────────────
const MiniPlayer = ({
  events,
  totalDuration,
  projectId,
  playingId,
  onPlay,
  effects = {},
}) => {
  const { isPlaying, currentTime, play, pause, seek, stop } = useMelodyPlayer(
    events,
    totalDuration,
    null,
    effects,
  );

  const trackRef = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (playingId !== null && playingId !== projectId && isPlaying) {
      stop();
    }
  }, [playingId, projectId, isPlaying, stop]);

  useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingRef.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      seek(ratio * totalDuration);
    };
    const onUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [seek, totalDuration]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (isPlaying) {
      pause();
    } else {
      onPlay(projectId);
      await play();
    }
  };

  const handleTrackMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    seek(ratio * totalDuration);
  };

  const handleTrackClick = (e) => {
    e.stopPropagation();
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    seek(ratio * totalDuration);
  };

  const pct =
    totalDuration > 0 ? Math.min((currentTime / totalDuration) * 100, 100) : 0;
  const fmt = (sec) => {
    const s = Math.round(Math.max(0, sec));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="mini-player" onClick={(e) => e.stopPropagation()}>
      <img
        src={isPlaying ? PauseIcon : PlayIcon}
        alt={isPlaying ? "Пауза" : "Play"}
        className="icon mini-player-btn"
        onClick={toggle}
      />
      <div
        ref={trackRef}
        className="mini-player-track"
        onClick={handleTrackClick}
        onMouseDown={handleTrackMouseDown}
      >
        <div className="mini-player-fill" style={{ width: `${pct}%` }} />
        <div className="mini-player-thumb" style={{ left: `${pct}%` }} />
      </div>
      <span className="mini-player-time">{fmt(currentTime)}</span>
    </div>
  );
};

// ─── Карточка проекта ─────────────────────────────────────────────────────────
const ProjectCard = ({
  project,
  onDelete,
  onToggleFavorite,
  playingId,
  onPlay,
}) => {
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({});

  const openModal = (config) => {
    setModalConfig(config);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    modalConfig.onClose?.();
  };

  const effects = {
    reverb: project.settings?.reverb ?? 0,
    delay: project.settings?.delay ?? 0,
    distortion: project.settings?.distortion ?? 0,
  };

  const canvas = project.canvas;
  const melodyFull = project.melody;
  const totalDur = melodyFull?.total_duration ?? 60;
  const hasEvents = Boolean(melodyFull?.events?.length);

  // Экспорт аудио (WAV) — для кнопки скачать
  const { exportToWAV } = useAudioExporter(melodyFull?.events ?? [], totalDur);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const handleOpen = () => navigate(`/canvas?project=${project.id}`);

  // ── Избранное ──────────────────────────────────────────────────────────────
  const handleStar = async (e) => {
    e.stopPropagation();
    // Оптимистичное обновление в родителе
    onToggleFavorite?.(project.id);
    try {
      await api.patch(`/api/projects/${project.id}/favorite`);
    } catch (err) {
      // Откат при ошибке
      onToggleFavorite?.(project.id);
      openModal({
        title: "Ошибка",
        description: "Не удалось обновить избранное. Попробуйте ещё раз.",
        variant: "error",
        primaryText: "ОК",
      });
    }
  };

  // ── Удаление ───────────────────────────────────────────────────────────────
  const handleDelete = (e) => {
    e.stopPropagation();
    openModal({
      title: "Удалить проект",
      description: `Вы уверены, что хотите удалить проект «${project.title}»? Это действие необратимо.`,
      variant: "warning",
      primaryText: "Удалить",
      cancelText: "Отмена",
      onPrimary: async () => {
        setModalOpen(false);
        try {
          await api.delete(`/api/projects/${project.id}`);
          onDelete(project.id);
        } catch (err) {
          openModal({
            title: "Ошибка",
            description: "Не удалось удалить проект. Попробуйте ещё раз.",
            variant: "error",
            primaryText: "ОК",
          });
        }
      },
      onCancel: () => setModalOpen(false),
    });
  };

  // ── Скачать ────────────────────────────────────────────────────────────────
  const handleDownloadImage = (e) => {
    e.stopPropagation();
    // Рисуем превью на offscreen canvas и скачиваем
    const offscreen = document.createElement("canvas");
    offscreen.width = canvas?.width ?? 750;
    offscreen.height = canvas?.height ?? 600;
    const ctx = offscreen.getContext("2d");
    ctx.fillStyle = canvas?.bg_color ?? "#0B0B1F";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    const segs = canvas?.segments ?? [];
    segs.forEach((seg) => {
      const pts = seg.points;
      if (!pts || pts.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = seg.color ?? "#ffffff";
      ctx.lineWidth = seg.lineWidth ?? 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(pts[0].x * offscreen.width, pts[0].y * offscreen.height);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * offscreen.width, pts[i].y * offscreen.height);
      }
      ctx.stroke();
    });
    const link = document.createElement("a");
    link.download = `${project.title || "drawing"}.png`;
    link.href = offscreen.toDataURL("image/png");
    link.click();
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!hasEvents) {
      // Нет мелодии — сразу скачиваем картинку
      handleDownloadImage(e);
      return;
    }
    // Есть мелодия — предлагаем выбор
    openModal({
      title: "Скачать",
      description: "Выберите формат для скачивания",
      variant: "warning",
      primaryText: "Мелодия (WAV)",
      cancelText: "Картинка (PNG)",
      onPrimary: () => {
        setModalOpen(false);
        exportToWAV(
          `${project.title || "melody"}_${new Date().toISOString().slice(0, 10)}.wav`,
        );
      },
      onCancel: (e2) => {
        setModalOpen(false);
        handleDownloadImage(e);
      },
    });
  };

  return (
    <div className="project-card" onClick={handleOpen}>
      <h3 className="project-card-title">{project.title}</h3>

      <div className="project-card-actions">
        <img
          src={project.is_favorite ? StarSelectedIcon : StarIcon}
          alt="Избранное"
          className="icon"
          onClick={handleStar}
        />
        <img
          src={DownloadIcon}
          alt="Скачать"
          className="icon"
          onClick={handleDownload}
        />
        <img
          src={TrashIcon}
          alt="Удалить"
          className="icon"
          onClick={handleDelete}
        />
      </div>

      <div className="project-card-preview">
        <CanvasPreview
          key={`${project.id}-${canvas?.segments?.length ?? 0}`}
          bgColor={canvas?.bg_color}
          segments={canvas?.segments}
          origW={canvas?.width ?? 750}
          origH={canvas?.height ?? 600}
        />

        {(hasEvents || project.melody) && (
          <div
            className="project-card-player"
            onClick={(e) => e.stopPropagation()}
          >
            {hasEvents ? (
              <MiniPlayer
                events={melodyFull.events}
                totalDuration={totalDur}
                projectId={project.id}
                playingId={playingId}
                onPlay={onPlay}
                effects={effects}
              />
            ) : (
              <div className="mini-player mini-player--loading">
                <img
                  src={PlayIcon}
                  alt="Play"
                  className="icon mini-player-btn"
                  style={{ opacity: 0.4 }}
                />
                <div className="mini-player-track">
                  <div className="mini-player-fill" style={{ width: "0%" }} />
                </div>
                <span className="mini-player-time">
                  {String(Math.floor(totalDur / 60)).padStart(2, "0")}:
                  {String(totalDur % 60).padStart(2, "0")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="project-card-dates">
        <div className="project-card-date-row">
          <span className="project-card-date-label">Дата изменения:</span>
          <span className="project-card-date-value">
            {formatDate(project.updated_at)}
          </span>
        </div>
        <div className="project-card-date-row">
          <span className="project-card-date-label">Дата создания:</span>
          <span className="project-card-date-value">
            {formatDate(project.created_at)}
          </span>
        </div>
      </div>

      {/* Локальная модалка карточки (удаление, скачивание, ошибки) */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalConfig.title}
        description={modalConfig.description}
        variant={modalConfig.variant || "default"}
        primaryText={modalConfig.primaryText || "ОК"}
        cancelText={modalConfig.cancelText}
        onPrimary={() => {
          setModalOpen(false);
          modalConfig.onPrimary?.();
        }}
        onCancel={() => {
          setModalOpen(false);
          modalConfig.onCancel?.();
        }}
      />
    </div>
  );
};

export default ProjectCard;
