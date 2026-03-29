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
import * as XLSX from 'xlsx';
import './EnterprisePollAnalysis.css';
import { useLanguage } from '../../contexts/LanguageContext';
import { enterprisePollApi, enterpriseApi, lineApi, branchApi } from '../../services/api';
import { useUser } from '../../contexts/UserContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';

// Register locales
registerLocale('ru', ru);
registerLocale('uk', uk);

// Reverse mapping: (mfDev, typeDev) -> device type name
const DEVICE_TYPE_NAMES = {
  '1_5': 'ВЕГА-1.01',
  '1_15': 'ВЕГА-1.01Н',
  '1_4': 'КПЛГ-2.01Р',
  '1_2': 'КПЛГ-1.02Р',
  '1_3': 'КПЛГ-1.02РВ',
  '1_8': 'ВЕГА-2.01',
  '1_16': 'ВЕГА-2.01Н',
  '1_7': 'ВЕГА-1.02',
  '1_11': 'КВР-1.01',
  '1_12': 'КВР-1.02',
  '5_12': 'ФЛОУТЕК-ТМ-2-3-4',
  '5_15': 'ФЛОУТЕК-ТМ',
  '5_9': 'ФЛОУТЕК-ТМ-1',
  '5_2': 'ФЛОУТЕК-ТМ-3',
  '3_2': 'Універсал-02',
  '3_1': 'Універсал-01',
  '4_1': 'ТАНДЕМ-ТР',
};

const getDeviceTypeName = (mfDev, typeDev) => {
  return DEVICE_TYPE_NAMES[`${mfDev}_${typeDev}`] || `${mfDev}-${typeDev}`;
};

// Normalize DB (snake_case) fields to camelCase used throughout this component
const normalizeEnt = (e) => ({
  ...e,
  serNum:  e.ser_num  ?? e.serNum,
  mfDev:   e.mf_dev   ?? e.mfDev,
  typeDev: e.type_dev ?? e.typeDev,
  chNum:   e.ch_num   ?? e.chNum,
});

/**
 * Enterprise Poll Analysis Component
 * Allows viewing unpolled enterprises and polling specific enterprises
 */
