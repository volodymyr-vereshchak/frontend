import React from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import './OverviewTab.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useOverviewData } from '../hooks/useOverviewData';
import OverviewMetrics from './OverviewMetrics';
import LumgOverviewGroup from './LumgOverviewGroup';

/**
 * Overview Tab Component (desktop).
 * Data orchestration lives in the shared useOverviewData hook so the mobile
 * Overview screen renders from the same source. This component owns only the
 * desktop presentation (LUMG groups, collapse state).
 */
const OverviewTab = () => {
  const { t } = useLanguage();
  const {
    branches,
    selectedBranchId,
    selectBranch,
    data,
    selectorLoading,
    isLoading,
    error,
    lastUpdateTime,
    reload,
  } = useOverviewData();

  // Collapsed LUMG groups, persisted per lumg id: { [lumgId]: true }
  const [collapsedLumgs, setCollapsedLumgs] = useLocalStorage('hlv-overview-collapsed-lumgs', {});

  const toggleLumg = (lumgId) => {
    setCollapsedLumgs(prev => ({ ...prev, [lumgId]: !prev[lumgId] }));
  };

  const setAllCollapsed = (collapsed) => {
    if (!data?.lumgGroups) return;
    const next = {};
    data.lumgGroups.forEach(g => { next[g.lumgId] = collapsed; });
    setCollapsedLumgs(next);
  };

  const handleBranchChange = (e) => {
    selectBranch(Number(e.target.value));
  };

  return (
    <div className="overview-tab">
      {/* Header */}
      <div className="overview-header">
        <div className="overview-title-row">
          <h2 className="overview-title">{t('grsOverviewTitle')}</h2>

          {/* Branch selector */}
          <div className="overview-selectors">
            <div className="selector-group">
              <label className="selector-label">{t('branch')}</label>
              <select
                className="overview-select"
                value={selectedBranchId ?? ''}
                onChange={handleBranchChange}
                disabled={selectorLoading || branches.length === 0}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name || `Філія ${b.id}`}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overview-controls">
        </div>
      </div>

      {/* Selector loading */}
      {selectorLoading && (
        <div className="overview-loading">
          <div className="loading-spinner"></div>
          <p>{t('loading')}</p>
        </div>
      )}

      {/* No branch selected */}
      {!selectorLoading && !selectedBranchId && (
        <div className="overview-error">
          <p className="error-message">{t('selectBranchPrompt')}</p>
        </div>
      )}

      {/* Data loading */}
      {!selectorLoading && selectedBranchId && isLoading && !data && (
        <div className="overview-loading">
          <div className="loading-spinner"></div>
          <p>{t('loading')}</p>
        </div>
      )}

      {/* Error State */}
      {!selectorLoading && error && !data && (
        <div className="overview-error">
          <p className="error-icon">⚠️</p>
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={reload}>
            {t('refreshNow')}
          </button>
        </div>
      )}

      {/* Content */}
      {data && (
        <>
          <OverviewMetrics
            totalVolume24h={data.totalVolume24h}
            volumeComparison={data.volumeComparison}
            lastUpdate={lastUpdateTime}
            activeLines={data.activeLines}
            totalLines={data.totalLines}
          />

          <section className="overview-section">
            {data.lumgGroups && data.lumgGroups.length > 1 && (
              <div className="lumg-groups-toolbar">
                <button type="button" onClick={() => setAllCollapsed(false)}>
                  {t('expandAll')}
                </button>
                <button type="button" onClick={() => setAllCollapsed(true)}>
                  {t('collapseAll')}
                </button>
              </div>
            )}

            {(data.lumgGroups || []).map(group => (
              <LumgOverviewGroup
                key={group.lumgId}
                group={group}
                data={data}
                collapsed={!!collapsedLumgs[group.lumgId]}
                onToggle={() => toggleLumg(group.lumgId)}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
};

export default OverviewTab;
