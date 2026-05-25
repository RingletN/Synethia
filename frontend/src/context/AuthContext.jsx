import { createContext, useContext, useState, useEffect } from "react";
import api, { getCsrfCookie, postFormData } from "../api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const apiUrl = "http://127.0.0.1:8000";

  // Обновление пользователя (GET — без CSRF, поэтому чистый fetch)
  const refreshUser = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/me`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const userData = await res.json();

        if (userData.profile_photo) {
          userData.profile_photo = userData.profile_photo.startsWith("http")
            ? userData.profile_photo
            : `${apiUrl}${userData.profile_photo.startsWith("/") ? "" : "/"}${userData.profile_photo}`;
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
      await api.post("/api/register", dataToSend);
      await refreshUser();
      return { ok: true };
    } catch (err) {
      // err.data.errors — объект с ошибками валидации от Laravel (422)
      return { ok: false, errors: err.data?.errors ?? {} };
    }
  };

  const login = async (email, password) => {
    try {
      await api.post("/api/login", { email, password });
      await refreshUser();
      return { ok: true };
    } catch (err) {
      return { ok: false, errors: err.data?.errors ?? {} };
    }
  };

  const sendResetCode = async (email) => {
    try {
      await api.post("/api/forgot-password/send-code", { email });
      return { ok: true };
    } catch (err) {
      return { ok: false, errors: err.data?.errors ?? {} };
    }
  };

  const verifyResetCode = async (email, code) => {
    try {
      await api.post("/api/forgot-password/verify-code", { email, code });
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err.data?.error || "Неверный код" };
    }
  };

  const resetPassword = async (email, code, password) => {
    try {
      await api.post("/api/forgot-password/reset", { email, code, password });
      return { ok: true };
    } catch (err) {
      return { ok: false, errors: err.data?.errors ?? {} };
    }
  };

  const logout = async () => {
    try {
      await api.post("/api/logout", {});
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      // HttpOnly куку не трогаем — Sanctum инвалидирует сессию на сервере
      localStorage.clear();
      sessionStorage.clear();
    }
  };

  const updateUser = async (data) => {
    try {
      await api.put("/api/profile", data);
      await refreshUser();
      return { ok: true };
    } catch (err) {
      return { ok: false, errors: err.data?.errors ?? {} };
    }
  };

  const uploadPhoto = async (file) => {
    const formData = new FormData();
    formData.append("photo", file);
    try {
      const res = await postFormData("/api/profile/photo", formData);
      const data = await res.json();
      if (res.ok) {
        await refreshUser();
        return data.photo_url || data.full_url;
      }
      return null;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const deletePhoto = async () => {
    try {
      await api.delete("/api/profile/photo");
      await refreshUser();
      return { ok: true };
    } catch (err) {
      return { ok: false };
    }
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