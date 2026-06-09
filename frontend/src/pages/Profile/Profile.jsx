import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api"; 
import BgProfileLine from "../../assets/backgrounds/bg-profile-line.png";
import ConfirmIcon from "../../assets/icons/icon-confirm.svg";
import CloseIcon from "../../assets/icons/icon-close.svg";
import LogoutIcon from "../../assets/icons/icon-logout.svg";

import InputField from "../../components/ui/InputField/InputField";
import Button from "../../components/ui/Button/Button";
import Loader from "../../components/ui/Loader";
import Modal from "../../components/ui/Modal/Modal";

import { getValidationErrorMessage } from "../../utils/validationErrors";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";

import "./Profile.css";

const Profile = () => {
  // === КОНТЕКСТ ===
  const { user, updateUser, uploadPhoto, deletePhoto, logout } = useAuth();

  // === СОСТОЯНИЯ ===
  const [originalData, setOriginalData] = useState({
    name: "",
    nickname: "",
    email: "",
    password: "",
  });

  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    email: "",
    password: "",
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

  // Для debounce-проверки уникальности
const nicknameTimeoutRef = useRef(null);
const emailTimeoutRef = useRef(null);
const [checkingNickname, setCheckingNickname] = useState(false);
const [checkingEmail, setCheckingEmail] = useState(false);
  
  // === ЭФФЕКТЫ ===
  useEffect(() => {
    if (user) {
      const data = {
        name: user.name || "",
        nickname: user.nickname || "",
        email: user.email || "",
        password: "",
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
      formData.password !== "";

    setHasChanges(isChanged);
  }, [formData, originalData]);

  // === ХЕЛПЕРЫ МОДАЛКИ ===
  const openModal = (config) => {
    setModalConfig(config);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    if (modalConfig.onClose) modalConfig.onClose();
  };

  // === ПОДТВЕРЖДЕНИЯ ===
  const handleLogout = () => {
    openModal({
      title: "Выйти из аккаунта?",
      description:
        "Вы действительно хотите выйти? Несохраненные изменения профиля будут утеряны.",
      primaryText: "Выйти",
      cancelText: "Отмена",
      variant: "warning",
      onPrimary: async () => {
        await logout();
        window.location.href = "/auth";
      },
    });
  };

  const handlePhotoReset = () => {
    openModal({
      title: "Сбросить фото?",
      description:
        "Вы действительно хотите сбросить фото профиля? Это действие нельзя будет отменить. ",
      primaryText: "Сбросить",
      cancelText: "Отмена",
      variant: "warning",
      onPrimary: async () => {
        const result = await deletePhoto();
        if (result.ok) {   // ← исправлено: проверяем .ok, а не сам объект
          setPhotoPreview(null);
          openModal({
            title: "Готово",
            description: "Фото успешно удалено",
            primaryText: "ОК",
            variant: "success",
          });
        }
      },
    });
  };
  const checkUniqueness = useCallback(async (field, value) => {
    if (!value || value.length < 2) return; // не проверяем короткие значения
  
    try {
      const result = await api.post('/api/check-unique', { [field]: value });
      // Сервер возвращает { nickname: null } или { nickname: "текст ошибки" }
      const errorMsg = result[field];
      setErrors(prev => ({ ...prev, [field]: errorMsg || '' }));
    } catch (err) {
      console.error(`Ошибка проверки ${field}:`, err);
    } finally {
      if (field === 'nickname') setCheckingNickname(false);
      else setCheckingEmail(false);
    }
  }, []);

  const handleChange = (e) => {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));
  // очищаем ошибку только если это не nickname/email? лучше очищать любую ошибку поля
  if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));

  // Для nickname и email запускаем проверку с задержкой
  if (name === 'nickname') {
    if (nicknameTimeoutRef.current) clearTimeout(nicknameTimeoutRef.current);
    setCheckingNickname(true);
    nicknameTimeoutRef.current = setTimeout(() => {
      checkUniqueness('nickname', value);
    }, 500);
  }
  if (name === 'email') {
    if (emailTimeoutRef.current) clearTimeout(emailTimeoutRef.current);
    setCheckingEmail(true);
    emailTimeoutRef.current = setTimeout(() => {
      checkUniqueness('email', value);
    }, 500);
  }
};

useEffect(() => {
  return () => {
    if (nicknameTimeoutRef.current) clearTimeout(nicknameTimeoutRef.current);
    if (emailTimeoutRef.current) clearTimeout(emailTimeoutRef.current);
  };
}, []);

 // Валидация при потере фокуса
