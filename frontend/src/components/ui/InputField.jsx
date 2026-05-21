import React, { useState } from "react";
import EyeOpenIcon from "../../assets/icons/icon-eye-open.svg";
import EyeClosedIcon from "../../assets/icons/icon-eye-closed.svg";
import "./InputField.css";

const InputField = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  onKeyDown,
  error,
  disabled = false,
  readOnly = false,
  placeholder = "",
  required = false,
  showPasswordToggle = false,
  autoComplete,
  autoFocus,
}) => {
  const [inputType, setInputType] = useState(type);
  const [showPassword, setShowPassword] = useState(false);

  const togglePassword = () => {
    setShowPassword(!showPassword);
    setInputType(showPassword ? "password" : "text");
  };

  const EyeIcon = () => (
    <img
      src={showPassword ? EyeOpenIcon : EyeClosedIcon}
      alt="Показать пароль"
      className="password-eye"
      onClick={togglePassword}
    />
  );

  return (
    <div className="input-field">
      <label className="input-label">{label}</label>
      <div className="input-wrapper">
        <input
          className={`input-control ${showPasswordToggle ? "input-with-eye" : ""}`}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
        />
        {showPasswordToggle && type === "password" && <EyeIcon />}
      </div>
      {error && <div className="input-error-message">{error}</div>}
    </div>
  );
};

export default InputField;
