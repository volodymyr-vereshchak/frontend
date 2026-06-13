import React, { useState, useEffect, useRef } from 'react';
import './DataTable.css';
import apiClient, { archiveCountsApi, archiveDataApi, editArchiveApi, sysArchiveApi, commercialDayUtils, archiveDataVirtualApi, virtualLinesHelper, enterpriseApi, enterpriseVirtualApi } from '../services/api';
import { formatEditValue } from '../utils/valueConverter';
import { PRESSURE_UNIT_DEFAULT, DP_UNIT_DEFAULT, convertPressureValue } from '../constants/pressureUnits';

const EDIT_CHANNEL_NAMES = ["P", "T", "dP", "dPL", "Густ"];

function resolveEditName(editName, rawOldValue, rawNewValue) {
  if (!editName || !editName.includes('%s')) return editName;
  const isChannelIdx = (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < EDIT_CHANNEL_NAMES.length;
  const idx = isChannelIdx(rawOldValue) ? rawOldValue
             : isChannelIdx(rawNewValue) ? rawNewValue
             : null;
  const channelName = idx !== null ? EDIT_CHANNEL_NAMES[idx] : String(rawOldValue ?? '?');
  return editName.replace('%s', channelName);
}
import { getEnterpriseWithCache } from '../services/enterpriseCache';
import { addDays } from '../utils/commercialDay';
import * as XLSX from 'xlsx';
import { useLanguage } from '../contexts/LanguageContext';

// Excel Export Icon
const ExcelIcon = ({ color = "#B9E42B" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.53 9L13 3.47C12.8595 3.32931 12.6688 3.25018 12.47 3.25H8C7.27065 3.25 6.57118 3.53973 6.05546 4.05546C5.53973 4.57118 5.25 5.27065 5.25 6V18C5.25 18.7293 5.53973 19.4288 6.05546 19.9445C6.57118 20.4603 7.27065 20.75 8 20.75H16C16.7293 20.75 17.4288 20.4603 17.9445 19.9445C18.4603 19.4288 18.75 18.7293 18.75 18V9.5C18.7421 9.3116 18.6636 9.13309 18.53 9ZM13.25 5.81L16.19 8.75H13.25V5.81ZM16 19.25H8C7.66848 19.25 7.35054 19.1183 7.11612 18.8839C6.8817 18.6495 6.75 18.3315 6.75 18V6C6.75 5.66848 6.8817 5.35054 7.11612 5.11612C7.35054 4.8817 7.66848 4.75 8 4.75H11.75V9.5C11.7526 9.69811 11.8324 9.88737 11.9725 10.0275C12.1126 10.1676 12.3019 10.2474 12.5 10.25H17.25V18C17.25 18.3315 17.1183 18.6495 16.8839 18.8839C16.6495 19.1183 16.3315 19.25 16 19.25Z" fill={color}/>
    <path d="M14.47 11.91C14.312 11.7893 14.1134 11.7343 13.9158 11.7567C13.7183 11.7791 13.537 11.877 13.41 12.03L12 13.8L10.59 12C10.5243 11.9225 10.4441 11.8587 10.3537 11.8123C10.2634 11.7658 10.1648 11.7376 10.0636 11.7293C9.96242 11.7209 9.86055 11.7326 9.76384 11.7636C9.66713 11.7946 9.57747 11.8443 9.49999 11.91C9.42251 11.9757 9.35872 12.0559 9.31227 12.1463C9.26581 12.2366 9.2376 12.3351 9.22925 12.4364C9.22089 12.5376 9.23255 12.6394 9.26356 12.7362C9.29457 12.8329 9.34433 12.9225 9.40999 13L11 15L9.40999 17C9.28534 17.1565 9.22796 17.3561 9.25046 17.5549C9.27296 17.7536 9.37351 17.9353 9.52999 18.06C9.68647 18.1847 9.88606 18.242 10.0848 18.2195C10.2836 18.197 10.4653 18.0965 10.59 17.94L12 16.2L13.41 18C13.4818 18.0871 13.5719 18.1573 13.6738 18.2056C13.7758 18.254 13.8871 18.2794 14 18.28C14.1534 18.2927 14.3069 18.2579 14.4398 18.1804C14.5728 18.1028 14.6786 17.9863 14.743 17.8465C14.8074 17.7068 14.8273 17.5506 14.7999 17.3991C14.7726 17.2477 14.6993 17.1084 14.59 17L13 15L14.63 13C14.6922 12.9184 14.7375 12.8251 14.7632 12.7258C14.7889 12.6264 14.7944 12.5229 14.7795 12.4213C14.7646 12.3198 14.7295 12.2222 14.6764 12.1344C14.6232 12.0466 14.5531 11.9703 14.47 11.91Z" fill={color}/>
  </svg>
);

const DataTable = ({ selectedLines, dateRange, isDateFilterEnabled, archiveType, onDataChange, isVirtualLine, lineUnits }) => {
  const { t, getLocale } = useLanguage();
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'period', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pageInput, setPageInput] = useState('1');
  const [totalRows, setTotalRows] = useState(0);
  const [exportWithEnterprise, setExportWithEnterprise] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fetchCountRef = useRef(0);

  // Alarm (sys) and change (edit) archives can hold tens of thousands of rows per
  // day, so for physical lines they are fetched one page at a time from the
  // server (/sys/paged/, /edit/paged/) with server-side sorting. Everything else
  // (daily/hourly/param, and virtual lines) loads fully and sorts client-side.
  const serverPaged = !isVirtualLine && (archiveType === 'sys' || archiveType === 'edit');

  // Format period value for Excel export
  const formatPeriodForExcel = (value) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value || '';
    const locale = getLocale();
    if (archiveType === 'daily') {
      return date.toLocaleDateString(locale);
    } else if (archiveType === 'hourly') {
      return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    } else if (archiveType === 'edit' || archiveType === 'sys') {
      return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } else {
      return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  };

  // Excel export function
  const exportToExcel = async () => {
    if (!rowData || rowData.length === 0) {
      alert(t('noDataExport'));
      return;
    }

    setIsExporting(true);
    try {
      const columns = getColumns();

      // ── Enterprise export (daily/hourly only) ──────────────────────────────
      if (exportWithEnterprise && (archiveType === 'daily' || archiveType === 'hourly') && selectedLines && selectedLines.length > 0) {
        // Sort data chronologically
        const sortedData = [...processedRowData].sort((a, b) => new Date(a.period) - new Date(b.period));
        const firstDate = String(sortedData[0].period).slice(0, 10);
        const toDate   = String(sortedData[sortedData.length - 1].period).slice(0, 10);
        const periodType = archiveType === 'hourly' ? 'hourly' : 'daily';
        // Enterprise is commercial-day aligned (07:00 start); for hourly fetch a day
        // earlier so the first date's 00:00–06:00 hours (tail of the previous
        // commercial day) are included.
        const fromDate = periodType === 'hourly' ? addDays(firstDate, -1) : firstDate;

        // Excel needs full per-enterprise breakdown — always fetch fresh from API
        // (cache stores only total volumes, which is enough for the chart overlay).
        const rawEnterprise = await (isVirtualLine
          ? enterpriseVirtualApi.getEnterpriseVolumesVirtual(selectedLines, fromDate, toDate, periodType)
          : enterpriseApi.getEnterpriseVolumes(selectedLines, fromDate, toDate, periodType)
        ) || [];

        // Build per-period, per-enterprise breakdown
        const entByPeriod = {}; // period key -> { entName -> volume }
        const entNames = new Set();

        rawEnterprise.forEach(record => {
          const raw = String(record.period || '').replace(' ', 'T');
          const pk  = archiveType === 'hourly' ? raw.slice(0, 13) : raw.slice(0, 10);
          if (!entByPeriod[pk]) entByPeriod[pk] = {};
          (record.devices || []).forEach(device => {
            const name = device.enterprise_name || 'Unknown';
            entNames.add(name);
            if (device.volume != null) {
              // Polled: add to sum (even if 0)
              entByPeriod[pk][name] = (entByPeriod[pk][name] ?? 0) + device.volume;
            } else if (entByPeriod[pk][name] === undefined) {
              // Not polled and no prior data: mark explicitly as null (no data)
              entByPeriod[pk][name] = null;
            }
            // If already has a value from another device, leave it (partial poll)
          });
        });

        const sortedEntNames = [...entNames].sort();

        // Build headers: archive columns + enterprise columns + totals
        const archiveHeaders = columns.map(col => col.label);
        const entHeaders     = sortedEntNames;
        const extraHeaders   = [t('totalEnterpriseVolume'), t('netVolume')];
        const headers        = [...archiveHeaders, ...entHeaders, ...extraHeaders];

        // Build data rows
        const dataRows = sortedData.map(row => {
          const archiveCells = columns.map(col => {
            const value = row[col.key];
            if (col.key === 'period' && value) return formatPeriodForExcel(value);
            if (typeof value === 'number') return value;
            return value || '';
          });

          const raw = String(row.period || '').replace(' ', 'T');
          const pk  = archiveType === 'hourly' ? raw.slice(0, 13) : raw.slice(0, 10);
          const entData = entByPeriod[pk] || {};

          const entCells = sortedEntNames.map(name => entData[name] != null ? entData[name] : '');
          const totalEnt = entCells.reduce((s, v) => s + (v !== '' ? v : 0), 0);
          const lineVol  = row.volume || 0;
          const netVol   = lineVol - totalEnt;

          return [...archiveCells, ...entCells, totalEnt, netVol];
        });

        // Summary row
        const summaryArchive = columns.map(col => {
          if (col.key === 'period') return t('total');
          if (col.isSummable) return sortedData.reduce((s, row) => s + (parseFloat(row[col.key]) || 0), 0);
          return '';
        });
        const summaryEnt = sortedEntNames.map(name =>
          sortedData.reduce((s, row) => {
            const raw = String(row.period || '').replace(' ', 'T');
            const pk  = archiveType === 'hourly' ? raw.slice(0, 13) : raw.slice(0, 10);
            return s + ((entByPeriod[pk] || {})[name] || 0);
          }, 0)
        );
        const summaryTotalEnt = summaryEnt.reduce((s, v) => s + v, 0);
        const summaryLineVol  = sortedData.reduce((s, row) => s + (row.volume || 0), 0);
        const summaryNetVol   = summaryLineVol - summaryTotalEnt;
        const summaryRow      = [...summaryArchive, ...summaryEnt, summaryTotalEnt, summaryNetVol];

        // Build workbook
        const allRows = [headers, ...dataRows, summaryRow];
        const workbook  = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(allRows);

        // Column widths
        worksheet['!cols'] = headers.map((h, i) => {
          const maxLen = Math.max(h.length, ...dataRows.map(r => String(r[i] ?? '').length));
          return { wch: Math.min(Math.max(maxLen + 3, 12), 50) };
        });

        // Number format
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let r = 1; r <= range.e.r; r++) {
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (worksheet[addr] && typeof worksheet[addr].v === 'number') {
              worksheet[addr].z = '#,##0.00';
            }
          }
        }

        const archiveTypeNames = { daily: t('dailyArchive'), hourly: t('hourlyArchive') };
        XLSX.utils.book_append_sheet(workbook, worksheet, archiveTypeNames[archiveType] || archiveType);

        const now = new Date();
        const ts  = now.toISOString().slice(0, 19).replace(/[T:]/g, '_');
        const fileArchiveNames = { daily: t('dailyArchiveFile'), hourly: t('hourlyArchiveFile') };
        XLSX.writeFile(workbook, `${fileArchiveNames[archiveType] || archiveType}_enterprise_${ts}.xlsx`);
        return;
      }

      // ── Standard export ────────────────────────────────────────────────────

      // Server-paginated archives (sys / edit) only keep the current page in
      // memory; pull the full dataset so the export is complete.
      const exportData = serverPaged
        ? ((archiveType === 'sys'
            ? await sysArchiveApi.getSysData(selectedLines, dateRange.fromDate, dateRange.toDate)
            : await editArchiveApi.getEditData(selectedLines, dateRange.fromDate, dateRange.toDate)) || [])
        : processedRowData;

      // Prepare header row
      const headers = columns.map(col => col.label);

      // Prepare data rows
      const dataRows = exportData.map(row => {
        return columns.map(col => {
          let value = row[col.key];
          if (col.key === 'period' && value) return formatPeriodForExcel(value);
          if (archiveType === 'edit' && col.key === 'edit_name') {
            return resolveEditName(value, row.old_value, row.new_value) || '';
          }
          if (archiveType === 'edit' && (col.key === 'old_value' || col.key === 'new_value')) {
            return formatEditValue(value, row.edit_type_id ?? null);
          }
          if (typeof value === 'number') return value;
          return value || '';
        });
      });

      // Add summary row for daily and hourly archives
      let summaryRow = null;
      if (archiveType === 'daily' || archiveType === 'hourly') {
        summaryRow = columns.map(col => {
          if (col.key === 'period') {
            return t('total');
          } else if (col.isSummable) {
            // Calculate sum for volume, edit_counts, sys_counts
            const sum = processedRowData.reduce((acc, row) => {
              const value = parseFloat(row[col.key]) || 0;
              return acc + value;
            }, 0);
            return sum;
          } else if (col.isAveragable) {
            // Calculate average for other numeric columns
            const validValues = processedRowData
              .map(row => parseFloat(row[col.key]))
              .filter(value => !isNaN(value));

            if (validValues.length > 0) {
              const avg = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
              return avg;
            }
            return '';
          }
          return '';
        });
      }

      // Combine all rows
      const allRows = [headers, ...dataRows];
      if (summaryRow) {
        allRows.push(summaryRow);
      }

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(allRows);

      // Auto-size columns with better width calculation
      const columnWidths = columns.map((col, colIndex) => {
        const headerLength = col.label.length;
        const maxDataLength = Math.max(
          ...exportData.map(row => {
            const value = row[col.key];
            if (value === null || value === undefined) return 0;
            // For numbers, consider decimal places
            if (typeof value === 'number') {
              return value.toFixed(2).length + 2;
            }
            return String(value).length;
          })
        );
        const width = Math.max(headerLength, maxDataLength) + 3;
        return { wch: Math.min(Math.max(width, 12), 50) };
      });
      worksheet['!cols'] = columnWidths;

      // Apply number format to numeric cells
      // Excel will automatically use system locale (comma for Russian, period for English)
      const range = XLSX.utils.decode_range(worksheet['!ref']);

      for (let row = 1; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellAddress]) continue;

          const cell = worksheet[cellAddress];

          // Apply number format for 2 decimal places
          // The format will be adapted by Excel to user's regional settings
          if (typeof cell.v === 'number') {
            cell.z = '#,##0.00'; // Number format with thousand separator and 2 decimals
          }
        }
      }

      // Add worksheet to workbook
      const archiveTypeNames = {
        'daily': t('dailyArchive'),
        'hourly': t('hourlyArchive'),
        'sys': t('systemArchive'),
        'edit': t('editArchive'),
        'param': t('parameters')
      };
      const sheetName = archiveTypeNames[archiveType] || archiveType;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Generate filename
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '_');
      const fileArchiveNames = {
        'daily': t('dailyArchiveFile'),
        'hourly': t('hourlyArchiveFile'),
        'sys': t('systemArchiveFile'),
        'edit': t('editArchiveFile'),
        'param': t('parametersFile')
      };
      const filename = `${fileArchiveNames[archiveType] || archiveType}_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert(t('exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  // Sync scroll between header and body
  const handleTableScroll = (e) => {
    const headerWrapper = document.querySelector('.table-header-wrapper');
    if (headerWrapper) {
      headerWrapper.scrollLeft = e.target.scrollLeft;
    }
  };

  const pressureUnit = lineUnits?.pressure_unit || PRESSURE_UNIT_DEFAULT;
  const dpUnit = lineUnits?.dp_unit || DP_UNIT_DEFAULT;
  // Output (downstream) pressure = pressure − dP, shown only for low-pressure
  // non-meter lines (meter=false AND not high pressure) in daily/hourly archives.
  // For meters or high-pressure lines we show the raw pressure with no extra column.
  const showOutputPressure =
    !isVirtualLine &&
    !!lineUnits &&
    !lineUnits.meter &&
    !lineUnits.is_high_pressure &&
    (archiveType === 'daily' || archiveType === 'hourly');

  const getColumns = () => {
    // Meter lines store working volume (m³) in w_volume_dp; others store dP.
    const wVolumeDpLabel = lineUnits?.meter
      ? `${t('workingVolume')}, ${t('volumeUnit')}`
      : `${t('differentialPressure')}, ${dpUnit}`;
    switch (archiveType) {
      case 'daily':
      case 'hourly':
        // Для виртуальных линий - ТОЛЬКО period и volume
        if (isVirtualLine) {
          return [
            { key: 'period', label: t('period'), sortable: true },
            { key: 'volume', label: t('volume'), sortable: true, isSummable: true }
          ];
        }

        // Для физических линий - все колонки
        return [
          { key: 'period', label: t('period'), sortable: true },
          { key: 'volume', label: t('volume'), sortable: true, isSummable: true },
          { key: 'w_volume_dp', label: wVolumeDpLabel, sortable: true, isAveragable: true },
          { key: 'pressure', label: `${t('pressure')}, ${pressureUnit}`, sortable: true, isAveragable: true },
          ...(showOutputPressure
            ? [{ key: 'output_pressure', label: `${t('outputPressure')}, ${pressureUnit}`, sortable: true, isAveragable: true }]
            : []),
          { key: 'temperature', label: t('temperature'), sortable: true, isAveragable: true },
          { key: 'density', label: t('density'), sortable: true, isAveragable: true },
          { key: 'edit_counts', label: t('editCounts'), sortable: true, isSummable: true, tooltip: t('changesCount') },
          { key: 'sys_counts', label: t('sysCounts'), sortable: true, isSummable: true, tooltip: t('alarmsCount') }
        ];
      case 'edit':
        return [
          { key: 'period', label: t('period'), sortable: true },
          { key: 'edit_name', label: t('editType'), sortable: true },
          { key: 'old_value', label: t('oldValue'), sortable: true },
          { key: 'new_value', label: t('newValue'), sortable: true }
        ];
      case 'sys':
        return [
          { key: 'period', label: t('period'), sortable: true },
          { key: 'sys_name', label: t('operationType'), sortable: true },
          { key: 'volume', label: t('value'), sortable: true, isSummable: true }
        ];
      case 'param':
        return [
          { key: 'period', label: t('period'), sortable: true },
          { key: 'density', label: t('density'), sortable: true, isAveragable: true },
          { key: 'co2', label: 'CO2 (%)', sortable: true, isAveragable: true },
          { key: 'n2', label: 'N2 (%)', sortable: true, isAveragable: true },
          { key: 'D20', label: 'D20', sortable: true, isAveragable: true },
          { key: 'd20', label: 'd20', sortable: true, isAveragable: true },
          { key: 'cutoff', label: 'Cutoff', sortable: true, isAveragable: true },
          { key: 'roughness', label: 'Roughness', sortable: true, isAveragable: true },
          { key: 'max_dp', label: t('paramMaxDp'), sortable: true, isAveragable: true },
          { key: 'min_dp', label: t('paramMinDp'), sortable: true, isAveragable: true },
          { key: 'A0su', label: 'A0su', sortable: true, isAveragable: true },
          { key: 'A1su', label: 'A1su', sortable: true, isAveragable: true },
          { key: 'A2su', label: 'A2su', sortable: true, isAveragable: true },
          { key: 'A0pipe', label: 'A0pipe', sortable: true, isAveragable: true },
          { key: 'A1pipe', label: 'A1pipe', sortable: true, isAveragable: true },
          { key: 'A2pipe', label: 'A2pipe', sortable: true, isAveragable: true },
          { key: 'radius', label: t('paramRadius'), sortable: true, isAveragable: true },
          { key: 'su_year', label: t('paramSuYear'), sortable: true, isAveragable: true },
          { key: 'max_p', label: t('paramMaxP'), sortable: true, isAveragable: true },
          { key: 'min_p', label: t('paramMinP'), sortable: true, isAveragable: true },
          { key: 'max_t', label: t('paramMaxT'), sortable: true, isAveragable: true },
          { key: 'min_t', label: t('paramMinT'), sortable: true, isAveragable: true }
        ];
      default:
        return [];
    }
  };

  const columns = getColumns();

  const fetchData = async (abortController) => {
    const myFetchId = ++fetchCountRef.current;
    if (!selectedLines || selectedLines.length === 0) {
      setRowData([]);
      setLoading(false);
      if (onDataChange) {
        onDataChange([]);
      }
      return;
    }

    if (!isDateFilterEnabled) {
      setRowData([]);
      setLoading(false);
      if (onDataChange) {
        onDataChange([]);
      }
      return;
    }

    // Clear old data immediately when starting new request
    setRowData([]);
    setLoading(true);
    setError(null);

    const startTime = performance.now();

    try {
      // Для виртуальных линий используем виртуальные endpoints
      if (isVirtualLine) {
        // Виртуальные линии поддерживают только daily и hourly
        if (archiveType !== 'daily' && archiveType !== 'hourly') {
          setError(t('virtualLinesSupportOnlyDailyHourly'));
          setRowData([]);
          if (onDataChange) onDataChange([]);
          return;
        }

        // Fetch archive data (VIRTUAL)
        let archiveData;
        if (archiveType === 'daily') {
          archiveData = await archiveDataVirtualApi.getDailyDataVirtual(
            selectedLines,
            dateRange.fromDate,
            dateRange.toDate
          );
        } else {
          archiveData = await archiveDataVirtualApi.getHourlyDataVirtual(
            selectedLines,
            dateRange.fromDate,
            dateRange.toDate
          );
        }

        if (abortController?.signal?.aborted || fetchCountRef.current !== myFetchId) return;

        setRowData(archiveData || []);
        if (onDataChange) onDataChange(archiveData || []);
        return;
      }

      // ФИЗИЧЕСКИЕ ЛИНИИ - существующая логика

      // Server-paginated archives (alarms / changes): fetch only the current
      // page with server-side sorting; never pull the whole archive into memory.
      if (serverPaged) {
        const opts = {
          skip: (currentPage - 1) * itemsPerPage,
          limit: itemsPerPage,
          orderBy: sortConfig.key,
          orderDir: sortConfig.direction,
        };
        const resp = archiveType === 'sys'
          ? await sysArchiveApi.getSysDataPaged(selectedLines, dateRange.fromDate, dateRange.toDate, opts)
          : await editArchiveApi.getEditDataPaged(selectedLines, dateRange.fromDate, dateRange.toDate, opts);

        if (fetchCountRef.current !== myFetchId) return;
        const items = resp?.items || [];
        setRowData(items);
        setTotalRows(resp?.total || 0);
        if (onDataChange) onDataChange(items);
        return;
      }

      // Skip И and А columns for other non-daily/hourly archives
      if (archiveType !== 'daily' && archiveType !== 'hourly') {
        // Use apiClient for correct proxy handling
        const params = {};

        if (selectedLines && selectedLines.length > 0) {
          params.line_id = selectedLines;
        }

        if (dateRange.fromDate) {
          params.from_date = dateRange.fromDate;
        }
        if (dateRange.toDate) {
          params.to_date = dateRange.toDate;
        }

        const data = await apiClient.get(`/${archiveType}/`, params);

        if (fetchCountRef.current !== myFetchId) return;
        setRowData(data || []);
        if (onDataChange) {
          onDataChange(data || []);
        }
        return;
      }

      // For daily and hourly archives, fetch main data and separate counts (И and А)

      const promises = [];

      // Fetch main archive data
      if (archiveType === 'daily') {
        promises.push(archiveDataApi.getDailyData(selectedLines, dateRange.fromDate, dateRange.toDate));
      } else {
        promises.push(archiveDataApi.getHourlyData(selectedLines, dateRange.fromDate, dateRange.toDate));
      }

      // Fetch edit counts (И) and sys counts (А) separately
      promises.push(archiveCountsApi.getEditCounts(selectedLines, dateRange.fromDate, dateRange.toDate));
      promises.push(archiveCountsApi.getSysCounts(selectedLines, dateRange.fromDate, dateRange.toDate));

      const [archiveData, editCountsData, sysCountsData] = await Promise.all(promises);

      if (abortController?.signal?.aborted || fetchCountRef.current !== myFetchId) {
        return;
      }

      // Process edit counts (И) and sys counts (А) separately
      let processedEditCounts = [];
      let processedSysCounts = [];

      if (archiveType === 'daily') {
        // Aggregate hourly counts to commercial days
        if (editCountsData) {
          processedEditCounts = commercialDayUtils.aggregateEditCountsToCommercialDays(editCountsData, selectedLines);
        }
        if (sysCountsData) {
          processedSysCounts = commercialDayUtils.aggregateSysCountsToCommercialDays(sysCountsData, selectedLines);
        }
      } else if (archiveType === 'hourly') {
        // Transform hourly counts to expected format
        if (editCountsData) {
          processedEditCounts = editCountsData.map(record => {
            const periodField = record.period || record.hour_group;
            const lineId = record.line_id || (selectedLines.length > 0 ? selectedLines[0] : 1);
            const countValue = record.record_count || 0;

            return {
              line_id: lineId,
              period: periodField,
              edit_counts: countValue
            };
          });
        }

        if (sysCountsData) {
          processedSysCounts = sysCountsData.map(record => {
            const periodField = record.period || record.hour_group;
            const lineId = record.line_id || (selectedLines.length > 0 ? selectedLines[0] : 1);
            const countValue = record.record_count || 0;

            return {
              line_id: lineId,
              period: periodField,
              sys_counts: countValue
            };
          });
        }
      }


      // Merge archive data with both edit and sys counts
      const mergedData = (archiveData || []).map((record, index) => {
        // Find matching edit counts
        const matchingEditCounts = processedEditCounts.find(count =>
          count.line_id === record.line_id &&
          count.period === record.period
        );

        // Find matching sys counts
        const matchingSysCounts = processedSysCounts.find(count =>
          count.line_id === record.line_id &&
          count.period === record.period
        );


        return {
          ...record,
          edit_counts: matchingEditCounts?.edit_counts || 0,
          sys_counts: matchingSysCounts?.sys_counts || 0
        };
      });


      setRowData(mergedData);
      if (onDataChange) {
        onDataChange(mergedData);
      }

    } catch (error) {
      if (error.name === 'AbortError' || fetchCountRef.current !== myFetchId) {
        return;
      }
      console.error('Error fetching data:', error);
      setError(error.message);
      setRowData([]);
      if (onDataChange) {
        onDataChange([]);
      }
    } finally {
      if (fetchCountRef.current === myFetchId) {
        setLoading(false);
      }
    }
  };

  // Clear stale data immediately when archive type changes (before 50ms debounce fires)
  useEffect(() => {
    setRowData([]);
    setLoading(isDateFilterEnabled && selectedLines && selectedLines.length > 0);
    setError(null);
  }, [archiveType]);

  // Reset to the first page and default sort whenever the query context changes
  // (lines, dates, archive type). Returning the same state object when already at
  // the default avoids an extra render/fetch cycle.
  useEffect(() => {
    setCurrentPage(p => (p === 1 ? p : 1));
    setSortConfig(s => (s.key === 'period' && s.direction === 'asc' ? s : { key: 'period', direction: 'asc' }));
  }, [JSON.stringify(selectedLines), JSON.stringify(dateRange), isDateFilterEnabled, archiveType, isVirtualLine]);

  // Page and sort only drive a re-fetch for server-paginated archives; for
  // everything else they are handled client-side, so they are excluded from the
  // fetch key to avoid needless reloads.
  const fetchKey = JSON.stringify(
    serverPaged
      ? [selectedLines, dateRange, isDateFilterEnabled, archiveType, isVirtualLine, currentPage, itemsPerPage, sortConfig]
      : [selectedLines, dateRange, isDateFilterEnabled, archiveType, isVirtualLine]
  );

  useEffect(() => {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      fetchData(abortController);
    }, 50);
    return () => {
      clearTimeout(timeoutId);
      abortController.abort(); // Cancel pending requests
    };
  }, [fetchKey]);

  // Keep the manual page-number input in sync when the page changes via the
  // arrows, page-size change, or a context reset.
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    // Server-paginated archives re-sort the whole set on the backend, so jump
    // back to the first page when the sort changes.
    if (serverPaged) setCurrentPage(1);
  };

  // Inject the computed output-pressure field (pressure − dP, dP converted into
  // the pressure unit) so it flows through sorting, summary, render and export.
  const processedRowData = React.useMemo(() => {
    if (!showOutputPressure) return rowData;
    return rowData.map(row => ({
      ...row,
      output_pressure:
        (row.pressure || 0) - convertPressureValue(row.w_volume_dp || 0, dpUnit, pressureUnit),
    }));
  }, [rowData, showOutputPressure, dpUnit, pressureUnit]);

  const sortedData = React.useMemo(() => {
    let sortableData = [...processedRowData];
    if (sortConfig.key) {
      sortableData.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Special handling for period column (dates)
        if (sortConfig.key === 'period') {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
        }

        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableData;
  }, [processedRowData, sortConfig]);

  // Server-paginated archives arrive already sorted and sliced by the backend;
  // render them as-is. Everything else is sorted client-side over the full set.
  const displayData = serverPaged ? rowData : sortedData;

  // Only server-paginated archives expose page controls; others show everything.
  const totalPages = serverPaged ? Math.max(1, Math.ceil(totalRows / itemsPerPage)) : 1;

  const getRecordCount = () => {
    if (serverPaged) return totalRows;
    return rowData ? rowData.length : 0;
  };

  const goToPage = (n) => {
    const clamped = Math.max(1, Math.min(totalPages, n));
    setCurrentPage(clamped);
    setPageInput(String(clamped));
  };

  // Commit the manually typed page number (Enter / blur), clamped to range.
  const commitPageInput = () => {
    const n = parseInt(pageInput, 10);
    goToPage(isNaN(n) ? currentPage : n);
  };

  // Switch page size and restart from the first page.
  const changePageSize = (size) => {
    setItemsPerPage(size);
    setCurrentPage(1);
  };

  const formatNumber = (value, key) => {
    if (typeof value !== 'number' || isNaN(value)) return value;

    // Density needs 4 decimals; everything else 2. Spaces between thousands.
    const decimals = key === 'density' ? 4 : 2;
    const formatted = value.toFixed(decimals);
    const [integerPart, decimalPart] = formatted.split('.');
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + decimalPart;
  };

  const formatValue = (value, key, row = {}) => {
    // Edit archive: resolve %s channel template in edit_name based on old_value
    if (archiveType === 'edit' && key === 'edit_name') {
      return resolveEditName(value, row?.old_value, row?.new_value);
    }
    // Edit archive: smart-format raw int values (handles enums, small coefficients, time, floats)
    if (archiveType === 'edit' && (key === 'old_value' || key === 'new_value')) {
      return formatEditValue(value, row?.edit_type_id ?? null);
    }

    if (key === 'period') {
      const date = new Date(value);
      const locale = getLocale();
      if (archiveType === 'daily') {
        return date.toLocaleDateString(locale);
      } else {
        // For edit and sys archives, show full time with seconds
        if (archiveType === 'edit' || archiveType === 'sys') {
          return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
        } else {
          // For other archives (hourly, param), use default time format
          return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale);
        }
      }
    }
    if (typeof value === 'number') {
      return formatNumber(value, key);
    }
    return value;
  };

  // Handler for clicking on volume cell in daily archive
  const handleVolumeClick = (row) => {
    if (archiveType !== 'daily') return;

    // Get the date from the row (this is the commercial day start date)
    const startDate = new Date(row.period);

    // Commercial day: from current day 07:00 to next day 06:00
    // So end date should be next day
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    // Format dates as YYYY-MM-DD for URL
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);

    // Get line_id from the row
    const lineId = row.line_id;

    // Build URL with parameters
    const params = new URLSearchParams({
      archiveType: 'hourly',
      fromDate: formattedStartDate,
      toDate: formattedEndDate,
      lineId: lineId,
      dateFilterEnabled: 'true'
    });

    // Open in new tab
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.open(url, '_blank');
  };

  const calculateSummary = () => {
    if (sortedData.length === 0) {
      return {};
    }

    const summary = {};

    columns.forEach(column => {
      if (column.key === 'period') {
        summary[column.key] = t('total');
      } else if (column.isSummable) {
        // Calculate sum for volume
        summary[column.key] = sortedData.reduce((sum, row) => {
          const value = parseFloat(row[column.key]) || 0;
          return sum + value;
        }, 0);
      } else if (column.isAveragable) {
        // Calculate average for other numeric columns
        const validValues = sortedData
          .map(row => parseFloat(row[column.key]))
          .filter(value => !isNaN(value));

        if (validValues.length > 0) {
          summary[column.key] = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
        } else {
          summary[column.key] = 0;
        }
      }
    });

    return summary;
  };

  const summary = calculateSummary();

  return (
    <div className="data-table-container">
      <div className="table-header">
        <h6>
          {archiveType === 'daily' && t('dailyArchive')}
          {archiveType === 'hourly' && t('hourlyArchive')}
          {archiveType === 'edit' && t('editArchive')}
          {archiveType === 'sys' && t('systemArchive')}
          {archiveType === 'param' && t('parameters')}
        </h6>
        <div className="table-info">
          {loading ? (
            <span style={{color: '#ffa500'}}>{t('loading')}</span>
          ) : (
            <>
              <span style={{marginRight: '15px'}}>{t('records')}: {getRecordCount()}</span>
              {rowData && rowData.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(archiveType === 'daily' || archiveType === 'hourly') && selectedLines && selectedLines.length > 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', color: '#ccc', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={exportWithEnterprise}
                        onChange={e => setExportWithEnterprise(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      {t('enterpriseOverlay')}
                    </label>
                  )}
                  <button
                    className="excel-export-btn"
                    onClick={exportToExcel}
                    title={t('export')}
                    disabled={isExporting}
                    style={isExporting ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                  >
                    {isExporting
                      ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '16px' }}>⏳</span>
                      : <ExcelIcon color="#000000" />
                    }
                    <span>{isExporting ? t('loading') : t('excel')}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {t('errorLoading')}: {error}
        </div>
      )}

      {!selectedLines || selectedLines.length === 0 ? (
        <div className="placeholder-content">
          <p>{t('selectLines')}</p>
        </div>
      ) : !isDateFilterEnabled ? (
        <div className="placeholder-content">
          <p>{t('activateDate')}</p>
        </div>
      ) : (
        <div className="data-table">
          <div className="table-wrapper">
            {/* Fixed Header with horizontal scroll */}
            <div className="table-header-wrapper">
              <table className={`custom-table header-table ${archiveType === 'param' ? 'param-table' : ''}`}>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        onClick={() => column.sortable && handleSort(column.key)}
                        className={column.sortable ? 'sortable' : ''}
                        title={column.tooltip || column.label}
                      >
                        {column.label}
                        {sortConfig.key === column.key && (
                          <span className="sort-indicator">
                            {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable Body */}
            <div className="table-body-wrapper" onScroll={handleTableScroll}>
              <table className={`custom-table body-table ${archiveType === 'param' ? 'param-table' : ''}`}>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={columns.length} className="loading-cell">
                        {t('loadingData')}
                      </td>
                    </tr>
                  ) : displayData.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="no-data-cell">
                        {t('noData')}
                      </td>
                    </tr>
                  ) : (
                    displayData.map((row, index) => (
                      <tr key={index}>
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={archiveType === 'daily' && column.key === 'volume' ? 'volume-cell-clickable' : ''}
                            onClick={() => archiveType === 'daily' && column.key === 'volume' && handleVolumeClick(row)}
                            style={archiveType === 'daily' && column.key === 'volume' ? { cursor: 'pointer' } : {}}
                          >
                            {formatValue(row[column.key], column.key, row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Fixed Summary Row - only for daily and hourly archives */}
            {sortedData.length > 0 && (archiveType === 'daily' || archiveType === 'hourly') && (
              <table className={`custom-table summary-table ${archiveType === 'param' ? 'param-table' : ''}`}>
                <tbody>
                  <tr className="summary-row">
                    {columns.map((column) => (
                      <td key={column.key} className="summary-cell">
                        {column.key === 'period'
                          ? summary[column.key]
                          : formatValue(summary[column.key], column.key)
                        }
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination controls — server-paginated archives (sys / edit) only */}
          {serverPaged && !loading && totalRows > 0 && (
            <div
              className="table-pagination"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '10px 0', flexWrap: 'wrap' }}
            >
              {/* Page size selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#aaa', fontSize: '12px' }}>{t('perPage')}:</span>
                {[10, 50, 100].map(size => (
                  <button
                    key={size}
                    onClick={() => changePageSize(size)}
                    style={{
                      padding: '2px 9px', borderRadius: '4px', border: '1px solid #555', fontSize: '12px', cursor: 'pointer',
                      background: itemsPerPage === size ? '#B9E42B' : '#333',
                      color: itemsPerPage === size ? '#000' : '#fff',
                      fontWeight: itemsPerPage === size ? 600 : 400,
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>

              {/* Page navigation with manual page input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  style={{ padding: '2px 12px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '16px', lineHeight: '20px', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.4 : 1 }}
                >
                  ‹
                </button>
                <span style={{ color: '#aaa', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pageInput}
                    onChange={e => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    onBlur={commitPageInput}
                    style={{ width: '52px', textAlign: 'center', padding: '2px 4px', background: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '13px' }}
                  />
                  / {totalPages}
                </span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  style={{ padding: '2px 12px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '16px', lineHeight: '20px', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.4 : 1 }}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataTable;