import React, { useState, useEffect, useCallback } from 'react';
import './OverviewTab.css';
import { useLanguage } from '../contexts/LanguageContext';
import { lineApi, archiveDataApi, paramArchiveApi } from '../services/api';
import { grsConfig } from '../config/grsConfig';
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

  // State
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  /**
   * Load data from API
   */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch line metadata
      const linesResponse = await lineApi.getLinesByLumg(1);
      let lines = Array.isArray(linesResponse) ? linesResponse : linesResponse?.data || [];

      if (!Array.isArray(lines) || lines.length === 0) {
        throw new Error('Не удалось получить данные линий');
      }

      // Filter only GRS lines
      lines = lines.filter(line => grsConfig.LINES_IDS.includes(line.id));

      // Fetch parameters for all GRS lines
      let paramsMap = {};
      try {
        const paramsResponse = await paramArchiveApi.getParamsForLines(grsConfig.LINES_IDS);
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

      // Fetch last 24h hourly data
      const last24hResponse = await archiveDataApi.getHourlyDataLast24h();
      let last24hData = Array.isArray(last24hResponse) ? last24hResponse : last24hResponse?.data || [];

      if (!Array.isArray(last24hData) || last24hData.length === 0) {
        throw new Error('Нет данных за последние 24 часа');
      }

      // Calculate previous 24h period
      // Find earliest and latest periods in last24hData
      const periods = last24hData
        .map(r => r.period ? new Date(r.period) : null)
        .filter(d => d && !isNaN(d.getTime()))
        .sort((a, b) => a - b);

      if (periods.length === 0) {
        throw new Error('Не удалось определить временные границы данных');
      }

      const currentStart = periods[0];
      const currentEnd = periods[periods.length - 1];

      // Previous period: 24 hours before current start
      const previousEnd = new Date(currentStart);
      previousEnd.setHours(previousEnd.getHours() - 1);

      const previousStart = new Date(previousEnd);
      previousStart.setHours(previousStart.getHours() - 23);

      // Format dates for API
      const previousStartStr = OverviewCalculator.formatDateForAPI(previousStart);
      const previousEndStr = OverviewCalculator.formatDateForAPI(previousEnd);

      // Fetch previous 24h data
      const previous24hResponse = await archiveDataApi.getHourlyData(
        grsConfig.LINES_IDS,
        previousStartStr,
        previousEndStr
      );
      let previous24hData = Array.isArray(previous24hResponse) ? previous24hResponse : previous24hResponse?.data || [];

      // Calculate metrics - only for GRS lines
      const lineNames = {};
      lines.forEach(line => {
        if (grsConfig.LINES_IDS.includes(line.id)) {
          lineNames[line.id] = line.name || `Линия ${line.id}`;
        }
      });

      // Total 24h volumes
      const currentTotal = OverviewCalculator.calculate24hTotal(last24hData, grsConfig.LINES_IDS);
      const previousTotal = OverviewCalculator.calculate24hTotal(previous24hData, grsConfig.LINES_IDS);
      const volumeComparison = OverviewCalculator.calculateComparison(currentTotal, previousTotal);

      // Last hour flow comparisons
      const flowComparisons = OverviewCalculator.calculateLastHourFlow(last24hData, grsConfig.LINES_IDS);

      // 24h volume comparisons by line
      const volumeComparisons = OverviewCalculator.calculate24hVolumeByLine(
        last24hData,
        previous24hData,
        grsConfig.LINES_IDS
      );

      // Pressure readings
      const pressures = OverviewCalculator.getLastPressures(last24hData, grsConfig.LINES_IDS, lines, paramsMap);

      // Pressure timestamps
      const pressureTimestamps = {};
      Object.keys(pressures).forEach(lineId => {
        pressureTimestamps[lineId] = pressures[lineId].timestamp;
      });

      // Active lines count
      const activeLines = Object.keys(pressures).length;

      // Update state
      setData({
        totalVolume24h: currentTotal,
        volumeComparison,
        flowComparisons,
        volumeComparisons,
        pressures,
        lineNames,
        pressureTimestamps,
        activeLines,
        totalLines: grsConfig.LINES_IDS.length,
        currentPeriod: { start: currentStart, end: currentEnd },
        previousPeriod: { start: previousStart, end: previousEnd }
      });

      setLastUpdateTime(new Date());
      setIsLoading(false);
      setCountdown(300); // Reset countdown

    } catch (err) {
      console.error('Error loading overview data:', err);
      setError(err.message || 'Ошибка загрузки данных');
      setIsLoading(false);
    }
  }, []);

  /**
   * Initial load
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Auto-refresh timer
   */
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  /**
   * Countdown timer
   */
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return 300; // Reset when reaches 0
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh]);

  /**
   * Handle manual refresh
   */
  const handleRefresh = () => {
    loadData();
  };

  /**
   * Handle auto-refresh toggle
   */
  const handleAutoRefreshToggle = () => {
    setAutoRefresh(prev => !prev);
  };

  return (
    <div className="overview-tab">
      {/* Header */}
      <div className="overview-header">
        <h2 className="overview-title">{t('grsOverviewTitle')}</h2>
        <div className="overview-controls">
          <button
            className="refresh-button"
            onClick={handleRefresh}
            disabled={isLoading}
            title={t('refreshNow')}
          >
            <span className="refresh-icon">{isLoading ? '⏳' : '🔄'}</span>
            <span className="refresh-text">{t('refreshNow')}</span>
          </button>
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={handleAutoRefreshToggle}
            />
            <span className="toggle-text">{t('autoRefresh')}</span>
          </label>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && !data && (
        <div className="overview-loading">
          <div className="loading-spinner"></div>
          <p>{t('loading')}</p>
        </div>
      )}

      {/* Error State */}
      {error && !data && (
        <div className="overview-error">
          <p className="error-icon">⚠️</p>
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={handleRefresh}>
            {t('refreshNow')}
          </button>
        </div>
      )}

      {/* Content */}
      {data && (
        <>
          {/* Metrics Cards */}
          <OverviewMetrics
            totalVolume24h={data.totalVolume24h}
            volumeComparison={data.volumeComparison}
            lastUpdate={lastUpdateTime}
            activeLines={data.activeLines}
            totalLines={data.totalLines}
            nextRefreshIn={autoRefresh ? countdown : null}
          />

          {/* Pressure Gauges with Flow and Volume Data */}
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
