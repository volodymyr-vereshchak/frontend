import * as XLSX from 'xlsx';
import { editArchiveApi, sysArchiveApi } from '../services/api';
import { enterprisePeriodKey, getEnterpriseFetchFn } from './enterpriseVolumes';
import { addDays } from './commercialDay';
import { formatEditValue } from './valueConverter';
import { resolveEditName } from './archiveColumns';

// Період у клітинці Excel — той самий формат, що і в таблиці на екрані.
export function formatPeriodForExcel(value, archiveType, locale) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value || '';
  if (archiveType === 'daily') {
    return date.toLocaleDateString(locale);
  } else if (archiveType === 'hourly') {
    return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  } else if (archiveType === 'edit' || archiveType === 'sys') {
    return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } else {
    return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}

function applyNumberFormat(worksheet) {
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  for (let r = 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (worksheet[addr] && typeof worksheet[addr].v === 'number') {
        worksheet[addr].z = '#,##0.00';
      }
    }
  }
}

// ── Експорт з розбивкою по підприємствах (daily/hourly) ─────────────────────
async function exportWithEnterpriseBreakdown({
  columns, processedRowData, archiveType, selectedLines, isVirtualLine, locale, t,
}) {
  // Sort data chronologically
  const sortedData = [...processedRowData].sort((a, b) => new Date(a.period) - new Date(b.period));
  const firstDate = String(sortedData[0].period).slice(0, 10);
  const toDate = String(sortedData[sortedData.length - 1].period).slice(0, 10);
  const periodType = archiveType === 'hourly' ? 'hourly' : 'daily';
  // Enterprise is commercial-day aligned (07:00 start); for hourly fetch a day
  // earlier so the first date's 00:00–06:00 hours (tail of the previous
  // commercial day) are included.
  const fromDate = periodType === 'hourly' ? addDays(firstDate, -1) : firstDate;

  // Excel needs full per-enterprise breakdown — always fetch fresh from API
  // (cache stores only total volumes, which is enough for the chart overlay).
  const rawEnterprise = await getEnterpriseFetchFn(isVirtualLine)(
    selectedLines, fromDate, toDate, periodType
  ) || [];

  // Build per-period, per-enterprise breakdown
  const entByPeriod = {}; // period key -> { entName -> volume }
  const entNames = new Set();

  rawEnterprise.forEach(record => {
    const pk = enterprisePeriodKey(record.period, periodType);
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
  const extraHeaders = [t('totalEnterpriseVolume'), t('netVolume')];
  const headers = [...archiveHeaders, ...sortedEntNames, ...extraHeaders];

  // Build data rows
  const dataRows = sortedData.map(row => {
    const archiveCells = columns.map(col => {
      const value = row[col.key];
      if (col.key === 'period' && value) return formatPeriodForExcel(value, archiveType, locale);
      if (typeof value === 'number') return value;
      return value || '';
    });

    const pk = enterprisePeriodKey(row.period, periodType);
    const entData = entByPeriod[pk] || {};

    const entCells = sortedEntNames.map(name => entData[name] != null ? entData[name] : '');
    const totalEnt = entCells.reduce((s, v) => s + (v !== '' ? v : 0), 0);
    const lineVol = row.volume || 0;
    const netVol = lineVol - totalEnt;

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
      const pk = enterprisePeriodKey(row.period, periodType);
      return s + ((entByPeriod[pk] || {})[name] || 0);
    }, 0)
  );
  const summaryTotalEnt = summaryEnt.reduce((s, v) => s + v, 0);
  const summaryLineVol = sortedData.reduce((s, row) => s + (row.volume || 0), 0);
  const summaryNetVol = summaryLineVol - summaryTotalEnt;
  const summaryRow = [...summaryArchive, ...summaryEnt, summaryTotalEnt, summaryNetVol];

  // Build workbook
  const allRows = [headers, ...dataRows, summaryRow];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths
  worksheet['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...dataRows.map(r => String(r[i] ?? '').length));
    return { wch: Math.min(Math.max(maxLen + 3, 12), 50) };
  });

  applyNumberFormat(worksheet);

  const archiveTypeNames = { daily: t('dailyArchive'), hourly: t('hourlyArchive') };
  XLSX.utils.book_append_sheet(workbook, worksheet, archiveTypeNames[archiveType] || archiveType);

  const now = new Date();
  const ts = now.toISOString().slice(0, 19).replace(/[T:]/g, '_');
  const fileArchiveNames = { daily: t('dailyArchiveFile'), hourly: t('hourlyArchiveFile') };
  XLSX.writeFile(workbook, `${fileArchiveNames[archiveType] || archiveType}_enterprise_${ts}.xlsx`);
}

