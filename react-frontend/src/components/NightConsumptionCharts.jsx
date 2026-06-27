import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { TimeAxisTick, labelEveryFor } from '../utils/timeAxisTick';
import './NightConsumptionCharts.css';

// Same hue spread the GRS-trends chart uses, so the per-line night charts share
// its look. One evenly-spaced colour per line.
function trendColor(index, total) {
  const hue = Math.round((index * 360) / Math.max(total, 1));
  return `hsl(${hue}, 70%, 60%)`;
}

// Parse 'YYYY-MM-DD' as a LOCAL date (no timezone shift).
function parseDate(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Per-line night-consumption charts shown under the summary table. Visual style
// mirrors the GRS-trends chart (InteractiveChart): dark grid, #9e9e9e axes,
// monotone line, deterministic X labels via TimeAxisTick.
const NightConsumptionCharts = ({ tableData, lineIds, lineNames = {} }) => {
  const { t, getLocale } = useLanguage();

  if (!tableData?.length || !lineIds?.length) return null;

  const formatX = (value) => {
    const d = parseDate(value);
    return d ? d.toLocaleDateString(getLocale()) : String(value);
  };

  const NightTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const v = entry.value;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{formatX(label)}</p>
          <p className="tooltip-value" style={{ color: entry.color }}>
            {`${entry.name}: ${typeof v === 'number' ? v.toFixed(2) : v}`}
          </p>
        </div>
      );
    }
    return null;
  };

  const labelEvery = labelEveryFor(tableData.length);

  return (
    <div className="nc-charts-section">
      <h4 className="nc-charts-heading">{t('nightConsumptionChartsTitle')}</h4>
      <div className="nc-charts-grid">
        {lineIds.map((lineId, idx) => {
          const color = trendColor(idx, lineIds.length);
          const name = lineNames[lineId] || lineNames[Number(lineId)] || `Лінія ${lineId}`;
          const data = tableData.map(r => ({ period: r.date, value: r[`line_${lineId}`] }));
          const hasData = data.some(d => d.value !== null && d.value !== undefined);

          return (
            <div key={lineId} className="nc-chart-card">
              <h5 className="nc-chart-title" style={{ color }}>{name}</h5>
              {hasData ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                    <XAxis
                      dataKey="period"
                      stroke="#9e9e9e"
                      height={70}
                      interval={0}
                      tick={<TimeAxisTick total={data.length} labelEvery={labelEvery} formatter={formatX} />}
                    />
                    <YAxis
                      stroke="#9e9e9e"
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => +Number(v).toFixed(2)}
                    />
                    <Tooltip content={<NightTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={color}
                      strokeWidth={2}
                      dot={{ fill: color, strokeWidth: 1, r: 2 }}
                      activeDot={{ r: 4, stroke: color, strokeWidth: 1 }}
                      name={name}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="nc-chart-empty">{t('noDataAvailable')}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NightConsumptionCharts;
