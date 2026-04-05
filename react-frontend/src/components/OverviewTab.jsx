import React, { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import './OverviewTab.css';
import { useLanguage } from '../contexts/LanguageContext';
import { lineApi, archiveDataApi, paramArchiveApi, branchApi, lumgApi } from '../services/api';
import { OverviewCalculator } from '../utils/overviewCalculator';
import OverviewMetrics from './OverviewMetrics';
import PressureGaugesGrid from './PressureGaugesGrid';

/**
 * Overview Tab Component
 * Main container for GRS overview displaying real-time metrics,
 * pressure gauges, and comparison data
 */
const OverviewTab = () => {
  const { t } = useLanguage();

  // Branch selection
  const [branches, setBranches] = useState([]);
  const [allLumgs, setAllLumgs] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useLocalStorage('hlv-overview-branch', null);
  const [selectorLoading, setSelectorLoading] = useState(true);

  // Data state
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  /**
   * Load branches and lumgs on mount, auto-select first
   */
  useEffect(() => {
    const loadSelectors = async () => {
      setSelectorLoading(true);
      try {
        const [branchesRes, lumgsRes] = await Promise.all([
          branchApi.getAll(),
          lumgApi.getAll(),
        ]);
        const branchList = Array.isArray(branchesRes) ? branchesRes : branchesRes?.data || [];
        const lumgList = Array.isArray(lumgsRes) ? lumgsRes : lumgsRes?.data || [];

        setBranches(branchList);
        setAllLumgs(lumgList);

        if (branchList.length > 0) {
          setSelectedBranchId(prev =>
            prev !== null && branchList.some(b => b.id === prev) ? prev : branchList[0].id
          );
        }
      } catch (err) {
        console.error('Failed to load branches/lumgs:', err);
      } finally {
        setSelectorLoading(false);
      }
    };
    loadSelectors();
  }, []);

  /**
   * Handle branch selection change
   */
  const handleBranchChange = (e) => {
    setSelectedBranchId(Number(e.target.value));
    setData(null);
  };

  /**
   * Load overview data for all LUMGs of the selected branch
   */
  const loadData = useCallback(async () => {
    if (!selectedBranchId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get all LUMGs for the selected branch
      const branchLumgIds = allLumgs
        .filter(l => l.branch_id === selectedBranchId)
        .map(l => l.id);

      if (branchLumgIds.length === 0) {
        throw new Error(t('noLumgsForBranch'));
      }

      // Fetch lines for all LUMGs in parallel
      const linesResponses = await Promise.all(
        branchLumgIds.map(lumgId => lineApi.getLinesByLumg(lumgId))
      );
      let lines = linesResponses.flatMap(r => Array.isArray(r) ? r : r?.data || []);

      if (!Array.isArray(lines) || lines.length === 0) {
        throw new Error(t('noLinesData'));
      }

      // Filter only lines included in report
      lines = lines.filter(line => line.include_in_report);
      const reportLineIds = lines.map(line => line.id);

      if (reportLineIds.length === 0) {
        throw new Error(t('noReportLinesForBranch'));
      }

      // Fetch parameters for all report lines
      let paramsMap = {};
      try {
        const paramsResponse = await paramArchiveApi.getParamsForLines(reportLineIds);
        const paramsData = Array.isArray(paramsResponse) ? paramsResponse : paramsResponse?.data || [];

        paramsData.forEach(param => {
          if (param && param.line_id) {
            paramsMap[param.line_id] = {
              min_dp: param.min_dp || 0,
              max_dp: param.max_dp || 100
            };
          }
        });
      } catch (err) {
        console.warn('Failed to load dP parameters, using defaults:', err);
      }

      // Fetch recent hourly data (3 days: covers current + previous 24h windows + buffer)
      const allHourlyResponse = await archiveDataApi.getHourlyDataLast24h(reportLineIds);
      const allHourlyData = Array.isArray(allHourlyResponse) ? allHourlyResponse : allHourlyResponse?.data || [];

      if (!Array.isArray(allHourlyData) || allHourlyData.length === 0) {
        throw new Error(t('noDataFor24h'));
      }

      // Find most recent record across all lines
      const allTimestamps = allHourlyData
        .map(r => r.period ? new Date(r.period).getTime() : null)
        .filter(ts => ts && !isNaN(ts));

      if (allTimestamps.length === 0) {
        throw new Error(t('noTimeBoundsError'));
      }

      const currentEnd = new Date(Math.max(...allTimestamps));
      const currentStart = new Date(currentEnd.getTime() - 23 * 60 * 60 * 1000);

      // Current 24h window (for volume totals)
      const last24hData = allHourlyData.filter(r => {
        const d = new Date(r.period);
        return d >= currentStart && d <= currentEnd;
      });

      // Previous 24h window (no separate HTTP request needed)
      const previousEnd = new Date(currentStart.getTime() - 60 * 60 * 1000);
      const previousStart = new Date(previousEnd.getTime() - 23 * 60 * 60 * 1000);
      const previous24hData = allHourlyData.filter(r => {
        const d = new Date(r.period);
        return d >= previousStart && d <= previousEnd;
      });

      // Calculate metrics
      const lineNames = {};
      lines.forEach(line => {
        lineNames[line.id] = line.name || `${t('unknownLine')} ${line.id}`;
      });

      const currentTotal = OverviewCalculator.calculate24hTotal(last24hData, reportLineIds);
      const previousTotal = OverviewCalculator.calculate24hTotal(previous24hData, reportLineIds);
      const volumeComparison = OverviewCalculator.calculateComparison(currentTotal, previousTotal);
      // Use full 3-day data for flow/pressures: ensures sparse lines (daily updates) get 2+ records
      const flowComparisons = OverviewCalculator.calculateLastHourFlow(allHourlyData, reportLineIds);
      const volumeComparisons = OverviewCalculator.calculate24hVolumeByLine(
        last24hData,
        previous24hData,
        reportLineIds
      );
      const pressures = OverviewCalculator.getLastPressures(allHourlyData, reportLineIds, lines, paramsMap);

      const pressureTimestamps = {};
      Object.keys(pressures).forEach(lineId => {
        pressureTimestamps[lineId] = pressures[lineId].timestamp;
      });

      // Active = line whose last timestamp matches the branch's last period (within 1 min)
      const currentEndMs = currentEnd.getTime();
      const activeLines = Object.values(pressures).filter(p =>
        p.timestamp && Math.abs(new Date(p.timestamp).getTime() - currentEndMs) < 60 * 1000
      ).length;

      setData({
        totalVolume24h: currentTotal,
        volumeComparison,
        flowComparisons,
        volumeComparisons,
        pressures,
        lineNames,
        pressureTimestamps,
        activeLines,
        totalLines: reportLineIds.length,
        currentPeriod: { start: currentStart, end: currentEnd },
        previousPeriod: { start: previousStart, end: previousEnd }
      });

      setLastUpdateTime(currentEnd);
    } catch (err) {
      console.error('Error loading overview data:', err);
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, allLumgs]);

  /**
   * Load data when branch is selected or changes
   */
  useEffect(() => {
    if (selectedBranchId) {
      loadData();
    }
  }, [loadData, selectedBranchId]);

  /**
   * Sync refresh: fires at :32 of each hour (2 min after scheduler at :30), then hourly
   */
  useEffect(() => {
    if (!selectedBranchId) return;
    let timeoutId, intervalId;
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(32);
    if (next <= now) next.setHours(next.getHours() + 1);
    timeoutId = setTimeout(() => {
      loadData();
      intervalId = setInterval(loadData, 60 * 60 * 1000);
    }, next - now);
    return () => { clearTimeout(timeoutId); clearInterval(intervalId); };
  }, [selectedBranchId, loadData]);

  return (
    <div className="overview-tab">
      {/* Header */}
      <div className="overview-header">
        <div className="overview-title-row">
          <h2 className="overview-title">{t('grsOverviewTitle')}</h2>

          {/* Branch selector */}
          <div className="overview-selectors">
            <div className="selector-group">
              <label className="selector-label">{t('branch')}</label>
              <select
                className="overview-select"
                value={selectedBranchId ?? ''}
                onChange={handleBranchChange}
                disabled={selectorLoading || branches.length === 0}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name || `Філія ${b.id}`}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overview-controls">
        </div>
      </div>

      {/* Selector loading */}
      {selectorLoading && (
        <div className="overview-loading">
          <div className="loading-spinner"></div>
          <p>{t('loading')}</p>
        </div>
      )}

      {/* No branch selected */}
      {!selectorLoading && !selectedBranchId && (
        <div className="overview-error">
          <p className="error-message">{t('selectBranchPrompt')}</p>
        </div>
      )}

      {/* Data loading */}
      {!selectorLoading && selectedBranchId && isLoading && !data && (
        <div className="overview-loading">
          <div className="loading-spinner"></div>
          <p>{t('loading')}</p>
        </div>
      )}

      {/* Error State */}
      {!selectorLoading && error && !data && (
        <div className="overview-error">
          <p className="error-icon">⚠️</p>
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={loadData}>
            {t('refreshNow')}
          </button>
        </div>
      )}

      {/* Content */}
      {data && (
        <>
          <OverviewMetrics
            totalVolume24h={data.totalVolume24h}
            volumeComparison={data.volumeComparison}
            lastUpdate={lastUpdateTime}
            activeLines={data.activeLines}
            totalLines={data.totalLines}
          />

          <section className="overview-section">
            <h3 className="section-title">{t('linePressures')}</h3>
            <PressureGaugesGrid
              pressures={data.pressures}
              lineNames={data.lineNames}
              timestamps={data.pressureTimestamps}
              flowComparisons={data.flowComparisons}
              volumeComparisons={data.volumeComparisons}
            />
          </section>
        </>
      )}
    </div>
  );
};

export default OverviewTab;
