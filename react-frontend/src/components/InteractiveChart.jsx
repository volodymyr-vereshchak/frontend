import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { DP_UNIT_DEFAULT, PRESSURE_UNIT_DEFAULT, convertPressureValue } from '../constants/pressureUnits';

function generateTrendColor(index, total) {
  const hue = Math.round((index * 360) / total);
  return `hsl(${hue}, 70%, 60%)`;
}

// Parse a period string to a LOCAL Date without timezone shift. Handles all the
// shapes that flow through here: 'YYYY-MM-DD', 'YYYY-MM-DDTHH' (13-char trend
// key — note: no minutes, so new Date() would return Invalid Date),
// 'YYYY-MM-DDTHH:MM[:SS]' and 'YYYY-MM-DD HH:MM:SS'. Returns null if unparseable.
function parsePeriod(value) {
  const m = String(value ?? '').replace(' ', 'T')
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0'] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
}

// Does a period string carry an hour component (hourly) vs date-only (daily)?
function periodHasTime(value) {
  return /T\d{2}/.test(String(value ?? '').replace(' ', 'T'));
}

const InteractiveChart = ({ data, archiveType, selectedLines, isVirtualLine, lineNames = {}, lineUnits = null, trendsEnterpriseChecked = false, onTrendsEnterpriseChange = null }) => {
  const { t, getLocale } = useLanguage();
  const [visibleLines, setVisibleLines] = useState({});
  const [yAxisDomain, setYAxisDomain] = useState(['dataMin', 'dataMax']);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [renderedChart, setRenderedChart] = useState(null);
  const [enterpriseOverlayData, setEnterpriseOverlayData] = useState(null);

  const [linesDropdownOpen, setLinesDropdownOpen] = useState(false);
  const linesDropdownRef = useRef(null);
  const renderCancelRef = useRef(null);
  const renderTimeoutRef = useRef(null);

  const pressureUnit = lineUnits?.pressure_unit || PRESSURE_UNIT_DEFAULT;
  const dpUnit = lineUnits?.dp_unit || DP_UNIT_DEFAULT;
  // Output (downstream) pressure series = pressure − dP, only for low-pressure
  // non-meter lines (meter=false AND not high pressure) in daily/hourly archives.
  const showOutputPressure =
    !isVirtualLine &&
    !!lineUnits &&
    !lineUnits.meter &&
    !lineUnits.is_high_pressure &&
    (archiveType === 'daily' || archiveType === 'hourly');

  // Inject the computed output_pressure field into the chart data so the series
  // can pick it up via dataKey (dP converted into the pressure unit, then subtracted).
  const chartData = useMemo(() => {
    if (!showOutputPressure || !Array.isArray(data)) return data;
    return data.map(d => ({
      ...d,
      output_pressure: (d.pressure || 0) - convertPressureValue(d.w_volume_dp || 0, dpUnit, pressureUnit),
    }));
  }, [data, showOutputPressure, dpUnit, pressureUnit]);

  // Async chart rendering with cancellation.
  // `columns` and `isDualAxis` are computed fresh by the caller and passed in:
  // this callback has empty deps (to avoid re-render loops on every `t`/props
  // change), so it must NOT call getChartColumns() itself — that closure would be
  // stale and would, e.g., drop the conditional output_pressure series.
  const renderChartAsync = useCallback(async (chartData, archiveType, visibleLines, enterpriseData, columns, isDualAxis) => {
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

      // Sort by ISO-like period string (correct order; avoids Invalid Date on the
      // 13-char 'YYYY-MM-DDTHH' hourly-trend key).
      let sortedChartData = [...chartData].sort((a, b) =>
        String(a.period).localeCompare(String(b.period))
      );

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
  }, [data, archiveType, showOutputPressure]);

  // Trigger async chart rendering when data or settings change
  useEffect(() => {
    if (chartData && chartData.length > 0 && Object.keys(visibleLines).length > 0) {
      console.log('Starting async chart rendering...');
      const cols = getChartColumns();
      const isDualAxis = (archiveType === 'daily' || archiveType === 'hourly') && !isVirtualLine;
      renderChartAsync(chartData, archiveType, visibleLines, enterpriseOverlayData, cols, isDualAxis);
    } else {
      setRenderedChart(null);
      setIsChartLoading(false);
    }
  }, [chartData, archiveType, visibleLines, enterpriseOverlayData, renderChartAsync]);

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

  // Close lines dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (linesDropdownRef.current && !linesDropdownRef.current.contains(e.target)) {
        setLinesDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getChartColumns = () => {
    // Meter lines store working volume (m³) in w_volume_dp; others store dP.
    const wVolumeDpLabel = lineUnits?.meter
      ? `${t('workingVolume')}, ${t('volumeUnit')}`
      : `${t('differentialPressure')}, ${dpUnit}`;
    switch (archiveType) {
      case 'trends': {
        if (!data || data.length === 0) return [];
        const lineKeys = Object.keys(data[0]).filter(
          k => k.startsWith('line_') && !k.endsWith('_volume') && !k.endsWith('_enterprise')
        );
        return lineKeys.map((key, idx) => {
          const lineId = key.replace('line_', '');
          const label = lineNames[lineId] || lineNames[Number(lineId)] || `Лінія ${lineId}`;
          return { key, label, color: generateTrendColor(idx, lineKeys.length), yAxisId: 'left' };
        });
      }
      case 'daily':
      case 'hourly':
        if (isVirtualLine) {
          return [
            { key: 'volume', label: t('volumeLabel'), color: '#8884d8', yAxisId: 'left' }
          ];
        }
        return [
          { key: 'volume', label: t('volumeLabel'), color: '#8884d8', yAxisId: 'left' },
          { key: 'w_volume_dp', label: wVolumeDpLabel, color: '#82ca9d', yAxisId: 'left' },
          { key: 'pressure', label: `${t('pressureLabel')}, ${pressureUnit}`, color: '#ffc658', yAxisId: 'right' },
          ...(showOutputPressure
            ? [{ key: 'output_pressure', label: `${t('outputPressure')}, ${pressureUnit}`, color: '#e91e63', yAxisId: 'right' }]
            : []),
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
    const date = parsePeriod(value);
    const locale = getLocale();
    if (!date) return String(value);
    // Date-only for daily / daily-trend; date+time when the period carries an hour
    // (hourly trend or hourly archive).
    const dateOnly = (archiveType === 'daily' || archiveType === 'trends') && !periodHasTime(value);
    if (dateOnly) {
      return date.toLocaleDateString(locale);
    }
    return date.toLocaleDateString(locale) + ' ' +
      date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  const CustomTooltip = ({ active, payload, label, archiveType: tooltipArchiveType }) => {
    if (active && payload && payload.length) {
      const currentArchiveType = tooltipArchiveType || archiveType;
      const date = parsePeriod(label);
      const locale = getLocale();

      let formattedLabel;
      if (!date) {
        formattedLabel = String(label);
      } else {
        const dateOnly = (currentArchiveType === 'daily' || currentArchiveType === 'trends') && !periodHasTime(label);
        formattedLabel = dateOnly
          ? date.toLocaleDateString(locale)
          : date.toLocaleDateString(locale) + ' ' +
            date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
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
    // ISO-like period strings sort correctly as plain strings (avoids new Date()
    // returning Invalid Date for the 13-char 'YYYY-MM-DDTHH' trend key).
    const sortedData = [...data].sort((a, b) =>
      String(a.period).localeCompare(String(b.period))
    );
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
          {archiveType === 'trends' && onTrendsEnterpriseChange && (
            <label className="chart-enterprise-checkbox">
              <input
                type="checkbox"
                checked={trendsEnterpriseChecked}
                onChange={onTrendsEnterpriseChange}
                disabled={isChartLoading}
              />
              <span>{t('enterpriseOverlay')}</span>
            </label>
          )}

          {archiveType === 'trends' ? (
            /* Dropdown for trends — can have many lines */
            <div className="lines-dropdown" ref={linesDropdownRef}>
              <button
                className="lines-dropdown-trigger"
                onClick={() => setLinesDropdownOpen(o => !o)}
                disabled={isChartLoading}
              >
                Лінії ({Object.values(visibleLines).filter(Boolean).length}/{columns.length})
                <span style={{ marginLeft: 6 }}>{linesDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {linesDropdownOpen && (
                <div className="lines-dropdown-menu">
                  <div className="lines-dropdown-actions">
                    <button onClick={() => {
                      const all = {};
                      columns.forEach(c => { all[c.key] = true; });
                      setVisibleLines(all);
                    }}>Всі</button>
                    <button onClick={() => {
                      const none = {};
                      columns.forEach(c => { none[c.key] = false; });
                      setVisibleLines(none);
                    }}>Жодної</button>
                  </div>
                  {columns.map(col => (
                    <label key={col.key} className="lines-dropdown-item">
                      <input
                        type="checkbox"
                        checked={!!visibleLines[col.key]}
                        onChange={() => toggleLine(col.key)}
                      />
                      <span
                        className="lines-dropdown-color"
                        style={{ background: col.color }}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Regular toggle buttons for daily/hourly/etc */
            columns.map((col) => (
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
            ))
          )}

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
