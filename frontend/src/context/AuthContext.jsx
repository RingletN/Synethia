import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const apiUrl = 'http://127.0.0.1:8000';

  // Получаем CSRF cookie
  const getCsrfCookie = async () => {
    try {
      await fetch(`${apiUrl}/sanctum/csrf-cookie`, { credentials: 'include' });
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error("CSRF fetch error", e);
    }
  };

  const fetchWithCsrf = async (url, options = {}) => {
    await getCsrfCookie();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const xsrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('XSRF-TOKEN='))
      ?.split('=')[1];

    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfToken);
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  // Обновление пользователя
  const refreshUser = async () => {
    try {
      const res = await fetchWithCsrf(`${apiUrl}/api/me`);
      if (res.ok) {
        const userData = await res.json();

        // преобразуем относительный путь фото в абсолютный
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
      const res = await fetchWithCsrf(`${apiUrl}/api/register`, {
        method: 'POST',
        body: JSON.stringify(formData),
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
        // Сначала получаем CSRF
        await fetch(`${apiUrl}/sanctum/csrf-cookie`, { credentials: 'include' });
        await new Promise(r => setTimeout(r, 300));

        const xsrfToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('XSRF-TOKEN='))
            ?.split('=')[1];

        const res = await fetch(`${apiUrl}/api/forgot-password/send-code`, {
            method: 'POST',   // явно POST
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(xsrfToken ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrfToken) } : {}),
            },
            body: JSON.stringify({ email }),
        });

        console.log('sendResetCode status:', res.status); // смотри в консоли
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
        if (res.ok) return true;
        return false;
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
      // всегда очищаем, даже если сервер не ответил
      setUser(null);
      document.cookie = 'laravel_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
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

  // Вспомогательная функция для FormData (фото)
  const fetchFormData = async (url, formData) => {
    await getCsrfCookie();

    const xsrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('XSRF-TOKEN='))
      ?.split('=')[1];

    const headers = {};
    if (xsrfToken) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfToken);

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