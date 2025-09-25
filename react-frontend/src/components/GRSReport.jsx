import React, { useState } from 'react';
import { reportsApi } from '../services/api';
import { GRSCalculator } from '../utils/grsCalculator';
import { useLanguage } from '../contexts/LanguageContext';
import './GRSReport.css';

const GRSReport = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to get structured data and calculate report
      const structuredResponse = await reportsApi.getGRSReportData();

      if (structuredResponse && structuredResponse.success) {
        // Calculate report using our frontend logic
        const calculatedReport = GRSCalculator.calculateGRSReport(
          structuredResponse.lines,
          structuredResponse.hourlyData
        );

        if (calculatedReport.success) {
          setReportData(calculatedReport.data);
        } else {
          setError(calculatedReport.error || t('calculationError'));
        }
      } else {
        // Fallback to old text-based report
        const textResponse = await reportsApi.getGRSReport();
        if (textResponse && textResponse.success) {
          // Parse the old text format (keep existing parsing logic as fallback)
          setReportData({ fallback: true, message: textResponse.message });
        } else {
          setError(textResponse?.message || t('unknownReportError'));
        }
      }
    } catch (err) {
      setError(t('serverConnectionError'));
      console.error('Error fetching GRS report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchReport();
  };

  const formatReportData = (data) => {
    if (!data) {
      return <div className="no-data">{t('noData')}</div>;
    }

    // Handle fallback text format
    if (data.fallback && data.message) {
      return formatReportMessage(data.message);
    }

    // Handle new structured format
    if (data.lineReports) {
      return (
        <div className="report-content-structured">
          <h4 className="report-title">{t('grsVolumeTitle')}</h4>

          {data.startDate && data.endDate && (
            <p className="date-range">
              {data.startDate.toLocaleString('ru')} - {data.endDate.toLocaleString('ru')}
            </p>
          )}

          <h5 className="total-volume">
            {t('grsTotalVolume')}: {data.totalVolume?.toLocaleString('ru')} {t('volumeUnit')}
          </h5>

          {data.lineReports.map((report, index) => (
            <div key={report.lineId} className={`line-data ${report.hasIncompleteData ? 'warning' : 'normal'}`}>
              {report.hasIncompleteData && <span className="warning-icon">⚠️</span>}
              <span className="line-name">{report.lineName}:</span>
              <span className="line-value">
                <span className="volume-info">{t('volume')}: <strong>{report.volume.toLocaleString('ru')} {t('volumeUnit')}</strong></span>
                <span className="separator"> | </span>
                <span className="pressure-info">
                  {report.isHighPressureLine ? t('pressureIn') : t('pressureOut')}: <strong>{report.pressure.toLocaleString('ru')} {t('pressureUnit')}</strong>
                </span>
              </span>
            </div>
          ))}
        </div>
      );
    }

    return <div className="no-data">{t('unknownDataFormat')}</div>;
  };

  const formatReportMessage = (message) => {
    if (!message) {
      return <div className="no-data">{t('noData')}</div>;
    }

    const lines = message.split('\n');
    const formattedLines = [];

    lines.forEach((line, index) => {
      if (!line.trim()) {
        formattedLines.push(<br key={`br-${index}`} />);
        return;
      }

      if (line.startsWith('Объем по ГРС')) {
        formattedLines.push(
          <h4 key={index} className="report-title">
            {line}
          </h4>
        );
      } else if (line.includes(' - ') && line.includes(':') && (line.includes('202') || line.includes('203'))) {
        formattedLines.push(
          <p key={index} className="date-range">
            {line}
          </p>
        );
      } else if (line.includes('всего:') && line.includes('ГРС')) {
        const cleanLine = line.replace(/<b>/g, '').replace(/<\/b>/g, '');
        formattedLines.push(
          <h5 key={index} className="total-volume">
            {cleanLine}
          </h5>
        );
      } else if (line.includes('<b>') && line.includes('</b>') && (line.includes('м³') || line.includes('кг/см²') || line.includes('Pвых'))) {
        const cleanLine = line.replace(/<b>/g, '').replace(/<\/b>/g, '');
        const hasWarning = line.includes('🔴');

        if (cleanLine.includes(':')) {
          const parts = cleanLine.split(':', 2);
          const lineName = parts[0].trim();
          const lineData = parts[1]?.trim() || '';

          // Parse volume and pressure from line data
          let volume = '', pressure = '';

          // Extract volume (м³)
          const volumeMatch = lineData.match(/([\d\s.,]+)\s*м³/);
          if (volumeMatch) {
            volume = volumeMatch[1].replace(/\s+/g, ' ').trim();
          }

          // Extract pressure after Pвых (currently missing from API response)
          const pressureMatch = lineData.match(/Pвых\s+([\d\s.,]+)(?:\s*кг\/см²)?/);
          if (pressureMatch) {
            pressure = pressureMatch[1].replace(/\s+/g, ' ').trim();
          }

          formattedLines.push(
            <div key={index} className={`line-data ${hasWarning ? 'warning' : 'normal'}`}>
              {hasWarning && <span className="warning-icon">⚠️</span>}
              <span className="line-name">{lineName}:</span>
              <span className="line-value">
                {volume && <span className="volume-info">Объем: <strong>{volume} м³</strong></span>}
                {volume && lineData.includes('Pвых') && <span className="separator"> | </span>}
                {volume && lineData.includes('Pвых') && !pressure && <span className="pressure-info">Pвых: <em>нет данных</em></span>}
                {pressure && <span className="pressure-info">Pвых: <strong>{pressure} кг/см²</strong></span>}
                {!volume && !pressure && <span className="raw-data">{lineData}</span>}
              </span>
            </div>
          );
        } else {
          formattedLines.push(
            <p key={index} className="data-line monospace">
              {cleanLine}
            </p>
          );
        }
      } else if (line.trim() && (line.includes('м³') || line.includes('кг/см²') || line.includes('Pвых'))) {
        // Handle lines that contain data but may not have bold tags
        const cleanLine = line.replace(/<\/?b>/g, '').trim();
        formattedLines.push(
          <p key={index} className="data-line monospace">
            {cleanLine}
          </p>
        );
      } else if (line.trim()) {
        formattedLines.push(
          <p key={index} className="other-line">
            {line}
          </p>
        );
      }
    });

    return <div className="report-content-formatted">{formattedLines}</div>;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Отчет по объемам газа за последние 24 часа</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {isLoading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Загрузка отчета...</p>
            </div>
          )}

          {error && (
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <p className="error-message">Ошибка: {error}</p>
            </div>
          )}

          {!isLoading && !error && !reportData && (
            <div className="initial-state">
              <p>Нажмите кнопку "Получить отчет" для загрузки данных</p>
            </div>
          )}

          {!isLoading && !error && reportData && (
            <div className="report-container">
              {formatReportData(reportData)}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-primary"
            onClick={isLoading ? undefined : (reportData ? handleRefresh : fetchReport)}
            disabled={isLoading}
          >
            {isLoading ? 'Загрузка...' : (reportData ? 'Обновить' : 'Получить отчет')}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default GRSReport;