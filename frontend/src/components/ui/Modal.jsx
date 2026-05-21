import React from "react";
import { createPortal } from "react-dom";
import Button from "./Button";
import "./Modal.css";

const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  primaryText = "ОК",
  cancelText = "Отмена",
  onPrimary,
  onCancel,
  variant = "default",
}) => {
  if (!isOpen) return null;

  const handlePrimary = () => {
    onPrimary?.();
    onClose(); // ← важно!
  };

  const handleCancel = () => {
    onCancel?.();
    onClose(); // ← важно!
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content modal-${variant}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="modal-title">{title}</h3>}
        {description && <p className="modal-description">{description}</p>}

        <div className="modal-buttons">
          {onCancel && (
            <Button variant="negative" onClick={handleCancel}>
              {cancelText}
            </Button>
          )}
          <Button variant="primary" onClick={handlePrimary}>
            {primaryText}
          </Button>
        </div>
      </div>
    </div>,
    document.body, // ← контейнер, а не ребёнок!
  );
};

export default Modal;
