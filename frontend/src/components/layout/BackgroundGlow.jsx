import "./BackgroundGlow.css";
import LogoBlur from "../../assets/backgrounds/logo-blur.svg";
import NavBlur from "../../assets/backgrounds/nav-blur.svg";

const BackgroundGlow = () => {
  return (
    <div className="background-glow">
      <img src={LogoBlur} alt="" className="glow-logo" />
      <img src={NavBlur} alt="" className="glow-nav" />
    </div>
  );
};

export default BackgroundGlow;
