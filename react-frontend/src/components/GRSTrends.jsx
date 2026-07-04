import React, { useState, useEffect, useMemo } from 'react';
import { archiveDataApi, archiveDataVirtualApi } from '../services/api';
import { getEnterpriseWithCache } from '../services/enterpriseCache';
import { enterprisePeriodKey, buildEnterpriseByLinePeriod, getEnterpriseFetchFn } from '../utils/enterpriseVolumes';
import { commercialHourlyRange } from '../utils/commercialDay';
import { useLanguage } from '../contexts/LanguageContext';
import { useBranchLines } from '../hooks/useBranchLines';
import ReportModalShell, { BranchSelect, ErrorBlock, LoadingBlock } from './common/ReportModalShell';
import DateTimePickers from './DateTimePickers';
import InteractiveChart from './InteractiveChart';
import './GRSTrends.css';

const GRSTrends = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState(null);
  const [chartData, setChartData]     = useState([]);
  const [showEnterprise, setShowEnterprise] = useState(false);
  const [periodType, setPeriodType]   = useState('daily'); // 'daily' | 'hourly'

  // Raw volume data from last load (needed for enterprise toggle without re-fetch)
  const [rawData, setRawData]                 = useState([]);
  const [loadedDateRange, setLoadedDateRange] = useState(null);
  const [loadedPeriodType, setLoadedPeriodType] = useState('daily');
  const [loadedLines, setLoadedLines]         = useState({ phys: [], virt: [], all: [] });

  // Branch + line data (shared hook); trends use only include_in_trends lines
  const {
    branches,
    selectedBranchId,
    setSelectedBranchId,
    physicalLines: allPhysicalLines,
    virtualLines: allVirtualLines,
    lineNames,
    linesLoading,
  } = useBranchLines(isOpen);

  const getInitialDateRange = () => {
    const today = new Date();
    const year  = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day   = String(today.getDate()).padStart(2, '0');
    return { fromDate: `${year}-${month}-01`, toDate: `${year}-${month}-${day}`, startHour: 7, endHour: 6 };
  };

  const [dateRange, setDateRange] = useState(getInitialDateRange);

  const physicalLineIds = useMemo(
    () => allPhysicalLines.filter(l => l.include_in_trends).map(l => l.id),
    [allPhysicalLines]
  );
  const virtualLineIds = useMemo(
    () => allVirtualLines.filter(l => l.include_in_trends).map(l => l.id),
    [allVirtualLines]
  );
  const grsLines = useMemo(
    () => [...physicalLineIds, ...virtualLineIds],
    [physicalLineIds, virtualLineIds]
  );

  const handleBranchChange = (e) => {
    setSelectedBranchId(Number(e.target.value));
    setChartData([]);
    setRawData([]);
    setShowEnterprise(false);
  };

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

  return (
    <ReportModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('grsTrends')}
      className="grs-trends-modal"
    >
      <div className="grs-trends-modal-body">
        {/* Controls row */}
        <div className="grs-controls-row">
          <BranchSelect
            branches={branches}
            value={selectedBranchId}
            onChange={handleBranchChange}
            label={t('branch')}
          />

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

        {isLoading && <LoadingBlock text={t('calculatingTrends')} />}

        {error && <ErrorBlock error={error} />}

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
    </ReportModalShell>
  );
};

export default GRSTrends;
