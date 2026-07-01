/**
 * Shared helpers for the enterprise (промисловість) volume overlay.
 *
 * The same fetch-and-reduce logic was duplicated across every place that
 * subtracts/overlays enterprise volumes on top of GS archive data:
 *   - the daily/hourly archive chart checkbox (SimplifiedEnterpriseControl)
 *   - the daily/hourly archive Excel export (DataTable)
 *   - the GRS trends (GRSTrends)
 *   - the night-consumption report (NightConsumption)
 *
 * This module is the single source of those primitives. It intentionally only
 * builds the period/line lookups — the NET calculation stays at each call site,
 * because they differ on purpose (trends/night clamp with Math.max(0, …); the
 * chart overlay and Excel export show the raw line − enterprise difference).
 */
import { enterpriseApi, enterpriseVirtualApi, streamEnterpriseVolumesVirtual } from '../services/api';

/**
 * Normalize a period value to the key used to join enterprise records with
 * archive rows. Hourly → "YYYY-MM-DDTHH" (13 chars), daily → "YYYY-MM-DD" (10).
 * Handles both API ("YYYY-MM-DDTHH:MM:SS") and cache ("YYYY-MM-DDTHH") shapes.
 */
export function enterprisePeriodKey(period, periodType) {
  const raw = String(period || '').replace(' ', 'T');
  return periodType === 'hourly' ? raw.slice(0, 13) : raw.slice(0, 10);
}

/**
 * Total enterprise volume of one API/cache record. The API returns
 * `total_volume` (already the sum of its devices); cached records carry only a
 * `devices` array. Both resolve to the same number.
 */
export function enterpriseRecordTotal(record) {
  if (record && record.total_volume !== undefined && record.total_volume !== null) {
    return record.total_volume;
  }
  return (record?.devices || []).reduce((sum, d) => sum + (d.volume || 0), 0);
}

/**
 * Pick the correct fetch function for physical vs virtual lines. The returned
 * function has the signature (lines, from, to, periodType) => Promise<record[]>,
 * matching what getEnterpriseWithCache expects.
 */
export function getEnterpriseFetchFn(isVirtualLine) {
  return isVirtualLine
    ? (lines, from, to, type) => enterpriseVirtualApi.getEnterpriseVolumesVirtual(lines, from, to, type)
    : (lines, from, to, type) => enterpriseApi.getEnterpriseVolumes(lines, from, to, type);
}

/**
 * fetchFn for getEnterpriseWithCache that streams progress. Works for physical
 * and virtual lines (the stream endpoint resolves both). onProgress(done, total)
 * is called as devices are polled. Returns the same records array as the plain
 * fetch, so the cache/aggregation layers stay unchanged.
 */
export function makeEnterpriseStreamFetch(onProgress) {
  return (lines, from, to, type) => streamEnterpriseVolumesVirtual(lines, from, to, type, onProgress);
}

/**
 * Enterprise totals keyed by line then period: { lineId: { periodKey: total } }.
 * Used where the overlay is per line (trends, night consumption).
 */
export function buildEnterpriseByLinePeriod(records, periodType) {
  const map = {};
  (records || []).forEach(entry => {
    const lid = entry.line_id;
    const key = enterprisePeriodKey(entry.period, periodType);
    if (!map[lid]) map[lid] = {};
    map[lid][key] = enterpriseRecordTotal(entry);
  });
  return map;
}

/**
 * Enterprise totals keyed by period, summed across all lines/devices:
 * { periodKey: totalEnterpriseVolume }. Used by the archive chart overlay,
 * which shows one aggregate enterprise series across the selected lines.
 */
export function buildEnterpriseByPeriod(records, periodType) {
  const map = {};
  (records || []).forEach(entry => {
    const key = enterprisePeriodKey(entry.period, periodType);
    map[key] = (map[key] || 0) + enterpriseRecordTotal(entry);
  });
  return map;
}