/**
 * Експорт архівної таблиці в Excel (стандартний або з розбивкою по
 * підприємствах). Витягнуто з DataTable.jsx; сам компонент лише передає
 * поточний контекст (колонки, дані, тип архіву, локаль).
 */
export async function exportArchiveToExcel({
  columns,
  processedRowData,
  archiveType,
  serverPaged,
  selectedLines,
  dateRange,
  withEnterprise,
  isVirtualLine,
  locale,
  t,
}) {
  // ── Enterprise export (daily/hourly only) ──────────────────────────────
  if (withEnterprise && (archiveType === 'daily' || archiveType === 'hourly') && selectedLines && selectedLines.length > 0) {
    await exportWithEnterpriseBreakdown({
      columns, processedRowData, archiveType, selectedLines, isVirtualLine, locale, t,
    });
    return;
  }

  // ── Standard export ────────────────────────────────────────────────────

  // Server-paginated archives (sys / edit) only keep the current page in
  // memory; pull the full dataset so the export is complete.
  const rawExportData = serverPaged
    ? ((archiveType === 'sys'
        ? await sysArchiveApi.getSysData(selectedLines, dateRange.fromDate, dateRange.toDate)
        : await editArchiveApi.getEditData(selectedLines, dateRange.fromDate, dateRange.toDate)) || [])
    : processedRowData;

  // The API does not guarantee chronological row order (re-polled/backfilled
  // periods can arrive out of sequence), and the on-screen table sorts a
  // separate copy. Sort the export itself by period so every archive's
  // spreadsheet is strictly chronological. Rows without a period keep a
  // stable relative order at the end.
  const exportData = rawExportData.slice().sort((a, b) => {
    const ta = a.period ? new Date(a.period).getTime() : NaN;
    const tb = b.period ? new Date(b.period).getTime() : NaN;
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return ta - tb;
  });

  const headers = columns.map(col => col.label);

  const dataRows = exportData.map(row => {
    return columns.map(col => {
      const value = row[col.key];
      if (col.key === 'period' && value) return formatPeriodForExcel(value, archiveType, locale);
      if (archiveType === 'edit' && col.key === 'edit_name') {
        return resolveEditName(value, row.old_value, row.new_value) || '';
      }
      if (archiveType === 'edit' && (col.key === 'old_value' || col.key === 'new_value')) {
        return formatEditValue(value, row.edit_type_id ?? null, row.gas_volume_calc_type_id ?? null);
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
        return processedRowData.reduce((acc, row) => acc + (parseFloat(row[col.key]) || 0), 0);
      } else if (col.isAveragable) {
        const validValues = processedRowData
          .map(row => parseFloat(row[col.key]))
          .filter(value => !isNaN(value));
        if (validValues.length > 0) {
          return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
        }
        return '';
      }
      return '';
    });
  }

  const allRows = [headers, ...dataRows];
  if (summaryRow) {
    allRows.push(summaryRow);
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(allRows);

  // Auto-size columns
  worksheet['!cols'] = columns.map(col => {
    const headerLength = col.label.length;
    const maxDataLength = Math.max(
      ...exportData.map(row => {
        const value = row[col.key];
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') {
          return value.toFixed(2).length + 2;
        }
        return String(value).length;
      })
    );
    const width = Math.max(headerLength, maxDataLength) + 3;
    return { wch: Math.min(Math.max(width, 12), 50) };
  });

  applyNumberFormat(worksheet);

  const archiveTypeNames = {
    'daily': t('dailyArchive'),
    'hourly': t('hourlyArchive'),
    'sys': t('systemArchive'),
    'edit': t('editArchive'),
    'param': t('parameters')
  };
  XLSX.utils.book_append_sheet(workbook, worksheet, archiveTypeNames[archiveType] || archiveType);

  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '_');
  const fileArchiveNames = {
    'daily': t('dailyArchiveFile'),
    'hourly': t('hourlyArchiveFile'),
    'sys': t('systemArchiveFile'),
    'edit': t('editArchiveFile'),
    'param': t('parametersFile')
  };
  XLSX.writeFile(workbook, `${fileArchiveNames[archiveType] || archiveType}_${timestamp}.xlsx`);
}
