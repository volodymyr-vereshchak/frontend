// Commercial-day semantics for gas metering.
//
// A commercial day runs CONTRACT_HOUR → CONTRACT_HOUR (next calendar day), e.g.
// 07:00 → 07:00, NOT 00:00 → 00:00. So commercial day D spans
// [D CONTRACT_HOUR:00, (D+1) CONTRACT_HOUR:00); its hourly records run from
// D CONTRACT_HOUR:00 to (D+1) (CONTRACT_HOUR-1):00 (last record one hour before).
//
// Consequence: the early hours 00:00..(CONTRACT_HOUR-1) of calendar date C belong
// to the PREVIOUS commercial day (C-1). E.g. with 07:00: 30.05 05:00 → 29.05.
//
// CONTRACT_HOUR is a GLOBAL project setting served by the backend (GET /config →
// window.APP_CONFIG.GRS_CONFIG.CONTRACT_HOUR, env CONTRACT_HOUR). Read DYNAMICALLY
// because the runtime config loads after this module is first imported.

import { grsConfig } from '../config/grsConfig.js';

// Resolve the contract hour at call time: runtime config (from /config) first,
// then the build-time default in grsConfig, then 7.
export function getContractHour() {
  const runtime = typeof window !== 'undefined' && window.APP_CONFIG?.GRS_CONFIG?.CONTRACT_HOUR;
  if (Number.isInteger(runtime)) return runtime;
  if (Number.isInteger(grsConfig.CONTRACT_HOUR)) return grsConfig.CONTRACT_HOUR;
  return 7;
}

const pad = (n) => String(n).padStart(2, '0');

// Add `delta` days to a 'YYYY-MM-DD' string using pure UTC math (no timezone/DST).
export function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Map a selected inclusive date range [fromDate, toDate] (commercial days) to the
// hourly datetime range covering them: [fromDate CONTRACT_HOUR:00, (toDate+1) (CONTRACT_HOUR-1):00].
// Example (CONTRACT_HOUR=7): ['2026-05-01','2026-05-03'] → { from:'2026-05-01T07:00:00', to:'2026-05-04T06:00:00' }
export function commercialHourlyRange(fromDate, toDate) {
  const h = getContractHour();
  const endHour = h - 1; // last hourly record of the commercial day
  return {
    from: `${fromDate}T${pad(h)}:00:00`,
    to: `${addDays(toDate, 1)}T${pad(endHour)}:00:00`,
  };
}

// The commercial day (YYYY-MM-DD) that a calendar date + hour belongs to.
// Hours below CONTRACT_HOUR → previous day; CONTRACT_HOUR+ → same day.
// Example (CONTRACT_HOUR=7): commercialDayOf('2026-05-30', 5) → '2026-05-29'
export function commercialDayOf(dateStr, hour) {
  return hour < getContractHour() ? addDays(dateStr, -1) : dateStr;
}
