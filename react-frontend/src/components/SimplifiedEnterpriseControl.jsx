import React, { useState, useEffect, useRef } from 'react';
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

  // Process raw API data into period-based structure
  const processEnterpriseData = (rawData) => {
    const byPeriod = {};

    rawData.forEach(item => {
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

    return byPeriod;
  };

  // Build chart data from processed enterprise data
  const buildChartData = (processedData, includeNet, includeTotal) => {
    if (!processedData) return null;

    const result = {};

    if (includeNet) {
      result.netVolume = Object.keys(processedData).sort().map(period => ({
        period: period,
        value: processedData[period].lineVolume - processedData[period].totalEnterpriseVolume
      }));
    }

    if (includeTotal) {
      result.totalEnterprise = Object.keys(processedData).sort().map(period => ({
        period: period,
        value: processedData[period].totalEnterpriseVolume
      }));
    }

    return Object.keys(result).length > 0 ? result : null;
  };

  // Fetch enterprise data from API
  const fetchEnterpriseData = async () => {
    if (!selectedLines || selectedLines.length === 0) {
      console.warn('No lines selected for enterprise data fetch');
      return;
    }

    if (!dateRange || !dateRange.fromDate || !dateRange.toDate) {
      console.warn('Invalid date range for enterprise data fetch');
      return;
    }

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
        onEnterpriseDataChange(null);
        setLoading(false);
        return;
      }

      // Process and save data
      const processed = processEnterpriseData(data);
      setEnterpriseData(processed);

      // Build and send chart data
      const chartData = buildChartData(processed, showNetVolume, showTotal);
      onEnterpriseDataChange(chartData);

    } catch (err) {
      console.error('Error fetching enterprise data:', err);
      setEnterpriseData(null);
      onEnterpriseDataChange(null);
    } finally {
      setLoading(false);
    }
  };

  // useEffect #1: Load data when activated or parameters change
  useEffect(() => {
    if (!isActive) {
      setEnterpriseData(null);
      onEnterpriseDataChange(null);
      setIsDropdownOpen(false); // Close dropdown when disabled
      return;
    }

    fetchEnterpriseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, selectedLines, dateRange, archiveType]);

  // useEffect #2: Update chart when checkboxes change (without re-fetching)
  useEffect(() => {
    if (isActive && enterpriseData) {
      const chartData = buildChartData(enterpriseData, showNetVolume, showTotal);
      onEnterpriseDataChange(chartData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNetVolume, showTotal]);

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
