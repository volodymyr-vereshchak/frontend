import React from 'react';
import './OverviewMetrics.css';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Overview Metrics Component
 * Displays summary cards with key GRS metrics
 */
const OverviewMetrics = ({ totalVolume24h, volumeComparison, lastUpdate, activeLines, totalLines }) => {
  const { t } = useLanguage();

  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return num.toLocaleString('ru', { maximumFractionDigits: 3 });
  };

  const formatTime = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    return `${day}.${month}.${year} ${time}`;
  };

  // Determine arrow icon and color for volume comparison
  const getComparisonIcon = (comparison) => {
    if (!comparison) return null;
    if (comparison.isIncrease) return '↑';
    if (comparison.isDecrease) return '↓';
    return '—';
  };

  const getComparisonColor = (comparison) => {
    if (!comparison) return '#999999';
    if (comparison.isIncrease) return '#90EE90';
    if (comparison.isDecrease) return '#ff6b6b';
    return '#999999';
  };

  return (
    <div className="overview-metrics">
      {/* Total 24h Volume Card */}
      <div className="metric-card volume-card">
        <div className="card-icon">📊</div>
        <div className="card-content">
          <div className="card-label">{t('total24hVolume')}</div>
          <div className="card-value">
            {formatNumber(totalVolume24h)} {t('volumeUnit')}
          </div>
          {volumeComparison && (
            <div
              className="card-comparison"
              style={{ color: getComparisonColor(volumeComparison) }}
            >
              <span className="comparison-icon">{getComparisonIcon(volumeComparison)}</span>
              <span className="comparison-absolute">
                {formatNumber(Math.abs(volumeComparison.change))} {t('volumeUnit')}
              </span>
              <span className="comparison-percent">
                ({volumeComparison.changePercent > 0 ? '+' : ''}{volumeComparison.changePercent}%)
              </span>
            </div>
          )}
          {volumeComparison && (
            <div className="card-subtitle">{t('comparedToPrevious')}</div>
          )}
        </div>
      </div>

      {/* Last Update Card */}
      <div className="metric-card update-card">
        <div className="card-icon">🕐</div>
        <div className="card-content">
          <div className="card-label">{t('lastUpdate')}</div>
          <div className="card-value-small">
            {formatTime(lastUpdate)}
          </div>
        </div>
      </div>

      {/* Active Lines Card */}
      {(() => {
        const allActive = (activeLines || 0) === (totalLines || 0) && totalLines > 0;
        return (
          <div className={`metric-card lines-card ${allActive ? 'lines-all-active' : 'lines-partial'}`}>
            <div className="card-content">
              <div className="card-label">{t('activeLines')}</div>
              <div className="card-value-small">
                <span className={`lines-count ${allActive ? 'lines-count-ok' : 'lines-count-warn'}`}>
                  {activeLines || 0}
                </span>
                <span className="lines-total"> / {totalLines || 0}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default OverviewMetrics;
