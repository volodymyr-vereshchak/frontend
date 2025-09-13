import React, { useState, useEffect } from 'react';
import './DataTable.css';

const DataTable = ({ selectedLines, dateRange, isDateFilterEnabled, archiveType, onDataChange }) => {
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

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
          { key: 'density', label: 'Плотность', sortable: true, isAveragable: true }
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
      // Build query parameters for server-side filtering
      const params = new URLSearchParams();

      // Add line IDs filter - backend expects multiple line_id parameters
      if (selectedLines && selectedLines.length > 0) {
        selectedLines.forEach(lineId => {
          params.append('line_id', lineId.toString());
        });
      }

      // Add date range filters
      if (dateRange.fromDate) {
        // For daily archive, use date format, for others use ISO datetime
        if (archiveType === 'daily') {
          params.append('from_date', dateRange.fromDate);
        } else {
          // fromDate is already ISO string for non-daily archives
          params.append('from_date', dateRange.fromDate);
        }
      }

      if (dateRange.toDate) {
        if (archiveType === 'daily') {
          params.append('to_date', dateRange.toDate);
        } else {
          // toDate is already ISO string for non-daily archives
          params.append('to_date', dateRange.toDate);
        }
      }

      // Use the appropriate archive endpoint with query parameters
      const endpoint = `/api/${archiveType}/?${params.toString()}`;
      console.log('🚀 Starting fetch from:', endpoint, 'at', new Date().toLocaleTimeString());

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: abortController?.signal
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const totalTime = performance.now() - startTime;
      console.log('✅ Server-filtered data received:', data.length, 'records in', Math.round(totalTime), 'ms');
      setRowData(data);

      // Notify parent component about data change for chart
      if (onDataChange) {
        onDataChange(data);
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
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

  const formatNumber = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return value;

    // Format with 2 decimal places and add spaces between thousands
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const formatValue = (value, key) => {
    if (key === 'period') {
      const date = new Date(value);
      if (archiveType === 'daily') {
        return date.toLocaleDateString();
      } else {
        // Format without comma: "01.01.2024 14:30:00"
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      }
    }
    if (typeof value === 'number') {
      return formatNumber(value);
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

  console.log('DataTable rendering with rowData:', rowData);

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
            `Записей: ${getRecordCount()}`
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