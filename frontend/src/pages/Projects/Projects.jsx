import React, { useState } from 'react';
// import BgProjectsLine from '../../assets/backgrounds/bg-projects-line.png';
import SortIcon from '../../assets/icons/icon-sort.svg'
import CloseIcon from '../../assets/icons/icon-close.svg';
import SearchPanel from './SearchPanel';
import Button from '../../components/ui/Button'
import './Projects.css'

const Projects = () => {
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
    };

    const [isSortOpen, setIsSortOpen] = useState(false);
    const toggleSort = () => setIsSortOpen(!isSortOpen);
    const closeSort = () => setIsSortOpen(false);

    return (
        <div className="projects-content">
            {/* <div className="projects-bg-line">
                <img src={BgProjectsLine} alt="фоновая линия" />
            </div> */}

            <div className="projects-header">
                <div className="projects-header-text">
                    <h2>БИБЛИОТЕКА ПРОЕКТОВ</h2>
                    {/* <div className="sort-btn" onClick={closeMenu}> */}
                    <div className="sort-btn" onClick={toggleSort}>
                        <img src={SortIcon} alt="Сортировка" />
                    </div>
                </div>
                <div className="divider" />
            </div>

            {/* модальное окно сортировки */}
            {isSortOpen && (
                <div className="sort-overlay" onClick={closeSort}>
                    <div 
                        className="sort-modal" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="sort-header">
                            <div className="sort-header-text">
                                <h2>Сортировка</h2>
                                <div className="close-btn" onClick={closeSort}>
                                    <img src={CloseIcon} alt="Закрыть" />
                                </div>
                            </div>
                            <div className="divider" />
                        </div>
                        <div className="sort-content">
                            <div className="sort-field">
                                <p>по полю:</p>
                                <div className="option">Название</div>
                                 <div className="option">Дата создания</div>
                                 <div className="option">Дата изменения</div>
                            </div>
                            <div className="sort-direction">
                                <p>по направлению:</p>
                                <div className="option">Возрастание</div>
                                 <div className="option">Убывание</div>
                            </div>
                        </div>
                        <Button variant="negative">ОТМЕНИТЬ</Button>
                        <Button variant="primary">ПОДТВЕРДИТЬ</Button>
                    </div>
                </div>
            )}

            <SearchPanel
                value={searchQuery}
                onChange={handleSearchChange}
                onClear={handleClearSearch}
                placeholder="Поиск по названию проекта ..."
            />

            <div className="search-result-block">
                {searchQuery && <p>Результаты поиска: ...</p>}
            </div>

            {/* {projectsLoading ? (
            <div className="projects-loader">
                <Loader size={70} color="violet" speed={1400} />
            </div>
            ) : ( */}
            <div className="project-cards-content">
                <div className="slider">
                    {/* Здесь рендерятся проекты, отфильтрованные через searchQuery */}
                </div>
            </div>
            {/* )} */}

        </div>
    );
};

export default Projects;