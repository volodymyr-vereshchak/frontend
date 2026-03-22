import React, { useState, useEffect } from 'react';
import { reportsApi, branchApi, lumgApi, lineApi, archiveDataApi } from '../services/api';
import { GRSCalculator } from '../utils/grsCalculator';
import { useLanguage } from '../contexts/LanguageContext';
import './GRSReport.css';

const GRSReport = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  // Branch selector state
  const [branches, setBranches] = useState([]);
  const [allLumgs, setAllLumgs] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [selectorLoading, setSelectorLoading] = useState(false);

  // Load branches and lumgs when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const loadSelectors = async () => {
      setSelectorLoading(true);
      try {
        const [branchesRes, lumgsRes] = await Promise.all([
          branchApi.getAll(),
          lumgApi.getAll(),
        ]);
        const branchList = Array.isArray(branchesRes) ? branchesRes : [];
        const lumgList = Array.isArray(lumgsRes) ? lumgsRes : [];
        setBranches(branchList);
        setAllLumgs(lumgList);
        if (branchList.length > 0) {
          setSelectedBranchId(branchList[0].id);
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      } finally {
        setSelectorLoading(false);
      }
    };
    loadSelectors();
  }, [isOpen]);

  const handleBranchChange = (e) => {
    setSelectedBranchId(Number(e.target.value));
    setReportData(null);
    setError(null);
  };

  const fetchReport = async () => {
    if (!selectedBranchId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Get LUMGs for selected branch
      const branchLumgIds = allLumgs
        .filter(l => l.branch_id === selectedBranchId)
        .map(l => l.id);

      if (branchLumgIds.length === 0) {
        setError('Немає ЛУМГів для обраної філії');
        return;
      }

      // Fetch lines for all LUMGs in parallel, filter by include_in_report
      const linesArr = await Promise.all(
        branchLumgIds.map(lid => lineApi.getLinesByLumg(lid))
      );
      const lines = linesArr.flat().filter(l => l && l.include_in_report);

      if (lines.length === 0) {
        setError('Немає ліній з прапором include_in_report для обраної філії');
        return;
      }

      const lineIds = lines.map(l => l.id);
      const hourlyData = await archiveDataApi.getHourlyDataLast24h(lineIds);

      if (!hourlyData || hourlyData.length === 0) {
        setError('Немає даних за останні 24 години');
        return;
      }

      const calculatedReport = GRSCalculator.calculateGRSReport(lines, hourlyData);

      if (calculatedReport.success) {
        setReportData(calculatedReport.data);
      } else {
        // Fallback to text report
        const textResponse = await reportsApi.getGRSReport();
        if (textResponse && textResponse.success) {
          setReportData({ fallback: true, message: textResponse.message });
        } else {
          setError(calculatedReport.error || t('calculationError'));
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

    if (data.fallback && data.message) {
      return formatReportMessage(data.message);
    }

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

          {data.lineReports.map((report) => (
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
        formattedLines.push(<h4 key={index} className="report-title">{line}</h4>);
      } else if (line.includes(' - ') && line.includes(':') && (line.includes('202') || line.includes('203'))) {
        formattedLines.push(<p key={index} className="date-range">{line}</p>);
      } else if (line.includes('всего:') && line.includes('ГРС')) {
        const cleanLine = line.replace(/<b>/g, '').replace(/<\/b>/g, '');
        formattedLines.push(<h5 key={index} className="total-volume">{cleanLine}</h5>);
      } else if (line.includes('<b>') && line.includes('</b>') && (line.includes('м³') || line.includes('кг/см²') || line.includes('Pвых'))) {
        const cleanLine = line.replace(/<b>/g, '').replace(/<\/b>/g, '');
        const hasWarning = line.includes('🔴');

        if (cleanLine.includes(':')) {
          const parts = cleanLine.split(':', 2);
          const lineName = parts[0].trim();
          const lineData = parts[1]?.trim() || '';

          let volume = '', pressure = '';
          const volumeMatch = lineData.match(/([\d\s.,]+)\s*м³/);
          if (volumeMatch) volume = volumeMatch[1].replace(/\s+/g, ' ').trim();
          const pressureMatch = lineData.match(/Pвых\s+([\d\s.,]+)(?:\s*кг\/см²)?/);
          if (pressureMatch) pressure = pressureMatch[1].replace(/\s+/g, ' ').trim();

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
          formattedLines.push(<p key={index} className="data-line monospace">{cleanLine}</p>);
        }
      } else if (line.trim() && (line.includes('м³') || line.includes('кг/см²') || line.includes('Pвых'))) {
        formattedLines.push(<p key={index} className="data-line monospace">{line.replace(/<\/?b>/g, '').trim()}</p>);
      } else if (line.trim()) {
        formattedLines.push(<p key={index} className="other-line">{line}</p>);
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
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="grs-modal-body">
          {/* Branch selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <label style={{ color: '#B9E42B', fontSize: 13, whiteSpace: 'nowrap' }}>Філія:</label>
            <select
              style={{ background: '#2a2a2a', color: '#e0e0e0', border: '1px solid #404040', borderRadius: 4, padding: '5px 10px', fontSize: 13, minWidth: 180 }}
              value={selectedBranchId || ''}
              onChange={handleBranchChange}
              disabled={selectorLoading}
            >
              {selectorLoading && <option>Завантаження...</option>}
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

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
            disabled={isLoading || !selectedBranchId}
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
