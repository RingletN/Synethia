import { createContext, useContext, useState, useEffect, useRef } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const apiUrl = 'http://127.0.0.1:8000';

  // Флаг — CSRF уже был получен в этой сессии
  const csrfInitialized = useRef(false);

  // Получаем CSRF cookie и ждём пока кука реально появится
  const getCsrfCookie = async () => {
    if (csrfInitialized.current && getXsrfToken()) return; // уже есть

    try {
      await fetch(`${apiUrl}/sanctum/csrf-cookie`, {
        credentials: 'include',
      });

      // Ждём появления куки (polling до 1 сек)
      for (let i = 0; i < 10; i++) {
        if (getXsrfToken()) break;
        await new Promise(r => setTimeout(r, 100));
      }

      csrfInitialized.current = true;

      // Отладка — убери после исправления
      console.log('[CSRF] token after init:', getXsrfToken() ? 'OK' : 'MISSING');
    } catch (e) {
      console.error("CSRF fetch error", e);
    }
  };

  const getXsrfToken = () => {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
};

  const fetchWithCsrf = async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      await getCsrfCookie();
    }

    const xsrfToken = getXsrfToken();

    // Отладка — убери после исправления
    console.log(`[${method}] ${url} | XSRF: ${xsrfToken ? xsrfToken.slice(0, 20) + '...' : 'MISSING'}`);

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken;
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  // Обновление пользователя (GET — без CSRF)
  const refreshUser = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/me`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const userData = await res.json();

        if (userData.profile_photo) {
          userData.profile_photo = userData.profile_photo.startsWith('http')
            ? userData.profile_photo
            : `${apiUrl}${userData.profile_photo.startsWith('/') ? '' : '/'}${userData.profile_photo}`;
        }

        setUser(userData);
        return userData;
      }
    } catch (error) {
      console.error("Ошибка обновления пользователя:", error);
    }
    return null;
  };

  const fetchUser = async () => {
    try {
      // При старте сразу инициализируем CSRF
      await getCsrfCookie();
      await refreshUser();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);


  // === АУТЕНТИФИКАЦИЯ ===

  const register = async (formData) => {
    try {
      const { confirmPassword, ...dataToSend } = formData;
      const res = await fetchWithCsrf(`${apiUrl}/api/register`, {
        method: 'POST',
        body: JSON.stringify(dataToSend),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        await refreshUser();
        return true;
      } else {
        console.error('Статус:', res.status);
        console.error('Ошибки:', JSON.stringify(data, null, 2));
        return false;
      }
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const login = async (email, password) => {
    try {
      const res = await fetchWithCsrf(`${apiUrl}/api/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        await refreshUser();
        return true;
      } else {
        console.error(data);
        return false;
      }
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const sendResetCode = async (email) => {
    try {
      const res = await fetchWithCsrf(`${apiUrl}/api/forgot-password/send-code`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return res.ok;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const verifyResetCode = async (email, code) => {
    try {
      const res = await fetchWithCsrf(`${apiUrl}/api/forgot-password/verify-code`, {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      if (res.ok) return { valid: true };
      const data = await res.json().catch(() => ({}));
      return { valid: false, error: data.error || 'Неверный код' };
    } catch {
      return { valid: false, error: 'Ошибка соединения' };
    }
  };

  const resetPassword = async (email, code, password) => {
    try {
      const res = await fetchWithCsrf(`${apiUrl}/api/forgot-password/reset`, {
        method: 'POST',
        body: JSON.stringify({ email, code, password }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    try {
        await fetchWithCsrf(`${apiUrl}/api/logout`, { method: 'POST' });
    } catch (err) {
        console.error("Logout error:", err);
    } finally {
        csrfInitialized.current = false;
        setUser(null);
        // НЕ трогаем HttpOnly куки через JS — это бесполезно
        // Sanctum сам инвалидирует сессию на сервере через /api/logout
        // Просто чистим то что реально доступно:
        localStorage.clear();
        sessionStorage.clear();
    }
};

  const updateUser = async (data) => {
    try {
      const res = await fetchWithCsrf(`${apiUrl}/api/profile`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (res.ok) {
        await refreshUser();
        return true;
      }

      const errorData = await res.json().catch(() => ({}));
      console.error('Server errors:', errorData);
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const uploadPhoto = async (file) => {
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetchFormData(`${apiUrl}/api/profile/photo`, formData);
      const responseData = await res.json();

      if (res.ok) {
        await refreshUser();
        return responseData.photo_url || responseData.full_url;
      }
      return null;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const deletePhoto = async () => {
    try {
      const res = await fetchWithCsrf(`${apiUrl}/api/profile/photo`, { method: 'DELETE' });
      if (res.ok) {
        await refreshUser();
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Для FormData (загрузка фото) — без Content-Type, браузер выставит boundary сам
  const fetchFormData = async (url, formData) => {
    await getCsrfCookie();

    const xsrfToken = getXsrfToken();
    const headers = {};
    if (xsrfToken) headers['X-XSRF-TOKEN'] = xsrfToken;

    return fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    });
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
        login,
        logout,
        updateUser,
        uploadPhoto,
        deletePhoto,
        refreshUser,
        sendResetCode,
        verifyResetCode,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);