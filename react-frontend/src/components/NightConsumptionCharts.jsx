import React, { useMemo } from 'react';
import InteractiveChart from './InteractiveChart';
import { useLanguage } from '../contexts/LanguageContext';
import './NightConsumptionCharts.css';

// Single chart with ALL lines (one series per line) shown under the night-
// consumption summary table. Reuses InteractiveChart's "trends" mode, so it gets
// the exact same look AND the lines dropdown (toggle lines on/off) as GRS-trends.
const NightConsumptionCharts = ({ tableData, lineIds, lineNames = {} }) => {
  const { t } = useLanguage();

  // Reshape the table into the trends data format: one point per commercial day,
  // a `line_<id>` key per line carrying that day's nightly MIN net consumption.
  const chartData = useMemo(() => {
    if (!tableData?.length || !lineIds?.length) return [];
    return tableData.map(row => {
      const point = { period: row.date };
      lineIds.forEach(id => { point[`line_${id}`] = row[`line_${id}`]; });
      return point;
    });
  }, [tableData, lineIds]);

  if (!chartData.length) return null;

  return (
    <div className="nc-charts-section">
      <h4 className="nc-charts-heading">{t('nightConsumptionChartsTitle')}</h4>
      <InteractiveChart
        data={chartData}
        archiveType="trends"
        selectedLines={lineIds}
        lineNames={lineNames}
      />
    </div>
  );
};

export default NightConsumptionCharts;
