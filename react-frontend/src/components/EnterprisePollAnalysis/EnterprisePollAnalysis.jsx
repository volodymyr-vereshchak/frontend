import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ru, uk } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './EnterprisePollAnalysis.css';
import { useLanguage } from '../../contexts/LanguageContext';
import { enterprisePollApi, enterpriseApi, lineApi } from '../../services/api';

// Register locales
registerLocale('ru', ru);
registerLocale('uk', uk);

/**
 * Enterprise Poll Analysis Component
 * Allows viewing unpolled enterprises and polling specific enterprises
 */
const EnterprisePollAnalysis = () => {
  const { language, t } = useLanguage();

  // State
  const [enterprises, setEnterprises] = useState([]);
  const [lineNames, setLineNames] = useState({});
  const [collapsedLines, setCollapsedLines] = useState({});
  const [unpolledEnterprises, setUnpolledEnterprises] = useState([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState(null);
  const [pollResults, setPollResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPollLoading, setIsPollLoading] = useState(false);
  const [isCheckingUnpolled, setIsCheckingUnpolled] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodType, setPeriodType] = useState('daily');
  const [showUnpolledModal, setShowUnpolledModal] = useState(false);

  // Chart visibility toggles
  const [showVolume, setShowVolume] = useState(true);
  const [showTemperature, setShowTemperature] = useState(true);
  const [showPressure, setShowPressure] = useState(true);

  // Date picker refs
  const startPickerRef = useRef(null);
  const endPickerRef = useRef(null);

  // Date range state - default to last 7 days
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    date.setHours(7, 0, 0, 0);
    return date;
  };

  const getDefaultEndDate = () => {
    const date = new Date();
    date.setHours(6, 0, 0, 0);
    return date;
  };

  const [startDateTime, setStartDateTime] = useState(getDefaultStartDate());
  const [endDateTime, setEndDateTime] = useState(getDefaultEndDate());

  const currentLocale = language === 'uk' ? 'uk' : 'ru';

  /**
   * Format date for API
   */
  const formatDateForAPI = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * Load all enterprises and line names
   */
  const loadEnterprises = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load enterprises and lines in parallel
      const [enterprisesData, linesData] = await Promise.all([
        enterprisePollApi.getAllEnterprises(),
        lineApi.getLinesByLumg(1)
      ]);

      // Build line names map
      const namesMap = {};
      if (linesData && Array.isArray(linesData)) {
        linesData.forEach(line => {
          namesMap[line.id] = line.name || `${t('lineName')} ${line.id}`;
        });
      }
      setLineNames(namesMap);

      if (enterprisesData && Array.isArray(enterprisesData)) {
        setEnterprises(enterprisesData);
      } else {
        setEnterprises([]);
      }
    } catch (err) {
      console.error('Error loading enterprises:', err);
      setError(t('pollError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  /**
   * Check for unpolled enterprises (last 3 days)
   */
  const checkUnpolledEnterprises = useCallback(async () => {
    if (enterprises.length === 0) return;

    setIsCheckingUnpolled(true);
    setError(null);

    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const today = new Date();

      // Get unique line IDs from active enterprises
      const activeEnterprises = enterprises.filter(e => e.active);
      const lineIds = [...new Set(activeEnterprises.map(e => e.line_id))];

      if (lineIds.length === 0) {
        setUnpolledEnterprises([]);
        setShowUnpolledModal(true);
        return;
      }

      // Fetch volume data for all lines
      const volumeData = await enterpriseApi.getEnterpriseVolumes(
        lineIds,
        formatDateForAPI(threeDaysAgo),
        formatDateForAPI(today),
        'daily'
      );

      // Collect device keys that have actual volume data (not null)
      const polledDevices = new Set();
      if (volumeData && Array.isArray(volumeData)) {
        volumeData.forEach(record => {
          if (record.devices && Array.isArray(record.devices)) {
            record.devices.forEach(d => {
              // Only count as polled if volume is not null/undefined
              if (d.volume != null) {
                polledDevices.add(`${d.serNum}_${d.chNum}`);
              }
            });
          }
        });
      }

      // Find active enterprises without data or with null volumes
      const unpolled = activeEnterprises.filter(e =>
        !polledDevices.has(`${e.serNum}_${e.chNum}`)
      );

      setUnpolledEnterprises(unpolled);
      setShowUnpolledModal(true);
    } catch (err) {
      console.error('Error checking unpolled enterprises:', err);
      setError(t('pollError'));
    } finally {
      setIsCheckingUnpolled(false);
    }
  }, [enterprises, t]);

  /**
   * Poll selected enterprise
   */
  const pollEnterprise = useCallback(async () => {
    if (!selectedEnterprise) return;

    setIsPollLoading(true);
    setError(null);
    setPollResults([]);

    try {
      const data = await enterprisePollApi.pollEnterpriseDevice(
        selectedEnterprise.line_id,
        selectedEnterprise.serNum,
        selectedEnterprise.chNum,
        formatDateForAPI(startDateTime),
        formatDateForAPI(endDateTime),
        periodType
      );

      if (data && Array.isArray(data)) {
        // Backend returns device data in devices array
        // Volume is in device.volume, not record.total_volume
        const results = data.map(record => {
          const device = record.devices?.[0];
          return {
            period: record.period,
            volume: device?.volume ?? null,
            temperature: device?.temperature ?? null,
            pressure: device?.pressure ?? null
          };
        }).sort((a, b) => new Date(a.period) - new Date(b.period));

        setPollResults(results);
      }
    } catch (err) {
      console.error('Error polling enterprise:', err);
      setError(t('pollError'));
    } finally {
      setIsPollLoading(false);
    }
  }, [selectedEnterprise, startDateTime, endDateTime, periodType, t]);

  /**
   * Initial load
   */
  useEffect(() => {
    loadEnterprises();
  }, [loadEnterprises]);

  /**
   * Filter enterprises by search query
   */
  const filteredEnterprises = useMemo(() => {
    if (!searchQuery.trim()) return enterprises;

    const query = searchQuery.toLowerCase();
    return enterprises.filter(e =>
      e.enterprise_name.toLowerCase().includes(query)
    );
  }, [enterprises, searchQuery]);

  /**
   * Group enterprises by line_id for better display
   */
  const enterprisesByLine = useMemo(() => {
    const grouped = {};
    filteredEnterprises.forEach(e => {
      if (!grouped[e.line_id]) {
        grouped[e.line_id] = [];
      }
      grouped[e.line_id].push(e);
    });
    return grouped;
  }, [filteredEnterprises]);

  /**
   * Format period for display
   */
  const formatPeriod = (period) => {
    if (!period) return '';
    const date = new Date(period);
    const locale = currentLocale === 'uk' ? 'uk-UA' : 'ru-RU';

    if (periodType === 'daily') {
      // Только дата, без времени
      return date.toLocaleDateString(locale);
    } else if (periodType === 'hourly') {
      // Дата + время (часы:минуты, без секунд)
      return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
    return date.toLocaleDateString(locale);
  };

  /**
   * Форматирование чисел: 2 знака после запятой, пробелы в разрядах тысяч
   * Соответствует DataTable.jsx (строки 551-565)
   */
  const formatNumber = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return value;

    const formatted = value.toFixed(2);
    const [integerPart, decimalPart] = formatted.split('.');
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + decimalPart;
  };

  /**
   * Calculate totals and averages
   */
  const totals = useMemo(() => {
    if (pollResults.length === 0) {
      return { volume: 0, temperature: 0, pressure: 0 };
    }

    // Sum for volume
    const totalVolume = pollResults.reduce((acc, r) => acc + (r.volume ?? 0), 0);

    // Average for temperature
    const tempValues = pollResults
      .map(r => r.temperature)
      .filter(v => v != null);
    const avgTemperature = tempValues.length > 0
      ? tempValues.reduce((sum, v) => sum + v, 0) / tempValues.length
      : 0;

    // Average for pressure
    const pressValues = pollResults
      .map(r => r.pressure)
      .filter(v => v != null);
    const avgPressure = pressValues.length > 0
      ? pressValues.reduce((sum, v) => sum + v, 0) / pressValues.length
      : 0;

    return {
      volume: totalVolume,
      temperature: avgTemperature,
      pressure: avgPressure
    };
  }, [pollResults]);

  /**
   * Toggle line collapse state
   */
  const toggleLineCollapse = (lineId) => {
    setCollapsedLines(prev => ({
      ...prev,
      [lineId]: !prev[lineId]
    }));
  };

  /**
   * Get line name by ID
   */
  const getLineName = (lineId) => {
    return lineNames[lineId] || `${t('lineName')} ${lineId}`;
  };

  /**
   * Handle date picker changes
   */
  const handleStartDateTimeChange = (date) => {
    setStartDateTime(date);
  };

  const handleEndDateTimeChange = (date) => {
    setEndDateTime(date);
  };

  const handleStartDateSelect = (date) => {
    setStartDateTime(date);
    setTimeout(() => {
      if (startPickerRef.current) {
        startPickerRef.current.setOpen(false);
      }
    }, 100);
  };

  const handleEndDateSelect = (date) => {
    setEndDateTime(date);
    setTimeout(() => {
      if (endPickerRef.current) {
        endPickerRef.current.setOpen(false);
      }
    }, 100);
  };

  /**
   * Highlight today's date
   */
  const getTodayClassName = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate.getTime() === today.getTime() ? 'react-datepicker__day--today-highlight' : undefined;
  };

  /**
   * Custom header for date picker
   */
  const renderCustomHeader = ({
    date,
    changeYear,
    changeMonth,
    decreaseMonth,
    increaseMonth,
    prevMonthButtonDisabled,
    nextMonthButtonDisabled
  }) => {
    const months = currentLocale === 'ru'
      ? ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
      : ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

    return (
      <div className="custom-header">
        <button
          type="button"
          onClick={decreaseMonth}
          disabled={prevMonthButtonDisabled}
          className="header-arrow"
        >
          {'<'}
        </button>

        <div className="header-center">
          <select
            value={date.getMonth()}
            onChange={({ target: { value } }) => changeMonth(Number(value))}
            className="month-select"
          >
            {months.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>

          <div className="year-control">
            <button
              type="button"
              onClick={() => changeYear(date.getFullYear() - 1)}
              className="year-arrow"
            >
              ▲
            </button>
            <span className="year-display">{date.getFullYear()}</span>
            <button
              type="button"
              onClick={() => changeYear(date.getFullYear() + 1)}
              className="year-arrow"
            >
              ▼
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={increaseMonth}
          disabled={nextMonthButtonDisabled}
          className="header-arrow"
        >
          {'>'}
        </button>
      </div>
    );
  };

  /**
   * Custom tooltip for chart
   */
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="poll-chart-tooltip">
        <p className="tooltip-period">{formatPeriod(label)}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? formatNumber(entry.value) : '-'}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="enterprise-poll-analysis">
      {/* Header with Date Pickers */}
      <div className="poll-header">
        <div className="poll-controls-left">
          <button
            className={`period-button ${periodType === 'daily' ? 'active' : ''}`}
            onClick={() => setPeriodType('daily')}
          >
            {t('dailyPoll')}
          </button>
          <button
            className={`period-button ${periodType === 'hourly' ? 'active' : ''}`}
            onClick={() => setPeriodType('hourly')}
          >
            {t('hourlyPoll')}
          </button>
        </div>

        <div className="poll-date-pickers">
          <label className="picker-label">{t('periodStart')}</label>
          <DatePicker
            ref={startPickerRef}
            selected={startDateTime}
            onChange={handleStartDateTimeChange}
            showTimeSelect={periodType === 'hourly'}
            timeIntervals={60}
            timeFormat="HH:mm"
            dateFormat={periodType === 'hourly' ? "dd.MM.yyyy HH:mm" : "dd.MM.yyyy"}
            className="datetime-picker"
            locale={currentLocale}
            placeholderText={t('selectDateTime')}
            shouldCloseOnSelect={periodType === 'daily'}
            onSelect={handleStartDateSelect}
            dayClassName={getTodayClassName}
            renderCustomHeader={renderCustomHeader}
            todayButton={t('today')}
          />

          <label className="picker-label">{t('periodEnd')}</label>
          <DatePicker
            ref={endPickerRef}
            selected={endDateTime}
            onChange={handleEndDateTimeChange}
            showTimeSelect={periodType === 'hourly'}
            timeIntervals={60}
            timeFormat="HH:mm"
            dateFormat={periodType === 'hourly' ? "dd.MM.yyyy HH:mm" : "dd.MM.yyyy"}
            className="datetime-picker"
            locale={currentLocale}
            placeholderText={t('selectDateTime')}
            minDate={startDateTime}
            shouldCloseOnSelect={periodType === 'daily'}
            onSelect={handleEndDateSelect}
            dayClassName={getTodayClassName}
            renderCustomHeader={renderCustomHeader}
            todayButton={t('today')}
          />

          <button
            className="poll-action-button"
            onClick={pollEnterprise}
            disabled={isPollLoading || !selectedEnterprise}
            title={!selectedEnterprise ? t('selectEnterprise') : t('poll')}
          >
            {isPollLoading ? '...' : t('poll')}
          </button>
        </div>

        <div className="poll-controls-right">
          <button
            className="unpolled-button"
            onClick={checkUnpolledEnterprises}
            disabled={isCheckingUnpolled || isLoading}
          >
            {isCheckingUnpolled ? '...' : t('unpolledEnterprises')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="poll-content">
        {/* Left Panel - Enterprise List */}
        <div className="poll-sidebar">
          <div className="search-box">
            <input
              type="text"
              placeholder={t('searchEnterprise')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="enterprise-list">
            {isLoading ? (
              <div className="loading-message">{t('loadingEnterprises')}</div>
            ) : (
              Object.entries(enterprisesByLine).map(([lineId, lineEnterprises]) => (
                <div key={lineId} className="line-group">
                  <div
                    className="line-header"
                    onClick={() => toggleLineCollapse(lineId)}
                  >
                    <span className={`collapse-icon ${collapsedLines[lineId] ? 'collapsed' : ''}`}>
                      ▼
                    </span>
                    <span className="line-name">{getLineName(parseInt(lineId))}</span>
                    <span className="enterprise-count">({lineEnterprises.length})</span>
                  </div>
                  {!collapsedLines[lineId] && lineEnterprises.map(enterprise => (
                    <div
                      key={`${enterprise.serNum}_${enterprise.chNum}`}
                      className={`enterprise-item ${
                        selectedEnterprise?.serNum === enterprise.serNum &&
                        selectedEnterprise?.chNum === enterprise.chNum
                          ? 'selected'
                          : ''
                      } ${!enterprise.active ? 'inactive' : ''}`}
                      onClick={() => setSelectedEnterprise(enterprise)}
                    >
                      <span className="enterprise-name">{enterprise.enterprise_name}</span>
                      {!enterprise.active && <span className="inactive-badge">inactive</span>}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="enterprise-stats">
            <span>{t('totalEnterprises')}: {enterprises.length}</span>
            <span>{t('activeEnterprises')}: {enterprises.filter(e => e.active).length}</span>
          </div>
        </div>

        {/* Right Panel - Poll Results */}
        <div className="poll-main">
          {selectedEnterprise ? (
            <>
              {/* Selected Enterprise Info */}
              <div className="selected-enterprise-header">
                <h3>{selectedEnterprise.enterprise_name}</h3>
                <span className="enterprise-details">
                  {getLineName(selectedEnterprise.line_id)} |
                  SN: {selectedEnterprise.serNum} |
                  CH: {selectedEnterprise.chNum}
                </span>
              </div>

              {/* Results Table */}
              {pollResults.length > 0 ? (
                <>
                  <div className="poll-table-wrapper">
                    {/* Scrollable Table Body */}
                    <div className="poll-results-table-container">
                      <table className="poll-results-table">
                        <thead>
                          <tr>
                            <th>{t('period')}</th>
                            <th>{t('volume')}</th>
                            <th>{t('temperature')}</th>
                            <th>{t('pressure')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pollResults.map((result, index) => (
                            <tr key={index}>
                              <td>{formatPeriod(result.period)}</td>
                              <td>{result.volume != null ? formatNumber(result.volume) : '-'}</td>
                              <td>{result.temperature != null ? formatNumber(result.temperature) : '-'}</td>
                              <td>{result.pressure != null ? formatNumber(result.pressure) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Fixed Summary Row */}
                    <table className="poll-results-table poll-summary-table">
                      <tbody>
                        <tr className="poll-summary-row">
                          <td><strong>{t('total')}</strong></td>
                          <td><strong>{formatNumber(totals.volume)}</strong></td>
                          <td><strong>{formatNumber(totals.temperature)}</strong></td>
                          <td><strong>{formatNumber(totals.pressure)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="no-results-message">
                  {isPollLoading ? t('loading') : t('noPollData')}
                </div>
              )}
            </>
          ) : (
            <div className="no-selection-message">
              {t('noEnterpriseSelected')}
            </div>
          )}
        </div>
      </div>

      {/* Chart Section - moved outside poll-content */}
      {pollResults.length > 0 && (
        <div className="poll-chart-section">
          <div className="chart-toggles">
            <label>
              <input
                type="checkbox"
                checked={showVolume}
                onChange={(e) => setShowVolume(e.target.checked)}
              />
              {t('showVolume')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={showTemperature}
                onChange={(e) => setShowTemperature(e.target.checked)}
              />
              {t('showTemperature')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={showPressure}
                onChange={(e) => setShowPressure(e.target.checked)}
              />
              {t('showPressure')}
            </label>
          </div>

          <div className="poll-chart-container">
            <ResponsiveContainer width="100%" height={800}>
              <LineChart data={pollResults} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                <XAxis
                  dataKey="period"
                  tickFormatter={formatPeriod}
                  stroke="#9e9e9e"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis yAxisId="left" stroke="#9e9e9e" domain={['auto', 'auto']} allowDataOverflow={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#9e9e9e" domain={['auto', 'auto']} allowDataOverflow={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {showVolume && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="volume"
                    name={t('volume')}
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ fill: '#8884d8', r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                  />
                )}
                {showTemperature && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="temperature"
                    name={t('temperature')}
                    stroke="#ff7300"
                    strokeWidth={2}
                    dot={{ fill: '#ff7300', r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                  />
                )}
                {showPressure && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="pressure"
                    name={t('pressure')}
                    stroke="#ffc658"
                    strokeWidth={2}
                    dot={{ fill: '#ffc658', r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls={true}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Unpolled Enterprises Modal */}
      {showUnpolledModal && (
        <div className="modal-overlay" onClick={() => setShowUnpolledModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('unpolledEnterprises')} ({unpolledEnterprises.length})</h3>
              <button className="modal-close" onClick={() => setShowUnpolledModal(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {unpolledEnterprises.length > 0 ? (
                <div className="unpolled-list">
                  {unpolledEnterprises.map(enterprise => (
                    <div
                      key={`${enterprise.serNum}_${enterprise.chNum}`}
                      className="unpolled-item"
                      onClick={() => {
                        setSelectedEnterprise(enterprise);
                        setShowUnpolledModal(false);
                      }}
                    >
                      <span className="enterprise-name">{enterprise.enterprise_name}</span>
                      <span className="line-id">{getLineName(enterprise.line_id)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-unpolled-message">
                  {t('noData')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </div>
  );
};

export default EnterprisePollAnalysis;