const handleBlur = (e) => {
  const { name, value } = e.target;

  // Для имени: только минимальная длина
  if (name === "name") {
    const lengthError = value.trim().length < 2 ? getValidationErrorMessage(name, "min") : "";
    if (lengthError) {
      setErrors((prev) => ({ ...prev, [name]: lengthError }));
    }
    // если ошибки нет — ничего не делаем (оставляем старую ошибку, но у name нет уникальности, так что ок)
    return;
  }

  // Для псевдонима: минимальная длина (ошибку уникальности не трогаем)
  if (name === "nickname") {
    const lengthError = value.trim().length < 2 ? getValidationErrorMessage(name, "min") : "";
    if (lengthError) {
      setErrors((prev) => ({ ...prev, [name]: lengthError }));
    }
    // если длина норм — НЕ сбрасываем ошибку (она может быть от уникальности)
    return;
  }

  // Для email: проверка формата
  if (name === "email") {
    if (value && !/^\S+@\S+\.\S+$/.test(value)) {
      setErrors((prev) => ({ ...prev, [name]: getValidationErrorMessage(name, "email") }));
    }
    // если формат правильный — ничего не делаем (оставляем ошибку уникальности, если она была)
    return;
  }

  // Для пароля: минимальная длина (уникальности нет, можно сбрасывать)
  if (name === "password") {
    if (value && value.length < 8) {
      setErrors((prev) => ({ ...prev, [name]: getValidationErrorMessage(name, "min") }));
    } else {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    return;
  }
};

  // === СОХРАНЕНИЕ ПРОФИЛЯ (исправлено) ===
  const handleSave = async () => {
    // 1. Клиентская валидация
    let hasClientError = false;
    const newErrors = {};

    if (formData.name.trim().length < 2) {
      newErrors.name = getValidationErrorMessage("name", "min");
      hasClientError = true;
    }
    if (formData.nickname.trim().length < 2) {
      newErrors.nickname = getValidationErrorMessage("nickname", "min");
      hasClientError = true;
    }
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = getValidationErrorMessage("email", "email");
      hasClientError = true;
    }
    if (formData.password && formData.password.length < 6) {
      newErrors.password = getValidationErrorMessage("password", "min");
      hasClientError = true;
    }

    if (hasClientError) {
      setErrors(newErrors);
      return;
    }

    // 2. Собираем только изменённые поля
    const payload = {};
    if (formData.name !== originalData.name) payload.name = formData.name;
    if (formData.nickname !== originalData.nickname) payload.nickname = formData.nickname;
    if (formData.email !== originalData.email) payload.email = formData.email;
    if (formData.password) payload.password = formData.password;

    if (Object.keys(payload).length === 0) return;

    setIsSaving(true);

    // 3. Вызов updateUser (возвращает { ok, errors })
    const result = await updateUser(payload);

    if (result.ok) {
      // Успех
      setOriginalData((prev) => ({ ...prev, ...payload, password: "" }));
      setFormData((prev) => ({ ...prev, password: "" }));
      openModal({
        title: "Успешно!",
        description: "Данные профиля обновлены",
        primaryText: "ОК",
        variant: "success",
      });
    } else if (result.errors) {
      // Серверные ошибки валидации (422) – показываем под полями
      const serverErrors = {};
      if (result.errors.nickname) serverErrors.nickname = result.errors.nickname[0];
      if (result.errors.email) serverErrors.email = result.errors.email[0];
      if (result.errors.name) serverErrors.name = result.errors.name[0];
      if (result.errors.password) serverErrors.password = result.errors.password[0];
      setErrors(serverErrors);
      // Модалку не показываем – ошибки видны под инпутами
    } else {
      // Прочие ошибки (сеть, 500 и т.д.)
      openModal({
        title: "Ошибка",
        description: "Не удалось обновить данные. Попробуйте позже.",
        primaryText: "Понятно",
        variant: "error",
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
        title: "Готово",
        description: "Фото успешно обновлено",
        primaryText: "ОК",
        variant: "success",
      });
    } else {
      openModal({
        title: "Ошибка",
        description: "Не удалось загрузить фото",
        primaryText: "Понятно",
        variant: "error",
      });
    }
    setIsPhotoUploading(false);
  };

  const cancelPhoto = () => {
    setPhotoPreview(user?.profile_photo || null);
    setIsPhotoChanged(false);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // === ХУК ЗАЩИТЫ ОТ УХОДА ===
  useUnsavedChanges(hasChanges, openModal);

  return (
    <div className="profile-page">
      {/* ШАПКА, ФОН, КОНТЕЙНЕР — без изменений */}
      <div className="profile-header">
        <div className="profile-header-text">
          <h2>ПРОФИЛЬ</h2>
          <div className="logout-btn" onClick={handleLogout} style={{ cursor: "pointer" }}>
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
                <img
                  src={CloseIcon}
                  alt="Отменить"
                  onClick={() => {
                    setFormData({ ...originalData, password: "" });
                    setErrors({}); // <-- очистить все ошибки
                  }}
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

        <div className="profile-photo-block">
          <div className="photo-container">
            {isPhotoUploading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
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
              <Button variant="primary" onClick={confirmPhoto}>
                ПОДТВЕРДИТЬ
              </Button>
              <Button variant="negative" onClick={cancelPhoto}>
                ОТМЕНИТЬ
              </Button>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handlePhotoChange}
          />
        </div>
      </div>

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
        variant={modalConfig.variant || "default"}
      />
    </div>
  );
};

export default Profile;