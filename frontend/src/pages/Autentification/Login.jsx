import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import InputField from '../../components/ui/InputField';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import tabLoginTop from '../../assets/login/tab-login-top.svg';
import tabRegisterTop from '../../assets/login/tab-register-top.svg';
import frameBottom from '../../assets/login/frame-bottom.svg';

/**
 * props:
 *   onSwitchToRegister — переключить на вкладку «Регистрация»
 *   onForgotPassword   — открыть экран восстановления пароля
 */
function Login({ onSwitchToRegister, onForgotPassword }) {
    const { login } = useAuth();
    const navigate  = useNavigate();

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [errors, setErrors]     = useState({});
    const [loading, setLoading]   = useState(false);
    const [generalError, setGeneralError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
        setGeneralError('');
    };

    const validateField = (name, value) => {
        if (name === 'email'    && !/^\S+@\S+\.\S+$/.test(value)) return 'Введите корректный email';
        if (name === 'password' && value.length < 6)               return 'Пароль не менее 6 символов';
        return '';
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        const error = validateField(name, value);
        if (error) setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = {};
        ['email', 'password'].forEach(f => {
            const err = validateField(f, formData[f]);
            if (err) newErrors[f] = err;
        });
        if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

        setLoading(true);
        setGeneralError('');
        try {
            const success = await login(formData.email, formData.password);
            if (success) {
                navigate('/profile');
            } else {
                setGeneralError('Неверный email или пароль');
            }
        } catch {
            setGeneralError('Ошибка соединения с сервером');
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
                    src={tabLoginTop}
                    alt=""
                    aria-hidden="true"
                />
                <div className="auth-tabs">
                    <button
                        type="button"
                        className="auth-tab auth-tab--active"
                    >
                        <h3>Вход</h3>
                    </button>
                    <button
                        type="button"
                        className="auth-tab"
                        onClick={onSwitchToRegister}
                    >
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
                        <div className="loader-overlay"><Loader /></div>
                    )}
                    <form onSubmit={handleSubmit} noValidate>
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
                            label="Пароль"
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            error={errors.password}
                            showPasswordToggle
                        />

                        {/* Ссылка «Забыли пароль?» */}
                        <button
                            type="button"
                            className="auth-forgot-link"
                            onClick={onForgotPassword}
                        >
                            Забыли пароль?
                        </button>

                        {generalError && (
                            <div className="auth-error">{generalError}</div>
                        )}

                        <Button
                            type="submit"
                            variant="primary"
                            disabled={loading}
                            className="auth-submit-button"
                        >
                            {loading ? 'Подождите...' : 'Войти'}
                        </Button>
                    </form>
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
    );
}

export default Login;
