import React from "react";

const IconCanvasBg = ({ color = "#86D0FF", size = 60, className = "" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M47.5 7.5H12.5C9.73858 7.5 7.5 9.73858 7.5 12.5V47.5C7.5 50.2614 9.73858 52.5 12.5 52.5H47.5C50.2614 52.5 52.5 50.2614 52.5 47.5V12.5C52.5 9.73858 50.2614 7.5 47.5 7.5Z"
        fill={color}
        stroke="#312E49"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default IconCanvasBg;
