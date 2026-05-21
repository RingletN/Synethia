import { useState } from "react";
import Register from "./Register";
import Login from "./Login";
import ForgotPassword from "./ForgotPassword";
import BgLoginLine from "../../assets/backgrounds/bg-login-line.png";
import "./Register.css";

/**
 * AuthPage — главная оболочка.
 * mode: 'login' | 'register' | 'forgot'
 */
function AuthPage() {
  const [mode, setMode] = useState("login"); // 'login' | 'register' | 'forgot'

  const isLoginTab = mode === "login" || mode === "forgot";
  const isRegTab = mode === "register";

  if (mode === "forgot") {
    return (
      <div className="auth-page-container">
        <div className="login-bg-line">
          <img src={BgLoginLine} alt="фоновая линия" />
        </div>
        <ForgotPassword onBack={() => setMode("login")} />
      </div>
    );
  }

  return (
    <div className="auth-page-container">
      <div className="login-bg-line">
        <img src={BgLoginLine} alt="фоновая линия" />
      </div>
      <div className="auth-page">
        {mode === "login" ? (
          <Login
            onSwitchToRegister={() => setMode("register")}
            onForgotPassword={() => setMode("forgot")}
          />
        ) : (
          <Register onSwitchToLogin={() => setMode("login")} />
        )}
      </div>
    </div>
  );
}

export default AuthPage;
