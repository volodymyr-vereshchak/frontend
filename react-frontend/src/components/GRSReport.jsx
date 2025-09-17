import React, { useState } from 'react';
import { reportsApi } from '../services/api';
import './GRSReport.css';

const GRSReport = ({ isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await reportsApi.getGRSReport();

      if (response && response.success) {
        setReportData(response.message);
      } else {
        setError(response?.message || 'Неизвестная ошибка при получении отчета');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
      console.error('Error fetching GRS report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchReport();
  };

  const formatReportMessage = (message) => {
    if (!message) {
      return <div className="no-data">Нет данных для отображения</div>;
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
      } else if (line.includes('<b>') && line.includes('</b>') && (line.includes('м³') || line.includes('кг/см²'))) {
        const cleanLine = line.replace(/<b>/g, '').replace(/<\/b>/g, '');
        const hasWarning = line.includes('🔴');

        if (cleanLine.includes(':')) {
          const parts = cleanLine.split(':', 2);
          const lineName = parts[0].trim();
          const lineData = parts[1]?.trim() || '';

          formattedLines.push(
            <div key={index} className={`line-data ${hasWarning ? 'warning' : 'normal'}`}>
              {hasWarning && <span className="warning-icon">⚠️</span>}
              <span className="line-name">{lineName}:</span>
              <span className="line-value">{lineData}</span>
            </div>
          );
        } else {
          formattedLines.push(
            <p key={index} className="data-line monospace">
              {cleanLine}
            </p>
          );
        }
      } else if (line.trim() && (line.includes('м³') || line.includes('кг/см²'))) {
        formattedLines.push(
          <p key={index} className="data-line monospace">
            {line}
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
              {formatReportMessage(reportData)}
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