const EnterprisePollAnalysis = () => {
  const { language, t } = useLanguage();
  const { user } = useUser();

  // State
  const [enterprises, setEnterprises] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useLocalStorage('hlv-poll-branch', null);
  const [lineNames, setLineNames] = useState({});
  const [collapsedBranches, setCollapsedBranches] = useState(null); // null = всі згорнуті (lazy init після завантаження)
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
      // Load enterprises, lines and branches in parallel
      const [enterprisesData, linesData, branchesData] = await Promise.all([
        enterpriseApi.getAll(),
        lineApi.getAll(),
        branchApi.getAll(),
      ]);

      // Build line names map
      const namesMap = {};
      if (linesData && Array.isArray(linesData)) {
        linesData.forEach(line => {
          namesMap[line.id] = line.name || `${t('lineName')} ${line.id}`;
        });
      }
      setLineNames(namesMap);
      const branchList = Array.isArray(branchesData) ? branchesData : [];
      setBranches(branchList);

      // For non-admin with single branch — auto-select it
      if (user?.role !== 'admin' && user?.allowed_branch_ids?.length === 1) {
        setSelectedBranchId(user.allowed_branch_ids[0]);
      }

      if (enterprisesData && Array.isArray(enterprisesData)) {
        const normalized = enterprisesData.map(normalizeEnt);
        setEnterprises(normalized);
        // Collapse all branches and lines initially
        const allBranchKeys = [...new Set(normalized.map(e =>
          e.branch_id != null ? String(e.branch_id) : '__no_branch__'
        ))];
        setCollapsedBranches(Object.fromEntries(allBranchKeys.map(k => [k, true])));

        const allLineCollapseKeys = [...new Set(normalized.map(e => {
          const bKey = e.branch_id != null ? String(e.branch_id) : '__no_branch__';
          const lKey = e.line_id  != null ? String(e.line_id)  : '__no_line__';
          return `${bKey}_${lKey}`;
        }))];
        setCollapsedLines(Object.fromEntries(allLineCollapseKeys.map(k => [k, true])));
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

      // Get unique line IDs from active enterprises (exclude those without lines)
      const activeEnterprises = enterprises.filter(e =>
        e.active && (selectedBranchId == null || e.branch_id === selectedBranchId)
      );
      const lineIds = [...new Set(activeEnterprises.map(e => e.line_id).filter(id => id != null))];

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
  }, [enterprises, selectedBranchId, t]);

  /**
   * Poll selected enterprise
   */
  const pollEnterprise = useCallback(async () => {
    if (!selectedEnterprise || selectedEnterprise.line_id == null) return;

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
    let list = enterprises;
    if (selectedBranchId != null) {
      list = list.filter(e => e.branch_id === selectedBranchId);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(e => e.enterprise_name.toLowerCase().includes(query));
    }
    return list;
  }, [enterprises, selectedBranchId, searchQuery]);

  /**
   * Group enterprises: branch → line → enterprises
   */
  const enterprisesByBranchAndLine = useMemo(() => {
    const NO_LINE_KEY = '__no_line__';
    const NO_BRANCH_KEY = '__no_branch__';

    const byBranch = {};
    filteredEnterprises.forEach(e => {
      const bKey = e.branch_id != null ? String(e.branch_id) : NO_BRANCH_KEY;
      const lKey = e.line_id  != null ? String(e.line_id)  : NO_LINE_KEY;
      if (!byBranch[bKey]) byBranch[bKey] = {};
      if (!byBranch[bKey][lKey]) byBranch[bKey][lKey] = [];
      byBranch[bKey][lKey].push(e);
    });

    // Sort branches: known branches first (by branch order), unknown last
    const branchOrder = branches.map(b => String(b.id));
    const sortedBranches = Object.keys(byBranch).sort((a, b) => {
      if (a === NO_BRANCH_KEY) return 1;
      if (b === NO_BRANCH_KEY) return -1;
      return branchOrder.indexOf(a) - branchOrder.indexOf(b);
    });

    const result = {};
    sortedBranches.forEach(bKey => {
      const lines = byBranch[bKey];
      const sortedLines = Object.keys(lines).sort((a, b) => {
        if (a === NO_LINE_KEY) return 1;
        if (b === NO_LINE_KEY) return -1;
        return Number(a) - Number(b);
      });
      result[bKey] = {};
      sortedLines.forEach(lKey => { result[bKey][lKey] = lines[lKey]; });
    });
    return result;
  }, [filteredEnterprises, branches]);

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

  const toggleBranchCollapse = (branchId) => {
    setCollapsedBranches(prev => ({ ...prev, [branchId]: !prev[branchId] }));
  };

  /**
   * Toggle line collapse state
   */
  const toggleLineCollapse = (lineId) => {
    setCollapsedLines(prev => ({ ...prev, [lineId]: !prev[lineId] }));
  };

  // Branches available to this user for the selector
  const availableBranches = useMemo(() => {
    if (user?.role === 'admin') return branches;
    if (!user?.allowed_branch_ids?.length) return [];
    return branches.filter(b => user.allowed_branch_ids.includes(b.id));
  }, [branches, user]);

  // Show branch selector if admin (can pick all/specific) or viewer with >1 branch
  const showBranchSelector = user?.role === 'admin' || availableBranches.length > 1;

  const getBranchName = (branchKey) => {
    if (branchKey === '__no_branch__') return 'Без відділення';
    const branch = branches.find(b => String(b.id) === branchKey);
    return branch ? branch.name : `Відділення ${branchKey}`;
  };

  const getBranchNameById = (branchId) => {
    if (branchId == null) return '—';
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : `Філія ${branchId}`;
  };

  /**
   * Get line name by ID
   */
  const getLineName = (lineId) => {
    if (lineId === '__no_line__') return t('withoutLine');
    return lineNames[lineId] || `${t('lineName')} ${lineId}`;
  };

  const exportUnpolledToExcel = () => {
    const headers = ['Філія', t('selectEnterprise'), t('correctorType'), t('correctorNumber'), t('channelNumber'), t('lineName'), t('status')];
    const data = unpolledEnterprises.map(e => ([
      getBranchNameById(e.branch_id),
      e.enterprise_name,
      getDeviceTypeName(e.mfDev, e.typeDev),
      e.serNum,
      e.chNum,
      getLineName(e.line_id != null ? e.line_id : '__no_line__'),
      e.enabled ? t('statusEnabled') : t('statusDisabled')
    ]));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('unpolledEnterprises'));
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `unpolled_enterprises_${today}.xlsx`);
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
      {/* Branch filter — global, affects tree and unpolled check */}
      {showBranchSelector && (
        <div className="poll-branch-row">
          <span className="poll-branch-label">Філія:</span>
          <select
            className="branch-selector"
            value={selectedBranchId ?? ''}
            onChange={e => setSelectedBranchId(e.target.value === '' ? null : Number(e.target.value))}
          >
            {user?.role === 'admin' && <option value="">Всі філії</option>}
            {availableBranches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Header: two side-by-side cards */}
      <div className="poll-header-row">

        {/* Card 1 — Poll enterprise */}
        <div className="poll-card">
          <div className="poll-card-title">Опрос підприємства</div>
          <div className="poll-card-body">
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
                disabled={isPollLoading || !selectedEnterprise || selectedEnterprise.line_id == null}
                title={
                  !selectedEnterprise
                    ? t('selectEnterprise')
                    : selectedEnterprise.line_id == null
                      ? 'Підприємство не прив\'язане до лінії — опрос неможливий'
                      : t('poll')
                }
              >
                {isPollLoading ? '...' : t('poll')}
              </button>
            </div>
          </div>
        </div>

        {/* Card 2 — Unpolled check */}
        <div className="poll-card">
          <div className="poll-card-title">Відсутність опросу</div>
          <div className="poll-card-body">
            <button
              className="unpolled-button"
              onClick={checkUnpolledEnterprises}
              disabled={isCheckingUnpolled || isLoading}
            >
              {isCheckingUnpolled ? '...' : t('unpolledEnterprises')}
            </button>
          </div>
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
              onChange={(e) => {
                const q = e.target.value;
                setSearchQuery(q);
                if (q.trim()) {
                  // Expand all when searching
                  setCollapsedBranches({});
                  setCollapsedLines({});
                } else {
                  // Collapse all when search cleared
                  const allBranchKeys = [...new Set(enterprises.map(e =>
                    e.branch_id != null ? String(e.branch_id) : '__no_branch__'
                  ))];
                  setCollapsedBranches(Object.fromEntries(allBranchKeys.map(k => [k, true])));
                  const allLineKeys = [...new Set(enterprises.map(e => {
                    const bKey = e.branch_id != null ? String(e.branch_id) : '__no_branch__';
                    const lKey = e.line_id  != null ? String(e.line_id)  : '__no_line__';
                    return `${bKey}_${lKey}`;
                  }))];
                  setCollapsedLines(Object.fromEntries(allLineKeys.map(k => [k, true])));
                }
              }}
              className="search-input"
            />
          </div>

          <div className="enterprise-list">
            {isLoading ? (
              <div className="loading-message">{t('loadingEnterprises')}</div>
            ) : (
              Object.entries(enterprisesByBranchAndLine).map(([branchKey, lineGroups]) => {
                const isBranchCollapsed = collapsedBranches == null ? true : collapsedBranches[branchKey];
                const totalCount = Object.values(lineGroups).reduce((s, arr) => s + arr.length, 0);
                return (
                  <div key={`branch-${branchKey}`} className="branch-group">
                    <div className="branch-header" onClick={() => toggleBranchCollapse(branchKey)}>
                      <span className={`collapse-icon ${isBranchCollapsed ? 'collapsed' : ''}`}>▼</span>
                      <span className="branch-name">{getBranchName(branchKey)}</span>
                      <span className="enterprise-count">({totalCount})</span>
                    </div>
                    {!isBranchCollapsed && Object.entries(lineGroups).map(([lineKey, lineEnterprises]) => {
                      const lineCollapseKey = `${branchKey}_${lineKey}`;
                      const isLineCollapsed = collapsedLines[lineCollapseKey];
                      return (
                        <div key={`line-${lineKey}`} className="line-group">
                          <div className="line-header" onClick={() => toggleLineCollapse(lineCollapseKey)}>
                            <span className={`collapse-icon ${isLineCollapsed ? 'collapsed' : ''}`}>▼</span>
                            <span className="line-name">
                              {getLineName(lineKey === '__no_line__' ? lineKey : parseInt(lineKey))}
                            </span>
                            <span className="enterprise-count">({lineEnterprises.length})</span>
                          </div>
                          {!isLineCollapsed && lineEnterprises.map((enterprise, idx) => (
                            <div
                              key={`${enterprise.line_id}_${enterprise.serNum}_${enterprise.chNum}_${idx}`}
                              className={`enterprise-item ${
                                selectedEnterprise?.serNum === enterprise.serNum &&
                                selectedEnterprise?.chNum === enterprise.chNum &&
                                selectedEnterprise?.line_id === enterprise.line_id &&
                                selectedEnterprise?.enterprise_name === enterprise.enterprise_name
                                  ? 'selected' : ''
                              } ${!enterprise.active ? 'inactive' : ''}`}
                              onClick={() => setSelectedEnterprise(enterprise)}
                            >
                              <span className="enterprise-name">{enterprise.enterprise_name}</span>
                              {!enterprise.active && <span className="inactive-badge">inactive</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })
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
                  {getLineName(selectedEnterprise.line_id != null ? selectedEnterprise.line_id : '__no_line__')} |
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
            <label className={`chart-toggle-volume ${showVolume ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={showVolume}
                onChange={(e) => setShowVolume(e.target.checked)}
              />
              {t('showVolume')}
            </label>
            <label className={`chart-toggle-temperature ${showTemperature ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={showTemperature}
                onChange={(e) => setShowTemperature(e.target.checked)}
              />
              {t('showTemperature')}
            </label>
            <label className={`chart-toggle-pressure ${showPressure ? 'active' : ''}`}>
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
              <div className="modal-header-actions">
                {unpolledEnterprises.length > 0 && (
                  <button className="export-excel-btn" onClick={exportUnpolledToExcel}>
                    {t('exportExcel')}
                  </button>
                )}
                <button className="modal-close" onClick={() => setShowUnpolledModal(false)}>
                  &times;
                </button>
              </div>
            </div>
            <div className="modal-body">
              {unpolledEnterprises.length > 0 ? (
                <table className="unpolled-table">
                  <thead>
                    <tr>
                      <th>Філія</th>
                      <th>{t('selectEnterprise')}</th>
                      <th>{t('correctorType')}</th>
                      <th>{t('correctorNumber')}</th>
                      <th>{t('channelNumber')}</th>
                      <th>{t('lineName')}</th>
                      <th>{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpolledEnterprises.map(enterprise => (
                      <tr
                        key={`${enterprise.serNum}_${enterprise.chNum}`}
                        className="unpolled-row"
                        onClick={() => {
                          setSelectedEnterprise(enterprise);
                          setShowUnpolledModal(false);
                        }}
                      >
                        <td>{getBranchNameById(enterprise.branch_id)}</td>
                        <td>{enterprise.enterprise_name}</td>
                        <td>{getDeviceTypeName(enterprise.mfDev, enterprise.typeDev)}</td>
                        <td>{enterprise.serNum}</td>
                        <td>{enterprise.chNum}</td>
                        <td>{getLineName(enterprise.line_id != null ? enterprise.line_id : '__no_line__')}</td>
                        <td>
                          <span className={`status-badge ${enterprise.enabled ? 'enabled' : 'disabled'}`}>
                            {enterprise.enabled ? t('statusEnabled') : t('statusDisabled')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
