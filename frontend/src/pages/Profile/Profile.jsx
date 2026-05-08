import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import BgProfileLine from '../../assets/backgrounds/bg-profile-line.png';
import InputField from '../../components/ui/InputField';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader'
import Modal from '../../components/ui/Modal'
import ConfirmIcon from '../../assets/icons/icon-confirm.svg';
import CloseIcon from '../../assets/icons/icon-close.svg';
import LogoutIcon from '../../assets/icons/icon-logout.svg';
import './Profile.css';

const Profile = () => {
    const { user, updateUser, uploadPhoto, deletePhoto, logout } = useAuth();

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
    const [isSaving, setIsSaving] = useState(false);
    const [isPhotoUploading, setIsPhotoUploading] = useState(false);
    const [isPhotoLoading, setIsPhotoLoading] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    // Фото
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [isPhotoChanged, setIsPhotoChanged] = useState(false);
    const fileInputRef = useRef(null);

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
            setIsPhotoLoading(false);
        }
    }, [user]);

    const openConfirmModal = (config) => {
        setModalConfig(config);
        setShowConfirmModal(true);
        };

    // Пример для сброса фото
    const resetPhoto = () => {
        openConfirmModal({
            title: "Сбросить фото?",
            description: "Это действие нельзя отменить",
            primaryText: "Сбросить",
            cancelText: "Отмена",
            onPrimary: async () => {
                setShowConfirmModal(false);
                const success = await deletePhoto();
                if (success) {
                    // показать успех
                }
            },
            variant: "warning"
        });
    };

    useEffect(() => {
        const isChanged =
            formData.name !== originalData.name ||
            formData.nickname !== originalData.nickname ||
            formData.email !== originalData.email ||
            formData.password !== '';
        setHasChanges(isChanged);
    }, [formData, originalData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateField = (name, value) => {
        let error = '';
        switch (name) {
            case 'email':
                if (!/^\S+@\S+\.\S+$/.test(value)) error = 'Введите корректный email (например, user@domain.com)';
                break;
            case 'name':
                if (value.trim().length < 2) error = 'Имя должно содержать не менее 2 символов';
                break;
            case 'nickname':
                if (value.trim().length < 2) error = 'Псевдоним должен содержать не менее 2 символов';
                break;
            case 'password':
                if (value && value.length < 6) error = 'Пароль должен быть не менее 6 символов';
                break;
            default: break;
        }
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        validateField(name, value);
    };

    const handleCancel = () => {
        setFormData({ ...originalData, password: '' });
        setErrors({});
    };

    const handleSave = async () => {
        let hasError = false;
        Object.keys(formData).forEach(key => {
            if (key !== 'password' || formData.password) {
                validateField(key, formData[key]);
                if (errors[key]) hasError = true;
            }
        });
        if (hasError) return;

        setIsSaving(true);
        const payload = {};
        if (formData.name !== originalData.name) payload.name = formData.name;
        if (formData.nickname !== originalData.nickname) payload.nickname = formData.nickname;
        if (formData.email !== originalData.email) payload.email = formData.email;
        if (formData.password) payload.password = formData.password;

        if (Object.keys(payload).length > 0) {
            const success = await updateUser(payload);
            if (success) {
                setOriginalData(prev => ({ ...prev, ...payload, password: '' }));
                setFormData(prev => ({ ...prev, password: '' }));
            }
        }
        setIsSaving(false);
    };

    // Фото
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
        }
        setIsPhotoUploading(false);
    };

    const cancelPhoto = () => {
        setPhotoPreview(user.profile_photo || null);
        setIsPhotoChanged(false);
        setPhotoFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // const resetPhoto = async () => {
    //     setIsPhotoUploading(true);
    //     const success = await deletePhoto();
    //     setIsPhotoUploading(false);
    //     if (success) {
    //         setPhotoPreview(null);
    //         setIsPhotoChanged(false);
    //         setPhotoFile(null);
    //     }
    //     setIsPhotoUploading(false);
    // };

    const handleLogout = async () => {
        await logout();
        window.location.href = '/auth';
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    if (!user) return <div>Загрузка...</div>;

    return (
        <div className="profile-page">
            {/* ШАПКА ПРОФИЛЯ */}
            <div className="profile-header">
                <div className="profile-header-text">
                    <h2>ПРОФИЛЬ</h2>
                    <div className="logout-btn" onClick={handleLogout} style={{ cursor: 'pointer' }}>
                        <img src={LogoutIcon} alt="Выход" />
                    </div>
                </div>
                <div className="divider" />
            </div>
            <div className="profile-bg-wrapper">
                <div className="profile-bg-line">
                    <img src={BgProfileLine} alt="фоновая линия" />
                </div>
            </div>
            {/* ОСНОВНОЙ КОНТЕЙНЕР */}
            <div className="profile-container">
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
                                <img src={CloseIcon} alt="Отменить" onClick={handleCancel} className="icon cancel" />
                                <img src={ConfirmIcon} alt="Сохранить" onClick={handleSave} className="icon confirm" />
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
                        name="registration_date"
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
                    />
                </div>

                <div className="profile-photo-block">
                    <div className="photo-container">
                        {(isPhotoLoading || isPhotoUploading) ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Loader size={70} color="cyan" speed={2000} />
                            </div>
                        ) : photoPreview ? (
                            <img src={photoPreview} alt="Profile" className="profile-photo" />
                        ) : (
                            <div className="no-photo-placeholder">ФОТО ОТСУТСТВУЕТ</div>
                        )}
                    </div>
                    {!isPhotoChanged ? (
                        <>
                        <div className="photo-actions">
                            <Button variant="primary" onClick={() => fileInputRef.current.click()}>
                                ИЗМЕНИТЬ ФОТО
                            </Button>
                            {photoPreview && (
                                <Button variant="negative" onClick={resetPhoto}>
                                    СБРОСИТЬ
                                </Button>
                            )}
                        </div>
                        </>
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
            <Modal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                title={modalConfig.title}
                description={modalConfig.description}
                primaryText={modalConfig.primaryText}
                cancelText={modalConfig.cancelText}
                onPrimary={modalConfig.onPrimary}
                onCancel={() => setShowConfirmModal(false)}
                variant={modalConfig.variant || "default"}
            />
        </div>
    );
};

export default Profile;