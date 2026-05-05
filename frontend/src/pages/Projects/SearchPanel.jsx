import React from 'react';
import SearchIcon from '../../assets/icons/icon-search.svg';
import CloseIcon from '../../assets/icons/icon-close2.svg';
import './SearchPanel.css';

const SearchPanel = ({ value, onChange, onClear, placeholder }) => {
  return (
    <div className="search-block">
      <div className="search-panel">
        <img src={SearchIcon} alt="Поиск" />
        <input
          type="text"
          placeholder={placeholder || "Поиск по названию проекта ..."}
          value={value}
          onChange={onChange}
        />
      </div>
      {value && (
        <img
          src={CloseIcon}
          alt="Очистить"
          className="search-clear"
          onClick={onClear}
        />
      )}
    </div>
  );
};

export default SearchPanel;