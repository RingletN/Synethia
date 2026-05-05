import React from 'react';
import './Button.css';

const Button = ({ 
  children, 
  variant = 'primary',  // 'primary' или 'negative'
  onClick, 
  disabled = false,
  className = '',
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
      {children}
    </button>
  );
};

export default Button;