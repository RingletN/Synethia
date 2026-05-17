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
// 590px карточка + 56px gap. Считаем по ширине контейнера.
const CARD_WIDTH = 590;
const CARD_GAP   = 56;

function useColCount(gridRef) {
    const [cols, setCols] = useState(2);

    useEffect(() => {
        const calc = () => {
            if (!gridRef.current) return;
            const w = gridRef.current.offsetWidth;
            // Сколько карточек влезает: (w + gap) / (cardWidth + gap)
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
                console.log('ПРОЕКТЫ:', JSON.stringify(data[0], null, 2));
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

    const handleDelete = (id) =>
        setProjects(prev => prev.filter(p => p.id !== id));

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
    const ROWS           = 2;
    const perPageFirst   = cols * ROWS - 1; // место под CreateCard
    const perPageOther   = cols * ROWS;

    const totalPages = filtered.length === 0
        ? 1
        : 1 + Math.ceil(Math.max(0, filtered.length - perPageFirst) / perPageOther);

    const getPageProjects = () => {
        if (page === 1) return filtered.slice(0, perPageFirst);
        const offset = perPageFirst + (page - 2) * perPageOther;
        return filtered.slice(offset, offset + perPageOther);
    };

    const pageProjects = getPageProjects();

    const applySort = () => setIsSortOpen(false);
    const resetSort = () => { setSortField('updated_at'); setSortDir('desc'); setIsSortOpen(false); };

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
                        {page === 1 && (
                            <CreateCard onClick={() => navigate('/canvas')} />
                        )}

                        {pageProjects.length === 0 && page === 1 && (
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

            {/* ── Пагинация ── */}
            {!isLoading && !error && totalPages > 1 && (
                <div className="projects-pagination">
                    <img
                        src={LeftChevron}
                        alt="Назад"
                        className={`icon pagination-chevron${page === 1 ? ' pagination-chevron--disabled' : ''}`}
                        onClick={() => page > 1 && setPage(p => p - 1)}
                    />
                    <div className="pagination-badge">
                        <span className="pagination-current">{page}</span>
                        <span className="pagination-sep">/</span>
                        <span className="pagination-total">{totalPages}</span>
                    </div>
                    <img
                        src={RightChevron}
                        alt="Вперёд"
                        className={`icon pagination-chevron${page === totalPages ? ' pagination-chevron--disabled' : ''}`}
                        onClick={() => page < totalPages && setPage(p => p + 1)}
                    />
                </div>
            )}
        </div>
    );
};

export default Projects;