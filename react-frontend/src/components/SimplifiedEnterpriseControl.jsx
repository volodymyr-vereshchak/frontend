import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { enterpriseApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './SimplifiedEnterpriseControl.css';

const SimplifiedEnterpriseControl = ({
  selectedLines,
  dateRange,
  archiveType,
  onEnterpriseDataChange
}) => {
  const { t } = useLanguage();

  // Simplified state (5 states)
  const [isActive, setIsActive] = useState(false); // Checkbox state - enable/disable enterprise
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // Dropdown visibility
  const [showNetVolume, setShowNetVolume] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [enterpriseData, setEnterpriseData] = useState(null);

  // Refs
  const dropdownRef = useRef(null);
  const previousParamsRef = useRef(null);
  const previousChartDataRef = useRef(null);

  // Process raw API data into period-based structure
  const processEnterpriseData = (rawData) => {
    const byPeriod = {};

    rawData.forEach(item => {
      // Use period as-is from API (should match main chart data format)
      const period = item.period;

      if (!byPeriod[period]) {
        byPeriod[period] = {
          period: period,
          lineVolume: item.total_volume || 0,
          totalEnterpriseVolume: 0
        };
      }

      // Sum up all enterprise volumes for this period
      item.devices?.forEach(device => {
        byPeriod[period].totalEnterpriseVolume += device.volume || 0;
      });
    });

    console.log('Processed enterprise data by period:', {
      totalPeriods: Object.keys(byPeriod).length,
      samplePeriods: Object.keys(byPeriod).slice(0, 3),
      sampleData: Object.values(byPeriod).slice(0, 2)
    });

    return byPeriod;
  };

  // Build chart data from processed enterprise data
  // Returns object with period mappings for merging with main chart data
  const buildChartData = (processedData, includeNet, includeTotal) => {
    if (!processedData) return null;

    // Return data as a map by period for easy merging in InteractiveChart
    const result = {
      byPeriod: {},
      includeNet,
      includeTotal
    };

    Object.keys(processedData).forEach(period => {
      result.byPeriod[period] = {};

      if (includeNet) {
        result.byPeriod[period].netVolume =
          processedData[period].lineVolume - processedData[period].totalEnterpriseVolume;
      }

      if (includeTotal) {
        result.byPeriod[period].totalEnterpriseVolume =
          processedData[period].totalEnterpriseVolume;
      }
    });

    console.log('Built chart data:', {
      totalPeriods: Object.keys(result.byPeriod).length,
      includeNet,
      includeTotal,
      samplePeriods: Object.keys(result.byPeriod).slice(0, 3),
      sampleValues: Object.entries(result.byPeriod).slice(0, 2).map(([p, v]) => ({ period: p, values: v }))
    });

    return Object.keys(result.byPeriod).length > 0 ? result : null;
  };

  // Fetch enterprise data from API
  const fetchEnterpriseData = useCallback(async () => {
    if (!selectedLines || selectedLines.length === 0) {
      console.warn('No lines selected for enterprise data fetch');
      return;
    }

    if (!dateRange || !dateRange.fromDate || !dateRange.toDate) {
      console.warn('Invalid date range for enterprise data fetch');
      return;
    }

    // Create params signature to check if we need to refetch
    const currentParams = JSON.stringify({
      lines: selectedLines?.sort(),
      from: dateRange.fromDate,
      to: dateRange.toDate,
      type: archiveType
    });

    // Skip if params haven't changed
    if (previousParamsRef.current === currentParams) {
      console.log('Parameters unchanged, skipping fetch');
      return;
    }

    previousParamsRef.current = currentParams;
    setLoading(true);

    try {
      const periodType = archiveType === 'hourly' ? 'hourly' : 'daily';

      console.log('Fetching enterprise data:', {
        lines: selectedLines,
        from: dateRange.fromDate,
        to: dateRange.toDate,
        periodType
      });

      const data = await enterpriseApi.getEnterpriseVolumes(
        selectedLines,
        dateRange.fromDate,
        dateRange.toDate,
        periodType
      );

      console.log('Enterprise data fetched:', data);

      // Check for empty data
      if (!data || data.length === 0) {
        console.log('No enterprise data available from API');
        setEnterpriseData(null);
        setLoading(false);
        return;
      }

      // Process and save data
      const processed = processEnterpriseData(data);
      setEnterpriseData(processed);

    } catch (err) {
      console.error('Error fetching enterprise data:', err);
      setEnterpriseData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedLines, dateRange, archiveType]);

  // Memoize chart data to prevent unnecessary recalculations
  const chartData = useMemo(() => {
    if (!isActive || !enterpriseData) {
      return null;
    }
    return buildChartData(enterpriseData, showNetVolume, showTotal);
  }, [isActive, enterpriseData, showNetVolume, showTotal]);

  // useEffect #1: Load data when activated or parameters change
  useEffect(() => {
    if (!isActive) {
      setEnterpriseData(null);
      setIsDropdownOpen(false); // Close dropdown when disabled
      previousParamsRef.current = null; // Reset params cache when disabled
      return;
    }

    fetchEnterpriseData();
  }, [isActive, fetchEnterpriseData]);

  // useEffect #2: Update parent when chart data changes
  useEffect(() => {
    // Stringify to compare by value, not by reference
    const currentDataString = JSON.stringify(chartData);
    const previousDataString = previousChartDataRef.current;

    if (currentDataString !== previousDataString) {
      previousChartDataRef.current = currentDataString;
      onEnterpriseDataChange(chartData);
    }
  }, [chartData, onEnterpriseDataChange]);

  // useEffect #3: Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Don't render if no lines selected
  if (!selectedLines || selectedLines.length === 0) {
    return null;
  }

  return (
    <div className="enterprise-control" ref={dropdownRef}>
      <div className="enterprise-controls-wrapper">
        {/* Checkbox to enable/disable enterprise */}
        <label className="enterprise-checkbox-label">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={loading}
            className="enterprise-checkbox"
          />
          <span className="enterprise-checkbox-text">{t('enterpriseOverlay')}</span>
          {loading && <span className="loading-indicator"> ⏳</span>}
        </label>

        {/* Button to open settings dropdown (only enabled when checkbox is checked) */}
        <button
          className={`enterprise-settings-btn ${isActive ? 'active' : ''}`}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={!isActive || loading}
          title={isActive ? "Настройки промышленности" : "Включите промышленность"}
          aria-label="Настройки"
          aria-expanded={isDropdownOpen}
        >
          <span className="button-icon">⚙️</span>
        </button>
      </div>

      {/* Dropdown Panel (visible when dropdown is open) */}
      {isActive && isDropdownOpen && (
        <div className="enterprise-panel">
          {/* Loading state */}
          {loading && (
            <div className="enterprise-loading">
              <div className="loading-spinner"></div>
              <p>{t('loadingEnterpriseData') || 'Загрузка данных предприятий...'}</p>
              <div className="progress-bar">
                <div className="progress-bar-fill"></div>
              </div>
            </div>
          )}

          {/* Info and checkboxes (visible when not loading) */}
          {!loading && (
            <>
              <div className="enterprise-info">
                <small>{t('enterpriseNetVolumeInfo')}</small>
              </div>

              <div className="enterprise-option">
                <label>
                  <input
                    type="checkbox"
                    checked={showNetVolume}
                    onChange={(e) => setShowNetVolume(e.target.checked)}
                  />
                  <span>{t('netVolume') || 'Net Volume'}</span>
                </label>
              </div>

              <div className="enterprise-option">
                <label>
                  <input
                    type="checkbox"
                    checked={showTotal}
                    onChange={(e) => setShowTotal(e.target.checked)}
                  />
                  <span>{t('totalEnterpriseVolume')}</span>
                </label>
              </div>

              {/* Show message if no data */}
              {enterpriseData === null && (
                <div className="enterprise-empty">
                  <small>{t('enterpriseNoData') || 'Нет данных по предприятиям'}</small>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SimplifiedEnterpriseControl;
