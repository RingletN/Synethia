// Projects.jsx — обновлённая версия с загрузкой реальных проектов
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BgProjectsLine from '../../assets/backgrounds/bg-projects-line.png';
import SortIcon from '../../assets/icons/icon-sort.svg';
import CloseIcon from '../../assets/icons/icon-close.svg';
import SearchPanel from './SearchPanel';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import api from '../../api'; // src/api.js
import './Projects.css';

// ─── Карточка проекта ─────────────────────────────────────────────────────────
const ProjectCard = ({ project, onDelete }) => {
    const navigate = useNavigate();

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
    };

    const handleOpen = () => {
        // Переходим на холст, передаём project_id — Canvas загрузит данные
        navigate(`/canvas?project=${project.id}`);
    };

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (!window.confirm(`Удалить проект «${project.title}»?`)) return;
        try {
            await api.delete(`/api/projects/${project.id}`);
            onDelete(project.id);
        } catch {
            alert('Не удалось удалить проект');
        }
    };

    return (
        <div className="project-card" onClick={handleOpen}>
            {/* Превью холста — цветной блок с размерами */}
            <div
                className="project-card-preview"
                style={{ backgroundColor: project.canvas?.bg_color ?? '#4D4DFF' }}
            >
                <span className="project-card-preview-size">
                    {project.canvas?.width ?? '—'} × {project.canvas?.height ?? '—'}
                </span>
                {project.melody && (
                    <span className="project-card-has-melody">♪</span>
                )}
            </div>

            <div className="project-card-info">
                <h3 className="project-card-title">{project.title}</h3>
                <div className="project-card-meta">
                    {project.settings && (
                        <span>{project.settings.bpm} BPM · {project.settings.scale === 'major' ? 'мажор' : 'минор'}</span>
                    )}
                    <span>{formatDate(project.updated_at)}</span>
                </div>
            </div>

            <button
                className="project-card-delete"
                onClick={handleDelete}
                title="Удалить проект"
            >
                ✕
            </button>
        </div>
    );
};

// ─── Главный компонент ────────────────────────────────────────────────────────
const Projects = () => {
    const [projects, setProjects]     = useState([]);
    const [isLoading, setIsLoading]   = useState(true);
    const [error, setError]           = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [sortField, setSortField]   = useState('updated_at');    // 'title' | 'created_at' | 'updated_at'
    const [sortDir, setSortDir]       = useState('desc');          // 'asc' | 'desc'

    // Загрузка проектов
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            setError(null);
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

    const handleDelete = (deletedId) => {
        setProjects(prev => prev.filter(p => p.id !== deletedId));
    };

    // Фильтрация + сортировка на фронте
    const displayed = projects
        .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            let va = a[sortField] ?? '';
            let vb = b[sortField] ?? '';
            if (sortField === 'title') {
                va = va.toLowerCase(); vb = vb.toLowerCase();
                return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            return sortDir === 'asc'
                ? new Date(va) - new Date(vb)
                : new Date(vb) - new Date(va);
        });

    const applySort = () => setIsSortOpen(false);
    const resetSort = () => { setSortField('updated_at'); setSortDir('desc'); setIsSortOpen(false); };

    return (
        <div className="projects-content">
            <div className="projects-bg-line">
                <img src={BgProjectsLine} alt="фоновая линия" />
            </div>

            <div className="projects-header">
                <div className="projects-header-text">
                    <h2>БИБЛИОТЕКА ПРОЕКТОВ</h2>
                    <div className="sort-btn" onClick={() => setIsSortOpen(!isSortOpen)}>
                        <img src={SortIcon} alt="Сортировка" />
                    </div>
                </div>
                <div className="divider" />
            </div>

            {/* Модальное окно сортировки */}
            {isSortOpen && (
                <div className="sort-overlay" onClick={() => setIsSortOpen(false)}>
                    <div className="sort-modal" onClick={e => e.stopPropagation()}>
                        <div className="sort-header">
                            <div className="sort-header-text">
                                <h2>Сортировка</h2>
                                <div className="close-btn" onClick={() => setIsSortOpen(false)}>
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
                                    <div
                                        key={opt.value}
                                        className={`option ${sortField === opt.value ? 'active' : ''}`}
                                        onClick={() => setSortField(opt.value)}
                                    >
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
                                    <div
                                        key={opt.value}
                                        className={`option ${sortDir === opt.value ? 'active' : ''}`}
                                        onClick={() => setSortDir(opt.value)}
                                    >
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

            <SearchPanel
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
                placeholder="Поиск по названию проекта ..."
            />

            <div className="project-cards-content">
                {isLoading && (
                    <div className="projects-loader">
                        <Loader size={70} color="violet" speed={1400} />
                    </div>
                )}

                {error && (
                    <p className="projects-error">{error}</p>
                )}

                {!isLoading && !error && displayed.length === 0 && (
                    <p className="projects-empty">
                        {searchQuery ? 'Ничего не найдено' : 'У вас пока нет проектов'}
                    </p>
                )}

                <div className="slider">
                    {displayed.map(project => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Projects;