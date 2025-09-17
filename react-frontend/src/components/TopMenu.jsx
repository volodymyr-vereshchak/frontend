import React, { useState, useRef, useEffect } from 'react';
import './TopMenu.css';

// Archive Icons from Python project
const CalendarIcon = ({ color = "#B9E42B" }) => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 17.7083H35M28.3333 4.375V11.0417M11.6667 4.375V11.0417M12.2917 23.5667H14.005M25.995 23.5667H27.7083M19.1433 23.5667H20.8567M12.2917 28.7067H14.005M25.995 28.7067H27.7083M19.1433 28.7067H20.8567M28.3333 7.70833H11.6667C9.89856 7.70833 8.20286 8.41071 6.95262 9.66095C5.70238 10.9112 5 12.6069 5 14.375V28.9583C5 30.7264 5.70238 32.4221 6.95262 33.6724C8.20286 34.9226 9.89856 35.625 11.6667 35.625H28.3333C30.1014 35.625 31.7971 34.9226 33.0474 33.6724C34.2976 32.4221 35 30.7264 35 28.9583V14.375C35 12.6069 34.2976 10.9112 33.0474 9.66095C31.7971 8.41071 30.1014 7.70833 28.3333 7.70833Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AlarmIcon = ({ color = "#B9E42B" }) => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M28.3333 21.6667H20V13.3333M8.33333 5.83334L11.6667 3.33334M31.6667 5.83334L28.3333 3.33334" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 36.6667C21.9698 36.6667 23.9204 36.2787 25.7403 35.5249C27.5601 34.771 29.2137 33.6662 30.6066 32.2733C31.9995 30.8804 33.1044 29.2268 33.8582 27.4069C34.612 25.587 35 23.6365 35 21.6667C35 19.6968 34.612 17.7463 33.8582 15.9264C33.1044 14.1065 31.9995 12.4529 30.6066 11.0601C29.2137 9.66719 27.5601 8.5623 25.7403 7.80848C23.9204 7.05466 21.9698 6.66667 20 6.66667C16.0218 6.66667 12.2064 8.24702 9.3934 11.0601C6.58035 13.8731 5 17.6884 5 21.6667C5 25.6449 6.58035 29.4602 9.3934 32.2733C12.2064 35.0863 16.0218 36.6667 20 36.6667Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WarningIcon = ({ color = "#B9E42B" }) => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.6667 36.6667H28.3333" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.33334 28.3333V6.66667C3.33334 5.78261 3.68453 4.93477 4.30965 4.30965C4.93477 3.68453 5.78261 3.33334 6.66667 3.33334H33.3333C34.2174 3.33334 35.0652 3.68453 35.6904 4.30965C36.3155 4.93477 36.6667 5.78261 36.6667 6.66667V28.3333C36.6667 29.2174 36.3155 30.0652 35.6904 30.6904C35.0652 31.3155 34.2174 31.6667 33.3333 31.6667H6.66667C5.78261 31.6667 4.93477 31.3155 4.30965 30.6904C3.68453 30.0652 3.33334 29.2174 3.33334 28.3333Z" stroke={color} strokeWidth="1.5"/>
    <path d="M20 11.6667V16.6667M20 23.35L20.0167 23.3317" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EditIcon = ({ color = "#B9E42B" }) => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M33.3333 20V9.58167C33.3334 9.45011 33.3076 9.31982 33.2572 9.19827C33.2069 9.07673 33.1331 8.9663 33.04 8.87334L27.7933 3.62667C27.606 3.43908 27.3518 3.33357 27.0867 3.33334H7.66667C7.40145 3.33334 7.1471 3.43869 6.95956 3.62623C6.77202 3.81377 6.66667 4.06812 6.66667 4.33334V35.6667C6.66667 35.9319 6.77202 36.1862 6.95956 36.3738C7.1471 36.5613 7.40145 36.6667 7.66667 36.6667H18.3333M13.3333 16.6667H26.6667M13.3333 10H20M13.3333 23.3333H18.3333M29.9233 28.2333L31.59 26.5667C31.7634 26.3928 31.9694 26.2549 32.1962 26.1608C32.423 26.0666 32.6661 26.0182 32.9117 26.0182C33.1572 26.0182 33.4003 26.0666 33.6271 26.1608C33.8539 26.2549 34.0599 26.3928 34.2333 26.5667C34.4069 26.74 34.5447 26.9459 34.6386 27.1726C34.7326 27.3992 34.781 27.6422 34.781 27.8875C34.781 28.1329 34.7326 28.3758 34.6386 28.6024C34.5447 28.8291 34.4069 29.035 34.2333 29.2083L32.5667 30.875L29.9233 28.2317L24.9383 33.2167C24.6891 33.4667 24.5257 33.7894 24.4717 34.1383L24.065 36.7333L26.66 36.3283C27.0089 36.2743 27.3316 36.1109 27.5817 35.8617L32.565 30.875" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M26.6667 3.33334V9C26.6667 9.26522 26.772 9.51957 26.9596 9.70711C27.1471 9.89465 27.4015 10 27.6667 10H33.3333" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ParamsIcon = ({ color = "#B9E42B" }) => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 3.33334V10.3509M20 3.33334C10.3105 3.33334 2.45615 11.1877 2.45615 20.8772C2.45068 24.6746 3.68242 28.3704 5.96492 31.4053H13.8597M20 3.33334C29.6895 3.33334 37.5439 11.1877 37.5439 20.8772C37.5439 24.8281 36.2386 28.4737 34.0351 31.4053L26.1404 31.4035M5.96492 10.3509L10.3509 14.7369M29.6491 14.7369L34.0351 10.3509M4.21054 26.1404H9.4737M20 26.1404L21.7544 15.6141M30.5263 26.1404H35.7895" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 36.6667C21.3959 36.6667 22.7346 36.1122 23.7216 35.1251C24.7087 34.1381 25.2632 32.7994 25.2632 31.4035C25.2632 30.0076 24.7087 28.6689 23.7216 27.6819C22.7346 26.6949 21.3959 26.1404 20 26.1404C18.6041 26.1404 17.2654 26.6949 16.2784 27.6819C15.2914 28.6689 14.7369 30.0076 14.7369 31.4035C14.7369 32.7994 15.2914 34.1381 16.2784 35.1251C17.2654 36.1122 18.6041 36.6667 20 36.6667Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ReportsIcon = ({ color = "#B9E42B" }) => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M31.6667 5H8.33333C7.44928 5 6.60143 5.35119 5.97631 5.97631C5.35119 6.60143 5 7.44928 5 8.33333V31.6667C5 32.5507 5.35119 33.3986 5.97631 34.0237C6.60143 34.6488 7.44928 35 8.33333 35H31.6667C32.5507 35 33.3986 34.6488 34.0237 34.0237C34.6488 33.3986 35 32.5507 35 31.6667V8.33333C35 7.44928 34.6488 6.60143 34.0237 5.97631C33.3986 5.35119 32.5507 5 31.6667 5Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 13.3333H25M15 20H25M15 26.6667H21.6667" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChevronDownIcon = ({ color = "#B9E42B" }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4.5L6 7.5L9 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TopMenu = ({ onArchiveTypeChange, archiveType, onGRSReportClick }) => {
  const [activeButton, setActiveButton] = useState(archiveType ?
    (archiveType === 'daily' ? 'days' :
     archiveType === 'hourly' ? 'hours' :
     archiveType === 'sys' ? 'sys' :
     archiveType === 'edit' ? 'edits' :
     archiveType === 'param' ? 'param' : 'days') : 'days');
  const [isReportsDropdownOpen, setIsReportsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsReportsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getButtonIcon = (buttonId, isActive) => {
    const iconColor = isActive ? '#000000' : '#B9E42B';

    switch (buttonId) {
      case 'days':
        return <CalendarIcon color={iconColor} />;
      case 'hours':
        return <AlarmIcon color={iconColor} />;
      case 'sys':
        return <WarningIcon color={iconColor} />;
      case 'edits':
        return <EditIcon color={iconColor} />;
      case 'param':
        return <ParamsIcon color={iconColor} />;
      case 'reports':
        return <ReportsIcon color={iconColor} />;
      default:
        return null;
    }
  };

  const buttons = [
    { id: 'days', label: 'Суточный архив' },
    { id: 'hours', label: 'Часовой архив' },
    { id: 'sys', label: 'Архив аварий' },
    { id: 'edits', label: 'Архив вмешательств' },
    { id: 'param', label: 'Параметры' }
  ];

  const handleButtonClick = (buttonId) => {
    if (buttonId === 'reports') {
      setIsReportsDropdownOpen(!isReportsDropdownOpen);
      return;
    }

    setActiveButton(buttonId);
    setIsReportsDropdownOpen(false);

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

  const handleGRSReportClick = () => {
    setIsReportsDropdownOpen(false);
    if (onGRSReportClick) {
      onGRSReportClick();
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
            <span className="button-icon">{getButtonIcon(button.id, activeButton === button.id)}</span>
          </button>
        ))}

        {/* Reports Dropdown */}
        <div className="dropdown" ref={dropdownRef}>
          <button
            className={`menu-button dropdown-toggle ${
              isReportsDropdownOpen ? 'active' : ''
            }`}
            onClick={() => handleButtonClick('reports')}
            title="Отчеты"
          >
            <span className="button-icon">{getButtonIcon('reports', isReportsDropdownOpen)}</span>
            <span className="button-text">Отчеты</span>
            <span className={`chevron-icon ${isReportsDropdownOpen ? 'rotated' : ''}`}>
              <ChevronDownIcon color={isReportsDropdownOpen ? '#000000' : '#B9E42B'} />
            </span>
          </button>

          {isReportsDropdownOpen && (
            <div className="dropdown-menu">
              <button
                className="dropdown-item"
                onClick={handleGRSReportClick}
                title="Получить отчет по объемам газа за последние 24 часа"
              >
                <span className="dropdown-item-icon">📊</span>
                <span className="dropdown-item-text">Отчет ГРС за 24 часа</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <h1 className="app-title">HostLib Viewer</h1>
    </div>
  );
};

export default TopMenu;