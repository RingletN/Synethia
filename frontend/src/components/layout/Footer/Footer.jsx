import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import Logo from "../../../assets/Logo.svg";
import IconInst from "../../../assets/icons/icon-instagram.svg";
import IconX from "../../../assets/icons/icon-x.svg";
import IconTikTok from "../../../assets/icons/icon-tiktok.svg";
import BgFooterLine from "../../../assets/backgrounds/bg-footer-line.png";
import "./Footer.css";

const Footer = () => {
  const { user } = useAuth();
  return (
    <footer className="footer">
      <div className="footer-bg-line">
        <img src={BgFooterLine} alt="фоновая линия футера" />
      </div>
      <div className="logo-block">
        <a href="/">
          <img src={Logo} alt="Synethia" />
        </a>
        <p>2026</p>
      </div>
      <div className="nav-footer">
        <a href="/">ГЛАВНАЯ</a>
        <a href="/canvas">ХОЛСТ</a>
        <a href="/projects">ПРОЕКТЫ</a>
        {user ? (
          <Link to="/profile">ПРОФИЛЬ</Link>
        ) : (
          <Link to="/auth">ВХОД</Link>
        )}
      </div>
      <div className="contacts">
        <div className="social-medias">
          <a href="#" onClick={(e) => e.preventDefault()}>
            <img src={IconInst} alt="IconInst" />
          </a>
          <a href="#" onClick={(e) => e.preventDefault()}>
            <img src={IconX} alt="IconX" />
          </a>
          <a href="#" onClick={(e) => e.preventDefault()}>
            <img src={IconTikTok} alt="IconTikTok" />
          </a>
        </div>
        <a href="mailto:synethia@example.com" className="email-link">
          synethia@example.com
        </a>
      </div>
    </footer>
  );
};
export default Footer;
