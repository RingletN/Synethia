import React from "react";

const IconBrushColor = ({ color = "#00ffd1", size = 60, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Круглая иконка */}
      <circle
        cx="30"
        cy="30"
        r="26"
        fill={color}
        stroke="#ECECEC"
        strokeWidth="3"
      />
    </svg>
  );
};

export default IconBrushColor;
