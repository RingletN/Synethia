// Projects.jsx — с пагинацией и адаптивной сеткой
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import BgProjectsLine from "../../assets/backgrounds/bg-projects-line.png";
import SortIcon from "../../assets/icons/icon-sort.svg";
import StarIcon from "../../assets/icons/icon-star.svg";
import CloseIcon from "../../assets/icons/icon-close.svg";
import LeftChevron from "../../assets/icons/icon-chevron-left.svg";
import RightChevron from "../../assets/icons/icon-chevron-right.svg";
import SearchPanel from "./SearchPanel";
import ProjectCard, { CreateCard } from "./ProjectCard";
import Button from "../../components/ui/Button/Button";
import Loader from "../../components/ui/Loader";
import api from "../../api";
import "./Projects.css";
import { useAuth } from "../../context/AuthContext";

// ─── Хук: сколько колонок сейчас помещается ──────────────────────────────────
const CARD_WIDTH = 590;
const CARD_GAP = 56;

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
  const gridRef = useRef(null);
  const cols = useColCount(gridRef);
  const [playingId, setPlayingId] = useState(null);

  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSortOpen, setIsSortOpen] = useState(false);

  // ── Реальные значения сортировки (применяются к данным) ──────────────────
  const [sortField, setSortField] = useState("updated_at");
  const [sortDir, setSortDir] = useState("desc");

  // ── Временные значения (только внутри модалки, до подтверждения) ─────────
  const [tempField, setTempField] = useState("updated_at");
  const [tempDir, setTempDir] = useState("desc");

  // ── Фильтр избранного (реальные значения) ────────────────────────────────
  // 'favorites_first' | 'only_favorites' | 'hide_favorites'
  const [favFilter, setFavFilter] = useState("favorites_first");
  const [tempFavFilter, setTempFavFilter] = useState("favorites_first");
  const [isFavOpen, setIsFavOpen] = useState(false);

  // committedFavorites — «снимок» id избранных на момент применения фильтра.
  // Список не перестраивается при ручном тыке на звёздочку — только при
  // смене страницы / поиска / повторном подтверждении фильтра.
  const [committedFavorites, setCommittedFavorites] = useState(null); // null = не инициализировано

  const [page, setPage] = useState(1);
  const { user, loading: authLoading } = useAuth();

  // Загрузка
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.get("/api/projects");
        setProjects(data);
        setCommittedFavorites(
          new Set(data.filter((p) => p.is_favorite).map((p) => p.id)),
        );
      } catch (err) {
        setError(err.message || "Не удалось загрузить проекты");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user, authLoading]);

  // Сброс страницы при поиске или смене колонок + коммит снимка избранных
  useEffect(() => {
    setPage(1);
    setCommittedFavorites(
      new Set(projects.filter((p) => p.is_favorite).map((p) => p.id)),
    );
  }, [searchQuery, cols]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Открытие модалки — синхронизируем temp с реальными ───────────────────
  const openSort = () => {
    setTempField(sortField);
    setTempDir(sortDir);
    setIsSortOpen(true);
  };

  // ── Подтвердить — применяем temp к реальным ──────────────────────────────
  const applySort = () => {
    setSortField(tempField);
    setSortDir(tempDir);
    setIsSortOpen(false);
  };

  // ── Отменить — сбрасываем к дефолту ──────────────────────────────────────
  const resetSort = () => {
    setSortField("updated_at");
    setSortDir("desc");
    setTempField("updated_at");
    setTempDir("desc");
    setIsSortOpen(false);
  };

  // ── Закрыть без изменений (крестик / клик вне) ───────────────────────────
  const closeSort = () => {
    setIsSortOpen(false);
  };

  // ── Избранное: открыть / подтвердить / отменить / закрыть ────────────────
  const openFav = () => {
    setTempFavFilter(favFilter);
    setIsFavOpen(true);
  };

  const applyFav = () => {
    setFavFilter(tempFavFilter);
    // Коммитим снимок избранных в момент подтверждения
    setCommittedFavorites(
      new Set(projects.filter((p) => p.is_favorite).map((p) => p.id)),
    );
    setPage(1);
    setIsFavOpen(false);
  };

  const resetFav = () => {
    setFavFilter("favorites_first");
    setTempFavFilter("favorites_first");
    setCommittedFavorites(
      new Set(projects.filter((p) => p.is_favorite).map((p) => p.id)),
    );
    setPage(1);
    setIsFavOpen(false);
  };

  const closeFav = () => setIsFavOpen(false);

  // ── Удаление — с коррекцией страницы ──────────────────────────────────────
  const handleDelete = (id) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const committed = committedFavorites ?? new Set();

      const afterSearch = next.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      const afterFav = applyFavFilter(afterSearch, favFilter, committed);

      const perPageFirst = cols * 2 - 1;
      const perPageOther = cols * 2;
      const newTotalPages =
        afterFav.length === 0
          ? 1
          : 1 +
            Math.ceil(
              Math.max(0, afterFav.length - perPageFirst) / perPageOther,
            );

      setPage((p) => Math.min(p, newTotalPages));
      return next;
    });
  };

  const handleToggleFavorite = (id) =>
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, is_favorite: !p.is_favorite } : p,
      ),
    );

  // ── Вспомогательная функция фильтрации по избранному ─────────────────────
  // Использует committedFavorites-снимок, чтобы список не дёргался при
  // ручном тыке на звёздочку.
  const applyFavFilter = (list, filter, committed) => {
    if (!committed || filter === "all") return list;
    if (filter === "only_favorites")
      return list.filter((p) => committed.has(p.id));
    if (filter === "hide_favorites")
      return list.filter((p) => !committed.has(p.id));
    if (filter === "favorites_first")
      return [
        ...list.filter((p) => committed.has(p.id)),
        ...list.filter((p) => !committed.has(p.id)),
      ];
    return list;
  };

  // Фильтрация + сортировка (по реальным значениям)
  const committed = committedFavorites ?? new Set();

  const afterSearch = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const sorted = [...afterSearch].sort((a, b) => {
    let va = a[sortField] ?? "",
      vb = b[sortField] ?? "";
    if (sortField === "title") {
      va = va.toLowerCase();
      vb = vb.toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === "asc"
      ? new Date(va) - new Date(vb)
      : new Date(vb) - new Date(va);
  });

  const filtered = applyFavFilter(sorted, favFilter, committed);

  /*
   * Пагинация: 2 ряда по cols карточек.
   * Страница 1: первый слот — CreateCard, остальных (cols*2 - 1) проектов.
   * Страница N (N>1): cols*2 проектов.
   */
  const ROWS = 2;
  const perPageFirst = cols * ROWS - 1;
  const perPageOther = cols * ROWS;

  const totalPages =
    filtered.length === 0
      ? 1
      : 1 +
        Math.ceil(Math.max(0, filtered.length - perPageFirst) / perPageOther);

  const safePage = Math.min(page, totalPages);

  const getPageProjects = () => {
    if (safePage === 1) return filtered.slice(0, perPageFirst);
    const offset = perPageFirst + (safePage - 2) * perPageOther;
    return filtered.slice(offset, offset + perPageOther);
  };

  const pageProjects = getPageProjects();

  const canGoPrev = safePage > 1;
  const canGoNext = safePage < totalPages;

  if (!authLoading && !user) {
    return (
      <div className="projects-content">
        <div className="projects-bg-line">
          <img src={BgProjectsLine} alt="фоновая линия" />
        </div>

        <div className="projects-header">
          <div className="projects-header-text">
            <h2>БИБЛИОТЕКА ПРОЕКТОВ</h2>
          </div>
          <div className="divider" />
        </div>

        <div className="projects-unauthenticated">
          <p className="projects-unauthenticated-text">
            Авторизируйтесь, чтобы хранить историю проектов
          </p>
          <Button variant="primary" onClick={() => navigate("/auth")}>
            ВХОД / РЕГИСТРАЦИЯ
          </Button>
        </div>

        <div
          className="project-cards-grid"
          style={{ "--cols": 1, "--card-gap": "56px" }}
        >
          <CreateCard onClick={() => navigate("/canvas")} />
        </div>
      </div>
    );
  }

  return (
    <div className="projects-content">
      <div className="projects-bg-line">
        <img src={BgProjectsLine} alt="фоновая линия" />
      </div>

      {/* ── Заголовок ── */}
      <div className="projects-header">
        <div className="projects-header-text">
          <h2>БИБЛИОТЕКА ПРОЕКТОВ</h2>
          <div className="canvas-header-icons">
            <div className="icon fav-btn" onClick={openFav}>
              <img src={StarIcon} alt="Избранное" />
            </div>
            <div className="icon sort-btn" onClick={openSort}>
              <img src={SortIcon} alt="Сортировка" />
            </div>
          </div>
        </div>
        <div className="divider" />
      </div>

      {/* ── Модалка избранного ── */}
      {isFavOpen && (
        <div className="sort-overlay" onClick={closeFav}>
          <div
            className="sort-modal sort-modal--fav"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sort-header">
              <div className="sort-header-text">
                <h2>Избранное</h2>
                <div className="icon close-btn" onClick={closeFav}>
                  <img src={CloseIcon} alt="Закрыть" />
                </div>
              </div>
              <div className="divider" />
            </div>
            <div className="sort-content">
              <div className="sort-field">
                {[
                  { value: "favorites_first", label: "Закреплять избранное" },
                  { value: "only_favorites", label: "Только избранное" },
                  { value: "hide_favorites", label: "Скрыть избранное" },
                ].map((opt) => (
                  <div
                    key={opt.value}
                    className={`option ${tempFavFilter === opt.value ? "active" : ""}`}
                    onClick={() => setTempFavFilter(opt.value)}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="sort-buttons">
              <Button variant="negative" onClick={resetFav}>
                ОТМЕНИТЬ
              </Button>
              <Button variant="primary" onClick={applyFav}>
                ПОДТВЕРДИТЬ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Сортировка ── */}
      {isSortOpen && (
        <div className="sort-overlay" onClick={closeSort}>
          <div className="sort-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sort-header">
              <div className="sort-header-text">
                <h2>Сортировка</h2>
                <div className="icon close-btn" onClick={closeSort}>
                  <img src={CloseIcon} alt="Закрыть" />
                </div>
              </div>
              <div className="divider" />
            </div>
            <div className="sort-content">
              <div className="sort-field">
                <p>по полю:</p>
                {[
                  { value: "title", label: "Название" },
                  { value: "created_at", label: "Дата создания" },
                  { value: "updated_at", label: "Дата изменения" },
                ].map((opt) => (
                  <div
                    key={opt.value}
                    className={`option ${tempField === opt.value ? "active" : ""}`}
                    onClick={() => setTempField(opt.value)}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
              <div className="sort-direction">
                <p>по направлению:</p>
                {[
                  { value: "asc", label: "Возрастание" },
                  { value: "desc", label: "Убывание" },
                ].map((opt) => (
                  <div
                    key={opt.value}
                    className={`option ${tempDir === opt.value ? "active" : ""}`}
                    onClick={() => setTempDir(opt.value)}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="sort-buttons">
              <Button variant="negative" onClick={resetSort}>
                ОТМЕНИТЬ
              </Button>
              <Button variant="primary" onClick={applySort}>
                ПОДТВЕРДИТЬ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Поиск ── */}
      <SearchPanel
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onClear={() => setSearchQuery("")}
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
            style={{ "--cols": cols, "--card-gap": `${CARD_GAP}px` }}
          >
            {safePage === 1 && (
              <CreateCard onClick={() => navigate("/canvas")} />
            )}

            {pageProjects.length === 0 && safePage === 1 && (
              <p className="projects-empty">
                {searchQuery ? "Ничего не найдено" : "У вас пока нет проектов"}
              </p>
            )}

            {pageProjects.map((project) => (
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
          <div
            className={`icon ${canGoPrev ? "" : "disabled"}`}
            onClick={canGoPrev ? () => setPage((p) => p - 1) : undefined}
          >
            <img src={LeftChevron} alt="Назад" />
          </div>

          <div className="pagination-badge">
            <span className="pagination-current">{safePage}</span>
            <span className="pagination-sep">/</span>
            <span className="pagination-total">{totalPages}</span>
          </div>

          <div
            className={`icon ${canGoNext ? "" : "disabled"}`}
            onClick={canGoNext ? () => setPage((p) => p + 1) : undefined}
          >
            <img src={RightChevron} alt="Вперёд" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
