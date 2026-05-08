import { useState, useEffect, useRef } from 'react';
import InputField from '../../components/ui/InputField';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import frameBottom from '../../assets/login/frame-bottom1.svg';
import forgotTop from '../../assets/login/forgot-top.svg'; 
import arrowBack from '../../assets/login/arrow-back.svg';
// Если хэдер у тебя один для этого окна — замени на нужный импорт

/**
 * ForgotPassword — восстановление доступа.
 *
 * Шаги:
 *   1 — ввод Email + кнопка «Получить код» (с таймером 1:00)
 *   2 — ввод кода подтверждения
 *   3 — ввод нового пароля + подтверждение
 *
 * props:
 *   onBack — вернуться на Login
 *
 * API-вызовы (замени на свои реальные):
 *   sendCode(email)            → Promise<boolean>
 *   verifyCode(email, code)    → Promise<boolean>
 *   resetPassword(email, code, newPassword) → Promise<boolean>
 */
function ForgotPassword({ onBack }) {
    const [step, setStep]     = useState(1); // 1 | 2 | 3
    const [loading, setLoading] = useState(false);
    const [error, setError]   = useState('');

    const [email, setEmail]   = useState('');
    const [code, setCode]     = useState('');
    const [password, setPassword]   = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // ── Таймер «Получить код» ─────────────────────────────────────────
    const TIMER_SECONDS = 60;
    const [timer, setTimer]      = useState(0); // 0 = кнопка активна
    const timerRef               = useRef(null);

    const startTimer = () => {
        setTimer(TIMER_SECONDS);
        timerRef.current = setInterval(() => {
            setTimer(prev => {
                if (prev <= 1) { clearInterval(timerRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    useEffect(() => () => clearInterval(timerRef.current), []);

    const formatTimer = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

    // ── Шаг 1: отправить код ─────────────────────────────────────────
    const handleSendCode = async () => {
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            setError('Введите корректный email'); return;
        }
        setError('');
        setLoading(true);
        try {
            // TODO: замени на свой вызов API
            // const ok = await sendCode(email);
            const ok = true; // заглушка
            if (ok) {
                startTimer();
                if (step === 1) setStep(2); // показываем поле кода
            } else {
                setError('Не удалось отправить код. Проверьте email.');
            }
        } catch {
            setError('Ошибка соединения с сервером');
        } finally {
            setLoading(false);
        }
    };

    // ── Шаг 2: проверить код ─────────────────────────────────────────
    const handleVerifyCode = async (e) => {
        e.preventDefault();
        if (!code.trim()) { setError('Введите код'); return; }
        setError('');
        setLoading(true);
        try {
            // TODO: замени на свой вызов API
            // const ok = await verifyCode(email, code);
            const ok = true; // заглушка
            if (ok) {
                setStep(3);
            } else {
                setError('Неверный код');
            }
        } catch {
            setError('Ошибка соединения с сервером');
        } finally {
            setLoading(false);
        }
    };

    // ── Шаг 3: сменить пароль ────────────────────────────────────────
    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (password.length < 6) { setError('Пароль не менее 6 символов'); return; }
        if (password !== confirmPassword) { setError('Пароли не совпадают'); return; }
        setError('');
        setLoading(true);
        try {
            // TODO: замени на свой вызов API
            // const ok = await resetPassword(email, code, password);
            const ok = true; // заглушка
            if (ok) {
                onBack(); // после успеха → обратно на логин
            } else {
                setError('Ошибка смены пароля');
            }
        } catch {
            setError('Ошибка соединения с сервером');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page forgot-page">
            <div className="auth-frame">
                {/* Хэдер «Восстановление доступа» */}
                <div className="auth-frame__top forgot-frame__top">
                    <img
                        className="forgot-frame__top-svg"
                        src={forgotTop}
                        alt=""
                        aria-hidden="true"
                    />
                    <div className="forgot-tabs">
                    {/* Кнопка «назад» — курсор pointer только на неё */}
                    <button
                        type="button"
                        className=" forgot-tab forgot-back-btn"
                        onClick={onBack}
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
                        {loading && <div className="loader-overlay"><Loader /></div>}

                        {/* ── ШАГ 1+2: email + код ────────────────── */}
                        {(step === 1 || step === 2) && (
                            <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleSendCode(); } : handleVerifyCode} noValidate>
                                {/* Email + кнопка «Получить код» в одной строке */}
                                <div>
                                    <InputField
                                        label="Email"
                                        name="email"
                                        type="email"
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setError(''); }}
                                    />
                                    {/* Кнопка «Получить код» прямо под полем, с таймером */}
                                    <button
                                        type="button"
                                        className={`forgot-send-code-btn ${timer > 0 ? 'forgot-send-code-btn--disabled' : ''}`}
                                        onClick={handleSendCode}
                                        disabled={timer > 0 || loading}
                                    >
                                        {timer > 0 ? formatTimer(timer) : 'Получить код'}
                                    </button>
                                </div>

                                {step === 2 && (
                                    <InputField
                                        label="Код"
                                        name="code"
                                        value={code}
                                        onChange={e => { setCode(e.target.value); setError(''); }}
                                    />
                                )}

                                {error && <div className="auth-error">{error}</div>}

                                {step === 2 && (
                                    <Button type="submit" variant="primary" disabled={loading} className="auth-submit-button">
                                        {loading ? 'Подождите...' : 'Подтвердить'}
                                    </Button>
                                )}
                            </form>
                        )}

                        {/* ── ШАГ 3: новый пароль ─────────────────── */}
                        {step === 3 && (
                            <form onSubmit={handleResetPassword} noValidate>
                                <InputField
                                    label="Новый пароль"
                                    name="password"
                                    type="password"
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setError(''); }}
                                    showPasswordToggle
                                />
                                <InputField
                                    label="Повторите пароль"
                                    name="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                                    showPasswordToggle
                                />

                                {error && <div className="auth-error">{error}</div>}

                                <Button type="submit" variant="primary" disabled={loading} className="auth-submit-button">
                                    {loading ? 'Подождите...' : 'Продолжить'}
                                </Button>
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
            </div>
        </div>
    );
}

export default ForgotPassword;
