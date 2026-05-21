import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

import Logo from "../../../assets/Logo.svg";
import ProfileIcon from "../../../assets/icons/profile.svg";
import ProfileGlow from "../../../assets/icons/profile-glow.svg";
import BurgerIcon from "../../../assets/icons/icon-burger.svg";
import CloseIcon from "../../../assets/icons/icon-close.svg";
import "./Header.css";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  const isActive = (path) => location.pathname === path;

  return (
    <header className="header">
      <div className="logo-header">
        <a href="/">
          <img src={Logo} alt="Synethia" />
        </a>
      </div>

      {/* Десктопное меню */}
      <nav className="nav-header desktop">
        <a href="/" className={isActive("/") ? "active" : ""}>
          ГЛАВНАЯ
        </a>
        <a href="/canvas" className={isActive("/canvas") ? "active" : ""}>
          ХОЛСТ
        </a>
        <a href="/projects" className={isActive("/projects") ? "active" : ""}>
          ПРОЕКТЫ
        </a>
        {user ? (
          <Link to="/profile" className="profile-link">
            <img src={ProfileGlow} alt="" className="profile-glow" />
            <img src={ProfileIcon} alt="Profile" className="profile-icon" />
          </Link>
        ) : (
          <Link to="/auth" className="profile-link">
            <img src={ProfileGlow} alt="" className="profile-glow" />
            <img src={ProfileIcon} alt="Profile" className="profile-icon" />
          </Link>
        )}
      </nav>

      {/* Бургер */}
      <div
        className="burger-btn"
        onClick={toggleMenu}
        aria-label="Открыть меню"
      >
        <img src={BurgerIcon} alt="Меню" />
      </div>

      {/* Мобильное модальное меню */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMenu}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <div className="menu-header-text">
                <h2>МЕНЮ</h2>
                <div className="close-btn" onClick={closeMenu}>
                  <img src={CloseIcon} alt="Закрыть" />
                </div>
              </div>
              <div className="divider" />
            </div>

            <nav className="mobile-nav">
              <a
                href="/"
                className={isActive("/") ? "active" : ""}
                onClick={closeMenu}
              >
                ГЛАВНАЯ
              </a>
              <a
                href="/canvas"
                className={isActive("/canvas") ? "active" : ""}
                onClick={closeMenu}
              >
                ХОЛСТ
              </a>
              <a
                href="/projects"
                className={isActive("/projects") ? "active" : ""}
                onClick={closeMenu}
              >
                ПРОЕКТЫ
              </a>
              {/* <a href="/profile" className={isActive('/profile') ? 'active' : ''} onClick={closeMenu}>ПРОФИЛЬ</a> */}
              {user ? (
                <Link
                  to="/profile"
                  className={isActive("/profile") ? "active" : ""}
                  onClick={closeMenu}
                >
                  ПРОФИЛЬ
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className={isActive("/auth") ? "active" : ""}
                  onClick={closeMenu}
                >
                  ВХОД
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
