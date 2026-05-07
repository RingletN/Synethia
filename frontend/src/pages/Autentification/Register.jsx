import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import InputField from '../../components/ui/InputField';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import BgLoginLine from '../../assets/backgrounds/bg-login-line.png';
import tabLoginTop from '../../assets/login/tab-login-top.svg';
import tabRegisterTop from '../../assets/login/tab-register-top.svg';
import frameBottom from '../../assets/login/frame-bottom.svg';
import './Register.css';

function Register() {
    const { register, login } = useAuth();
    const navigate = useNavigate();

    const [isLoginMode, setIsLoginMode] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        nickname: '',
        email: '',
        password: '',
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [generalError, setGeneralError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
        setGeneralError('');
    };

    const validateField = (name, value) => {
        let error = '';
        switch (name) {
            case 'email':
                if (!/^\S+@\S+\.\S+$/.test(value)) error = 'Введите корректный email';
                break;
            case 'password':
                if (value.length < 6) error = 'Пароль не менее 6 символов';
                break;
            case 'name':
                if (!isLoginMode && value.trim().length < 2) error = 'Имя не менее 2 символов';
                break;
            case 'nickname':
                if (!isLoginMode && value.trim().length < 2) error = 'Псевдоним не менее 2 символов';
                break;
            default: break;
        }
        return error;
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        const error = validateField(name, value);
        if (error) setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let hasError = false;
        const newErrors = {};
        if (!isLoginMode) {
            ['name', 'nickname', 'email', 'password'].forEach(field => {
                const err = validateField(field, formData[field]);
                if (err) { newErrors[field] = err; hasError = true; }
            });
        } else {
            ['email', 'password'].forEach(field => {
                const err = validateField(field, formData[field]);
                if (err) { newErrors[field] = err; hasError = true; }
            });
        }
        if (hasError) { setErrors(newErrors); return; }

        setLoading(true);
        setGeneralError('');
        try {
            let success = false;
            if (isLoginMode) {
                success = await login(formData.email, formData.password);
            } else {
                success = await register({
                    name: formData.name,
                    nickname: formData.nickname,
                    email: formData.email,
                    password: formData.password,
                });
            }
            if (success) {
                navigate('/profile');
            } else {
                setGeneralError(isLoginMode
                    ? 'Неверный email или пароль'
                    : 'Ошибка регистрации. Возможно, пользователь уже существует.');
            }
        } catch {
            setGeneralError('Ошибка соединения с сервером');
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsLoginMode(prev => !prev);
        setErrors({});
        setGeneralError('');
        setFormData({ name: '', nickname: '', email: '', password: '' });
    };

    return (
        <div className="auth-page-container">
                    <div className="login-bg-line">
                <img src={BgLoginLine} alt="фоновая линия" />
            </div>
        <div className="auth-page">

            <div className="auth-frame">

                <div className="auth-frame__top">
                    <img
                        className="auth-frame__top-svg"
                        src={isLoginMode ? tabLoginTop : tabRegisterTop}
                        alt=""
                        aria-hidden="true"
                    />

                    <div className="auth-tabs">
                        <button
                            type="button"
                            className={`auth-tab ${isLoginMode ? 'auth-tab--active' : ''}`}
                            onClick={() => !isLoginMode && toggleMode()}
                        > <h3>
                            Вход
                        </h3>
                        </button>
                        <button
                            type="button"
                            className={`auth-tab ${!isLoginMode ? 'auth-tab--active' : ''}`}
                            onClick={() => isLoginMode && toggleMode()}
                        >
                            <h3>
                                Регистрация
                            </h3>
                        </button>
                    </div>
                </div>

                <div className="auth-frame__middle">
                    <div className="auth-frame__line auth-frame__line--left" />
                    <div className="auth-frame__line auth-frame__line--right" />

                    {/* Контент формы */}
                    <div className="auth-content">
                        {loading && (
                            <div className="loader-overlay">
                                <Loader />
                            </div>
                        )}
                        <form onSubmit={handleSubmit} noValidate>
                            {!isLoginMode && (
                                <>
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
                                </>
                            )}
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
                            {generalError && (
                                <div className="auth-error">{generalError}</div>
                            )}
                            <Button type="submit" variant="primary" disabled={loading} className="auth-submit-button"> 
                                {loading ? 'Подождите...' : (isLoginMode ? 'Войти' : 'Зарегистрироваться')}
                            </Button>
                        </form>
                    </div>
                </div>

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
        </div>
    );
}

export default Register;