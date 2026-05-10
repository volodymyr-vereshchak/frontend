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

const InteractiveChart = ({ data, archiveType, selectedLines, isVirtualLine }) => {
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
    if (renderCancelRef.current) {
      renderCancelRef.current.cancelled = true;
    }
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    const cancelToken = { cancelled: false };
    renderCancelRef.current = cancelToken;

    setIsChartLoading(true);
    setRenderedChart(null);

    try {
      await new Promise(resolve => {
        renderTimeoutRef.current = setTimeout(resolve, 50);
      });

      if (cancelToken.cancelled) {
        console.log('Chart rendering cancelled during timeout');
        return;
      }

      let sortedChartData = [...chartData].sort((a, b) => {
        const dateA = new Date(a.period);
        const dateB = new Date(b.period);
        return dateA - dateB;
      });

      if (enterpriseData && enterpriseData.byPeriod) {
        console.log('Merging enterprise data into chart data', {
          chartDataPeriods: sortedChartData.length,
          enterprisePeriods: Object.keys(enterpriseData.byPeriod).length,
          sampleChartPeriods: sortedChartData.slice(0, 3).map(d => d.period),
          sampleEnterprisePeriods: Object.keys(enterpriseData.byPeriod).slice(0, 3),
          sampleChartData: sortedChartData.slice(0, 2).map(d => ({ period: d.period, volume: d.volume }))
        });

        let matchedCount = 0;
        sortedChartData = sortedChartData.map(item => {
          const raw = String(item.period || '').replace(' ', 'T');
          const periodKey = archiveType === 'hourly' ? raw.slice(0, 13) : raw.slice(0, 10);
          const enterpriseValues = enterpriseData.byPeriod[periodKey];

          if (enterpriseValues) {
            matchedCount++;
            const lineVolume = item.volume || 0;
            const enterpriseVolume = enterpriseValues.totalEnterpriseVolume || 0;
            const netVolume = lineVolume - enterpriseVolume;
            return {
              ...item,
              totalEnterpriseVolume: enterpriseVolume,
              netVolume: enterpriseData.includeNet ? netVolume : undefined
            };
          }
          return item;
        });

        console.log(`Merged enterprise data: ${matchedCount}/${sortedChartData.length} periods matched`, {
          sampleMerged: sortedChartData.slice(0, 2).map(d => ({
            period: d.period,
            volume: d.volume,
            totalEnterpriseVolume: d.totalEnterpriseVolume,
            netVolume: d.netVolume
          }))
        });
      }

      const columns = getChartColumns();
      const chunks = [];

      const CHUNK_SIZE = 1000;
      for (let i = 0; i < sortedChartData.length; i += CHUNK_SIZE) {
        if (cancelToken.cancelled) {
          console.log('Chart rendering cancelled during data processing');
          return;
        }
        const chunk = sortedChartData.slice(i, i + CHUNK_SIZE);
        chunks.push(chunk);
        if (i > 0 && i % (CHUNK_SIZE * 5) === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      if (cancelToken.cancelled) {
        console.log('Chart rendering cancelled before final render');
        return;
      }

      const isDualAxis = (archiveType === 'daily' || archiveType === 'hourly') && !isVirtualLine;

      const chartJSX = (
        <ResponsiveContainer width="100%" height={800}>
          <LineChart data={sortedChartData} margin={{ top: 10, right: isDualAxis ? 5 : 5, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
            <XAxis
              dataKey="period"
              tickFormatter={formatXAxisLabel}
              stroke="#9e9e9e"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis yAxisId="left" stroke="#9e9e9e" domain={['auto', 'auto']} allowDataOverflow={false} />
            {isDualAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                width={45}
                stroke="#9e9e9e"
                domain={[(dataMin) => dataMin - 0.25, (dataMax) => dataMax + 0.25]}
                allowDataOverflow={false}
                tickFormatter={(v) => +v.toFixed(2)}
              />
            )}
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
                  yAxisId={col.yAxisId || 'left'}
                />
              )
            ))}

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
                yAxisId="left"
              />
            )}

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
                yAxisId="left"
              />
            )}

          </LineChart>
        </ResponsiveContainer>
      );

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
      const columns = getChartColumns();
      const storageKey = `hlviewer-chart-visible-${archiveType}`;
      const savedPreferences = localStorage.getItem(storageKey);
      const initialVisible = {};

      if (savedPreferences) {
        try {
          const saved = JSON.parse(savedPreferences);
          columns.forEach(col => {
            initialVisible[col.key] = saved[col.key] !== undefined ? saved[col.key] : true;
          });
        } catch (e) {
          columns.forEach(col => { initialVisible[col.key] = true; });
        }
      } else {
        columns.forEach(col => { initialVisible[col.key] = true; });
      }

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
        if (isVirtualLine) {
          return [
            { key: 'volume', label: t('volumeLabel'), color: '#8884d8', yAxisId: 'left' }
          ];
        }
        return [
          { key: 'volume', label: t('volumeLabel'), color: '#8884d8', yAxisId: 'left' },
          { key: 'w_volume_dp', label: t('workingVolumeDpLabel'), color: '#82ca9d', yAxisId: 'left' },
          { key: 'pressure', label: t('pressureLabel'), color: '#ffc658', yAxisId: 'right' },
          { key: 'temperature', label: t('temperatureLabel'), color: '#ff7300', yAxisId: 'right' },
        ];
      case 'param':
        return [
          { key: 'density', label: t('densityLabel'), color: '#8884d8', yAxisId: 'left' },
          { key: 'co2', label: t('co2Label'), color: '#82ca9d', yAxisId: 'left' },
          { key: 'n2', label: t('n2Label'), color: '#ffc658', yAxisId: 'left' },
          { key: 'max_p', label: t('maxPressureLabel'), color: '#ff7300', yAxisId: 'left' },
          { key: 'min_p', label: t('minPressureLabel'), color: '#00ff00', yAxisId: 'left' },
          { key: 'max_t', label: t('maxTemperatureLabel'), color: '#ff0000', yAxisId: 'left' },
          { key: 'min_t', label: t('minTemperatureLabel'), color: '#0000ff', yAxisId: 'left' }
        ];
      case 'sys':
        return [
          { key: 'volume', label: t('volumeLabel'), color: '#8884d8', yAxisId: 'left' }
        ];
      case 'edit':
        return [
          { key: 'old_value', label: t('oldValueLabel'), color: '#8884d8', yAxisId: 'left' },
          { key: 'new_value', label: t('newValueLabel'), color: '#82ca9d', yAxisId: 'left' }
        ];
      default:
        return [];
    }
  };

  const formatXAxisLabel = (value) => {
    const date = new Date(value);
    const locale = getLocale();
    if (archiveType === 'daily' || archiveType === 'trends') {
      return date.toLocaleDateString(locale);
    } else {
      return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale);
    }
  };

  const CustomTooltip = ({ active, payload, label, archiveType: tooltipArchiveType }) => {
    if (active && payload && payload.length) {
      const currentArchiveType = tooltipArchiveType || archiveType;
      const date = new Date(label);
      const locale = getLocale();

      let formattedLabel;
      if (currentArchiveType === 'daily' || currentArchiveType === 'trends') {
        formattedLabel = date.toLocaleDateString(locale);
      } else {
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
    setVisibleLines(prev => {
      const newVisibleLines = {
        ...prev,
        [lineKey]: !prev[lineKey]
      };
      const storageKey = `hlviewer-chart-visible-${archiveType}`;
      localStorage.setItem(storageKey, JSON.stringify(newVisibleLines));
      return newVisibleLines;
    });
  };

  const handleEnterpriseDataChange = useCallback((data) => {
    console.log('Enterprise overlay data changed:', data);
    setEnterpriseOverlayData(data);
  }, []);

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

          {(archiveType === 'daily' || archiveType === 'hourly') && selectedLines && extractDateRange() && (
            <SimplifiedEnterpriseControl
              selectedLines={selectedLines}
              dateRange={extractDateRange()}
              archiveType={archiveType}
              isVirtualLine={isVirtualLine}
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
