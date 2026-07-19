import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { lineApi, archiveDataApi, paramArchiveApi, branchApi, lumgApi, dpdLineApi } from '../services/api';
import { OverviewCalculator } from '../utils/overviewCalculator';

/**
 * Shared Overview data orchestration: load branches/lumgs, then for the selected
 * branch fetch report lines + params + last-24h hourly data and compute the
 * metrics/pressures/comparisons via OverviewCalculator.
 *
 * Extracted from OverviewTab so both the desktop tab and the mobile Overview screen
 * render from the exact same data (single source of truth).
 */
export function useOverviewData() {
  const { t } = useLanguage();

  const [branches, setBranches] = useState([]);
  const [allLumgs, setAllLumgs] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useLocalStorage('hlv-overview-branch', null);
  const [selectorLoading, setSelectorLoading] = useState(true);

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // Load branches and lumgs on mount, auto-select first (or saved)
  useEffect(() => {
    const loadSelectors = async () => {
      setSelectorLoading(true);
      try {
        const [branchesRes, lumgsRes] = await Promise.all([
          branchApi.getAll(),
          lumgApi.getAll(),
        ]);
        const branchList = Array.isArray(branchesRes) ? branchesRes : branchesRes?.data || [];
        const lumgList = Array.isArray(lumgsRes) ? lumgsRes : lumgsRes?.data || [];

        setBranches(branchList);
        setAllLumgs(lumgList);

        if (branchList.length > 0) {
          setSelectedBranchId(prev =>
            prev !== null && branchList.some(b => b.id === prev) ? prev : branchList[0].id
          );
        }
      } catch (err) {
        console.error('Failed to load branches/lumgs:', err);
      } finally {
        setSelectorLoading(false);
      }
    };
    loadSelectors();
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedBranchId) return;

    setIsLoading(true);
    setError(null);

    try {
      const branchLumgIds = allLumgs
        .filter(l => l.branch_id === selectedBranchId)
        .map(l => l.id);

      if (branchLumgIds.length === 0) {
        throw new Error(t('noLumgsForBranch'));
      }

      const lineToLumg = {};
      const linesResponses = await Promise.all(
        branchLumgIds.map(async lumgId => {
          const r = await lineApi.getLinesByLumg(lumgId);
          const arr = Array.isArray(r) ? r : r?.data || [];
          arr.forEach(line => { lineToLumg[line.id] = lumgId; });
          return arr;
        })
      );
      let lines = linesResponses.flatMap(r => r);

      if (!Array.isArray(lines) || lines.length === 0) {
        throw new Error(t('noLinesData'));
      }

      lines = lines.filter(line => line.include_in_report);
      const physReportIds = lines.map(line => line.id);

      // DPD lines with the report flag join the overview next to physical
      // ones; a line without a LUMG lands in the branch's first LUMG group.
      const dpdAll = await dpdLineApi.getByBranch(selectedBranchId).catch(() => []);
      const dpdReportLines = (Array.isArray(dpdAll) ? dpdAll : [])
        .filter(l => l.include_in_report && l.active !== false);
      dpdReportLines.forEach(dl => {
        lineToLumg[dl.id] = dl.lumg_id && branchLumgIds.includes(dl.lumg_id)
          ? dl.lumg_id
          : branchLumgIds[0];
      });
      const dpdReportIds = dpdReportLines.map(l => l.id);
      lines = [...lines, ...dpdReportLines];
      const reportLineIds = [...physReportIds, ...dpdReportIds];

      if (reportLineIds.length === 0) {
        throw new Error(t('noReportLinesForBranch'));
      }

      let paramsMap = {};
      try {
        const paramsResponse = await paramArchiveApi.getParamsForLines(physReportIds);
        const paramsData = Array.isArray(paramsResponse) ? paramsResponse : paramsResponse?.data || [];
        paramsData.forEach(param => {
          if (param && param.line_id) {
            paramsMap[param.line_id] = {
              min_dp: param.min_dp || 0,
              max_dp: param.max_dp || 100,
            };
          }
        });
      } catch (err) {
        console.warn('Failed to load dP parameters, using defaults:', err);
      }

      // Physical hourly data anchors on the hostlib archive; DPD lines fetch
      // the same calendar window from their own archive endpoint.
      const dpdWindow = (() => {
        const now = new Date();
        const fmt = (d) => d.toISOString().split('T')[0];
        return {
          from: fmt(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
          to: fmt(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)),
        };
      })();
      const [physHourlyResponse, dpdHourlyResponse] = await Promise.all([
        physReportIds.length > 0
          ? archiveDataApi.getHourlyDataLast24h(physReportIds)
          : Promise.resolve([]),
        dpdReportIds.length > 0
          ? dpdLineApi.getHourlyData(dpdReportIds, dpdWindow.from, dpdWindow.to).catch(() => [])
          : Promise.resolve([]),
      ]);
      const physHourly = Array.isArray(physHourlyResponse) ? physHourlyResponse : physHourlyResponse?.data || [];
      const dpdHourly = Array.isArray(dpdHourlyResponse) ? dpdHourlyResponse : [];
      const allHourlyData = [...physHourly, ...dpdHourly];

      if (!Array.isArray(allHourlyData) || allHourlyData.length === 0) {
        throw new Error(t('noDataFor24h'));
      }

      // Per-LINE 24h windows: every line's volume anchors on ITS own last
      // archived period (hostlib lines and DPD lines alike — a lagging line
      // keeps a full, untruncated day). Only "activity" (active-lines
      // counter, header) compares against the global hostlib anchor below.
      const maxTs = (rows) => {
        const ts = rows
          .map(r => r.period ? new Date(r.period).getTime() : null)
          .filter(t => t && !isNaN(t));
        return ts.length ? Math.max(...ts) : null;
      };
      const physEndMs = maxTs(physHourly);
      const dpdEndMs = maxTs(dpdHourly);
      if (physEndMs === null && dpdEndMs === null) {
        throw new Error(t('noTimeBoundsError'));
      }

      const window24 = (rows, endMs) => {
        if (endMs === null) return { current: [], previous: [] };
        const currentStartMs = endMs - 23 * 60 * 60 * 1000;
        const previousEndMs = currentStartMs - 60 * 60 * 1000;
        const previousStartMs = previousEndMs - 23 * 60 * 60 * 1000;
        const current = [], previous = [];
        for (const r of rows) {
          const ts = new Date(r.period).getTime();
          if (ts >= currentStartMs && ts <= endMs) current.push(r);
          else if (ts >= previousStartMs && ts <= previousEndMs) previous.push(r);
        }
        return { current, previous };
      };
      const rowsByLine = new Map();
      for (const r of allHourlyData) {
        if (!rowsByLine.has(r.line_id)) rowsByLine.set(r.line_id, []);
        rowsByLine.get(r.line_id).push(r);
      }
      const last24hData = [];
      const previous24hData = [];
      for (const rows of rowsByLine.values()) {
        const win = window24(rows, maxTs(rows));
        last24hData.push(...win.current);
        previous24hData.push(...win.previous);
      }

      // Display bounds (header/"last update") anchor on the hostlib archives'
      // max period — the overview's "actual" date (user decision 2026-07-19).
      const currentEnd = new Date(physEndMs ?? dpdEndMs);
      const currentStart = new Date(currentEnd.getTime() - 23 * 60 * 60 * 1000);
      const previousEnd = new Date(currentStart.getTime() - 60 * 60 * 1000);
      const previousStart = new Date(previousEnd.getTime() - 23 * 60 * 60 * 1000);

      const lineNames = {};
      lines.forEach(line => {
        lineNames[line.id] = line.name || `${t('unknownLine')} ${line.id}`;
      });

      const lumgNameById = {};
      allLumgs.forEach(l => { lumgNameById[l.id] = l.name; });
      const lumgGroups = branchLumgIds
        .map(lumgId => ({
          lumgId,
          lumgName: lumgNameById[lumgId] || `ЛУМГ ${lumgId}`,
          lineIds: lines.filter(l => lineToLumg[l.id] === lumgId).map(l => l.id),
        }))
        .filter(g => g.lineIds.length > 0);

      const currentTotal = OverviewCalculator.calculate24hTotal(last24hData, reportLineIds);
      const previousTotal = OverviewCalculator.calculate24hTotal(previous24hData, reportLineIds);
      const volumeComparison = OverviewCalculator.calculateComparison(currentTotal, previousTotal);
      const flowComparisons = OverviewCalculator.calculateLastHourFlow(allHourlyData, reportLineIds);
      const volumeComparisons = OverviewCalculator.calculate24hVolumeByLine(
        last24hData,
        previous24hData,
        reportLineIds
      );
      const pressures = OverviewCalculator.getLastPressures(allHourlyData, reportLineIds, lines, paramsMap);

      const pressureTimestamps = {};
      Object.keys(pressures).forEach(lineId => {
        pressureTimestamps[lineId] = pressures[lineId].timestamp;
      });

      // A line counts as "active" when its last record matches the overview's
      // actual anchor — the hostlib archives' max date/time (user decision
      // 2026-07-19); a DPD line whose archive lags behind it is NOT active.
      const activeAnchorMs = physEndMs ?? dpdEndMs;
      const activeLines = Object.values(pressures).filter(p =>
        activeAnchorMs !== null && p.timestamp &&
        Math.abs(new Date(p.timestamp).getTime() - activeAnchorMs) < 60 * 1000
      ).length;

      setData({
        totalVolume24h: currentTotal,
        volumeComparison,
        flowComparisons,
        volumeComparisons,
        pressures,
        lineNames,
        pressureTimestamps,
        lumgGroups,
        activeLines,
        totalLines: reportLineIds.length,
        currentPeriod: { start: currentStart, end: currentEnd },
        previousPeriod: { start: previousStart, end: previousEnd },
      });

      setLastUpdateTime(currentEnd);
    } catch (err) {
      console.error('Error loading overview data:', err);
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, allLumgs]);

  // Load data when branch is selected or changes
  useEffect(() => {
    if (selectedBranchId) loadData();
  }, [loadData, selectedBranchId]);

  // Sync refresh: fires at :32 of each hour (2 min after scheduler at :30), then hourly
  useEffect(() => {
    if (!selectedBranchId) return;
    let timeoutId, intervalId;
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(32);
    if (next <= now) next.setHours(next.getHours() + 1);
    timeoutId = setTimeout(() => {
      loadData();
      intervalId = setInterval(loadData, 60 * 60 * 1000);
    }, next - now);
    return () => { clearTimeout(timeoutId); clearInterval(intervalId); };
  }, [selectedBranchId, loadData]);

  const selectBranch = (branchId) => {
    setSelectedBranchId(branchId);
    setData(null);
  };

  return {
    branches,
    allLumgs,
    selectedBranchId,
    setSelectedBranchId,
    selectBranch,
    data,
    selectorLoading,
    isLoading,
    error,
    lastUpdateTime,
    reload: loadData,
  };
}
