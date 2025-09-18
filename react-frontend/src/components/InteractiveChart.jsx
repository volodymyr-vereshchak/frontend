import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [renderedChart, setRenderedChart] = useState(null);

  const renderCancelRef = useRef(null);
  const renderTimeoutRef = useRef(null);

  // Async chart rendering with cancellation
  const renderChartAsync = useCallback(async (chartData, archiveType, visibleLines) => {
    // Cancel any existing render
    if (renderCancelRef.current) {
      renderCancelRef.current.cancelled = true;
    }

    // Clear any pending timeout
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    // Create new cancellation token
    const cancelToken = { cancelled: false };
    renderCancelRef.current = cancelToken;

    setIsChartLoading(true);
    setRenderedChart(null);

    try {
      // Defer rendering to next event loop to not block UI
      await new Promise(resolve => {
        renderTimeoutRef.current = setTimeout(resolve, 50);
      });

      // Check if cancelled during timeout
      if (cancelToken.cancelled) {
        console.log('Chart rendering cancelled during timeout');
        return;
      }

      // Prepare chart components in chunks to avoid blocking
      const columns = getChartColumns();
      const chunks = [];

      // Process data in chunks
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < chartData.length; i += CHUNK_SIZE) {
        if (cancelToken.cancelled) {
          console.log('Chart rendering cancelled during data processing');
          return;
        }

        const chunk = chartData.slice(i, i + CHUNK_SIZE);
        chunks.push(chunk);

        // Yield control periodically
        if (i > 0 && i % (CHUNK_SIZE * 5) === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      // Check if cancelled before final render
      if (cancelToken.cancelled) {
        console.log('Chart rendering cancelled before final render');
        return;
      }

      // Create chart JSX
      const chartJSX = (
        <ResponsiveContainer width="100%" height={800}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
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
      );

      // Final check before setting rendered chart
      if (!cancelToken.cancelled) {
        setRenderedChart(chartJSX);
        setIsChartLoading(false);
        console.log('Chart rendered successfully');
      }

    } catch (error) {
      if (!cancelToken.cancelled) {
        console.error('Error rendering chart:', error);
        setIsChartLoading(false);
      }
    }
  }, []);

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

  // Trigger async chart rendering when data or settings change
  useEffect(() => {
    if (data && data.length > 0 && Object.keys(visibleLines).length > 0) {
      console.log('Starting async chart rendering...');
      renderChartAsync(data, archiveType, visibleLines);
    } else {
      setRenderedChart(null);
      setIsChartLoading(false);
    }
  }, [data, archiveType, visibleLines, renderChartAsync]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renderCancelRef.current) {
        renderCancelRef.current.cancelled = true;
      }
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, []);

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
      return date.toLocaleDateString('ru-RU');
    } else {
      return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU');
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
    console.log('Toggling line:', lineKey);
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
              disabled={isChartLoading}
            >
              {col.label}
            </button>
          ))}
        </div>
        {isChartLoading && (
          <div className="chart-loading-indicator">
            <span>🔄 Обновление графика...</span>
          </div>
        )}
      </div>

      <div className="chart-wrapper">
        {isChartLoading && !renderedChart && (
          <div className="chart-loading-overlay">
            <div className="loading-spinner"></div>
            <p>Отрисовка графика...</p>
          </div>
        )}

        {renderedChart && (
          <div className={`chart-content ${isChartLoading ? 'updating' : ''}`}>
            {renderedChart}
          </div>
        )}

        {!renderedChart && !isChartLoading && (
          <div className="chart-placeholder">
            <p>График готовится к отображению...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveChart;