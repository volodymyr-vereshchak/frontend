import { useEffect, useRef, useState } from 'react';
import apiClient, {
  archiveCountsApi,
  archiveDataApi,
  archiveDataVirtualApi,
  commercialDayUtils,
  dpdLineApi,
  editArchiveApi,
  sysArchiveApi,
} from '../services/api';

/**
 * Завантаження архівних даних для DataTable.
 *
 * Ховає всю fetch-машинерію: віртуальні лінії (окремі endpoint'и), серверна
 * пагінація sys/edit, добові/годинні архіви з підрахунками змін (И) та аварій
 * (А), захист від гонок (fetch id + abort), дебаунс 50мс.
 *
 * Повертає { rowData, loading, error, totalRows }.
 */
export function useArchiveData({
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
}) {
  const [rowData, setRowData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const fetchCountRef = useRef(0);

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

    try {
      // ДПД-линии: свои endpoints, только daily/hourly (как виртуальные)
      if (isDpdLine) {
        if (archiveType !== 'daily' && archiveType !== 'hourly') {
          setError(t('virtualLinesSupportOnlyDailyHourly'));
          setRowData([]);
          if (onDataChange) onDataChange([]);
          return;
        }

        const archiveData = archiveType === 'daily'
          ? await dpdLineApi.getDailyData(selectedLines, dateRange.fromDate, dateRange.toDate)
          : await dpdLineApi.getHourlyData(selectedLines, dateRange.fromDate, dateRange.toDate);

        if (abortController?.signal?.aborted || fetchCountRef.current !== myFetchId) return;

        setRowData(archiveData || []);
        if (onDataChange) onDataChange(archiveData || []);
        return;
      }

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
        const archiveData = archiveType === 'daily'
          ? await archiveDataVirtualApi.getDailyDataVirtual(selectedLines, dateRange.fromDate, dateRange.toDate)
          : await archiveDataVirtualApi.getHourlyDataVirtual(selectedLines, dateRange.fromDate, dateRange.toDate);

        if (abortController?.signal?.aborted || fetchCountRef.current !== myFetchId) return;

        setRowData(archiveData || []);
        if (onDataChange) onDataChange(archiveData || []);
        return;
      }

      // ФИЗИЧЕСКИЕ ЛИНИИ

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
      const promises = [
        archiveType === 'daily'
          ? archiveDataApi.getDailyData(selectedLines, dateRange.fromDate, dateRange.toDate)
          : archiveDataApi.getHourlyData(selectedLines, dateRange.fromDate, dateRange.toDate),
        archiveCountsApi.getEditCounts(selectedLines, dateRange.fromDate, dateRange.toDate),
        archiveCountsApi.getSysCounts(selectedLines, dateRange.fromDate, dateRange.toDate),
      ];

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
          processedEditCounts = editCountsData.map(record => ({
            line_id: record.line_id || (selectedLines.length > 0 ? selectedLines[0] : 1),
            period: record.period || record.hour_group,
            edit_counts: record.record_count || 0,
          }));
        }
        if (sysCountsData) {
          processedSysCounts = sysCountsData.map(record => ({
            line_id: record.line_id || (selectedLines.length > 0 ? selectedLines[0] : 1),
            period: record.period || record.hour_group,
            sys_counts: record.record_count || 0,
          }));
        }
      }

      // Merge archive data with both edit and sys counts
      const mergedData = (archiveData || []).map((record) => {
        const matchingEditCounts = processedEditCounts.find(count =>
          count.line_id === record.line_id &&
          count.period === record.period
        );
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

    } catch (err) {
      if (err.name === 'AbortError' || fetchCountRef.current !== myFetchId) {
        return;
      }
      console.error('Error fetching data:', err);
      setError(err.message);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveType]);

  // Page and sort only drive a re-fetch for server-paginated archives; for
  // everything else they are handled client-side, so they are excluded from the
  // fetch key to avoid needless reloads.
  const fetchKey = JSON.stringify(
    serverPaged
      ? [selectedLines, dateRange, isDateFilterEnabled, archiveType, isVirtualLine, isDpdLine, currentPage, itemsPerPage, sortConfig]
      : [selectedLines, dateRange, isDateFilterEnabled, archiveType, isVirtualLine, isDpdLine]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  return { rowData, loading, error, totalRows };
}
