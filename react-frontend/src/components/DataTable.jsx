import React, { useState, useEffect } from 'react';
import './DataTable.css';
import { formatEditValue } from '../utils/valueConverter';
import { PRESSURE_UNIT_DEFAULT, DP_UNIT_DEFAULT, convertPressureValue } from '../constants/pressureUnits';
import { getArchiveColumns, resolveEditName } from '../utils/archiveColumns';
import { exportArchiveToExcel } from '../utils/exportArchiveToExcel';
import { useArchiveData } from '../hooks/useArchiveData';
import { useLanguage } from '../contexts/LanguageContext';
import ExcelIcon from './common/ExcelIcon';

const DataTable = ({ selectedLines, dateRange, isDateFilterEnabled, archiveType, onDataChange, isVirtualLine, isDpdLine, lineUnits }) => {
  const { t, getLocale } = useLanguage();
  const [sortConfig, setSortConfig] = useState({ key: 'period', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pageInput, setPageInput] = useState('1');
  const [exportWithEnterprise, setExportWithEnterprise] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Alarm (sys) and change (edit) archives can hold tens of thousands of rows per
  // day, so for physical lines they are fetched one page at a time from the
  // server (/sys/paged/, /edit/paged/) with server-side sorting. Everything else
  // (daily/hourly/param, and virtual lines) loads fully and sorts client-side.
  const serverPaged = !isVirtualLine && !isDpdLine && (archiveType === 'sys' || archiveType === 'edit');

  const { rowData, loading, error, totalRows } = useArchiveData({
    selectedLines,
    dateRange,
    isDateFilterEnabled,
    archiveType,
    isVirtualLine,
    isDpdLine,
    serverPaged,
    currentPage,
    itemsPerPage,
    sortConfig,
    onDataChange,
    t,
  });

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

  const columns = getArchiveColumns({
    archiveType,
    isVirtualLine,
    isDpdLine,
    lineUnits,
    showOutputPressure,
    pressureUnit,
    dpUnit,
    t,
  });

  // Reset to the first page and default sort whenever the query context changes
  // (lines, dates, archive type). Returning the same state object when already at
  // the default avoids an extra render/fetch cycle.
  useEffect(() => {
    setCurrentPage(p => (p === 1 ? p : 1));
    setSortConfig(s => (s.key === 'period' && s.direction === 'asc' ? s : { key: 'period', direction: 'asc' }));
  }, [JSON.stringify(selectedLines), JSON.stringify(dateRange), isDateFilterEnabled, archiveType, isVirtualLine, isDpdLine]);

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

  const handleExport = async () => {
    if (!rowData || rowData.length === 0) {
      alert(t('noDataExport'));
      return;
    }
    setIsExporting(true);
    try {
      await exportArchiveToExcel({
        columns,
        processedRowData,
        archiveType,
        serverPaged,
        selectedLines,
        dateRange,
        withEnterprise: exportWithEnterprise,
        isVirtualLine,
        locale: getLocale(),
        t,
      });
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert(t('exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const formatNumber = (value, key) => {
    if (typeof value !== 'number' || isNaN(value)) return value;

    // Density 4 decimals; alarm/change counts are integers; everything else 2.
    const decimals = key === 'density' ? 4
      : (key === 'edit_counts' || key === 'sys_counts') ? 0 : 2;
    const formatted = value.toFixed(decimals);
    const [integerPart, decimalPart] = formatted.split('.');
    const intWithSep = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return decimalPart != null ? `${intWithSep}.${decimalPart}` : intWithSep;
  };

  const formatValue = (value, key, row = {}) => {
    // Edit archive: resolve %s channel template in edit_name based on old_value
    if (archiveType === 'edit' && key === 'edit_name') {
      return resolveEditName(value, row?.old_value, row?.new_value);
    }
    // Edit archive: smart-format raw int values (handles enums, small coefficients, time, floats)
    if (archiveType === 'edit' && (key === 'old_value' || key === 'new_value')) {
      return formatEditValue(value, row?.edit_type_id ?? null, row?.gas_volume_calc_type_id ?? null);
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

    const params = new URLSearchParams({
      archiveType: 'hourly',
      fromDate: formatDate(startDate),
      toDate: formatDate(endDate),
      lineId: row.line_id,
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
                    onClick={handleExport}
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
