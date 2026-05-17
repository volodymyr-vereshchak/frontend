import React, { useState, useEffect, useMemo } from 'react';
import {
  archiveDataApi,
  archiveDataVirtualApi,
  enterpriseVirtualApi,
  branchApi,
  lumgApi,
  lineApi,
} from '../services/api';
import { getEnterpriseWithCache } from '../services/enterpriseCache';
import { useLanguage } from '../contexts/LanguageContext';
import DateTimePickers from './DateTimePickers';
import * as XLSX from 'xlsx';
import './NightConsumption.css';

// Excel Export Icon
const ExcelIcon = ({ color = "#B9E42B" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.53 9L13 3.47C12.8595 3.32931 12.6688 3.25018 12.47 3.25H8C7.27065 3.25 6.57118 3.53973 6.05546 4.05546C5.53973 4.57118 5.25 5.27065 5.25 6V18C5.25 18.7293 5.53973 19.4288 6.05546 19.9445C6.57118 20.4603 7.27065 20.75 8 20.75H16C16.7293 20.75 17.4288 20.4603 17.9445 19.9445C18.4603 19.4288 18.75 18.7293 18.75 18V9.5C18.7421 9.3116 18.6636 9.13309 18.53 9ZM13.25 5.81L16.19 8.75H13.25V5.81ZM16 19.25H8C7.66848 19.25 7.35054 19.1183 7.11612 18.8839C6.8817 18.6495 6.75 18.3315 6.75 18V6C6.75 5.66848 6.8817 5.35054 7.11612 5.11612C7.35054 4.8817 7.66848 4.75 8 4.75H11.75V9.5C11.7526 9.69811 11.8324 9.88737 11.9725 10.0275C12.1126 10.1676 12.3019 10.2474 12.5 10.25H17.25V18C17.25 18.3315 17.1183 18.6495 16.8839 18.8839C16.6495 19.1183 16.3315 19.25 16 19.25Z" fill={color}/>
    <path d="M14.47 11.91C14.312 11.7893 14.1134 11.7343 13.9158 11.7567C13.7183 11.7791 13.537 11.877 13.41 12.03L12 13.8L10.59 12C10.5243 11.9225 10.4441 11.8587 10.3537 11.8123C10.2634 11.7658 10.1648 11.7376 10.0636 11.7293C9.96242 11.7209 9.86055 11.7326 9.76384 11.7636C9.66713 11.7946 9.57747 11.8443 9.49999 11.91C9.42251 11.9757 9.35872 12.0559 9.31227 12.1463C9.26581 12.2366 9.2376 12.3351 9.22925 12.4364C9.22089 12.5376 9.23255 12.6394 9.26356 12.7362C9.29457 12.8329 9.34433 12.9225 9.40999 13L11 15L9.40999 17C9.28534 17.1565 9.22796 17.3561 9.25046 17.5549C9.27296 17.7536 9.37351 17.9353 9.52999 18.06C9.68647 18.1847 9.88606 18.242 10.0848 18.2195C10.2836 18.197 10.4653 18.0965 10.59 17.94L12 16.2L13.41 18C13.4818 18.0871 13.5719 18.1573 13.6738 18.2056C13.7758 18.254 13.8871 18.2794 14 18.28C14.1534 18.2927 14.3069 18.2579 14.4398 18.1804C14.5728 18.1028 14.6786 17.9863 14.743 17.8465C14.8074 17.7068 14.8273 17.5506 14.7999 17.3991C14.7726 17.2477 14.6993 17.1084 14.59 17L13 15L14.63 13C14.6922 12.9184 14.7375 12.8251 14.7632 12.7258C14.7889 12.6264 14.7944 12.5229 14.7795 12.4213C14.7646 12.3198 14.7295 12.2222 14.6764 12.1344C14.6232 12.0466 14.5531 11.9703 14.47 11.91Z" fill={color}/>
  </svg>
);

const NightConsumption = ({ isOpen, onClose }) => {
  const { t, getLocale } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [lineNames, setLineNames] = useState({});
  const [linesLoading, setLinesLoading] = useState(false);

  // Physical and virtual lines loaded per branch
  const [physicalLines, setPhysicalLines] = useState([]);
  const [virtualLines, setVirtualLines] = useState([]);

  // Branch + lumg data
  const [branches, setBranches] = useState([]);
  const [lumgs, setLumgs] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  // Get initial date range (first day of current month to today)
  const getInitialDateRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-${day}`;

    return {
      fromDate: startDate,
      toDate: endDate,
      startHour: 7,
      endHour: 6
    };
  };

  const [dateRange, setDateRange] = useState(getInitialDateRange);

  // Load branches + lumgs on open
  useEffect(() => {
    if (!isOpen) return;
    Promise.all([branchApi.getAll(), lumgApi.getAll()])
      .then(([branchData, lumgData]) => {
        const branchList = Array.isArray(branchData) ? branchData : [];
        setBranches(branchList);
        setLumgs(Array.isArray(lumgData) ? lumgData : []);
        if (branchList.length > 0) setSelectedBranchId(branchList[0].id);
      })
      .catch(err => console.error('Failed to load branches/lumgs:', err));
  }, [isOpen]);

  // Load lines for selected branch (include_in_trends only)
  useEffect(() => {
    if (!isOpen || !selectedBranchId) return;

    const loadLinesByBranch = async () => {
      setLinesLoading(true);
      try {
        const branchLumgIds = lumgs.filter(l => l.branch_id === selectedBranchId).map(l => l.id);

        // Physical lines with include_in_trends=true
        let phys = [];
        if (branchLumgIds.length > 0) {
          const arrays = await Promise.all(
            branchLumgIds.map(lid => lineApi.getLinesByLumg(lid))
          );
          phys = arrays.flat().filter(l => l && l.include_in_trends);
        }

        // Virtual lines with include_in_trends=true for this branch
        const virt = await lumgApi.getAll()
          .then(() => fetch(
            `${(window.APP_CONFIG?.API_URL || '/api')}/virtual_lines/?include_in_trends=true&branch_id=${selectedBranchId}`,
            { credentials: 'include' }
          ).then(r => r.ok ? r.json() : []))
          .catch(() => []);

        setPhysicalLines(phys);
        setVirtualLines(virt);

        const namesMap = {};
        [...phys, ...virt].forEach(l => { namesMap[l.id] = l.name || `Лінія ${l.id}`; });
        setLineNames(namesMap);
      } catch (err) {
        console.error('Error loading lines for branch:', err);
      } finally {
        setLinesLoading(false);
      }
    };

    loadLinesByBranch();
  }, [isOpen, selectedBranchId, lumgs]);

  const physicalLineIds = useMemo(() => physicalLines.map(l => l.id), [physicalLines]);
  const virtualLineIds  = useMemo(() => virtualLines.map(l => l.id),  [virtualLines]);
  const grsLines        = useMemo(() => [...physicalLineIds, ...virtualLineIds], [physicalLineIds, virtualLineIds]);

  const calculateNightConsumption = async () => {
    if (grsLines.length === 0) {
      setError(t('noGrsLinesConfigured'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Commercial day: 07:00 of fromDate to 06:00 of toDate
      const commercialFrom = `${dateRange.fromDate}T07:00:00`;
      const commercialTo = `${dateRange.toDate}T06:00:00`;

      // Fetch physical and virtual hourly data from separate endpoints (like old HTML page)
      const [physHourly, virtHourly, enterpriseData] = await Promise.all([
        physicalLineIds.length > 0
          ? archiveDataApi.getHourlyData(physicalLineIds, commercialFrom, commercialTo)
          : Promise.resolve([]),
        virtualLineIds.length > 0
          ? archiveDataVirtualApi.getHourlyDataVirtual(virtualLineIds, commercialFrom, commercialTo)
          : Promise.resolve([]),
        getEnterpriseWithCache(
          grsLines, commercialFrom, commercialTo, 'hourly',
          (lines, from, to, type) => enterpriseVirtualApi.getEnterpriseVolumesVirtual(lines, from, to, type)
        )
      ]);
      const hourlyData = [...(physHourly || []), ...(virtHourly || [])];

      if (!hourlyData || hourlyData.length === 0) {
        setError(t('noDataAvailable'));
        setTableData([]);
        return;
      }

      // Log warning if no enterprise data (not an error)
      if (!enterpriseData || enterpriseData.length === 0) {
        console.warn('No enterprise data available, using GS volumes only');
      }

      // Calculate night consumption with enterprise subtraction
      const nightData = calculateMinNightFlow(
        hourlyData,
        grsLines,
        enterpriseData || []
      );
      setTableData(nightData);

    } catch (err) {
      setError(t('errorLoadingData'));
      console.error('Error calculating night consumption:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMinNightFlow = (hourlyData, lineIds, enterpriseData = []) => {
    // STEP 1: Create enterprise lookup map with FULL datetime for exact hourly matching
    // Structure: {line_id: {datetime: total_volume}}
    const enterpriseMap = {};

    enterpriseData.forEach(entry => {
      const lineId = entry.line_id;
      const datetime = entry.period; // Keep full datetime: "2025-12-01T03:00:00"

      if (!enterpriseMap[lineId]) {
        enterpriseMap[lineId] = {};
      }

      // Sum up all device volumes for this period
      let totalVolume = 0;
      if (entry.devices && Array.isArray(entry.devices)) {
        entry.devices.forEach(device => {
          totalVolume += device.volume || 0;
        });
      } else if (entry.total_volume !== undefined) {
        totalVolume = entry.total_volume;
      }

      enterpriseMap[lineId][datetime] = totalVolume;
    });

    // STEP 2: Group hourly data by date and line for night period (0-5 hours)
    const dataByDateAndLine = {};

    hourlyData.forEach((record) => {
      // CRITICAL: Parse datetime WITHOUT timezone conversion
      // Server sends "2025-10-01T00:00:00" which means LOCAL time 2025-10-01 00:00
      // We must NOT let browser convert it to its timezone

      let date, hour;
      const periodStr = String(record.period);

      // Extract date and hour using REGEX to avoid ANY Date object creation
      // This prevents timezone issues completely
      const isoMatch = periodStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);

      if (isoMatch) {
        // Format: "2025-10-01T00:00:00" or "2025-10-01 00:00:00"
        const [, year, month, day, hours] = isoMatch;
        date = `${year}-${month}-${day}`;
        hour = parseInt(hours, 10);
      } else {
        // Fallback: try simple split (shouldn't happen with correct API)
        if (periodStr.includes('T')) {
          const [datePart, timePart] = periodStr.split('T');
          date = datePart;
          hour = parseInt(timePart.substring(0, 2), 10);
        } else if (periodStr.includes(' ')) {
          const [datePart, timePart] = periodStr.split(' ');
          date = datePart;
          hour = parseInt(timePart.substring(0, 2), 10);
        } else {
          return; // Skip invalid format
        }
      }

      // Only consider hours 00:00 to 05:00 (inclusive)
      if (hour >= 0 && hour <= 5) {
        const lineId = record.line_id;
        const fullDatetime = periodStr; // Keep full datetime for enterprise lookup

        // STEP 3: Calculate NET = MAX(0, GS Volume - Enterprise Volume)
        const gsVolume = record.volume !== undefined ? record.volume : (record.flow || 0);
        const enterpriseVolume = (enterpriseMap[lineId]?.[fullDatetime]) || 0;
        const netVolume = Math.max(0, gsVolume - enterpriseVolume);

        if (!dataByDateAndLine[date]) {
          dataByDateAndLine[date] = {};
        }

        if (!dataByDateAndLine[date][lineId]) {
          dataByDateAndLine[date][lineId] = [];
        }

        // Store NET volume instead of raw GS volume
        dataByDateAndLine[date][lineId].push(netVolume);
      }
    });

    // STEP 4: Find MIN(NET volumes) for each date and line
    const result = [];

    Object.keys(dataByDateAndLine).sort().forEach(date => {
      const row = { date };

      lineIds.forEach(lineId => {
        const netVolumes = dataByDateAndLine[date][lineId];
        if (netVolumes && netVolumes.length > 0) {
          row[`line_${lineId}`] = Math.min(...netVolumes);
        } else {
          row[`line_${lineId}`] = null;
        }
      });

      result.push(row);
    });

    return result;
  };

  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
  };

  const handleRefresh = () => {
    calculateNightConsumption();
  };

  const exportToExcel = () => {
    if (!tableData || tableData.length === 0) {
      alert(t('noDataExport'));
      return;
    }

    try {
      // Prepare data for Excel
      const excelData = tableData.map(row => {
        const excelRow = { [t('date')]: row.date };

        grsLines.forEach(lineId => {
          const columnName = lineNames[lineId] || `Line ${lineId}`;
          const value = row[`line_${lineId}`];
          excelRow[columnName] = value !== null ? value : '';
        });

        return excelRow;
      });

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const columnWidths = [
        { wch: 15 }, // Date column
        ...grsLines.map(() => ({ wch: 15 })) // Line columns
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, t('nightConsumption'));

      // Generate filename
      const branchName = branches.find(b => b.id === selectedBranchId)?.name || '';
      const filename = `${t('nightConsumption')}${branchName ? '_' + branchName : ''}_${dateRange.fromDate}_${dateRange.toDate}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert(t('errorExportingData'));
    }
  };

  const handleLoad = () => {
    if (!linesLoading && grsLines.length > 0 && dateRange.fromDate && dateRange.toDate) {
      calculateNightConsumption();
    }
  };

  // Re-calculate when enterprise cache is cleared (Ctrl+Shift+E)
  useEffect(() => {
    const handler = () => { if (isOpen) calculateNightConsumption(); };
    window.addEventListener('enterprise-cache-cleared', handler);
    return () => window.removeEventListener('enterprise-cache-cleared', handler);
  }, [isOpen, dateRange, selectedBranchId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content night-consumption-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{t('nightConsumption')}</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="night-consumption-modal-body">
          {/* Controls row: branch + dates + load button */}
          <div className="nc-controls-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: '#B9E42B', fontSize: 13, whiteSpace: 'nowrap' }}>{t('branch')}:</label>
              <select
                style={{ background: '#2a2a2a', color: '#e0e0e0', border: '1px solid #404040', borderRadius: 4, padding: '5px 10px', fontSize: 13, minWidth: 180 }}
                value={selectedBranchId || ''}
                onChange={e => { setSelectedBranchId(Number(e.target.value)); setTableData([]); }}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="date-picker-section" style={{ marginBottom: 0, flex: 1 }}>
              <DateTimePickers
                onDateRangeChange={handleDateRangeChange}
                onDateFilterToggle={() => {}}
                archiveType="daily"
                initialDateRange={dateRange}
              />
            </div>

            <button
              className="btn btn-primary nc-load-btn"
              onClick={handleLoad}
              disabled={isLoading || linesLoading}
            >
              {isLoading ? t('loading') : 'Завантажити'}
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>{t('loading')}</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <p className="error-message">{t('error')}: {error}</p>
            </div>
          )}

          {/* Table */}
          {!isLoading && !error && tableData.length > 0 && (
            <div className="table-section">
              <div className="table-header">
                <h4>{t('nightConsumptionNetDescription')}</h4>
                <button
                  className="export-button"
                  onClick={exportToExcel}
                  title={t('exportToExcel')}
                >
                  <ExcelIcon />
                  <span>{t('exportToExcel')}</span>
                </button>
              </div>

              <div className="table-wrapper">
                <table className="night-consumption-table">
                  <thead>
                    <tr>
                      <th>{t('date')}</th>
                      {grsLines.map(lineId => (
                        <th key={lineId}>
                          {lineNames[lineId] || `Line ${lineId}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, index) => (
                      <tr key={index}>
                        <td>{row.date}</td>
                        {grsLines.map(lineId => (
                          <td key={lineId}>
                            {row[`line_${lineId}`] !== null
                              ? row[`line_${lineId}`].toFixed(2)
                              : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No Data State */}
          {!isLoading && !error && tableData.length === 0 && (
            <div className="no-data-container">
              <p>{t('selectPeriod')}</p>
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

export default NightConsumption;
