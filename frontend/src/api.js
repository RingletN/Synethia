// src/api.js
// Единый HTTP-клиент — используй вместо axios везде в проекте.
// Повторяет логику fetchWithCsrf из AuthContext, но живёт отдельно
// чтобы его могли импортировать любые хуки и компоненты.

const API_URL = 'http://127.0.0.1:8000';

const getXsrfToken = () => {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
};

const getCsrfCookie = async () => {
    if (getXsrfToken()) return; // уже есть — не трогаем

    await fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: 'include' });

    // Ждём появления куки (до 1 сек)
    for (let i = 0; i < 10; i++) {
        if (getXsrfToken()) break;
        await new Promise(r => setTimeout(r, 100));
    }
};

/**
 * Основной метод — аналог axios.get/post/put/delete
 *
 * @param {string} path        — путь вида '/api/projects'
 * @param {object} options     — стандартные fetch-опции (method, body, headers…)
 * @returns {Promise<any>}     — распарсенный JSON
 * @throws                     — бросает ошибку если res.ok === false
 */
const request = async (path, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        await getCsrfCookie();
    }

    const xsrfToken = getXsrfToken();

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
    };

    if (xsrfToken) {
        headers['X-XSRF-TOKEN'] = xsrfToken;
    }

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        method,
        headers,
        credentials: 'include',
    });

    // Пустые ответы (204 No Content)
    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const error = new Error(data.message || `HTTP ${res.status}`);
        error.status = res.status;
        error.data = data;
        throw error;
    }

    return data;
};

// Удобные методы — полный аналог axios
const api = {
    get:    (path, options = {}) => request(path, { ...options, method: 'GET' }),
    post:   (path, body, options = {}) => request(path, { ...options, method: 'POST',  body: JSON.stringify(body) }),
    put:    (path, body, options = {}) => request(path, { ...options, method: 'PUT',   body: JSON.stringify(body) }),
    patch:  (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
    delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
};

export default api;