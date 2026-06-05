import React from 'react';
import './PressureGaugesGrid.css';
import PressureGauge from './PressureGauge';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Pressure Gauges Grid Component
 * Displays a responsive grid of pressure gauges for all GRS lines
 * with flow and volume data
 */
const PressureGaugesGrid = ({
  pressures,
  lineNames,
  timestamps,
  referenceTime,
  flowComparisons,
  volumeComparisons
}) => {
  const { t } = useLanguage();

  if (!pressures || Object.keys(pressures).length === 0) {
    return (
      <div className="gauges-grid-empty">
        <p>{t('noPressureData')}</p>
      </div>
    );
  }

  // Convert arrays to maps for easier lookup
  const flowMap = {};
  const volumeMap = {};

  if (flowComparisons) {
    flowComparisons.forEach(item => {
      flowMap[item.lineId] = item;
    });
  }

  if (volumeComparisons) {
    volumeComparisons.forEach(item => {
      volumeMap[item.lineId] = item;
    });
  }

  return (
    <div className="gauges-grid">
      {Object.keys(pressures).map(lineIdStr => {
        const lineId = Number(lineIdStr);
        const pressureData = pressures[lineId];
        const lineName = lineNames ? lineNames[lineId] : `${t('unknownLine')} ${lineId}`;
        const timestamp = timestamps ? timestamps[lineId] : null;
        const isHighPressure = pressureData?.isHighPressure || false;

        return (
          <PressureGauge
            key={lineId}
            lineId={lineId}
            lineName={lineName}
            pressure={pressureData?.pressure || 0}
            minPressure24h={pressureData?.minPressure24h}
            maxPressure24h={pressureData?.maxPressure24h}
            isHighPressure={isHighPressure}
            timestamp={timestamp || pressureData?.timestamp}
            referenceTime={referenceTime}
            flowData={flowMap[lineId]}
            volumeData={volumeMap[lineId]}
            dpData={pressureData?.dpData}
            pressureUnit={pressureData?.pressureUnit}
            dpUnit={pressureData?.dpUnit}
          />
        );
      })}
    </div>
  );
};

export default PressureGaugesGrid;
