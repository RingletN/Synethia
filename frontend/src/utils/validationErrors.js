export const getValidationErrorMessage = (field, errorCode, value) => {
    const messages = {
        name: {
            required: 'Имя обязательно',
            min: 'Имя должно содержать минимум 2 символа',
            regex: 'Имя может содержать только буквы и пробелы',
        },
        nickname: {
            required: 'Псевдоним обязателен',
            min: 'Псевдоним минимум 2 символа',
            regex: 'Псевдоним может содержать только английские буквы, цифры, _ и -',
            unique: 'Этот псевдоним уже занят',
        },
        email: {
            required: 'Email обязателен',
            email: 'Введите корректный email, например: user@example.com',
            unique: 'Этот email уже зарегистрирован',
        },
        password: {
            min: 'Пароль должен содержать минимум 8 символов',
            regex: 'Пароль может содержать буквы, цифры и специальные символы',
        },
    };

    return messages[field]?.[errorCode] || errorCode;
};