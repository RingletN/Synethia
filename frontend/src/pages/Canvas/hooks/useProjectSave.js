import { useState, useCallback } from "react";
import api from "../../../api";

export const useProjectSave = ({
  engineRef,
  bgColor,
  canvasSize,
  bpm,
  duration,
  scale,
  rhythmPattern,
  effectReverb,
  effectDelay,
  effectDistortion,
  melodyEvents,
  totalDuration,
  isMelodyGenerated,
  showModal,
  onSaveSuccess,
  existingProjectNames = [],
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [projectId, setProjectId] = useState(null);
  const [currentTitle, setCurrentTitle] = useState("");
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);

  const _doSave = useCallback(
    async (title, idOverride) => {
      if (!engineRef.current) {
        showModal("Ошибка", "Движок рисования не инициализирован", "error");
        return;
      }

      const segments = engineRef.current.getAllSegments();
      const resolvedId = idOverride !== undefined ? idOverride : projectId;

      const payload = {
        ...(resolvedId ? { project_id: resolvedId } : {}),
        title,
        canvas: {
          segments,
          bg_color: bgColor,
          width: canvasSize.width,
          height: canvasSize.height,
        },
        settings: {
          bpm,
          duration,
          scale,
          rhythm_pattern: rhythmPattern,
          reverb: effectReverb,
          delay: effectDelay,
          distortion: effectDistortion,
        },
        ...(isMelodyGenerated && melodyEvents.length > 0
          ? { melody: { events: melodyEvents, total_duration: totalDuration } }
          : {}),
      };

      setIsSaving(true);
      try {
        const data = await api.post("/api/projects", payload);
        setProjectId(data.project_id);
        setCurrentTitle(title);
        onSaveSuccess?.(); // сбрасываем флаг несохранённых изменений в Canvas
        showModal("Сохранено", "Проект успешно сохранён!", "success");
      } catch (err) {
        showModal(
          "Ошибка сохранения",
          err.message || "Неизвестная ошибка",
          "error",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [
      engineRef,
      bgColor,
      canvasSize,
      bpm,
      duration,
      scale,
      effectReverb,
      effectDelay,
      effectDistortion,
      melodyEvents,
      totalDuration,
      isMelodyGenerated,
      showModal,
      onSaveSuccess,
      projectId,
    ],
  );

  const handleSaveClick = useCallback(
    (projectTitle) => {
      _doSave(projectTitle, projectId ?? null);
    },
    [projectId, _doSave],
  );

  const handleSaveAsConfirm = useCallback(
    (title) => {
      setShowSaveAsModal(false);
      _doSave(title, null);
    },
    [_doSave],
  );

  return {
    handleSaveClick,
    showSaveAsModal,
    setShowSaveAsModal,
    handleSaveAsConfirm,
    existingProjectNames,
    currentTitle,
    setCurrentTitle,
    isSaving,
    projectId,
    setProjectId,
  };
};
