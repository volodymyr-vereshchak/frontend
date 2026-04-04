import React from 'react';
import './PressureGauge.css';
import { useLanguage } from '../contexts/LanguageContext';

const PressureGauge = ({
  lineId,
  lineName,
  pressure,
  isHighPressure,
  timestamp,
  flowData,
  volumeData,
  dpData,
  minPressure24h,
  maxPressure24h,
}) => {
  const { t } = useLanguage();

  const fmt = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return Number(num).toFixed(decimals);
  };

  const fmtVol = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return num.toLocaleString('ru', { maximumFractionDigits: 1 });
  };

  const formattedTime = (() => {
    if (!timestamp) return '--:--';
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    return `${day}.${month}.${year} ${time}`;
  })();

  const getChangeIcon = (isIncrease, isDecrease) => {
    if (isIncrease) return '↑';
    if (isDecrease) return '↓';
    return '—';
  };

  const getChangeClass = (isIncrease, isDecrease) => {
    if (isIncrease) return 'increase';
    if (isDecrease) return 'decrease';
    return 'neutral';
  };

  return (
    <div className="pressure-gauge">
      <div className="gauge-header">
        <span className="gauge-line-name">{lineName || `${t('unknownLine')} ${lineId}`}</span>
      </div>

      {/* Pressure block */}
      <div className="gauge-pressure-block">
        <div className="gauge-pressure-current">
          <span className="pressure-value">{fmt(pressure)}</span>
          <span className="pressure-unit">{t('pressureUnit')}</span>
        </div>
        <div className="gauge-pressure-minmax">
          <div className="minmax-item">
            <span className="minmax-label">min</span>
            <span className="minmax-value">{fmt(minPressure24h)}</span>
          </div>
          <div className="minmax-divider" />
          <div className="minmax-item">
            <span className="minmax-label">max</span>
            <span className="minmax-value">{fmt(maxPressure24h)}</span>
          </div>
        </div>
      </div>

      <div className="gauge-footer">
        <span className="gauge-time">{formattedTime}</span>
      </div>

      {/* Flow data */}
      {flowData && (
        <div className="gauge-data-section">
          <div className="data-header">{t('lastHourShort')}</div>
          <div className="data-row">
            <span className="data-value">{fmtVol(flowData.lastHour)}</span>
            <span className="data-unit">{t('volumeUnit')}/ч</span>
          </div>
          {flowData.change !== null && flowData.change !== undefined && (
            <div className={`data-change ${getChangeClass(flowData.isIncrease, flowData.isDecrease)}`}>
              <span className="change-icon">{getChangeIcon(flowData.isIncrease, flowData.isDecrease)}</span>
              <span className="change-absolute">{fmtVol(Math.abs(flowData.change))} {t('volumeUnit')}/ч</span>
              <span className="change-percent">({fmtVol(Math.abs(flowData.changePercent))}%)</span>
            </div>
          )}
        </div>
      )}

      {/* Volume 24h */}
      {volumeData && (
        <div className="gauge-data-section">
          <div className="data-header">{t('current24hShort')}</div>
          <div className="data-row">
            <span className="data-value">{fmtVol(volumeData.current24h)}</span>
            <span className="data-unit">{t('volumeUnit')}</span>
          </div>
          {volumeData.change !== null && volumeData.change !== undefined && (
            <div className={`data-change ${getChangeClass(volumeData.isIncrease, volumeData.isDecrease)}`}>
              <span className="change-icon">{getChangeIcon(volumeData.isIncrease, volumeData.isDecrease)}</span>
              <span className="change-absolute">{fmtVol(Math.abs(volumeData.change))} {t('volumeUnit')}</span>
              <span className="change-percent">({fmtVol(Math.abs(volumeData.changePercent))}%)</span>
            </div>
          )}
        </div>
      )}

      {/* dP section */}
      {dpData && dpData.hasDpData && (
        <div className="gauge-data-section dp-section">
          <div className="data-header">{dpData.isMeter ? t('flowInWorkingConditions') : t('differentialPressure')}</div>
          <div className="dp-bar-container">
            <div className="dp-bar-track">
              <div className="dp-bar-background"></div>
              <div
                className="dp-bar-indicator dp-bar-indicator-current"
                style={{
                  left: `${Math.min(Math.max(
                    ((dpData.currentDp - dpData.minDp) / (dpData.maxDp - dpData.minDp)) * 100, 0
                  ), 100)}%`
                }}
              >
                <div className="dp-bar-marker dp-bar-marker-current"></div>
              </div>
              <div
                className="dp-bar-indicator dp-bar-indicator-max"
                style={{
                  left: `${Math.min(Math.max(
                    ((dpData.maxDp24h - dpData.minDp) / (dpData.maxDp - dpData.minDp)) * 100, 0
                  ), 100)}%`
                }}
              >
                <div className="dp-bar-marker dp-bar-marker-max"></div>
              </div>
            </div>
            <div className="dp-bar-labels">
              <span className="dp-label-min">{dpData.minDp.toFixed(1)}</span>
              <span className="dp-label-max">{dpData.maxDp.toFixed(1)}</span>
            </div>
          </div>
          <div className="dp-values-container">
            <div className="dp-value-item">
              <div className="dp-value-legend">
                <span className="dp-legend-marker dp-legend-marker-current"></span>
                <span className="dp-legend-label">{t('currentValue')}:</span>
              </div>
              <div className="data-row dp-value-row">
                <span className="data-value">{dpData.currentDp.toFixed(2)}</span>
                <span className="data-unit">{dpData.isMeter ? t('flowUnit') : t('dpUnit')}</span>
              </div>
            </div>
            <div className="dp-value-item">
              <div className="dp-value-legend">
                <span className="dp-legend-marker dp-legend-marker-max"></span>
                <span className="dp-legend-label">{t('maxValue24h')}:</span>
              </div>
              <div className="data-row dp-value-row">
                <span className="data-value">{dpData.maxDp24h.toFixed(2)}</span>
                <span className="data-unit">{dpData.isMeter ? t('flowUnit') : t('dpUnit')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PressureGauge;
