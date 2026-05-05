// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const apiUrl = 'http://127.0.0.1:8000';

  // Получаем CSRF cookie
  const getCsrfCookie = async () => {
    console.log("1. Запрашиваем CSRF cookie...");
    try {
      await fetch(`${apiUrl}/sanctum/csrf-cookie`, {
        credentials: 'include',
      });
      await new Promise(r => setTimeout(r, 400)); // небольшая пауза
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

    // Добавляем X-XSRF-TOKEN из cookie
    const xsrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('XSRF-TOKEN='))
      ?.split('=')[1];

    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfToken);
      console.log("X-XSRF-TOKEN добавлен");
    } else {
      console.warn("XSRF-TOKEN не найден в cookie!");
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  const fetchUser = async () => {
    try {
        const res = await fetchWithCsrf(`${apiUrl}/api/me`);
        if (res.ok) {
            const userData = await res.json();
            if (userData.profile_photo) {
                userData.profile_photo = toAbsoluteUrl(userData.profile_photo);
            }
            setUser(userData);
        }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const register = async (formData) => {
    try {
      const res = await fetchWithCsrf(`${apiUrl}/api/register`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => ({}));
      console.log("Register response:", res.status, data);

      if (res.ok) {
        setUser(data.user);
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
      console.log("Login response:", res.status, data);

      if (res.ok) {
        setUser(data.user);
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

  const logout = async () => {
  try {
    await fetch('http://127.0.0.1:8000/api/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.error(err);
  }
  setUser(null);
};

const toAbsoluteUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${apiUrl}${path.startsWith('/') ? path : '/' + path}`;
};

// внутри AuthProvider
const updateUser = async (data) => {
    try {
        const res = await fetchWithCsrf(`${apiUrl}/api/profile`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (res.ok) {
            setUser(prev => ({ ...prev, ...result.user }));
            return true;
        }
        console.error(result);
        return false;
    } catch (err) {
        console.error(err);
        return false;
    }
};
// Добавим вспомогательный метод для FormData-запросов с CSRF
const fetchFormData = async (url, formData, method = 'POST') => {
  await getCsrfCookie();
  
  const xsrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('XSRF-TOKEN='))
    ?.split('=')[1];
  
  const headers = {};
  if (xsrfToken) {
    headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfToken);
  }
  
  return fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: formData, // НЕ устанавливаем Content-Type – браузер сам добавит boundary
  });
};

const uploadPhoto = async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    try {
        const res = await fetchFormData(`${apiUrl}/api/profile/photo`, formData, 'POST');
        const data = await res.json();
        if (res.ok) {
            const fullUrl = toAbsoluteUrl(data.photo_url);
            setUser(prev => ({ ...prev, profile_photo: fullUrl }));
            return fullUrl;
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
            setUser(prev => ({ ...prev, profile_photo: null }));
            return true;
        }
        return false;
    } catch (err) {
        console.error(err);
        return false;
    }
};

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, updateUser, uploadPhoto, deletePhoto }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);