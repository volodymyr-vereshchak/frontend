import React from 'react';
import './PressureGauge.css';
import { OverviewCalculator } from '../utils/overviewCalculator';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Pressure Gauge Component
 * SVG-based semicircle speedometer gauge for displaying pressure readings
 * with flow and volume data
 */
const PressureGauge = ({
  lineId,
  lineName,
  pressure,
  isHighPressure,
  timestamp,
  flowData,
  volumeData,
  dpData
}) => {
  const { t } = useLanguage();
  // Get pressure range based on line type
  const range = OverviewCalculator.getPressureRange(isHighPressure);
  const needleColor = '#B9E42B'; // Accent color

  // Clamp pressure to range
  const clampedPressure = Math.min(Math.max(pressure || 0, range.min), range.max);

  // SVG dimensions
  const centerX = 100;
  const centerY = 100;
  const radius = 70;

  // Calculate needle angle
  // Start angle: 135° (bottom-left, 7:30 position)
  // End angle: 45° (bottom-right, 4:30 position)
  // Total sweep: 270° clockwise through top (135->180->270->360->45)
  const startAngle = 135;
  const endAngle = 405; // 45° + 360° to ensure we go clockwise
  const totalAngle = endAngle - startAngle; // 270 degrees

  const normalizedValue = (clampedPressure - range.min) / (range.max - range.min);
  // Subtract 270 because the needle is drawn pointing UP (270° position)
  // and we need to rotate it relative to that initial orientation
  let needleAngle = startAngle + (normalizedValue * totalAngle) - 270;

  // Normalize to 0-360 range
  while (needleAngle < 0) {
    needleAngle = needleAngle + 360;
  }
  while (needleAngle >= 360) {
    needleAngle = needleAngle - 360;
  }

  // Generate tick marks
  const ticks = [];
  let tickValues;

  if (isHighPressure) {
    // For 0-50: show 0, 10, 20, 30, 40, 50
    tickValues = [0, 10, 20, 30, 40, 50];
  } else {
    // For 0-7: show 0, 1, 2, 3, 4, 5, 6, 7
    tickValues = [0, 1, 2, 3, 4, 5, 6, 7];
  }

  tickValues.forEach((value, i) => {
    // Calculate angle for this tick (in degrees)
    const valueNormalized = (value - range.min) / (range.max - range.min);
    let angleDeg = startAngle + (valueNormalized * totalAngle);

    // Normalize to 0-360 range
    if (angleDeg >= 360) {
      angleDeg = angleDeg - 360;
    }

    const angleRad = (angleDeg * Math.PI) / 180;

    // Tick positions
    const x1 = centerX + radius * Math.cos(angleRad);
    const y1 = centerY + radius * Math.sin(angleRad);

    const x2 = centerX + (radius - 8) * Math.cos(angleRad);
    const y2 = centerY + (radius - 8) * Math.sin(angleRad);

    // Label position
    const labelX = centerX + (radius - 18) * Math.cos(angleRad);
    const labelY = centerY + (radius - 18) * Math.sin(angleRad);

    ticks.push({
      id: i,
      x1,
      y1,
      x2,
      y2,
      labelX,
      labelY,
      value
    });
  });

  // Create arc path for background
  const arcStartAngle = 135;
  const arcEndAngle = 45;

  const startAngleRad = (arcStartAngle * Math.PI) / 180;
  const endAngleRad = (arcEndAngle * Math.PI) / 180;

  const arcStartX = centerX + radius * Math.cos(startAngleRad);
  const arcStartY = centerY + radius * Math.sin(startAngleRad);
  const arcEndX = centerX + radius * Math.cos(endAngleRad);
  const arcEndY = centerY + radius * Math.sin(endAngleRad);

  // Large arc flag = 1 for arc > 180 degrees
  const arcPath = `M ${arcStartX} ${arcStartY} A ${radius} ${radius} 0 1 1 ${arcEndX} ${arcEndY}`;

  // Format timestamp
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  // Format numbers
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return num.toLocaleString('ru', { maximumFractionDigits: 1 });
  };

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
        <span className="gauge-line-name">{lineName || `Линія ${lineId}`}</span>
        <span className="gauge-range-label">{isHighPressure ? '0-50' : '0-7'} кг/см²</span>
      </div>

      <svg viewBox="0 0 200 150" className="gauge-svg">
        {/* Background arc */}
        <path
          d={arcPath}
          fill="none"
          stroke="#3E3E3E"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Tick marks and labels */}
        {ticks.map(tick => (
          <g key={tick.id}>
            <line
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="#999999"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <text
              x={tick.labelX}
              y={tick.labelY}
              fill="#cccccc"
              fontSize="9"
              fontWeight="600"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {/* Needle */}
        <g transform={`rotate(${needleAngle}, ${centerX}, ${centerY})`}>
          {/* Needle line */}
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX}
            y2={centerY - radius + 10}
            stroke={needleColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Needle arrow tip */}
          <polygon
            points={`${centerX},${centerY - radius + 5} ${centerX - 3},${centerY - radius + 13} ${centerX + 3},${centerY - radius + 13}`}
            fill={needleColor}
          />
        </g>

        {/* Center pivot */}
        <circle cx={centerX} cy={centerY} r="5" fill={needleColor} />
        <circle cx={centerX} cy={centerY} r="2.5" fill="#1a1a1a" />
      </svg>

      <div className="gauge-value">
        <span className="value-number">{clampedPressure.toFixed(2)}</span>
        <span className="value-unit">кг/см²</span>
      </div>

      <div className="gauge-footer">
        <span className="gauge-time">{formattedTime}</span>
      </div>

      {/* Flow data - hourly */}
      {flowData && (
        <div className="gauge-data-section">
          <div className="data-header">{t('lastHourShort')}</div>
          <div className="data-row">
            <span className="data-value">{formatNumber(flowData.lastHour)}</span>
            <span className="data-unit">{t('volumeUnit')}/ч</span>
          </div>
          {flowData.change !== null && flowData.change !== undefined && (
            <div className={`data-change ${getChangeClass(flowData.isIncrease, flowData.isDecrease)}`}>
              <span className="change-icon">{getChangeIcon(flowData.isIncrease, flowData.isDecrease)}</span>
              <span className="change-absolute">
                {formatNumber(Math.abs(flowData.change))} {t('volumeUnit')}/ч
              </span>
              <span className="change-percent">
                ({formatNumber(Math.abs(flowData.changePercent))}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Volume data - 24h */}
      {volumeData && (
        <div className="gauge-data-section">
          <div className="data-header">{t('current24hShort')}</div>
          <div className="data-row">
            <span className="data-value">{formatNumber(volumeData.current24h)}</span>
            <span className="data-unit">{t('volumeUnit')}</span>
          </div>
          {volumeData.change !== null && volumeData.change !== undefined && (
            <div className={`data-change ${getChangeClass(volumeData.isIncrease, volumeData.isDecrease)}`}>
              <span className="change-icon">{getChangeIcon(volumeData.isIncrease, volumeData.isDecrease)}</span>
              <span className="change-absolute">
                {formatNumber(Math.abs(volumeData.change))} {t('volumeUnit')}
              </span>
              <span className="change-percent">
                ({formatNumber(Math.abs(volumeData.changePercent))}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* dP Pressure Differential Section - only for non-meter lines */}
      {dpData && dpData.hasDpData && (
        <div className="gauge-data-section dp-section">
          <div className="data-header">{dpData.isMeter ? t('flowInWorkingConditions') : t('differentialPressure')}</div>

          <div className="dp-bar-container">
            <div className="dp-bar-track">
              <div className="dp-bar-background"></div>

              {/* Current value indicator */}
              <div
                className="dp-bar-indicator dp-bar-indicator-current"
                style={{
                  left: `${Math.min(Math.max(
                    ((dpData.currentDp - dpData.minDp) / (dpData.maxDp - dpData.minDp)) * 100,
                    0
                  ), 100)}%`
                }}
              >
                <div className="dp-bar-marker dp-bar-marker-current"></div>
              </div>

              {/* Max 24h value indicator */}
              <div
                className="dp-bar-indicator dp-bar-indicator-max"
                style={{
                  left: `${Math.min(Math.max(
                    ((dpData.maxDp24h - dpData.minDp) / (dpData.maxDp - dpData.minDp)) * 100,
                    0
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

          {/* Values with legend */}
          <div className="dp-values-container">
            <div className="dp-value-item">
              <div className="dp-value-legend">
                <span className="dp-legend-marker dp-legend-marker-current"></span>
                <span className="dp-legend-label">{t('currentValue')}:</span>
              </div>
              <div className="data-row dp-value-row">
                <span className="data-value">{dpData.currentDp.toFixed(2)}</span>
                <span className="data-unit">{dpData.isMeter ? 'м³/ч' : 'кг/м²'}</span>
              </div>
            </div>

            <div className="dp-value-item">
              <div className="dp-value-legend">
                <span className="dp-legend-marker dp-legend-marker-max"></span>
                <span className="dp-legend-label">{t('maxValue24h')}:</span>
              </div>
              <div className="data-row dp-value-row">
                <span className="data-value">{dpData.maxDp24h.toFixed(2)}</span>
                <span className="data-unit">{dpData.isMeter ? 'м³/ч' : 'кг/м²'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PressureGauge;
