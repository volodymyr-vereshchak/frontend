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
import { useLanguage } from '../contexts/LanguageContext';
import SimplifiedEnterpriseControl from './SimplifiedEnterpriseControl';

const InteractiveChart = ({ data, archiveType, selectedLines }) => {
  const { t, getLocale } = useLanguage();
  const [visibleLines, setVisibleLines] = useState({});
  const [yAxisDomain, setYAxisDomain] = useState(['dataMin', 'dataMax']);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [renderedChart, setRenderedChart] = useState(null);
  const [enterpriseOverlayData, setEnterpriseOverlayData] = useState(null);

  const renderCancelRef = useRef(null);
  const renderTimeoutRef = useRef(null);

  // Async chart rendering with cancellation
  const renderChartAsync = useCallback(async (chartData, archiveType, visibleLines, enterpriseData) => {
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

      // Sort data by period (date) to ensure correct chronological order in chart
      let sortedChartData = [...chartData].sort((a, b) => {
        const dateA = new Date(a.period);
        const dateB = new Date(b.period);
        return dateA - dateB;
      });

      // Merge enterprise data into main chart data if available
      if (enterpriseData && enterpriseData.byPeriod) {
        console.log('Merging enterprise data into chart data', {
          chartDataPeriods: sortedChartData.length,
          enterprisePeriods: Object.keys(enterpriseData.byPeriod).length,
          sampleChartPeriods: sortedChartData.slice(0, 3).map(d => d.period),
          sampleEnterprisePeriods: Object.keys(enterpriseData.byPeriod).slice(0, 3)
        });

        let matchedCount = 0;
        sortedChartData = sortedChartData.map(item => {
          const period = item.period;
          const enterpriseValues = enterpriseData.byPeriod[period];

          if (enterpriseValues) {
            matchedCount++;
            return {
              ...item,
              ...enterpriseValues // Add netVolume and/or totalEnterpriseVolume
            };
          }
          return item;
        });

        console.log(`Merged enterprise data: ${matchedCount}/${sortedChartData.length} periods matched`);
      }

      // Prepare chart components in chunks to avoid blocking
      const columns = getChartColumns();
      const chunks = [];

      // Process data in chunks
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < sortedChartData.length; i += CHUNK_SIZE) {
        if (cancelToken.cancelled) {
          console.log('Chart rendering cancelled during data processing');
          return;
        }

        const chunk = sortedChartData.slice(i, i + CHUNK_SIZE);
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
          <LineChart data={sortedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
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
            <Tooltip content={<CustomTooltip archiveType={archiveType} />} />
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

            {/* Enterprise Overlay Lines */}
            {/* Net Volume - shown when enterprise enabled and includeNet is true */}
            {enterpriseData?.includeNet && (
              <Line
                key="enterprise-net-volume"
                type="monotone"
                dataKey="netVolume"
                stroke="#33ff57"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 4, stroke: "#33ff57", strokeWidth: 1 }}
                name={t('netVolume') || 'Net Volume (Line - Enterprise)'}
                connectNulls={true}
              />
            )}

            {/* Total Enterprise - shown when enterprise enabled and includeTotal is true */}
            {enterpriseData?.includeTotal && (
              <Line
                key="enterprise-total"
                type="monotone"
                dataKey="totalEnterpriseVolume"
                stroke="#ff5733"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: "#ff5733", strokeWidth: 1 }}
                name={t('totalEnterpriseVolume') || 'Total Enterprise'}
                connectNulls={true}
              />
            )}


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
      renderChartAsync(data, archiveType, visibleLines, enterpriseOverlayData);
    } else {
      setRenderedChart(null);
      setIsChartLoading(false);
    }
  }, [data, archiveType, visibleLines, enterpriseOverlayData, renderChartAsync]);

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
          { key: 'volume', label: t('volumeLabel'), color: '#8884d8' },
          { key: 'w_volume_dp', label: t('workingVolumeDpLabel'), color: '#82ca9d' },
          { key: 'pressure', label: t('pressureLabel'), color: '#ffc658' },
          { key: 'temperature', label: t('temperatureLabel'), color: '#ff7300' },
          { key: 'density', label: t('densityLabel'), color: '#00ff00' }
        ];
      case 'param':
        return [
          { key: 'density', label: t('densityLabel'), color: '#8884d8' },
          { key: 'co2', label: t('co2Label'), color: '#82ca9d' },
          { key: 'n2', label: t('n2Label'), color: '#ffc658' },
          { key: 'max_p', label: t('maxPressureLabel'), color: '#ff7300' },
          { key: 'min_p', label: t('minPressureLabel'), color: '#00ff00' },
          { key: 'max_t', label: t('maxTemperatureLabel'), color: '#ff0000' },
          { key: 'min_t', label: t('minTemperatureLabel'), color: '#0000ff' }
        ];
      case 'sys':
        return [
          { key: 'volume', label: t('volumeLabel'), color: '#8884d8' }
        ];
      case 'edit':
        return [
          { key: 'old_value', label: t('oldValueLabel'), color: '#8884d8' },
          { key: 'new_value', label: t('newValueLabel'), color: '#82ca9d' }
        ];
      default:
        return [];
    }
  };

  const formatXAxisLabel = (value) => {
    const date = new Date(value);
    const locale = getLocale();
    // Show only date for daily and trends archives (date-only data)
    if (archiveType === 'daily' || archiveType === 'trends') {
      return date.toLocaleDateString(locale);
    } else {
      // Show date + time for hourly, param, sys, edit archives
      return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale);
    }
  };

  const CustomTooltip = ({ active, payload, label, archiveType: tooltipArchiveType }) => {
    if (active && payload && payload.length) {
      // Use the passed archiveType or fallback to component's archiveType
      const currentArchiveType = tooltipArchiveType || archiveType;
      const date = new Date(label);
      const locale = getLocale();

      let formattedLabel;
      // Show only date for daily and trends archives (date-only data)
      if (currentArchiveType === 'daily' || currentArchiveType === 'trends') {
        formattedLabel = date.toLocaleDateString(locale);
      } else {
        // Show date + time for hourly, param, sys, edit archives
        formattedLabel = date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale);
      }

      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{formattedLabel}</p>
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

  // Handle enterprise overlay data changes
  const handleEnterpriseDataChange = useCallback((data) => {
    console.log('Enterprise overlay data changed:', data);
    setEnterpriseOverlayData(data);
  }, []);


  // Extract date range from data for EnterpriseOverlayControl
  const extractDateRange = useCallback(() => {
    if (!data || data.length === 0) return null;

    const sortedData = [...data].sort((a, b) => {
      const dateA = new Date(a.period);
      const dateB = new Date(b.period);
      return dateA - dateB;
    });

    const fromDate = sortedData[0].period.split('T')[0];
    const toDate = sortedData[sortedData.length - 1].period.split('T')[0];

    return { fromDate, toDate };
  }, [data]);

  const columns = getChartColumns();

  if (!data || data.length === 0) {
    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3>{t('chartTitle')}</h3>
        </div>
        <div className="chart-placeholder">
          <p>{t('noChartData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>{t('chartTitle')}</h3>
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

          {/* Enterprise Overlay Control - only for daily/hourly archives */}
          {(archiveType === 'daily' || archiveType === 'hourly') && selectedLines && extractDateRange() && (
            <SimplifiedEnterpriseControl
              selectedLines={selectedLines}
              dateRange={extractDateRange()}
              archiveType={archiveType}
              onEnterpriseDataChange={handleEnterpriseDataChange}
            />
          )}
        </div>

        {isChartLoading && (
          <div className="chart-loading-indicator">
            <span>🔄 {t('updatingChart')}</span>
          </div>
        )}
      </div>

      <div className="chart-wrapper">
        {isChartLoading && !renderedChart && (
          <div className="chart-loading-overlay">
            <div className="loading-spinner"></div>
            <p>{t('renderingChart')}</p>
          </div>
        )}

        {renderedChart && (
          <div className={`chart-content ${isChartLoading ? 'updating' : ''}`}>
            {renderedChart}
          </div>
        )}

        {!renderedChart && !isChartLoading && (
          <div className="chart-placeholder">
            <p>{t('chartPreparation')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveChart;