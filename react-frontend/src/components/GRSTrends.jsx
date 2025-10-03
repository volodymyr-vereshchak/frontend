import React, { useState, useEffect, useMemo } from 'react';
import { archiveDataApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import DateTimePickers from './DateTimePickers';
import InteractiveChart from './InteractiveChart';
import './GRSTrends.css';

const GRSTrends = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);

  // Get initial date range (start of current month to today)
  const getInitialDateRange = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    return {
      fromDate: startDate,
      toDate: endDate,
      startHour: 7,
      endHour: 6
    };
  };

  const [dateRange, setDateRange] = useState(getInitialDateRange);

  // Get GRS trends lines from runtime config (injected by Python server)
  const grsLines = useMemo(() => {
    if (typeof window !== 'undefined' && window.APP_CONFIG?.GRS_CONFIG?.TRENDS_IDS) {
      return window.APP_CONFIG.GRS_CONFIG.TRENDS_IDS;
    }
    // Fallback to default
    return [1, 4, 5, 21, 20, 19, 18, 16, 6, 8, 15, 17, 12, 10, 11];
  }, []);

  const calculateTrends = async () => {
    if (grsLines.length === 0) {
      setError(t('noGrsLinesConfigured'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch daily data for all GRS lines for the selected period
      const dailyData = await archiveDataApi.getDailyData(
        grsLines,
        dateRange.fromDate,
        dateRange.toDate
      );

      if (!dailyData || dailyData.length === 0) {
        setError(t('noDataAvailable'));
        setChartData([]);
        return;
      }

      // Calculate trends
      const trendsData = calculateGRSTrendsPercentages(dailyData, grsLines);
      setChartData(trendsData);

    } catch (err) {
      setError(t('errorLoadingData'));
      console.error('Error calculating GRS trends:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateGRSTrendsPercentages = (dailyData, lineIds) => {
    // Group data by line_id
    const lineDataMap = {};

    dailyData.forEach(record => {
      const lineId = record.line_id;
      if (!lineDataMap[lineId]) {
        lineDataMap[lineId] = [];
      }
      lineDataMap[lineId].push(record);
    });

    // Calculate total volume per line for the entire period
    const lineTotals = {};
    Object.keys(lineDataMap).forEach(lineId => {
      const lineData = lineDataMap[lineId];
      const totalVolume = lineData.reduce((sum, record) => {
        return sum + (record.volume || 0);
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
          const volume = record.volume || 0;
          const percentage = (volume / totalVolume) * 100;

          if (!chartDataMap[date]) {
            chartDataMap[date] = { period: date };
          }

          chartDataMap[date][`line_${lineId}`] = percentage;
          chartDataMap[date][`line_${lineId}_volume`] = volume;
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

  // Auto-calculate when date range changes
  useEffect(() => {
    if (isOpen && dateRange.fromDate && dateRange.toDate) {
      calculateTrends();
    }
  }, [dateRange, isOpen]);

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

        <div className="modal-body">
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