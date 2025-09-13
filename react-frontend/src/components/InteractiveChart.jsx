import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush
} from 'recharts';
import './InteractiveChart.css';

const InteractiveChart = ({ data, archiveType, selectedLines }) => {
  const [visibleLines, setVisibleLines] = useState({});
  const [yAxisDomain, setYAxisDomain] = useState(['dataMin', 'dataMax']);

  // Initialize visible lines when data changes
  useEffect(() => {
    if (data && data.length > 0) {
      const initialVisible = {};
      const columns = getChartColumns();
      columns.forEach(col => {
        initialVisible[col.key] = true;
      });
      setVisibleLines(initialVisible);
    }
  }, [data, archiveType]);

  const getChartColumns = () => {
    switch (archiveType) {
      case 'daily':
      case 'hourly':
        return [
          { key: 'volume', label: 'Объем', color: '#8884d8' },
          { key: 'w_volume_dp', label: 'Раб. объем/перепад', color: '#82ca9d' },
          { key: 'pressure', label: 'Давление', color: '#ffc658' },
          { key: 'temperature', label: 'Температура', color: '#ff7300' },
          { key: 'density', label: 'Плотность', color: '#00ff00' }
        ];
      case 'param':
        return [
          { key: 'density', label: 'Плотность', color: '#8884d8' },
          { key: 'co2', label: 'CO2 (%)', color: '#82ca9d' },
          { key: 'n2', label: 'N2 (%)', color: '#ffc658' },
          { key: 'max_p', label: 'Макс. давление', color: '#ff7300' },
          { key: 'min_p', label: 'Мин. давление', color: '#00ff00' },
          { key: 'max_t', label: 'Макс. температура', color: '#ff0000' },
          { key: 'min_t', label: 'Мин. температура', color: '#0000ff' }
        ];
      case 'sys':
        return [
          { key: 'volume', label: 'Объем', color: '#8884d8' }
        ];
      case 'edit':
        return [
          { key: 'old_value', label: 'Старое значение', color: '#8884d8' },
          { key: 'new_value', label: 'Новое значение', color: '#82ca9d' }
        ];
      default:
        return [];
    }
  };

  const formatXAxisLabel = (value) => {
    const date = new Date(value);
    if (archiveType === 'daily') {
      return date.toLocaleDateString();
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{formatXAxisLabel(label)}</p>
          {payload.map((entry, index) => (
            <p key={index} className="tooltip-value" style={{ color: entry.color }}>
              {`${entry.name}: ${typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const toggleLine = (lineKey) => {
    setVisibleLines(prev => ({
      ...prev,
      [lineKey]: !prev[lineKey]
    }));
  };

  const columns = getChartColumns();

  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3>График данных</h3>
        </div>
        <div className="chart-placeholder">
          <p>Нет данных для отображения графика</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>График данных</h3>
        <div className="chart-controls">
          {columns.map((col) => (
            <button
              key={col.key}
              className={`line-toggle ${visibleLines[col.key] ? 'active' : ''}`}
              style={{
                borderColor: col.color,
                backgroundColor: visibleLines[col.key] ? col.color : 'transparent',
                color: visibleLines[col.key] ? 'white' : col.color
              }}
              onClick={() => toggleLine(col.key)}
            >
              {col.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={800}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
            <XAxis
              dataKey="period"
              tickFormatter={formatXAxisLabel}
              stroke="#9e9e9e"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis stroke="#9e9e9e" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {columns.map((col) => (
              visibleLines[col.key] && (
                <Line
                  key={col.key}
                  type="monotone"
                  dataKey={col.key}
                  stroke={col.color}
                  strokeWidth={2}
                  dot={{ fill: col.color, strokeWidth: 1, r: 2 }}
                  activeDot={{ r: 4, stroke: col.color, strokeWidth: 1 }}
                  name={col.label}
                />
              )
            ))}

            <Brush
              dataKey="period"
              height={30}
              stroke="#8884d8"
              tickFormatter={formatXAxisLabel}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default InteractiveChart;