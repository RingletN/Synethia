import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Хук предупреждает пользователя о несохранённых изменениях при попытке уйти.
 * Никакого сохранения — только информирование и выбор: уйти или остаться.
 *
 * @param {boolean}  hasChanges  — есть ли несохранённые изменения
 * @param {Function} openModal   — функция открытия модального окна
 */
export const useUnsavedChanges = (hasChanges, openModal) => {
  const navigate = useNavigate();
  const location = useLocation();

  const hasChangesRef = useRef(hasChanges);
  const openModalRef = useRef(openModal);

  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);
  useEffect(() => {
    openModalRef.current = openModal;
  }, [openModal]);

  // ─── 1. Закрытие / обновление вкладки ────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (!hasChangesRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ─── 2. Кнопки «Назад» / «Вперёд» в браузере ────────────────────────────
  useEffect(() => {
    window.history.pushState({ unsavedGuard: true }, "");

    const handler = () => {
      if (!hasChangesRef.current) return;
      window.history.pushState({ unsavedGuard: true }, "");
      showModal(() => window.history.go(-2));
    };

    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 3. Клики по ссылкам ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (!hasChangesRef.current) return;

      const link = e.target.closest("a[href]");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;

      if (href.startsWith("blob:")) return;

      const isExternal = href.startsWith("http") || href.startsWith("//");
      const isAnchor = href.startsWith("#");
      const isJS = href.startsWith("javascript");
      if (isExternal || isAnchor || isJS) return;
      if (href === location.pathname) return;

      e.preventDefault();
      e.stopPropagation();

      showModal(() => navigate(href));
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [location.pathname, navigate]);

  // ─── Модалка ─────────────────────────────────────────────────────────────
  function showModal(onLeave) {
    openModalRef.current({
      title: "Несохранённые изменения",
      description: "Вы не сохранили изменения. Уйти без сохранения?",
      primaryText: "Остаться",
      cancelText: "Всё равно уйти",
      variant: "warning",
      onPrimary: () => {},
      onCancel: onLeave,
      // «Остаться» и крестик — просто закрывают модалку, ничего не делают
    });
  }
};
