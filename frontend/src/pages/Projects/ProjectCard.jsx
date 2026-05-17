import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Tone from 'tone';
import api from '../../api';
import PlusIcon         from '../../assets/projects/plus.svg';
import StarIcon         from '../../assets/icons/icon-star.svg';
import StarSelectedIcon from '../../assets/icons/icon-star-selected.svg';
import DownloadIcon     from '../../assets/icons/icon-download.svg';
import TrashIcon        from '../../assets/icons/icon-trash.svg';
import PlayIcon         from '../../assets/icons/icon-play.svg';
import PauseIcon        from '../../assets/icons/icon-pause.svg';
import './ProjectCard.css';
import useMelodyPlayer from '../Canvas/hooks/useMelodyPlayer'; 

// ─── Карточка «Создать новый проект» ─────────────────────────────────────────
export const CreateCard = ({ onClick }) => (
    <div className="project-card project-card--create" onClick={onClick}>
        <div className="project-card-create-inner">
            <img src={PlusIcon} alt="Создать" className="project-card-plus icon" />
            <span className="project-card-create-label">Создать новый<br />проект</span>
        </div>
    </div>
);

// ─── Превью холста ────────────────────────────────────────────────────────────
const CanvasPreview = ({ bgColor, segments, origW = 750, origH = 600 }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        ctx.fillStyle = bgColor ?? '#0B0B1F';
        ctx.fillRect(0, 0, W, H);

        if (!segments?.length) return;

        segments.forEach(seg => {
            const pts = seg.points;
            if (!pts || pts.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = seg.color ?? '#ffffff';
            ctx.lineWidth   = seg.lineWidth ?? 4;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
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

// ─── Мини-плеер (принимает эффекты) ──────────────────────────────────────────
const MiniPlayer = ({ events, totalDuration, projectId, playingId, onPlay, effects = {} }) => {
    const { isPlaying, currentTime, play, pause, seek, stop } = useMelodyPlayer(
        events, totalDuration, null, effects
    );

    useEffect(() => {
        if (playingId !== null && playingId !== projectId && isPlaying) {
            stop();
        }
    }, [playingId, projectId, isPlaying, stop]);

    const toggle = async (e) => {
        e.stopPropagation();
        if (isPlaying) {
            pause();
        } else {
            onPlay(projectId);
            await play();
        }
    };

    const handleTrackClick = (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        seek(ratio * totalDuration);
    };

    const pct = totalDuration > 0 ? Math.min((currentTime / totalDuration) * 100, 100) : 0;
    const fmt = (sec) => {
        const s = Math.round(Math.max(0, sec));
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };

    return (
        <div className="mini-player" onClick={e => e.stopPropagation()}>
            <img
                src={isPlaying ? PauseIcon : PlayIcon}
                alt={isPlaying ? 'Пауза' : 'Play'}
                className="icon mini-player-btn"
                onClick={toggle}
            />
            <div className="mini-player-track" onClick={handleTrackClick}>
                <div className="mini-player-fill" style={{ width: `${pct}%` }} />
                <div className="mini-player-thumb" style={{ left: `${pct}%` }} />
            </div>
            <span className="mini-player-time">{fmt(currentTime)}</span>
        </div>
    );
};

// ─── Карточка проекта ─────────────────────────────────────────────────────────
const ProjectCard = ({ project, onDelete, onToggleFavorite, playingId, onPlay }) => {
    const navigate = useNavigate();

    // Эффекты из сохранённых настроек
const effects = {
    reverb:     project.settings?.reverb ?? 0,
    delay:      project.settings?.delay ?? 0,
    distortion: project.settings?.distortion ?? 0,
};
    console.log('[ProjectCard] project.settings:', project.settings);
console.log('[ProjectCard] project.melody:', project.melody);
console.log('[ProjectCard] effects from project.settings:', effects);
//     const effects = {
//     reverb: 1,      // максимальная реверберация
//     delay:  1,      // максимальная задержка
//     distortion: 1,  // максимальные искажения
// };

    const canvas     = project.canvas;
    const melodyFull = project.melody;
    const totalDur   = melodyFull?.total_duration ?? project.melody?.total_duration ?? 60;
    const hasEvents  = Boolean(melodyFull?.events?.length);

    const formatDate = (dateStr) =>
        new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });

    const handleOpen     = ()  => navigate(`/canvas?project=${project.id}`);
    const handleDelete   = (e) => {
        e.stopPropagation();
        if (!window.confirm(`Удалить проект «${project.title}»?`)) return;
        onDelete(project.id);
    };
    const handleDownload = (e) => e.stopPropagation();
    const handleStar     = (e) => { e.stopPropagation(); onToggleFavorite?.(project.id); };

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
                <img src={DownloadIcon} alt="Скачать" className="icon" onClick={handleDownload} />
                <img src={TrashIcon}    alt="Удалить" className="icon" onClick={handleDelete} />
            </div>

            <div className="project-card-preview">
                <CanvasPreview
                    key={`${project.id}-${canvas?.segments?.length ?? 0}`}
                    bgColor={canvas?.bg_color}
                    segments={canvas?.segments}
                    origW={canvas?.width  ?? 750}
                    origH={canvas?.height ?? 600}
                />

                {(hasEvents || project.melody) && (
                    <div className="project-card-player" onClick={e => e.stopPropagation()}>
                        {hasEvents ? (
                            <MiniPlayer
                                events={melodyFull.events}
                                totalDuration={totalDur}
                                projectId={project.id}
                                playingId={playingId}
                                onPlay={onPlay}
                                effects={effects}   // ← эффекты переданы
                            />
                        ) : (
                            <div className="mini-player mini-player--loading">
                                <img src={PlayIcon} alt="Play" className="icon mini-player-btn" style={{ opacity: 0.4 }} />
                                <div className="mini-player-track">
                                    <div className="mini-player-fill" style={{ width: '0%' }} />
                                </div>
                                <span className="mini-player-time">
                                    {String(Math.floor(totalDur / 60)).padStart(2,'0')}:{String(totalDur % 60).padStart(2,'0')}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="project-card-dates">
                <div className="project-card-date-row">
                    <span className="project-card-date-label">Дата изменения:</span>
                    <span className="project-card-date-value">{formatDate(project.updated_at)}</span>
                </div>
                <div className="project-card-date-row">
                    <span className="project-card-date-label">Дата создания:</span>
                    <span className="project-card-date-value">{formatDate(project.created_at)}</span>
                </div>
            </div>
        </div>
    );
};

export default ProjectCard;