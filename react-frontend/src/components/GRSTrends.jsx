import React, { useState, useEffect, useMemo } from 'react';
import {
  archiveDataApi,
  archiveDataVirtualApi,
  enterpriseVirtualApi,
  branchApi,
  lumgApi,
  lineApi,
} from '../services/api';
import { getEnterpriseWithCache } from '../services/enterpriseCache';
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

  const calculateTrends = async () => {
    if (grsLines.length === 0) {
      setError(t('noGrsLinesConfigured'));
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // Fetch physical + virtual data from correct endpoints
      const [physData, virtData] = await Promise.all([
        physicalLineIds.length > 0
          ? (periodType === 'daily'
              ? archiveDataApi.getDailyData(physicalLineIds, dateRange.fromDate, dateRange.toDate)
              : archiveDataApi.getHourlyData(physicalLineIds, dateRange.fromDate, dateRange.toDate))
          : Promise.resolve([]),
        virtualLineIds.length > 0
          ? (periodType === 'daily'
              ? archiveDataVirtualApi.getDailyDataVirtual(virtualLineIds, dateRange.fromDate, dateRange.toDate)
              : archiveDataVirtualApi.getHourlyDataVirtual(virtualLineIds, dateRange.fromDate, dateRange.toDate))
          : Promise.resolve([]),
      ]);

      const allData = [...(physData || []), ...(virtData || [])];

      if (allData.length === 0) {
        setError(t('noDataAvailable'));
        setChartData([]);
        return;
      }

      let enterpriseData = [];
      if (showEnterprise) {
        enterpriseData = await getEnterpriseWithCache(
          grsLines, dateRange.fromDate, dateRange.toDate, periodType,
          (lines, from, to, type) => enterpriseVirtualApi.getEnterpriseVolumesVirtual(lines, from, to, type)
        ) || [];
      }

      const trendsData = calculateGRSTrendsPercentages(allData, grsLines, enterpriseData);
      setChartData(trendsData);
    } catch (err) {
      setError(t('errorLoadingData'));
      console.error('Error calculating GRS trends:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateGRSTrendsPercentages = (data, lineIds, enterpriseData = []) => {
    const keyLen = periodType === 'hourly' ? 13 : 10;

    const lineDataMap = {};
    data.forEach(record => {
      const lid = record.line_id;
      if (!lineDataMap[lid]) lineDataMap[lid] = [];
      lineDataMap[lid].push(record);
    });

    const enterpriseMap = {};
    enterpriseData.forEach(entry => {
      const lid = entry.line_id;
      const key = String(entry.period || '').replace(' ', 'T').slice(0, keyLen);
      if (!enterpriseMap[lid]) enterpriseMap[lid] = {};
      enterpriseMap[lid][key] = entry.total_volume;
    });

    const lineTotals = {};
    Object.keys(lineDataMap).forEach(lid => {
      lineTotals[lid] = lineDataMap[lid].reduce((sum, rec) => {
        const key = String(rec.period || '').replace(' ', 'T').slice(0, keyLen);
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
        const key = String(rec.period || '').replace(' ', 'T').slice(0, keyLen);
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
                onChange={e => { setSelectedBranchId(Number(e.target.value)); setChartData([]); }}
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
                onTrendsEnterpriseChange={e => setShowEnterprise(e.target.checked)}
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
