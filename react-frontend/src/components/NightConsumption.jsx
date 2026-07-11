import React, { useState, useEffect, useMemo } from 'react';
import { archiveDataApi, archiveDataVirtualApi } from '../services/api';
import { getEnterpriseWithCache } from '../services/enterpriseCache';
import { enterprisePeriodKey, buildEnterpriseByLinePeriod, getEnterpriseFetchFn } from '../utils/enterpriseVolumes';
import { commercialHourlyRange, commercialDayOf } from '../utils/commercialDay';
import { useLanguage } from '../contexts/LanguageContext';
import { useBranchLines } from '../hooks/useBranchLines';
import ReportModalShell, { BranchSelect, ErrorBlock, LoadingBlock } from './common/ReportModalShell';
import ExcelIcon from './common/ExcelIcon';
import DateTimePickers from './DateTimePickers';
import NightConsumptionCharts from './NightConsumptionCharts';
import PollProgressBar from './PollProgressBar';
import * as XLSX from 'xlsx';
import './NightConsumption.css';

const NightConsumption = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [pollProgress, setPollProgress] = useState(null);
  const [error, setError] = useState(null);
  const [tableData, setTableData] = useState([]);
  // Per-line hourly export tabs (ALL lines), built once on "Load" so the Excel
  // export is instant and never re-queries the API. Keyed by lineId.
  const [hourlySheets, setHourlySheets] = useState({});

  // Full branch line lists come from the shared hook (objects keep
  // include_in_trends / include_in_report flags). Subsets are derived below.
  const {
    branches,
    selectedBranchId,
    setSelectedBranchId,
    physicalLines: physicalLinesAll,
    virtualLines: virtualLinesAll,
    lineNames,
    linesLoading,
  } = useBranchLines(isOpen);

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

  // Night-report variant:
  //   'min'   — minimum NET over hours 00:00–05:00 (default)
  //   'avg23' — average NET of hours 02:00 and 03:00 ((net[2]+net[3])/2)
  const [reportType, setReportType] = useState('min');
  // Per-day/line/hour NET map from the last load; kept so switching report type
  // recomputes the table from memory without re-querying the API.
  const [netMap, setNetMap] = useState({});

  // Report lines = physical with include_in_report + ALL virtual lines. Both the
  // on-screen table and the Excel export (one sheet per line) use this same set.
  const reportPhysicalLineIds = useMemo(() => physicalLinesAll.filter(l => l.include_in_report).map(l => l.id), [physicalLinesAll]);
  const reportVirtualLineIds  = useMemo(() => virtualLinesAll.map(l => l.id), [virtualLinesAll]);
  const grsLines              = useMemo(() => [...reportPhysicalLineIds, ...reportVirtualLineIds], [reportPhysicalLineIds, reportVirtualLineIds]);

  // Column widths sized to the DATA (not the header). Data is monospace, so char
  // count maps to a predictable px width; with table-layout:fixed the long line-name
  // headers then wrap to this width instead of stretching the column.
  const formatCell = (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : '-');
  const colWidths = useMemo(() => {
    if (!tableData.length) return null;
    const CHAR_PX = 8.5;   // ~width of one monospace char at 14px
    const PADDING = 26;    // cell padding + borders
    const MIN = 52;
    const px = (chars) => Math.max(MIN, Math.round(chars * CHAR_PX + PADDING));
    const dateChars = Math.max(1, ...tableData.map(r => String(r.date).length));
    const lineCols = grsLines.map(lineId =>
      px(Math.max(1, ...tableData.map(r => formatCell(r[`line_${lineId}`]).length)))
    );
    return [px(dateChars), ...lineCols];
  }, [tableData, grsLines]);

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

      // Fetch hourly + enterprise for the report lines (one load), so the summary
      // table AND the per-line Excel tabs are both served from memory — the export
      // never re-queries the API.
      const [physHourly, virtHourly, enterpriseData] = await Promise.all([
        reportPhysicalLineIds.length > 0
          ? archiveDataApi.getHourlyData(reportPhysicalLineIds, commercialFrom, commercialTo)
          : Promise.resolve([]),
        reportVirtualLineIds.length > 0
          ? archiveDataVirtualApi.getHourlyDataVirtual(reportVirtualLineIds, commercialFrom, commercialTo)
          : Promise.resolve([]),
        getEnterpriseWithCache(
          grsLines, commercialFrom, commercialTo, 'hourly',
          getEnterpriseFetchFn(true), setPollProgress
        )
      ]);
      const hourlyData = [...(physHourly || []), ...(virtHourly || [])];

      if (!hourlyData || hourlyData.length === 0) {
        setError(t('noDataAvailable'));
        setTableData([]);
        setHourlySheets({});
        setNetMap({});
        return;
      }

      // Log warning if no enterprise data (not an error)
      if (!enterpriseData || enterpriseData.length === 0) {
        console.warn('No enterprise data available, using GS volumes only');
      }

      // Per-hour NET map (single source) -> summary MIN table + per-line export tabs,
      // both over the same report lines.
      const netMapResult = buildNetByDayLineHour(hourlyData, enterpriseData || []);
      const dates = Object.keys(netMapResult).sort();
      setNetMap(netMapResult);
      setTableData(nightRowsFromMap(netMapResult, grsLines, reportType));
      setHourlySheets(buildHourlySheets(netMapResult, dates, grsLines));

    } catch (err) {
      setError(t('errorLoadingData'));
      console.error('Error calculating night consumption:', err);
    } finally {
      setIsLoading(false);
      setPollProgress(null);
    }
  };

  // Per-line hourly columns for the Excel export (one sheet per line). The summary
  // table keeps the MIN over hours 0-5; these tabs show the per-hour NET flow.
  const NIGHT_HOURS = [21, 22, 23, 0, 1, 2, 3, 4]; // sheet column order
  // Hours we must retain NET for: {0..5} feeds the summary MIN, {21,22,23} the tabs.
  const MIN_HOURS = [0, 1, 2, 3, 4, 5];
  // Hours averaged for the 'avg23' report variant.
  const AVG_HOURS = [2, 3];

  // Single source of truth for both the summary table and the per-line tabs:
  // { commDate: { lineId: { hour: netVolume } } } where NET = max(0, GS - enterprise).
  const buildNetByDayLineHour = (hourlyData, enterpriseData = []) => {
    // Enterprise lookup keyed by line then YYYY-MM-DDTHH (shared helper — same
    // reduction the archives/trends use). API returns "2025-12-01T03:00:00",
    // cache returns "2025-12-01T03" — the helper normalizes both.
    const enterpriseMap = buildEnterpriseByLinePeriod(enterpriseData, 'hourly');

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

      const normalizedPeriod = enterprisePeriodKey(periodStr, 'hourly');
      const gsVolume = record.volume !== undefined ? record.volume : (record.flow || 0);
      const enterpriseVolume = (enterpriseMap[lineId]?.[normalizedPeriod]) || 0;
      const netVolume = Math.max(0, gsVolume - enterpriseVolume);

      if (!map[commDate]) map[commDate] = {};
      if (!map[commDate][lineId]) map[commDate][lineId] = {};
      map[commDate][lineId][hour] = netVolume;
    });

    return map;
  };

  // Summary table rows per commercial day per line, depending on the variant:
  //   'min'   — MIN(NET) over hours 00:00–05:00
  //   'avg23' — AVG(NET) of hours 02:00 and 03:00
  const nightRowsFromMap = (map, lineIds, type = 'min') => {
    const hours = type === 'avg23' ? AVG_HOURS : MIN_HOURS;
    return Object.keys(map).sort().map(date => {
      const row = { date };
      lineIds.forEach(lineId => {
        const byHour = map[date][lineId];
        const vals = byHour ? hours.map(h => byHour[h]).filter(v => v !== undefined) : [];
        if (vals.length === 0) {
          row[`line_${lineId}`] = null;
        } else if (type === 'avg23') {
          row[`line_${lineId}`] = vals.reduce((a, b) => a + b, 0) / vals.length;
        } else {
          row[`line_${lineId}`] = Math.min(...vals);
        }
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

  const handleBranchChange = (e) => {
    setSelectedBranchId(Number(e.target.value));
    setTableData([]);
  };

  const exportToExcel = () => {
    if (!tableData || tableData.length === 0) {
      alert(t('noDataExport'));
      return;
    }

    try {
      // Everything is already in memory (built on "Load"): no API calls here.
      const exportLineIds = grsLines;

      // Summary sheet — same report lines as the table.
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
    }
  };

  const handleLoad = () => {
    if (!linesLoading && grsLines.length > 0 && dateRange.fromDate && dateRange.toDate) {
      calculateNightConsumption();
    }
  };

  // Switching the report variant recomputes the summary table from the cached
  // NET map — no API re-query. Per-line export tabs are variant-independent, so
  // they stay as built on the last load.
  useEffect(() => {
    if (Object.keys(netMap).length === 0) return;
    setTableData(nightRowsFromMap(netMap, grsLines, reportType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  // Re-calculate when enterprise cache is cleared (Ctrl+Shift+E)
  useEffect(() => {
    const handler = () => { if (isOpen) calculateNightConsumption(); };
    window.addEventListener('enterprise-cache-cleared', handler);
    return () => window.removeEventListener('enterprise-cache-cleared', handler);
  }, [isOpen, dateRange, selectedBranchId]);

  return (
    <ReportModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={t('nightConsumption')}
      className="night-consumption-modal"
      footerExtra={
        <button
          className="btn btn-primary"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          {isLoading ? t('loading') : t('refresh')}
        </button>
      }
    >
      <div className="night-consumption-modal-body">
        {/* Controls row: branch + dates + load button */}
        <div className="nc-controls-row">
          {/* Branch + report-variant toggle stacked vertically */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
            <BranchSelect
              branches={branches}
              value={selectedBranchId}
              onChange={handleBranchChange}
              label={t('branch')}
            />

            {/* Report variant: minimum (00–05) vs average (02–03) */}
            <div className="nc-report-toggle">
              <button
                className={`nc-toggle-btn ${reportType === 'min' ? 'active' : ''}`}
                onClick={() => setReportType('min')}
              >
                {t('nightReportMin')}
              </button>
              <button
                className={`nc-toggle-btn ${reportType === 'avg23' ? 'active' : ''}`}
                onClick={() => setReportType('avg23')}
              >
                {t('nightReportAvg')}
              </button>
            </div>
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

        {isLoading && pollProgress && (
          <div style={{ margin: '8px 0' }}>
            <PollProgressBar progress={pollProgress} />
          </div>
        )}
        {isLoading && !pollProgress && <LoadingBlock text={t('loading')} />}

        {error && <ErrorBlock error={error} />}

        {/* Table */}
        {!isLoading && !error && tableData.length > 0 && (
          <div className="table-section">
            <div className="night-table-header">
              <h4>{reportType === 'avg23' ? t('nightConsumptionAvgDescription') : t('nightConsumptionNetDescription')}</h4>
              <button
                className="export-button"
                onClick={exportToExcel}
                title={t('exportToExcel')}
              >
                <ExcelIcon />
                <span>{t('exportToExcel')}</span>
              </button>
            </div>

            <div className="night-table-wrapper">
              <table
                className="night-consumption-table"
                style={colWidths ? { tableLayout: 'fixed', width: 'auto' } : undefined}
              >
                {colWidths && (
                  <colgroup>
                    {colWidths.map((w, i) => (
                      <col key={i} style={{ width: `${w}px` }} />
                    ))}
                  </colgroup>
                )}
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
                        <td key={lineId}>{formatCell(row[`line_${lineId}`])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Per-line charts (trends style) under the summary table */}
            <NightConsumptionCharts
              tableData={tableData}
              lineIds={grsLines}
              lineNames={lineNames}
            />
          </div>
        )}

        {/* No Data State */}
        {!isLoading && !error && tableData.length === 0 && (
          <div className="no-data-container">
            <p>{t('selectPeriod')}</p>
          </div>
        )}
      </div>
    </ReportModalShell>
  );
};

export default NightConsumption;
