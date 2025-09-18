import React, { useState, useEffect } from 'react';
import './DataTable.css';
import apiClient, { archiveCountsApi, archiveDataApi, editArchiveApi, commercialDayUtils } from '../services/api';
import * as XLSX from 'xlsx';

// Excel Export Icon
const ExcelIcon = ({ color = "#B9E42B" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.53 9L13 3.47C12.8595 3.32931 12.6688 3.25018 12.47 3.25H8C7.27065 3.25 6.57118 3.53973 6.05546 4.05546C5.53973 4.57118 5.25 5.27065 5.25 6V18C5.25 18.7293 5.53973 19.4288 6.05546 19.9445C6.57118 20.4603 7.27065 20.75 8 20.75H16C16.7293 20.75 17.4288 20.4603 17.9445 19.9445C18.4603 19.4288 18.75 18.7293 18.75 18V9.5C18.7421 9.3116 18.6636 9.13309 18.53 9ZM13.25 5.81L16.19 8.75H13.25V5.81ZM16 19.25H8C7.66848 19.25 7.35054 19.1183 7.11612 18.8839C6.8817 18.6495 6.75 18.3315 6.75 18V6C6.75 5.66848 6.8817 5.35054 7.11612 5.11612C7.35054 4.8817 7.66848 4.75 8 4.75H11.75V9.5C11.7526 9.69811 11.8324 9.88737 11.9725 10.0275C12.1126 10.1676 12.3019 10.2474 12.5 10.25H17.25V18C17.25 18.3315 17.1183 18.6495 16.8839 18.8839C16.6495 19.1183 16.3315 19.25 16 19.25Z" fill={color}/>
    <path d="M14.47 11.91C14.312 11.7893 14.1134 11.7343 13.9158 11.7567C13.7183 11.7791 13.537 11.877 13.41 12.03L12 13.8L10.59 12C10.5243 11.9225 10.4441 11.8587 10.3537 11.8123C10.2634 11.7658 10.1648 11.7376 10.0636 11.7293C9.96242 11.7209 9.86055 11.7326 9.76384 11.7636C9.66713 11.7946 9.57747 11.8443 9.49999 11.91C9.42251 11.9757 9.35872 12.0559 9.31227 12.1463C9.26581 12.2366 9.2376 12.3351 9.22925 12.4364C9.22089 12.5376 9.23255 12.6394 9.26356 12.7362C9.29457 12.8329 9.34433 12.9225 9.40999 13L11 15L9.40999 17C9.28534 17.1565 9.22796 17.3561 9.25046 17.5549C9.27296 17.7536 9.37351 17.9353 9.52999 18.06C9.68647 18.1847 9.88606 18.242 10.0848 18.2195C10.2836 18.197 10.4653 18.0965 10.59 17.94L12 16.2L13.41 18C13.4818 18.0871 13.5719 18.1573 13.6738 18.2056C13.7758 18.254 13.8871 18.2794 14 18.28C14.1534 18.2927 14.3069 18.2579 14.4398 18.1804C14.5728 18.1028 14.6786 17.9863 14.743 17.8465C14.8074 17.7068 14.8273 17.5506 14.7999 17.3991C14.7726 17.2477 14.6993 17.1084 14.59 17L13 15L14.63 13C14.6922 12.9184 14.7375 12.8251 14.7632 12.7258C14.7889 12.6264 14.7944 12.5229 14.7795 12.4213C14.7646 12.3198 14.7295 12.2222 14.6764 12.1344C14.6232 12.0466 14.5531 11.9703 14.47 11.91Z" fill={color}/>
  </svg>
);

const DataTable = ({ selectedLines, dateRange, isDateFilterEnabled, archiveType, onDataChange }) => {
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Excel export function
  const exportToExcel = () => {
    if (!rowData || rowData.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }

    try {
      const columns = getColumns();

      // Prepare data for Excel
      const excelData = rowData.map(row => {
        const excelRow = {};
        columns.forEach(col => {
          let value = row[col.key];

          // Format dates for Excel
          if (col.key === 'period' && value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              // Excel recognizes Date objects directly
              value = date;
            }
          }

          // Keep numbers as numbers for Excel
          if (typeof value === 'number') {
            // Excel will handle number formatting
            excelRow[col.label] = value;
          } else {
            excelRow[col.label] = value || '';
          }
        });
        return excelRow;
      });

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const columnWidths = columns.map(col => {
        const maxLength = Math.max(
          col.label.length,
          ...rowData.map(row => {
            const value = row[col.key];
            if (value === null || value === undefined) return 0;
            return String(value).length;
          })
        );
        return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
      });
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      const archiveTypeNames = {
        'daily': 'Суточный архив',
        'hourly': 'Часовой архив',
        'sys': 'Архив аварий',
        'edit': 'Архив изменений',
        'param': 'Параметры'
      };
      const sheetName = archiveTypeNames[archiveType] || archiveType;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Generate filename
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/[T:]/g, '_');
      const fileArchiveNames = {
        'daily': 'суточный_архив',
        'hourly': 'часовой_архив',
        'sys': 'архив_аварий',
        'edit': 'архив_изменений',
        'param': 'параметры'
      };
      const filename = `${fileArchiveNames[archiveType] || archiveType}_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Ошибка при экспорте в Excel');
    }
  };

  // Sync scroll between header and body
  const handleTableScroll = (e) => {
    const headerWrapper = document.querySelector('.table-header-wrapper');
    if (headerWrapper) {
      headerWrapper.scrollLeft = e.target.scrollLeft;
    }
  };

  const getColumns = () => {
    switch (archiveType) {
      case 'daily':
      case 'hourly':
        return [
          { key: 'period', label: 'Период', sortable: true },
          { key: 'volume', label: 'Объем', sortable: true, isSummable: true },
          { key: 'w_volume_dp', label: 'Раб. объем/перепад', sortable: true, isAveragable: true },
          { key: 'pressure', label: 'Давление', sortable: true, isAveragable: true },
          { key: 'temperature', label: 'Температура', sortable: true, isAveragable: true },
          { key: 'density', label: 'Плотность', sortable: true, isAveragable: true },
          { key: 'edit_counts', label: 'И', sortable: true, isSummable: true, tooltip: 'Изменения' },
          { key: 'sys_counts', label: 'А', sortable: true, isSummable: true, tooltip: 'Аварии' }
        ];
      case 'edit':
        return [
          { key: 'period', label: 'Период', sortable: true },
          { key: 'edit_name', label: 'Тип изменения', sortable: true },
          { key: 'old_value', label: 'Старое значение', sortable: true },
          { key: 'new_value', label: 'Новое значение', sortable: true }
        ];
      case 'sys':
        return [
          { key: 'period', label: 'Период', sortable: true },
          { key: 'sys_name', label: 'Тип операции', sortable: true },
          { key: 'volume', label: 'Объем', sortable: true, isSummable: true }
        ];
      case 'param':
        return [
          { key: 'period', label: 'Период', sortable: true },
          { key: 'density', label: 'Плотность', sortable: true, isAveragable: true },
          { key: 'co2', label: 'CO2 (%)', sortable: true, isAveragable: true },
          { key: 'n2', label: 'N2 (%)', sortable: true, isAveragable: true },
          { key: 'D20', label: 'D20', sortable: true, isAveragable: true },
          { key: 'd20', label: 'd20', sortable: true, isAveragable: true },
          { key: 'cutoff', label: 'Cutoff', sortable: true, isAveragable: true },
          { key: 'roughness', label: 'Roughness', sortable: true, isAveragable: true },
          { key: 'max_dp', label: 'Макс. ΔP', sortable: true, isAveragable: true },
          { key: 'min_dp', label: 'Мин. ΔP', sortable: true, isAveragable: true },
          { key: 'A0su', label: 'A0su', sortable: true, isAveragable: true },
          { key: 'A1su', label: 'A1su', sortable: true, isAveragable: true },
          { key: 'A2su', label: 'A2su', sortable: true, isAveragable: true },
          { key: 'A0pipe', label: 'A0pipe', sortable: true, isAveragable: true },
          { key: 'A1pipe', label: 'A1pipe', sortable: true, isAveragable: true },
          { key: 'A2pipe', label: 'A2pipe', sortable: true, isAveragable: true },
          { key: 'radius', label: 'Радиус', sortable: true, isAveragable: true },
          { key: 'su_year', label: 'SU год', sortable: true, isAveragable: true },
          { key: 'max_p', label: 'Макс. P', sortable: true, isAveragable: true },
          { key: 'min_p', label: 'Мин. P', sortable: true, isAveragable: true },
          { key: 'max_t', label: 'Макс. T', sortable: true, isAveragable: true },
          { key: 'min_t', label: 'Мин. T', sortable: true, isAveragable: true }
        ];
      default:
        return [];
    }
  };

  const columns = getColumns();

  const fetchData = async (abortController) => {
    if (!selectedLines || selectedLines.length === 0) {
      setRowData([]);
      if (onDataChange) {
        onDataChange([]);
      }
      return;
    }

    if (!isDateFilterEnabled) {
      setRowData([]);
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
      // Special handling for edit archive with value conversion
      if (archiveType === 'edit') {
        const data = await editArchiveApi.getEditData(selectedLines, dateRange.fromDate, dateRange.toDate);

        setRowData(data || []);
        if (onDataChange) {
          onDataChange(data || []);
        }
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

      if (abortController?.signal?.aborted) {
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
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching data:', error);
      setError(error.message);
      setRowData([]);
      if (onDataChange) {
        onDataChange([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const abortController = new AbortController();

    // No debounce for archive type changes - immediate loading
    // Small debounce for date/line changes to prevent too many requests
    const isArchiveChange = archiveType; // If archiveType changed, load immediately
    const delay = 50; // Reduced delay for better responsiveness

    const timeoutId = setTimeout(() => {
      fetchData(abortController);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort(); // Cancel pending requests
    };
  }, [
    JSON.stringify(selectedLines),
    JSON.stringify(dateRange),
    isDateFilterEnabled,
    archiveType
  ]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = React.useMemo(() => {
    let sortableData = [...rowData];
    if (sortConfig.key) {
      sortableData.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableData;
  }, [rowData, sortConfig]);

  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const getRecordCount = () => {
    return rowData ? rowData.length : 0;
  };

  const formatNumber = (value, key) => {
    if (typeof value !== 'number' || isNaN(value)) return value;

    // Special formatting for edit archive values (4 decimal places)
    if (archiveType === 'edit' && (key === 'old_value' || key === 'new_value')) {
      const formatted = value.toFixed(4);
      const [integerPart, decimalPart] = formatted.split('.');
      return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + decimalPart;
    }

    // Default formatting with 2 decimal places and add spaces between thousands
    const formatted = value.toFixed(2);
    const [integerPart, decimalPart] = formatted.split('.');
    return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '.' + decimalPart;
  };

  const formatValue = (value, key) => {
    if (key === 'period') {
      const date = new Date(value);
      if (archiveType === 'daily') {
        return date.toLocaleDateString('ru-RU');
      } else {
        // Format without comma: "01.01.2024 14:30:00"
        return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU');
      }
    }
    if (typeof value === 'number') {
      return formatNumber(value, key);
    }
    return value;
  };

  const calculateSummary = () => {
    if (sortedData.length === 0) {
      return {};
    }

    const summary = {};

    columns.forEach(column => {
      if (column.key === 'period') {
        summary[column.key] = 'Итого:';
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
          {archiveType === 'daily' && 'Суточный архив'}
          {archiveType === 'hourly' && 'Часовой архив'}
          {archiveType === 'edit' && 'Архив изменений'}
          {archiveType === 'sys' && 'Системный архив'}
          {archiveType === 'param' && 'Параметры'}
        </h6>
        <div className="table-info">
          {loading ? (
            <span style={{color: '#ffa500'}}>Загрузка...</span>
          ) : (
            <>
              <span style={{marginRight: '15px'}}>Записей: {getRecordCount()}</span>
              {rowData && rowData.length > 0 && (
                <button
                  className="excel-export-btn"
                  onClick={exportToExcel}
                  title="Экспорт в Excel"
                >
                  <ExcelIcon color="#000000" />
                  <span>Excel</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          Ошибка загрузки данных: {error}
        </div>
      )}

      {!selectedLines || selectedLines.length === 0 ? (
        <div className="placeholder-content">
          <p>Выберите линии для отображения данных</p>
        </div>
      ) : !isDateFilterEnabled ? (
        <div className="placeholder-content">
          <p>Активируйте фильтр по датам для загрузки данных</p>
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
                        Загрузка данных...
                      </td>
                    </tr>
                  ) : sortedData.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="no-data-cell">
                        Нет данных для отображения
                      </td>
                    </tr>
                  ) : (
                    sortedData.map((row, index) => (
                      <tr key={index}>
                        {columns.map((column) => (
                          <td key={column.key}>
                            {formatValue(row[column.key], column.key)}
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
        </div>
      )}
    </div>
  );
};

export default DataTable;