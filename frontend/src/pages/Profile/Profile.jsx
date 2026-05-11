import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

import BgProfileLine from '../../assets/backgrounds/bg-profile-line.png';
import ConfirmIcon from '../../assets/icons/icon-confirm.svg';
import CloseIcon from '../../assets/icons/icon-close.svg';
import LogoutIcon from '../../assets/icons/icon-logout.svg';

import InputField from '../../components/ui/InputField';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import Modal from '../../components/ui/Modal';

import { getValidationErrorMessage } from '../../utils/validationErrors';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'; // ← новый хук

import './Profile.css';

const Profile = () => {

    // === КОНТЕКСТ ===
    const { user, updateUser, uploadPhoto, deletePhoto, logout } = useAuth();

    // === СОСТОЯНИЯ ===
    const [originalData, setOriginalData] = useState({
        name: '',
        nickname: '',
        email: '',
        password: '',
    });

    const [formData, setFormData] = useState({
        name: '',
        nickname: '',
        email: '',
        password: '',
    });

    const [hasChanges, setHasChanges] = useState(false);
    const [errors, setErrors] = useState({});

    // Статусы загрузки
    const [isSaving, setIsSaving] = useState(false);
    const [isPhotoUploading, setIsPhotoUploading] = useState(false);

    // Фото
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [isPhotoChanged, setIsPhotoChanged] = useState(false);
    const fileInputRef = useRef(null);

    // Модалка
    const [showModal, setShowModal] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    // === ЭФФЕКТЫ ===
    useEffect(() => {
        if (user) {
            const data = {
                name: user.name || '',
                nickname: user.nickname || '',
                email: user.email || '',
                password: '',
            };
            setOriginalData(data);
            setFormData(data);
            setPhotoPreview(user.profile_photo || null);
        }
    }, [user]);

    // Отслеживание изменений
    useEffect(() => {
        const isChanged =
            formData.name !== originalData.name ||
            formData.nickname !== originalData.nickname ||
            formData.email !== originalData.email ||
            formData.password !== '';

        setHasChanges(isChanged);
    }, [formData, originalData]);

    // === ХЕЛПЕРЫ МОДАЛКИ ===
    const openModal = (config) => {
        setModalConfig(config);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        // Если у конфига есть кастомный onClose — вызываем его
        // (нужно для blocker.reset() из useUnsavedChanges)
        if (modalConfig.onClose) modalConfig.onClose();
    };

    // === ПОДТВЕРЖДЕНИЯ ===
    const handleLogout = () => {
        openModal({
            title: 'Выйти из аккаунта?',
            description: 'Вы действительно хотите выйти? Несохраненные изменения будут утеряны.',
            primaryText: 'Выйти',
            cancelText: 'Отмена',
            variant: 'warning',
            onPrimary: async () => {
                await logout();
                window.location.href = '/auth';
            },
        });
    };

    const handlePhotoReset = () => {
        openModal({
            title: 'Сбросить фото?',
            description: 'Это действие нельзя будет отменить',
            primaryText: 'Сбросить',
            cancelText: 'Отмена',
            variant: 'warning',
            onPrimary: async () => {
                const success = await deletePhoto();
                if (success) {
                    setPhotoPreview(null);
                    openModal({
                        title: 'Готово',
                        description: 'Фото успешно удалено',
                        primaryText: 'ОК',
                        variant: 'success',
                    });
                }
            },
        });
    };

    // Обработка изменений полей
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    // Валидация при потере фокуса
    const handleBlur = (e) => {
        const { name, value } = e.target;
        let error = '';

        if (name === 'name' || name === 'nickname') {
            error = value.trim().length < 2
                ? getValidationErrorMessage(name, 'min')
                : '';
        }
        if (name === 'email' && value) {
            error = /^\S+@\S+\.\S+$/.test(value)
                ? ''
                : getValidationErrorMessage(name, 'email');
        }
        if (name === 'password' && value) {
            error = value.length < 6
                ? getValidationErrorMessage(name, 'min')
                : '';
        }

        setErrors(prev => ({ ...prev, [name]: error }));
    };

    // === СОХРАНЕНИЕ ПРОФИЛЯ ===
    const handleSave = async () => {
        let hasError = false;
        const newErrors = {};

        if (formData.name.trim().length < 2) {
            newErrors.name = getValidationErrorMessage('name', 'min');
            hasError = true;
        }
        if (formData.nickname.trim().length < 2) {
            newErrors.nickname = getValidationErrorMessage('nickname', 'min');
            hasError = true;
        }
        if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
            newErrors.email = getValidationErrorMessage('email', 'email');
            hasError = true;
        }
        if (formData.password && formData.password.length < 6) {
            newErrors.password = getValidationErrorMessage('password', 'min');
            hasError = true;
        }

        if (hasError) {
            setErrors(newErrors);
            return;
        }

        setIsSaving(true);

        const payload = {};
        if (formData.name !== originalData.name) payload.name = formData.name;
        if (formData.nickname !== originalData.nickname) payload.nickname = formData.nickname;
        if (formData.email !== originalData.email) payload.email = formData.email;
        if (formData.password) payload.password = formData.password;

        if (Object.keys(payload).length === 0) {
            setIsSaving(false);
            return;
        }

        const success = await updateUser(payload);

        if (success) {
            setOriginalData(prev => ({ ...prev, ...payload, password: '' }));
            setFormData(prev => ({ ...prev, password: '' }));
            openModal({
                title: 'Успешно!',
                description: 'Данные профиля обновлены',
                primaryText: 'ОК',
                variant: 'success',
            });
        } else {
            openModal({
                title: 'Ошибка',
                description: 'Не удалось обновить данные. Возможно, такой псевдоним или email уже занят.',
                primaryText: 'Понятно',
                variant: 'error',
            });
        }

        setIsSaving(false);
    };

    // === РАБОТА С ФОТО ===
    const handlePhotoChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        setIsPhotoChanged(true);
    };

    const confirmPhoto = async () => {
        if (!photoFile) return;
        setIsPhotoUploading(true);

        const newUrl = await uploadPhoto(photoFile);
        if (newUrl) {
            setPhotoPreview(newUrl);
            setIsPhotoChanged(false);
            setPhotoFile(null);
            openModal({
                title: 'Готово',
                description: 'Фото успешно обновлено',
                primaryText: 'ОК',
                variant: 'success',
            });
        } else {
            openModal({
                title: 'Ошибка',
                description: 'Не удалось загрузить фото',
                primaryText: 'Понятно',
                variant: 'error',
            });
        }
        setIsPhotoUploading(false);
    };

    const cancelPhoto = () => {
        setPhotoPreview(user?.profile_photo || null);
        setIsPhotoChanged(false);
        setPhotoFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    // === ХУК ЗАЩИТЫ ОТ УХОДА С НЕСОХРАНЁННЫМИ ДАННЫМИ ===
    // Должен вызываться ПОСЛЕ определения всех функций, которые он использует
    useUnsavedChanges(hasChanges, openModal);

    return (
        <div className="profile-page">

            {/* === ШАПКА ПРОФИЛЯ === */}
            <div className="profile-header">
                <div className="profile-header-text">
                    <h2>ПРОФИЛЬ</h2>
                    <div className="logout-btn" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                        <img src={LogoutIcon} alt="Выход" />
                    </div>
                </div>
                <div className="divider" />
            </div>

            {/* === ФОН ПРОФИЛЯ === */}
            <div className="profile-bg-wrapper">
                <div className="profile-bg-line">
                    <img src={BgProfileLine} alt="фоновая линия" />
                </div>
            </div>

            {/* === ОСНОВНОЙ КОНТЕНТ === */}
            <div className="profile-container">

                {/* Блок данных */}
                <div className="profile-data-block">
                    {isSaving && (
                        <div className="loader-overlay">
                            <Loader size={70} color="cyan" speed={2000} />
                        </div>
                    )}
                    <div className="block-header">
                        <h3>Мои данные</h3>
                        {hasChanges && (
                            <div className="action-icons">
                                <img
                                    src={CloseIcon}
                                    alt="Отменить"
                                    onClick={() => setFormData({ ...originalData, password: '' })}
                                    className="icon"
                                />
                                <img
                                    src={ConfirmIcon}
                                    alt="Сохранить"
                                    onClick={handleSave}
                                    className="icon"
                                />
                            </div>
                        )}
                    </div>
                    <InputField
                        label="Имя"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.name}
                    />
                    <InputField
                        label="Псевдоним"
                        name="nickname"
                        value={formData.nickname}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.nickname}
                    />
                    <InputField
                        label="Email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.email}
                    />
                    <InputField
                        label="Дата регистрации"
                        value={formatDate(user.registration_date)}
                        readOnly
                        disabled
                    />
                    <InputField
                        label="Смена пароля"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={errors.password}
                        showPasswordToggle
                        autoComplete="new-password"
                    />
                </div>

                {/* Блок фото */}
                <div className="profile-photo-block">
                    <div className="photo-container">
                        {isPhotoUploading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Loader size={70} color="pink" speed={2000} />
                            </div>
                        ) : photoPreview ? (
                            <img src={photoPreview} alt="Profile" className="profile-photo" />
                        ) : (
                            <div className="no-photo-placeholder">ФОТО ОТСУТСТВУЕТ</div>
                        )}
                    </div>

                    {!isPhotoChanged ? (
                        <div className="photo-actions">
                            <Button variant="primary" onClick={() => fileInputRef.current.click()}>
                                ИЗМЕНИТЬ ФОТО
                            </Button>
                            {photoPreview && (
                                <Button variant="negative" onClick={handlePhotoReset}>
                                    СБРОСИТЬ
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="photo-actions">
                            <Button variant="primary" onClick={confirmPhoto}>ПОДТВЕРДИТЬ</Button>
                            <Button variant="negative" onClick={cancelPhoto}>ОТМЕНИТЬ</Button>
                        </div>
                    )}

                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handlePhotoChange}
                    />
                </div>
            </div>

            {/* Модальное окно */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}   
                title={modalConfig.title}
                description={modalConfig.description}
                primaryText={modalConfig.primaryText}
                cancelText={modalConfig.cancelText}
                onPrimary={() => {
                    setShowModal(false);
                    modalConfig.onPrimary?.();
                }}
                onCancel={() => {
                    setShowModal(false);
                    modalConfig.onCancel?.();
                }}
                variant={modalConfig.variant || 'default'}
            />
        </div>
    );
};

export default Profile;