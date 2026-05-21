import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../components/ui/InputField/InputField";
import Button from "../../components/ui/Button/Button";
import Modal from "../../components/ui/Modal/Modal";
import Loader from "../../components/ui/Loader";
import tabRegisterTop from "../../assets/login/tab-register-top.svg";
import frameBottom from "../../assets/login/frame-bottom.svg";

/**
 * Регистрация разбита на 2 шага:
 *   Шаг 1 — Имя, Псевдоним, Email  → кнопки «Назад» (→ Login) и «Продолжить»
 *   Шаг 2 — Пароль, Подтвердить пароль → кнопки «Назад» (← Шаг 1) и «Зарегистрироваться»
 *
 * props:
 *   onSwitchToLogin — переключить на вкладку «Вход»
 */
function Register({ onSwitchToLogin }) {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 | 2

  const [formData, setFormData] = useState({
    name: "",
    nickname: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showValidationError, setShowValidationError] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const fromCanvas = params.get("pendingSave") === "1";
  const redirectTarget = params.get("redirect") || "/profile";

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigate(redirectTarget, { state: { pendingSave: fromCanvas } });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    setGeneralError("");
  };

  const validateField = (name, value) => {
    switch (name) {
      case "email":
        return /^\S+@\S+\.\S+$/.test(value) ? "" : "Введите корректный email";
      case "password":
        return value.length >= 6 ? "" : "Пароль не менее 6 символов";
      case "confirmPassword":
        return value === formData.password ? "" : "Пароли не совпадают";
      case "name":
        return value.trim().length >= 2 ? "" : "Имя не менее 2 символов";
      case "nickname":
        return value.trim().length >= 2 ? "" : "Псевдоним не менее 2 символов";
      default:
        return "";
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    if (error) setErrors((prev) => ({ ...prev, [name]: error }));
  };

  // ── Шаг 1: валидация и переход на шаг 2 ──────────────────────────
  const handleStep1Continue = (e) => {
    e.preventDefault();
    const newErrors = {};
    ["name", "nickname", "email"].forEach((f) => {
      const err = validateField(f, formData[f]);
      if (err) newErrors[f] = err;
    });

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      setShowValidationError(true);
      return;
    }
    setStep(2);
  };

  // ── Шаг 2: финальная отправка ─────────────────────────────────────
  const handleStep2Submit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    ["password", "confirmPassword"].forEach((f) => {
      const err = validateField(f, formData[f]);
      if (err) newErrors[f] = err;
    });

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      setShowValidationError(true);
      return;
    }
    setLoading(true);
    try {
      const success = await register(formData);
      if (success) {
        setShowSuccessModal(true);
      } else {
        setGeneralError("Ошибка регистрации...");
      }
    } catch {
      setGeneralError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-frame">
      {/* Верхняя часть с табами */}
      <div className="auth-frame__top">
        <img
          className="auth-frame__top-svg"
          src={tabRegisterTop}
          alt=""
          aria-hidden="true"
        />
        <div className="auth-tabs">
          <button type="button" className="auth-tab" onClick={onSwitchToLogin}>
            <h3>Вход</h3>
          </button>
          <button type="button" className="auth-tab auth-tab--active">
            <h3>Регистрация</h3>
          </button>
        </div>
      </div>

      {/* Середина */}
      <div className="auth-frame__middle">
        <div className="auth-frame__line auth-frame__line--left" />
        <div className="auth-frame__line auth-frame__line--right" />

        <div className="auth-content">
          {loading && (
            <div className="loader-overlay">
              <Loader />
            </div>
          )}

          {/* ── ШАГ 1 ───────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleStep1Continue} noValidate>
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

              {generalError && <div className="auth-error">{generalError}</div>}

              <div className="auth-buttons-row">
                <Button type="submit" variant="primary">
                  Продолжить
                </Button>
              </div>
            </form>
          )}

          {/* ── ШАГ 2 ───────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} noValidate>
              <InputField
                label="Пароль"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.password}
                showPasswordToggle
              />
              <InputField
                label="Повторите пароль"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.confirmPassword}
                showPasswordToggle
              />

              {generalError && <div className="auth-error">{generalError}</div>}

              <div className="auth-buttons-row">
                <Button
                  type="button"
                  variant="negative"
                  onClick={() => setStep(1)}
                >
                  Назад
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? "Подождите..." : "Зарегистрироваться"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Нижняя часть */}
      <div className="auth-frame__bottom">
        <img
          className="auth-frame__bottom-svg"
          src={frameBottom}
          alt=""
          aria-hidden="true"
        />
      </div>
      <Modal
        isOpen={showSuccessModal}
        onClose={handleSuccessClose}
        title="Регистрация успешна!"
        description={
          fromCanvas
            ? "Возвращаемся на холст, проект сохранится автоматически"
            : "Добро пожаловать в Synethia"
        }
        primaryText={fromCanvas ? "Вернуться на холст" : "Перейти в профиль"}
        onPrimary={handleSuccessClose}
        variant="success"
      />
      <Modal
        isOpen={showValidationError}
        onClose={() => setShowValidationError(false)}
        title="Ошибка заполнения"
        description="Пожалуйста, заполните все поля корректно"
        primaryText="Понятно"
        variant="error"
      />
    </div>
  );
}

export default Register;
