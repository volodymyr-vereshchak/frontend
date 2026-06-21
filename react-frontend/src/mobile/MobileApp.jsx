import React, { useCallback, useState } from 'react';
import './MobileApp.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import BottomNav from './BottomNav';
import MobileOverview from './MobileOverview';

/**
 * Mobile shell: header (section title + live date/time + active-lines, language,
 * logout) + content + bottom navigation. Phase 1 ships only Overview; add tabs by
 * extending `navItems` and the content switch.
 */
export default function MobileApp() {
  const { t, currentLanguage, changeLanguage } = useLanguage();
  const { logout } = useUser();
  const [tab, setTab] = useState('overview');
  const [headerInfo, setHeaderInfo] = useState(null); // { time, active, total }

  const handleHeaderInfo = useCallback((info) => setHeaderInfo(info), []);

  const navItems = [
    { id: 'overview', label: t('overview'), icon: '📊' },
    // Add later: { id: 'daily', label: t('dailyArchive'), icon: '📅' },
    //            { id: 'hourly', label: t('hourlyArchive'), icon: '🕐' },
  ];

  const title = navItems.find(i => i.id === tab)?.label || '';
  const allActive = headerInfo && headerInfo.active === headerInfo.total;

  return (
    <div className="m-app">
      <header className="m-topbar">
        <div className="m-topbar-main">
          <span className="m-topbar-title">{title}</span>
          {headerInfo && (
            <>
              <span className="m-topbar-time">{headerInfo.time}</span>
              <span className={`m-topbar-active${allActive ? ' ok' : ' warn'}`}>
                {headerInfo.active}/{headerInfo.total}
              </span>
            </>
          )}
        </div>
        <div className="m-topbar-actions">
          <button
            type="button"
            className="m-topbar-btn"
            onClick={() => changeLanguage(currentLanguage === 'uk' ? 'ru' : 'uk')}
          >
            {currentLanguage === 'uk' ? 'UA' : 'RU'}
          </button>
          <button type="button" className="m-topbar-btn" onClick={logout} title="Вийти">⎋</button>
        </div>
      </header>

      <main className="m-content">
        {tab === 'overview' && <MobileOverview onHeaderInfo={handleHeaderInfo} />}
      </main>

      <BottomNav items={navItems} active={tab} onSelect={setTab} />
    </div>
  );
}
