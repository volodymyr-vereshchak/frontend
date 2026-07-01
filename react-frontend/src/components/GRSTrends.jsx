import React, { useState, useEffect, useMemo } from 'react';
import {
  archiveDataApi,
  archiveDataVirtualApi,
  branchApi,
  lumgApi,
  lineApi,
} from '../services/api';
import { getEnterpriseWithCache } from '../services/enterpriseCache';
import { enterprisePeriodKey, buildEnterpriseByLinePeriod, getEnterpriseFetchFn } from '../utils/enterpriseVolumes';
import { commercialHourlyRange } from '../utils/commercialDay';
import { useLanguage } from '../contexts/LanguageContext';
import DateTimePickers from './DateTimePickers';
import InteractiveChart from './InteractiveChart';
import './GRSTrends.css';

const GRSTrends = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState(null);
  const [chartData, setChartData]     = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [showEnterprise, setShowEnterprise] = useState(false);
  const [periodType, setPeriodType]   = useState('daily'); // 'daily' | 'hourly'

  // Raw volume data from last load (needed for enterprise toggle without re-fetch)
  const [rawData, setRawData]                 = useState([]);
  const [loadedDateRange, setLoadedDateRange] = useState(null);
  const [loadedPeriodType, setLoadedPeriodType] = useState('daily');
  const [loadedLines, setLoadedLines]         = useState({ phys: [], virt: [], all: [] });

  // Branch + lumg data
  const [branches, setBranches]       = useState([]);
  const [lumgs, setLumgs]             = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  // Physical and virtual lines for selected branch
  const [physicalLines, setPhysicalLines] = useState([]);
  const [virtualLines,  setVirtualLines]  = useState([]);

  const getInitialDateRange = () => {
    const today = new Date();
    const year  = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day   = String(today.getDate()).padStart(2, '0');
    return { fromDate: `${year}-${month}-01`, toDate: `${year}-${month}-${day}`, startHour: 7, endHour: 6 };
  };

  const [dateRange, setDateRange] = useState(getInitialDateRange);

  // Load branches + lumgs on open
  useEffect(() => {
    if (!isOpen) return;
    Promise.all([branchApi.getAll(), lumgApi.getAll()])
      .then(([branchData, lumgData]) => {
        const list = Array.isArray(branchData) ? branchData : [];
        setBranches(list);
        setLumgs(Array.isArray(lumgData) ? lumgData : []);
        if (list.length > 0) setSelectedBranchId(list[0].id);
      })
      .catch(err => console.error('Failed to load branches/lumgs:', err));
  }, [isOpen]);

  // Load lines per branch (include_in_trends only)
  useEffect(() => {
    if (!isOpen || !selectedBranchId) return;

    const load = async () => {
      setLinesLoading(true);
      try {
        const branchLumgIds = lumgs.filter(l => l.branch_id === selectedBranchId).map(l => l.id);

        // Physical lines with include_in_trends=true
        let phys = [];
        if (branchLumgIds.length > 0) {
          const arrays = await Promise.all(branchLumgIds.map(lid => lineApi.getLinesByLumg(lid)));
          phys = arrays.flat().filter(l => l && l.include_in_trends);
        }

        // Virtual lines with include_in_trends=true for this branch
        const virt = await fetch(
          `${(window.APP_CONFIG?.API_URL || '/api')}/virtual_lines/?include_in_trends=true&branch_id=${selectedBranchId}`,
          { credentials: 'include' }
        ).then(r => r.ok ? r.json() : []).catch(() => []);

        setPhysicalLines(phys);
        setVirtualLines(virt);
      } catch (err) {
        console.error('Error loading lines for branch:', err);
      } finally {
        setLinesLoading(false);
      }
    };

    load();
  }, [isOpen, selectedBranchId, lumgs]);

  const physicalLineIds = useMemo(() => physicalLines.map(l => l.id), [physicalLines]);
  const virtualLineIds  = useMemo(() => virtualLines.map(l => l.id),  [virtualLines]);
  const grsLines        = useMemo(() => [...physicalLineIds, ...virtualLineIds], [physicalLineIds, virtualLineIds]);

  // Line names map
  const lineNames = useMemo(() => {
    const map = {};
    [...physicalLines, ...virtualLines].forEach(l => { map[l.id] = l.name || `Лінія ${l.id}`; });
    return map;
  }, [physicalLines, virtualLines]);

  // Recalculate chart from already-fetched raw data (no new API calls for volumes)
  const recalculate = (data, pType, lines, entData = []) => {
    const trendsData = calculateGRSTrendsPercentages(data, lines, entData, pType);
    setChartData(trendsData);
  };

  const calculateTrends = async () => {
    if (grsLines.length === 0) {
      setError(t('noGrsLinesConfigured'));
      return;
    }
    setIsLoading(true);
    setError(null);

    // Hourly trends use commercial-day boundaries (07:00→07:00): a selected range
    // [from, to] maps to [from 07:00, (to+1) 06:00]. Daily stays calendar-based.
    const range = periodType === 'hourly'
      ? commercialHourlyRange(dateRange.fromDate, dateRange.toDate)
      : { from: dateRange.fromDate, to: dateRange.toDate };

    try {
      const [physData, virtData] = await Promise.all([
        physicalLineIds.length > 0
          ? (periodType === 'daily'
              ? archiveDataApi.getDailyData(physicalLineIds, range.from, range.to)
              : archiveDataApi.getHourlyData(physicalLineIds, range.from, range.to))
          : Promise.resolve([]),
        virtualLineIds.length > 0
          ? (periodType === 'daily'
              ? archiveDataVirtualApi.getDailyDataVirtual(virtualLineIds, range.from, range.to)
              : archiveDataVirtualApi.getHourlyDataVirtual(virtualLineIds, range.from, range.to))
          : Promise.resolve([]),
      ]);

      const allData = [...(physData || []), ...(virtData || [])];

      if (allData.length === 0) {
        setError(t('noDataAvailable'));
        setChartData([]);
        setRawData([]);
        return;
      }

      // Store raw data and context for enterprise toggle
      setRawData(allData);
      setLoadedDateRange({ ...dateRange });
      setLoadedPeriodType(periodType);
      setLoadedLines({ phys: physicalLineIds, virt: virtualLineIds, all: grsLines });

      let entData = [];
      if (showEnterprise) {
        entData = await getEnterpriseWithCache(
          grsLines, range.from, range.to, periodType,
          getEnterpriseFetchFn(true)
        ) || [];
      }

      recalculate(allData, periodType, grsLines, entData);
    } catch (err) {
      setError(t('errorLoadingData'));
      console.error('Error calculating GRS trends:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Enterprise checkbox handler — immediately recalculates without re-fetching volumes
  const handleEnterpriseChange = async (e) => {
    const checked = e.target.checked;
    setShowEnterprise(checked);

    if (rawData.length === 0 || !loadedDateRange) return; // no data loaded yet

    setIsLoading(true);
    try {
      let entData = [];
      if (checked) {
        const range = loadedPeriodType === 'hourly'
          ? commercialHourlyRange(loadedDateRange.fromDate, loadedDateRange.toDate)
          : { from: loadedDateRange.fromDate, to: loadedDateRange.toDate };
        entData = await getEnterpriseWithCache(
          loadedLines.all, range.from, range.to, loadedPeriodType,
          getEnterpriseFetchFn(true)
        ) || [];
      }
      recalculate(rawData, loadedPeriodType, loadedLines.all, entData);
    } catch (err) {
      console.error('Error loading enterprise data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateGRSTrendsPercentages = (data, lineIds, enterpriseData = [], pType = periodType) => {
    const lineDataMap = {};
    data.forEach(record => {
      const lid = record.line_id;
      if (!lineDataMap[lid]) lineDataMap[lid] = [];
      lineDataMap[lid].push(record);
    });

    // Enterprise totals keyed by line then period (shared with archives/night).
    const enterpriseMap = buildEnterpriseByLinePeriod(enterpriseData, pType);

    const lineTotals = {};
    Object.keys(lineDataMap).forEach(lid => {
      lineTotals[lid] = lineDataMap[lid].reduce((sum, rec) => {
        const key = enterprisePeriodKey(rec.period, pType);
        const gs  = rec.volume || 0;
        const ent = (enterpriseMap[lid] && enterpriseMap[lid][key]) || 0;
        return sum + Math.max(0, gs - ent);
      }, 0);
    });

    const chartDataMap = {};
    Object.keys(lineDataMap).forEach(lid => {
      const total = lineTotals[lid];
      if (total <= 0) return;
      lineDataMap[lid].forEach(rec => {
        const key = enterprisePeriodKey(rec.period, pType);
        const gs  = rec.volume || 0;
        const ent = (enterpriseMap[lid] && enterpriseMap[lid][key]) || 0;
        const net = Math.max(0, gs - ent);
        const pct = (net / total) * 100;
        if (!chartDataMap[key]) chartDataMap[key] = { period: key };
        chartDataMap[key][`line_${lid}`]            = pct;
        chartDataMap[key][`line_${lid}_volume`]     = net;
        chartDataMap[key][`line_${lid}_enterprise`] = ent;
      });
    });

    return Object.values(chartDataMap).sort((a, b) => a.period.localeCompare(b.period));
  };

  const handleLoad = () => {
    if (!linesLoading && grsLines.length > 0) calculateTrends();
  };

  // Re-calculate when enterprise cache is cleared
  useEffect(() => {
    const handler = () => { if (isOpen && chartData.length > 0) calculateTrends(); };
    window.addEventListener('enterprise-cache-cleared', handler);
    return () => window.removeEventListener('enterprise-cache-cleared', handler);
  }, [isOpen, dateRange, selectedBranchId, showEnterprise, periodType]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content grs-trends-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{t('grsTrends')}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="grs-trends-modal-body">
          {/* Controls row */}
          <div className="grs-controls-row">
            {/* Branch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: '#B9E42B', fontSize: 13, whiteSpace: 'nowrap' }}>{t('branch')}:</label>
              <select
                style={{ background: '#2a2a2a', color: '#e0e0e0', border: '1px solid #404040', borderRadius: 4, padding: '5px 10px', fontSize: 13, minWidth: 180 }}
                value={selectedBranchId || ''}
                onChange={e => { setSelectedBranchId(Number(e.target.value)); setChartData([]); setRawData([]); setShowEnterprise(false); }}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {/* Period toggle */}
            <div className="grs-period-toggle">
              <button
                className={`grs-toggle-btn ${periodType === 'daily' ? 'active' : ''}`}
                onClick={() => setPeriodType('daily')}
              >
                Добові
              </button>
              <button
                className={`grs-toggle-btn ${periodType === 'hourly' ? 'active' : ''}`}
                onClick={() => setPeriodType('hourly')}
              >
                Годинні
              </button>
            </div>

            {/* Date pickers */}
            <DateTimePickers
              onDateRangeChange={setDateRange}
              onDateFilterToggle={() => {}}
              archiveType="daily"
              initialDateRange={dateRange}
            />

            {/* Load button */}
            <button
              className="btn btn-primary grs-load-btn"
              onClick={handleLoad}
              disabled={isLoading || linesLoading}
            >
              {isLoading ? t('loading') : 'Завантажити'}
            </button>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>{t('calculatingTrends')}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <p className="error-message">{t('error')}: {error}</p>
            </div>
          )}

          {/* Chart */}
          {!isLoading && !error && chartData.length > 0 && (
            <div className="chart-section">
              <h4>{t('grsConsumptionTrends')}</h4>
              <div className="chart-description">
                <p>{t('grsTracksDescription')}</p>
              </div>
              <InteractiveChart
                data={chartData}
                archiveType="trends"
                selectedLines={grsLines}
                lineNames={lineNames}
                trendsEnterpriseChecked={showEnterprise}
                onTrendsEnterpriseChange={handleEnterpriseChange}
              />
            </div>
          )}

          {/* No data */}
          {!isLoading && !error && chartData.length === 0 && (
            <div className="no-data-container">
              <p>{t('selectPeriod')}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
};

export default GRSTrends;
