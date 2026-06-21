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
import { commercialHourlyRange, commercialDayOf } from '../utils/commercialDay';
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
  const [isExporting, setIsExporting] = useState(false);
  const [lineNames, setLineNames] = useState({});
  const [linesLoading, setLinesLoading] = useState(false);

  // Trend lines (include_in_trends) — shown in the on-screen table.
  const [physicalLines, setPhysicalLines] = useState([]);
  const [virtualLines, setVirtualLines] = useState([]);
  // ALL branch lines — used only for the Excel export (one sheet per line).
  const [allPhysicalLines, setAllPhysicalLines] = useState([]);
  const [allVirtualLines, setAllVirtualLines] = useState([]);

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

        // ALL physical lines of the branch; trend subset (include_in_trends) drives the table.
        let allPhys = [];
        if (branchLumgIds.length > 0) {
          const arrays = await Promise.all(
            branchLumgIds.map(lid => lineApi.getLinesByLumg(lid))
          );
          allPhys = arrays.flat().filter(Boolean);
        }
        const phys = allPhys.filter(l => l.include_in_trends);

        // ALL virtual lines of the branch; trend subset drives the table.
        const allVirt = await fetch(
          `${(window.APP_CONFIG?.API_URL || '/api')}/virtual_lines/?branch_id=${selectedBranchId}`,
          { credentials: 'include' }
        ).then(r => r.ok ? r.json() : []).catch(() => []);
        const virt = (Array.isArray(allVirt) ? allVirt : []).filter(l => l.include_in_trends);

        setPhysicalLines(phys);
        setVirtualLines(virt);
        setAllPhysicalLines(allPhys);
        setAllVirtualLines(Array.isArray(allVirt) ? allVirt : []);

        // Names for ALL lines (export needs every line's name).
        const namesMap = {};
        [...allPhys, ...(Array.isArray(allVirt) ? allVirt : [])]
          .forEach(l => { namesMap[l.id] = l.name || `Лінія ${l.id}`; });
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

  // ALL branch lines (export only) split by physical/virtual for the two endpoints.
  const allPhysicalLineIds = useMemo(() => allPhysicalLines.map(l => l.id), [allPhysicalLines]);
  const allVirtualLineIds  = useMemo(() => allVirtualLines.map(l => l.id),  [allVirtualLines]);
  const allLines           = useMemo(() => [...allPhysicalLineIds, ...allVirtualLineIds], [allPhysicalLineIds, allVirtualLineIds]);

  const calculateNightConsumption = async () => {
    if (grsLines.length === 0) {
      setError(t('noGrsLinesConfigured'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Commercial day: covers commercial days fromDate..toDate, i.e. the hourly
      // range 07:00 of fromDate to 06:00 of (toDate+1). The night of commercial
      // day toDate is the 00:00–05:00 of the next calendar morning.
      const { from: commercialFrom, to: commercialTo } =
        commercialHourlyRange(dateRange.fromDate, dateRange.toDate);

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

      // Per-hour NET map (single source) -> summary MIN table (trend lines only).
      const netMap = buildNetByDayLineHour(hourlyData, enterpriseData || []);
      const nightData = minNightRowsFromMap(netMap, grsLines);
      setTableData(nightData);

    } catch (err) {
      setError(t('errorLoadingData'));
      console.error('Error calculating night consumption:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Per-line hourly columns for the Excel export (one sheet per line). The summary
  // table keeps the MIN over hours 0-5; these tabs show the per-hour NET flow.
  const NIGHT_HOURS = [21, 22, 23, 0, 1, 2, 3, 4]; // sheet column order
  // Hours we must retain NET for: {0..5} feeds the summary MIN, {21,22,23} the tabs.
  const MIN_HOURS = [0, 1, 2, 3, 4, 5];

  // Single source of truth for both the summary table and the per-line tabs:
  // { commDate: { lineId: { hour: netVolume } } } where NET = max(0, GS - enterprise).
  const buildNetByDayLineHour = (hourlyData, enterpriseData = []) => {
    // Enterprise lookup normalized to YYYY-MM-DDTHH (13 chars). API returns
    // "2025-12-01T03:00:00", cache returns "2025-12-01T03" — normalize both.
    const enterpriseMap = {};
    enterpriseData.forEach(entry => {
      const lineId = entry.line_id;
      const normalizedPeriod = String(entry.period || '').replace(' ', 'T').slice(0, 13);
      if (!enterpriseMap[lineId]) enterpriseMap[lineId] = {};

      let totalVolume = 0;
      if (entry.devices && Array.isArray(entry.devices)) {
        entry.devices.forEach(device => { totalVolume += device.volume || 0; });
      } else if (entry.total_volume !== undefined) {
        totalVolume = entry.total_volume;
      }
      enterpriseMap[lineId][normalizedPeriod] = totalVolume;
    });

    const wantHours = new Set([...MIN_HOURS, ...NIGHT_HOURS]);
    const map = {}; // commDate -> lineId -> hour -> net

    hourlyData.forEach((record) => {
      // CRITICAL: parse datetime WITHOUT timezone conversion. Server sends
      // "2025-10-01T00:00:00" meaning LOCAL time — must NOT let the browser shift it.
      let date, hour;
      const periodStr = String(record.period);
      const isoMatch = periodStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
      if (isoMatch) {
        const [, year, month, day, hours] = isoMatch;
        date = `${year}-${month}-${day}`;
        hour = parseInt(hours, 10);
      } else if (periodStr.includes('T')) {
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

      if (!wantHours.has(hour)) return;

      const lineId = record.line_id;
      // Attribute the hour to the COMMERCIAL day it belongs to (00:00–06:00 of
      // calendar date C is part of commercial day C−1; 21:00–23:00 stay on C).
      const commDate = commercialDayOf(date, hour);

      const normalizedPeriod = periodStr.replace(' ', 'T').slice(0, 13);
      const gsVolume = record.volume !== undefined ? record.volume : (record.flow || 0);
      const enterpriseVolume = (enterpriseMap[lineId]?.[normalizedPeriod]) || 0;
      const netVolume = Math.max(0, gsVolume - enterpriseVolume);

      if (!map[commDate]) map[commDate] = {};
      if (!map[commDate][lineId]) map[commDate][lineId] = {};
      map[commDate][lineId][hour] = netVolume;
    });

    return map;
  };

  // Summary table rows: MIN(NET over hours 0-5) per commercial day per line.
  const minNightRowsFromMap = (map, lineIds) => {
    return Object.keys(map).sort().map(date => {
      const row = { date };
      lineIds.forEach(lineId => {
        const byHour = map[date][lineId];
        const vals = byHour ? MIN_HOURS.map(h => byHour[h]).filter(v => v !== undefined) : [];
        row[`line_${lineId}`] = vals.length > 0 ? Math.min(...vals) : null;
      });
      return row;
    });
  };

  // Per-line export tabs: { lineId: [ { date, 21, 22, ... }, ... ] } over the same
  // commercial days as the summary table (every selected line gets a sheet).
  const buildHourlySheets = (map, dates, lineIds) => {
    const sheets = {};
    lineIds.forEach(lineId => {
      sheets[lineId] = dates.map(date => {
        const byHour = map[date]?.[lineId] || {};
        const row = { date };
        NIGHT_HOURS.forEach(h => {
          row[h] = byHour[h] !== undefined ? byHour[h] : null;
        });
        return row;
      });
    });
    return sheets;
  };

  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
  };

  const handleRefresh = () => {
    calculateNightConsumption();
  };

  const exportToExcel = async () => {
    if (!tableData || tableData.length === 0) {
      alert(t('noDataExport'));
      return;
    }

    setIsExporting(true);
    try {
      // The on-screen summary table uses trend lines only; the export needs the
      // per-line hourly tabs for ALL branch lines, so fetch their data here.
      const dates = tableData.map(r => r.date);
      let hourlySheets = {};
      const exportLineIds = allLines.length > 0 ? allLines : grsLines;

      if (exportLineIds.length > 0) {
        const { from: commercialFrom, to: commercialTo } =
          commercialHourlyRange(dateRange.fromDate, dateRange.toDate);

        const [physHourly, virtHourly, enterpriseData] = await Promise.all([
          allPhysicalLineIds.length > 0
            ? archiveDataApi.getHourlyData(allPhysicalLineIds, commercialFrom, commercialTo)
            : Promise.resolve([]),
          allVirtualLineIds.length > 0
            ? archiveDataVirtualApi.getHourlyDataVirtual(allVirtualLineIds, commercialFrom, commercialTo)
            : Promise.resolve([]),
          getEnterpriseWithCache(
            exportLineIds, commercialFrom, commercialTo, 'hourly',
            (lines, from, to, type) => enterpriseVirtualApi.getEnterpriseVolumesVirtual(lines, from, to, type)
          )
        ]);
        const allHourly = [...(physHourly || []), ...(virtHourly || [])];
        const netMap = buildNetByDayLineHour(allHourly, enterpriseData || []);
        hourlySheets = buildHourlySheets(netMap, dates, exportLineIds);
      }

      // Summary sheet (trend lines) — unchanged.
      const excelData = tableData.map(row => {
        const excelRow = { [t('date')]: row.date };
        grsLines.forEach(lineId => {
          const columnName = lineNames[lineId] || `Line ${lineId}`;
          const value = row[`line_${lineId}`];
          excelRow[columnName] = value !== null ? value : '';
        });
        return excelRow;
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet['!cols'] = [{ wch: 15 }, ...grsLines.map(() => ({ wch: 15 }))];
      XLSX.utils.book_append_sheet(workbook, worksheet, t('nightConsumption'));

      // Per-line tabs for ALL lines: hourly NET flows (21:00-04:00) per commercial
      // day. Excel sheet names must be unique, <=31 chars and free of : \ / ? * [ ].
      const usedSheetNames = new Set([t('nightConsumption').toLowerCase()]);
      const sanitizeSheetName = (raw) => {
        let base = String(raw || 'Line').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Line';
        let name = base;
        let i = 2;
        while (usedSheetNames.has(name.toLowerCase())) {
          const suffix = `~${i++}`;
          name = base.slice(0, 31 - suffix.length) + suffix;
        }
        usedSheetNames.add(name.toLowerCase());
        return name;
      };

      const hourHeaders = NIGHT_HOURS.map(h => `${String(h).padStart(2, '0')}:00`);
      exportLineIds.forEach(lineId => {
        const rows = (hourlySheets[lineId] || []).map(row => {
          const out = { [t('date')]: row.date };
          NIGHT_HOURS.forEach((h, idx) => {
            out[hourHeaders[idx]] = row[h] !== null && row[h] !== undefined ? row[h] : '';
          });
          return out;
        });

        const ws = XLSX.utils.json_to_sheet(rows, {
          header: [t('date'), ...hourHeaders],
        });
        ws['!cols'] = [{ wch: 12 }, ...hourHeaders.map(() => ({ wch: 12 }))];
        XLSX.utils.book_append_sheet(workbook, ws, sanitizeSheetName(lineNames[lineId] || `Line ${lineId}`));
      });

      const branchName = branches.find(b => b.id === selectedBranchId)?.name || '';
      const filename = `${t('nightConsumption')}${branchName ? '_' + branchName : ''}_${dateRange.fromDate}_${dateRange.toDate}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert(t('errorExportingData'));
    } finally {
      setIsExporting(false);
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
                hideEnableCheckbox
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
              <div className="night-table-header">
                <h4>{t('nightConsumptionNetDescription')}</h4>
                <button
                  className="export-button"
                  onClick={exportToExcel}
                  title={t('exportToExcel')}
                  disabled={isExporting}
                >
                  <ExcelIcon />
                  <span>{isExporting ? t('loading') : t('exportToExcel')}</span>
                </button>
              </div>

              <div className="night-table-wrapper">
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
