import React from "react";
import "./Button.css";

const Button = ({
  children,
  variant = "primary", // 'primary', 'negative' или 'accent'
  onClick,
  disabled = false,
  className = "",
  ...rest
}) => {
  const baseClass = `button-base button-${variant}`;
  return (
    <button
      className={`${baseClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      <span style={{ position: "relative", zIndex: 2 }}>{children}</span>
    </button>
  );
};

export default Button;
