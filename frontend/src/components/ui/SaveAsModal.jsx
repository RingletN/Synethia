// src/components/SaveAsModal.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';
import InputField from './InputField';

const SaveAsModal = ({ isOpen, onClose, onSave, existingNames = [] }) => {
    const [title, setTitle] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) { setTitle(''); setError(''); }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!title.trim()) {
            setError('Введите название проекта');
            return;
        }
        if (existingNames.includes(title.trim())) {
            setError('Проект с таким названием уже существует');
            return;
        }
        onSave(title.trim());
        setTitle('');
        setError('');
        onClose();
    };

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">Сохранить проект</h3>
                <InputField
                    name="projectTitle"
                    value={title}
                    onChange={e => { setTitle(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    placeholder="Название проекта"
                    error={error}
                    autoFocus
                />
                <div className="modal-buttons">
                    <Button variant="negative" onClick={onClose}>Отмена</Button>
                    <Button variant="primary" onClick={handleSave}>Сохранить</Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SaveAsModal;