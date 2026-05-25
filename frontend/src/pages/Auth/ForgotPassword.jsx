import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import InputField from "../../components/ui/InputField/InputField";
import Button from "../../components/ui/Button/Button";
import Loader from "../../components/ui/Loader";
import Modal from "../../components/ui/Modal/Modal";
import frameBottom from "../../assets/login/frame-bottom1.svg";
import forgotTop from "../../assets/login/forgot-top.svg";
import arrowBack from "../../assets/login/arrow-back.svg";

/**
 * props:
 *   onBack(email?) — вернуться на Login, передаём email для автозаполнения
 */
function ForgotPassword({ onBack }) {
  const { sendResetCode, verifyResetCode, resetPassword } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(""); // ошибка под полем кода
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ── Таймер ───────────────────────────────────────────────────────
  const TIMER_SECONDS = 60;
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  const startTimer = () => {
    setTimer(TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const formatTimer = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Шаг 1: отправить код ─────────────────────────────────────────
  const handleSendCode = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setGeneralError("Введите корректный email");
      return;
    }
    setGeneralError("");
    setLoading(true);
    try {
      const ok = await sendResetCode(email);
      if (ok) {
        startTimer();
        setStep(2);
        setCode("");
        setCodeError("");
      } else {
        setGeneralError("Не удалось отправить код. Проверьте email.");
      }
    } catch {
      setGeneralError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  // ── Шаг 2: динамическая проверка кода ────────────────────────────
  const verifyDebounceRef = useRef(null);

  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6); // только цифры, макс 6
    setCode(value);
    setCodeError("");

    // Запускаем проверку только когда введено 6 цифр
    if (value.length === 6) {
      clearTimeout(verifyDebounceRef.current);
      verifyDebounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const result = await verifyResetCode(email, value);
          if (result.valid) {
            setStep(3); // автоматический переход
          } else {
            setCodeError(result.error || "Неверный код");
          }
        } catch {
          setCodeError("Ошибка проверки кода");
        } finally {
          setLoading(false);
        }
      }, 300); // небольшой debounce чтобы не дёргать при быстром вводе
    }
  };

  // ── Шаг 3: сменить пароль ────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();

    let hasError = false;
    if (password.length < 8) {
      setPasswordError("Пароль не менее 8 символов");
      hasError = true;
    } else if (password !== confirmPassword) {
      setPasswordError("Пароли не совпадают");
      hasError = true;
    } else {
      setPasswordError("");
    }
    if (hasError) return;

    setLoading(true);
    try {
      const result = await resetPassword(email, code, password);
      if (result?.ok) {
        setShowSuccessModal(true);
      } else {
        setPasswordError("Ошибка смены пароля. Попробуйте заново.");
      }
    } catch {
      setPasswordError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page forgot-page">
      <div className="auth-frame">
        {/* Хэдер */}
        <div className="auth-frame__top forgot-frame__top">
          <img
            className="forgot-frame__top-svg"
            src={forgotTop}
            alt=""
            aria-hidden="true"
          />
          <div className="forgot-tabs">
            <button
              type="button"
              className="forgot-tab forgot-back-btn"
              onClick={() => onBack()}
              aria-label="Назад"
            >
              <img src={arrowBack} alt="назад" />
            </button>
            <h3 className="forgot-tab forgot-title">Восстановление доступа</h3>
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

            {/* ── ШАГ 1: Email ─────────────────────────── */}
            {step === 1 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendCode();
                }}
                noValidate
              >
                <InputField
                  label="Email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setGeneralError("");
                  }}
                />
                {generalError && (
                  <div className="auth-error">{generalError}</div>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading || !email}
                  className="auth-submit-button"
                >
                  Получить код
                </Button>
              </form>
            )}

            {/* ── ШАГ 2: Код ───────────────────────────── */}
            {step === 2 && (
              <form noValidate>
                <InputField
                  label="Email"
                  name="email"
                  type="email"
                  value={email}
                  disabled
                />

                {/* Кнопка + таймер рядом */}
                <div className="send-code-row">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleSendCode}
                    disabled={timer > 0 || loading}
                    className="forgot-send-code-btn"
                  >
                    ПОЛУЧИТЬ КОД
                  </Button>

                  {timer > 0 && (
                    <div className="timer-display">{formatTimer(timer)}</div>
                  )}
                </div>

                <InputField
                  label="Код из письма"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={handleCodeChange}
                  error={codeError}
                  maxLength={6}
                />
              </form>
            )}

            {/* ── ШАГ 3: Новый пароль ──────────────────── */}
            {step === 3 && (
              <form onSubmit={handleResetPassword} noValidate>
                <InputField
                  label="Новый пароль"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError("");
                  }}
                  showPasswordToggle
                />
                <InputField
                  label="Повторите пароль"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError("");
                  }}
                  showPasswordToggle
                  error={passwordError}
                />

                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="auth-submit-button"
                >
                  {loading ? "Подождите..." : "Сохранить пароль"}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Низ */}
        <div className="auth-frame__bottom">
          <img
            className="auth-frame__bottom-svg"
            src={frameBottom}
            alt=""
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Модалка успеха */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          onBack(email); // передаём email для автозаполнения на логине
        }}
        title="Пароль восстановлен!"
        description="Теперь вы можете войти с новым паролем"
        primaryText="Войти"
        onPrimary={() => {
          setShowSuccessModal(false);
          onBack(email);
        }}
        variant="success"
      />
    </div>
  );
}

export default ForgotPassword;
