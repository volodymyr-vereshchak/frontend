import React, { useState, useEffect, useMemo } from 'react';
import {
  virtualLinesApi,
  archiveDataVirtualApi,
  enterpriseVirtualApi,
  branchApi,
} from '../services/api';
import { getEnterpriseWithCache } from '../services/enterpriseCache';
import { useLanguage } from '../contexts/LanguageContext';
import DateTimePickers from './DateTimePickers';
import InteractiveChart from './InteractiveChart';
import './GRSTrends.css';

const GRSTrends = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [visibleLines, setVisibleLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [showEnterprise, setShowEnterprise] = useState(false);
  const [showEnterprise, setShowEnterprise] = useState(false);

  // Branch selector
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  // Get initial date range (first day of current month to today)
  const getInitialDateRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    // First day of current month
    const startDate = `${year}-${month}-01`;

    // Current date
    const endDate = `${year}-${month}-${day}`;

    return {
      fromDate: startDate,
      toDate: endDate,
      startHour: 7,
      endHour: 6
    };
  };

  const [dateRange, setDateRange] = useState(getInitialDateRange);

  // Load branches on open
  useEffect(() => {
    if (!isOpen) return;
    branchApi.getAll().then(data => {
      const list = Array.isArray(data) ? data : [];
      setBranches(list);
      if (list.length > 0) setSelectedBranchId(list[0].id);
    }).catch(err => console.error('Failed to load branches:', err));
  }, [isOpen]);

  // Load visible lines on component mount
  useEffect(() => {
    const loadVisibleLines = async () => {
      setLinesLoading(true);
      try {
        const lines = await virtualLinesApi.getVisibleLines();
        if (lines && lines.length > 0) {
          setVisibleLines(lines);
        } else {
          // Fallback to hardcoded config if API returns empty
          if (typeof window !== 'undefined' && window.APP_CONFIG?.GRS_CONFIG?.LINES_IDS) {
            const fallbackLines = window.APP_CONFIG.GRS_CONFIG.LINES_IDS.map(id => ({
              id: id,
              name: `Line ${id}`,
              is_virtual: false
            }));
            setVisibleLines(fallbackLines);
          } else {
            // Default fallback
            const defaultLines = [1, 4, 5, 21, 20, 19, 18, 16, 6, 8, 15, 17, 12, 10, 11].map(id => ({
              id: id,
              name: `Line ${id}`,
              is_virtual: false
            }));
            setVisibleLines(defaultLines);
          }
        }
      } catch (err) {
        console.error('Error loading visible lines:', err);
        // Fallback to hardcoded config on error
        if (typeof window !== 'undefined' && window.APP_CONFIG?.GRS_CONFIG?.LINES_IDS) {
          const fallbackLines = window.APP_CONFIG.GRS_CONFIG.LINES_IDS.map(id => ({
            id: id,
            name: `Line ${id}`,
            is_virtual: false
          }));
          setVisibleLines(fallbackLines);
        } else {
          // Default fallback
          const defaultLines = [1, 4, 5, 21, 20, 19, 18, 16, 6, 8, 15, 17, 12, 10, 11].map(id => ({
            id: id,
            name: `Line ${id}`,
            is_virtual: false
          }));
          setVisibleLines(defaultLines);
        }
      } finally {
        setLinesLoading(false);
      }
    };

    if (isOpen) {
      loadVisibleLines();
    }
  }, [isOpen]);

  // Extract line IDs filtered by selected branch
  const grsLines = useMemo(() => {
    return visibleLines
      .filter(line => !selectedBranchId || line.branch_id === selectedBranchId)
      .map(line => line.id);
  }, [visibleLines, selectedBranchId]);

  const calculateTrends = async () => {
    if (grsLines.length === 0) {
      setError(t('noGrsLinesConfigured'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dailyData = await archiveDataVirtualApi.getDailyDataVirtual(
        grsLines, dateRange.fromDate, dateRange.toDate
      );

      if (!dailyData || dailyData.length === 0) {
        setError(t('noDataAvailable'));
        setChartData([]);
        return;
      }

      let enterpriseData = [];
      if (showEnterprise) {
        enterpriseData = await getEnterpriseWithCache(
          grsLines, dateRange.fromDate, dateRange.toDate, 'daily',
          (lines, from, to, type) => enterpriseVirtualApi.getEnterpriseVolumesVirtual(lines, from, to, type)
        ) || [];
      }

      const trendsData = calculateGRSTrendsPercentages(dailyData, grsLines, enterpriseData);
      setChartData(trendsData);

    } catch (err) {
      setError(t('errorLoadingData'));
      console.error('Error calculating GRS trends:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateGRSTrendsPercentages = (dailyData, lineIds, enterpriseData = []) => {
    // Group data by line_id
    const lineDataMap = {};

    dailyData.forEach(record => {
      const lineId = record.line_id;
      if (!lineDataMap[lineId]) {
        lineDataMap[lineId] = [];
      }
      lineDataMap[lineId].push(record);
    });

    // Create enterprise volume lookup map: {line_id: {date: total_volume}}
    const enterpriseMap = {};
    enterpriseData.forEach(entry => {
      const lineId = entry.line_id;
      const date = new Date(entry.period).toISOString().split('T')[0];

      if (!enterpriseMap[lineId]) {
        enterpriseMap[lineId] = {};
      }
      enterpriseMap[lineId][date] = entry.total_volume;
    });

    // Calculate total NET volume per line (GS - Enterprise) for the entire period
    const lineTotals = {};
    Object.keys(lineDataMap).forEach(lineId => {
      const lineData = lineDataMap[lineId];
      const totalVolume = lineData.reduce((sum, record) => {
        const date = new Date(record.period).toISOString().split('T')[0];
        const gsVolume = record.volume || 0;

        // Subtract enterprise volume if exists for this line and date
        const enterpriseVolume = (enterpriseMap[lineId] && enterpriseMap[lineId][date]) || 0;
        const netVolume = Math.max(0, gsVolume - enterpriseVolume);

        return sum + netVolume;
      }, 0);
      lineTotals[lineId] = totalVolume;
    });

    // Create chart data with percentages for each day
    const chartDataMap = {};

    Object.keys(lineDataMap).forEach(lineId => {
      const lineData = lineDataMap[lineId];
      const totalVolume = lineTotals[lineId];

      if (totalVolume > 0) {
        lineData.forEach(record => {
          const date = new Date(record.period).toISOString().split('T')[0];
          const gsVolume = record.volume || 0;

          // Subtract enterprise volume
          const enterpriseVolume = (enterpriseMap[lineId] && enterpriseMap[lineId][date]) || 0;
          const netVolume = Math.max(0, gsVolume - enterpriseVolume);

          const percentage = (netVolume / totalVolume) * 100;

          if (!chartDataMap[date]) {
            chartDataMap[date] = { period: date };
          }

          chartDataMap[date][`line_${lineId}`] = percentage;
          chartDataMap[date][`line_${lineId}_volume`] = netVolume;
          chartDataMap[date][`line_${lineId}_enterprise`] = enterpriseVolume;
        });
      }
    });

    // Convert to array and sort by date
    const trendsArray = Object.values(chartDataMap).sort((a, b) =>
      new Date(a.period) - new Date(b.period)
    );

    return trendsArray;
  };

  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
  };

  const handleRefresh = () => {
    calculateTrends();
  };

  // Auto-calculate when date range, branch or enterprise toggle changes
  useEffect(() => {
    if (isOpen && dateRange.fromDate && dateRange.toDate && selectedBranchId) {
      calculateTrends();
    }
  }, [dateRange, isOpen, selectedBranchId, showEnterprise]);

  // Re-calculate when enterprise cache is cleared (Ctrl+Shift+E)
  useEffect(() => {
    const handler = () => { if (isOpen) calculateTrends(); };
    window.addEventListener('enterprise-cache-cleared', handler);
    return () => window.removeEventListener('enterprise-cache-cleared', handler);
  }, [isOpen, dateRange, selectedBranchId, showEnterprise]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content grs-trends-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{t('grsTrends')}</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="grs-trends-modal-body">
          {/* Branch selector + Enterprise checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#e0e0e0', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={showEnterprise}
                onChange={e => setShowEnterprise(e.target.checked)}
                disabled={isLoading}
              />
              {t('enterpriseOverlay')}
            </label>
          </div>

          {/* Date Range Picker */}
          <div className="date-picker-section">
            <h4>{t('selectPeriod')}</h4>
            <DateTimePickers
              onDateRangeChange={handleDateRangeChange}
              onDateFilterToggle={() => {}} // Not used in modal
              archiveType="daily"
              initialDateRange={dateRange}
            />
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>{t('calculatingTrends')}</p>
            </div>
          )}

          {/* Error State */}
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
                trendsMode={true}
              />
            </div>
          )}

          {/* No Data State */}
          {!isLoading && !error && chartData.length === 0 && (
            <div className="no-data-container">
              <p>{t('noDataForPeriod')}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-primary"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? t('loading') : t('refresh')}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GRSTrends;