// Projects.jsx — с пагинацией и адаптивной сеткой
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BgProjectsLine from '../../assets/backgrounds/bg-projects-line.png';
import SortIcon from '../../assets/icons/icon-sort.svg';
import CloseIcon from '../../assets/icons/icon-close.svg';
import LeftChevron from '../../assets/icons/icon-chevron-left.svg';
import RightChevron from '../../assets/icons/icon-chevron-right.svg';
import SearchPanel from './SearchPanel';
import ProjectCard, { CreateCard } from './ProjectCard';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import api from '../../api';
import './Projects.css';

// ─── Хук: сколько колонок сейчас помещается ──────────────────────────────────
const CARD_WIDTH = 590;
const CARD_GAP   = 56;

function useColCount(gridRef) {
    const [cols, setCols] = useState(2);

    useEffect(() => {
        const calc = () => {
            if (!gridRef.current) return;
            const w = gridRef.current.offsetWidth;
            const n = Math.floor((w + CARD_GAP) / (CARD_WIDTH + CARD_GAP));
            setCols(Math.max(1, n));
        };
        calc();
        const ro = new ResizeObserver(calc);
        if (gridRef.current) ro.observe(gridRef.current);
        return () => ro.disconnect();
    }, [gridRef]);

    return cols;
}

// ─── Главный компонент ────────────────────────────────────────────────────────
const Projects = () => {
    const navigate = useNavigate();
    const gridRef  = useRef(null);
    const cols     = useColCount(gridRef);
    const [playingId, setPlayingId] = useState(null);

    const [projects, setProjects]       = useState([]);
    const [isLoading, setIsLoading]     = useState(true);
    const [error, setError]             = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSortOpen, setIsSortOpen]   = useState(false);
    const [sortField, setSortField]     = useState('updated_at');
    const [sortDir, setSortDir]         = useState('desc');
    const [page, setPage]               = useState(1);

    // Загрузка
    useEffect(() => {
        const load = async () => {
            setIsLoading(true); setError(null);
            try {
                const data = await api.get('/api/projects');
                setProjects(data);
            } catch (err) {
                setError(err.message || 'Не удалось загрузить проекты');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    // Сброс страницы при поиске или смене колонок
    useEffect(() => { setPage(1); }, [searchQuery, cols]);

    // ── Удаление — с коррекцией страницы ──────────────────────────────────────
    const handleDelete = (id) => {
        setProjects(prev => {
            const next = prev.filter(p => p.id !== id);

            // Пересчитываем максимальную страницу после удаления
            // (используем текущие значения cols, searchQuery, sortField, sortDir)
            const filtered = next
                .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));

            const perPageFirst = cols * 2 - 1;
            const perPageOther = cols * 2;
            const newTotalPages = filtered.length === 0
                ? 1
                : 1 + Math.ceil(Math.max(0, filtered.length - perPageFirst) / perPageOther);

            // Если текущая страница вышла за пределы — перекидываем на последнюю
            setPage(p => Math.min(p, newTotalPages));

            return next;
        });
    };

    const handleToggleFavorite = (id) =>
        setProjects(prev =>
            prev.map(p => p.id === id ? { ...p, is_favorite: !p.is_favorite } : p)
        );

    // Фильтрация + сортировка
    const filtered = projects
        .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            let va = a[sortField] ?? '', vb = b[sortField] ?? '';
            if (sortField === 'title') {
                va = va.toLowerCase(); vb = vb.toLowerCase();
                return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            return sortDir === 'asc'
                ? new Date(va) - new Date(vb)
                : new Date(vb) - new Date(va);
        });

    /*
     * Пагинация: 2 ряда по cols карточек.
     * Страница 1: первый слот — CreateCard, остальных (cols*2 - 1) проектов.
     * Страница N (N>1): cols*2 проектов.
     */
    const ROWS         = 2;
    const perPageFirst = cols * ROWS - 1;
    const perPageOther = cols * ROWS;

    const totalPages = filtered.length === 0
        ? 1
        : 1 + Math.ceil(Math.max(0, filtered.length - perPageFirst) / perPageOther);

    // Защита от устаревшей страницы (на случай если totalPages уменьшился)
    const safePage = Math.min(page, totalPages);

    const getPageProjects = () => {
        if (safePage === 1) return filtered.slice(0, perPageFirst);
        const offset = perPageFirst + (safePage - 2) * perPageOther;
        return filtered.slice(offset, offset + perPageOther);
    };

    const pageProjects = getPageProjects();

    const applySort = () => setIsSortOpen(false);
    const resetSort = () => { setSortField('updated_at'); setSortDir('desc'); setIsSortOpen(false); };

    const canGoPrev = safePage > 1;
    const canGoNext = safePage < totalPages;

    return (
        <div className="projects-content">
            <div className="projects-bg-line">
                <img src={BgProjectsLine} alt="фоновая линия" />
            </div>

            {/* ── Заголовок ── */}
            <div className="projects-header">
                <div className="projects-header-text">
                    <h2>БИБЛИОТЕКА ПРОЕКТОВ</h2>
                    <div className="icon sort-btn" onClick={() => setIsSortOpen(!isSortOpen)}>
                        <img src={SortIcon} alt="Сортировка" />
                    </div>
                </div>
                <div className="divider" />
            </div>

            {/* ── Сортировка ── */}
            {isSortOpen && (
                <div className="sort-overlay" onClick={() => setIsSortOpen(false)}>
                    <div className="sort-modal" onClick={e => e.stopPropagation()}>
                        <div className="sort-header">
                            <div className="sort-header-text">
                                <h2>Сортировка</h2>
                                <div className="icon close-btn" onClick={() => setIsSortOpen(false)}>
                                    <img src={CloseIcon} alt="Закрыть" />
                                </div>
                            </div>
                            <div className="divider" />
                        </div>
                        <div className="sort-content">
                            <div className="sort-field">
                                <p>по полю:</p>
                                {[
                                    { value: 'title',      label: 'Название' },
                                    { value: 'created_at', label: 'Дата создания' },
                                    { value: 'updated_at', label: 'Дата изменения' },
                                ].map(opt => (
                                    <div key={opt.value}
                                         className={`option ${sortField === opt.value ? 'active' : ''}`}
                                         onClick={() => setSortField(opt.value)}>
                                        {opt.label}
                                    </div>
                                ))}
                            </div>
                            <div className="sort-direction">
                                <p>по направлению:</p>
                                {[
                                    { value: 'asc',  label: 'Возрастание' },
                                    { value: 'desc', label: 'Убывание' },
                                ].map(opt => (
                                    <div key={opt.value}
                                         className={`option ${sortDir === opt.value ? 'active' : ''}`}
                                         onClick={() => setSortDir(opt.value)}>
                                        {opt.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <Button variant="negative" onClick={resetSort}>ОТМЕНИТЬ</Button>
                        <Button variant="primary"  onClick={applySort}>ПОДТВЕРДИТЬ</Button>
                    </div>
                </div>
            )}

            {/* ── Поиск ── */}
            <SearchPanel
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Поиск по названию проекта ..."
            />

            {/* ── Карточки ── */}
            <div className="project-cards-content">
                {isLoading && (
                    <div className="projects-loader">
                        <Loader size={70} color="violet" speed={1400} />
                    </div>
                )}
                {error && <p className="projects-error">{error}</p>}

                {!isLoading && !error && (
                    <div
                        className="project-cards-grid"
                        ref={gridRef}
                        style={{ '--cols': cols, '--card-gap': `${CARD_GAP}px` }}
                    >
                        {safePage === 1 && (
                            <CreateCard onClick={() => navigate('/canvas')} />
                        )}

                        {pageProjects.length === 0 && safePage === 1 && (
                            <p className="projects-empty">
                                {searchQuery ? 'Ничего не найдено' : 'У вас пока нет проектов'}
                            </p>
                        )}

                        {pageProjects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onDelete={handleDelete}
                                onToggleFavorite={handleToggleFavorite}
                                playingId={playingId}
                                onPlay={setPlayingId}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Пагинация: шевроны всегда видны, disabled когда некуда листать ── */}
            {!isLoading && !error && totalPages > 1 && (
                <div className="projects-pagination">
                    <div className={`icon ${canGoPrev ? '' : ' disabled'}`}
                        onClick={canGoPrev ? () => setPage(p => p - 1) : undefined}>
                        <img src={LeftChevron} alt="Назад" />
                    </div>

                    <div className="pagination-badge">
                        <span className="pagination-current">{safePage}</span>
                        <span className="pagination-sep">/</span>
                        <span className="pagination-total">{totalPages}</span>
                    </div>

                    <div className={`icon ${canGoNext ? '' : ' disabled'}`}
                        onClick={canGoNext ? () => setPage(p => p + 1) : undefined}>
                        <img src={RightChevron} alt="Вперёд" />
                    </div>

                </div>
            )}
        </div>
    );
};

export default Projects;