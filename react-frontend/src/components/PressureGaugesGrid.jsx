import React from 'react';
import './PressureGaugesGrid.css';
import PressureGauge from './PressureGauge';
import { grsConfig } from '../config/grsConfig';

/**
 * Pressure Gauges Grid Component
 * Displays a responsive grid of pressure gauges for all GRS lines
 * with flow and volume data
 */
const PressureGaugesGrid = ({
  pressures,
  lineNames,
  timestamps,
  flowComparisons,
  volumeComparisons
}) => {
  if (!pressures || Object.keys(pressures).length === 0) {
    return (
      <div className="gauges-grid-empty">
        <p>Нет данных о давлении</p>
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
      {grsConfig.LINES_IDS.map(lineId => {
        const pressureData = pressures[lineId];
        const lineName = lineNames ? lineNames[lineId] : `Линия ${lineId}`;
        const timestamp = timestamps ? timestamps[lineId] : null;

        // Determine if this is a high pressure line
        const isHighPressure = grsConfig.HIGH_P_LINES_IDS.includes(lineId);

        return (
          <PressureGauge
            key={lineId}
            lineId={lineId}
            lineName={lineName}
            pressure={pressureData?.pressure || 0}
            isHighPressure={isHighPressure}
            timestamp={timestamp || pressureData?.timestamp}
            flowData={flowMap[lineId]}
            volumeData={volumeMap[lineId]}
            dpData={pressureData?.dpData}
          />
        );
      })}
    </div>
  );
};

export default PressureGaugesGrid;
