import React, { useState } from 'react';
import './TopMenu.css';

const TopMenu = ({ onArchiveTypeChange, archiveType }) => {
  const [activeButton, setActiveButton] = useState(archiveType ?
    (archiveType === 'daily' ? 'days' :
     archiveType === 'hourly' ? 'hours' :
     archiveType === 'sys' ? 'sys' :
     archiveType === 'edit' ? 'edits' :
     archiveType === 'param' ? 'param' : 'days') : 'days');

  const buttons = [
    { id: 'days', label: 'Суточный архив', icon: '📅' },
    { id: 'hours', label: 'Часовой архив', icon: '⏰' },
    { id: 'sys', label: 'Архив аварий', icon: '⚠️' },
    { id: 'edits', label: 'Архив вмешательств', icon: '✏️' },
    { id: 'param', label: 'Параметры', icon: '⚙️' }
  ];

  const handleButtonClick = (buttonId) => {
    setActiveButton(buttonId);

    // Map button IDs to archive types
    const archiveTypeMap = {
      'days': 'daily',
      'hours': 'hourly',
      'sys': 'sys',
      'edits': 'edit',
      'param': 'param'
    };

    if (onArchiveTypeChange && archiveTypeMap[buttonId]) {
      onArchiveTypeChange(archiveTypeMap[buttonId]);
    }
  };

  return (
    <div className="top-menu">
      <div className="menu-buttons">
        {buttons.map((button) => (
          <button
            key={button.id}
            className={`menu-button ${button.type === 'info' ? 'info-button' : ''} ${
              activeButton === button.id ? 'active' : ''
            }`}
            onClick={() => handleButtonClick(button.id)}
            title={button.label}
          >
            {button.icon && <span className="button-icon">{button.icon}</span>}
            {!button.icon && button.label}
          </button>
        ))}
      </div>
      <h1 className="app-title">HostLib Viewer</h1>
    </div>
  );
};

export default TopMenu;