/**
 * Enterprise data cache (localStorage, TTL 1 hour).
 *
 * Cache key format:
 *   ent_d_{lineId}_{YYYY-MM-DD}       — daily
 *   ent_h_{lineId}_{YYYY-MM-DDTHH}    — hourly
 *
 * Stored value: { ts: timestamp, data: DeviceVolume[] | null }
 *   null  = API returned no data for this line+period (cached absence, avoids re-fetch)
 *   array = device volumes
 */

const TTL = 60 * 60 * 1000; // 1 hour
const PREFIX = 'ent2_'; // v2: local-time keys (v1 used UTC, caused cache poisoning)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeKey(periodType, lineId, period) {
  const t = periodType === 'hourly' ? 'h' : 'd';
  return `${PREFIX}${t}_${lineId}_${period}`;
}

/** Normalize period string to cache key format (strip seconds, normalize T separator) */
function normalizePeriod(period, periodType) {
  const s = String(period).replace(' ', 'T');
  return periodType === 'hourly' ? s.slice(0, 13) : s.slice(0, 10);
}

function readEntry(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined; // not in cache
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > TTL) {
      localStorage.removeItem(key);
      return undefined; // expired
    }
    return entry.data; // DeviceVolume[] | null
  } catch {
    return undefined;
  }
}

function writeEntry(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // localStorage full — clean expired entries and retry once
    cleanExpired();
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // still full, skip caching silently
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate all period keys in [fromDate, toDate] for the given periodType.
 * fromDate / toDate can be full datetimes — only the date part is used.
 */
export function generatePeriods(fromDate, toDate, periodType) {
  const periods = [];
  const from = new Date(String(fromDate).slice(0, 10) + 'T00:00:00');
  const to   = new Date(String(toDate).slice(0, 10)   + 'T23:59:59');

  // Use local time helpers to avoid UTC offset shifting periods
  const localDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const localHour = (d) => `${localDate(d)}T${String(d.getHours()).padStart(2, '0')}`;

  if (periodType === 'hourly') {
    const cur = new Date(from);
    while (cur <= to) {
      periods.push(localHour(cur)); // YYYY-MM-DDTHH in local time
      cur.setHours(cur.getHours() + 1);
    }
  } else {
    const cur = new Date(from);
    while (cur <= to) {
      periods.push(localDate(cur)); // YYYY-MM-DD in local time
      cur.setDate(cur.getDate() + 1);
    }
  }
  return periods;
}

/** Remove all expired enterprise cache entries. Call on app startup. */
export function cleanExpired() {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key));
      if (!entry || Date.now() - entry.ts > TTL) localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Clear the entire enterprise cache and dispatch 'enterprise-cache-cleared'
 * so all listening components re-fetch their data immediately.
 */
export function clearEnterpriseCache() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX) || k.startsWith('ent_'))
    .forEach(k => localStorage.removeItem(k));
  window.dispatchEvent(new CustomEvent('enterprise-cache-cleared'));
}

/**
 * Fetch enterprise volumes with cache.
 *
 * - Checks cache for each (lineId × period) combination.
 * - Calls fetchFn only for lines/periods that are missing.
 * - Stores the API response (and null for periods with no data) back into cache.
 * - Returns merged result in the same format as the raw API response.
 *
 * @param {number[]} lineIds
 * @param {string}   fromDate   - YYYY-MM-DD (or datetime, date part used)
 * @param {string}   toDate     - YYYY-MM-DD (or datetime, date part used)
 * @param {string}   periodType - 'daily' | 'hourly'
 * @param {Function} fetchFn    - async (lineIds, fromDate, toDate, periodType) => record[]
 * @returns {Promise<Array>}    - same structure as raw API response
 */
export async function getEnterpriseWithCache(lineIds, fromDate, toDate, periodType, fetchFn) {
  const periods = generatePeriods(fromDate, toDate, periodType);
  const cachedRecords = [];
  const missingByLine = {}; // lineId → period[]

  // ── 1. Check cache ──────────────────────────────────────────────────────────
  for (const lineId of lineIds) {
    for (const period of periods) {
      const cached = readEntry(makeKey(periodType, lineId, period));
      if (cached === undefined) {
        if (!missingByLine[lineId]) missingByLine[lineId] = [];
        missingByLine[lineId].push(period);
      } else if (cached !== null && cached.length > 0) {
        cachedRecords.push({
          line_id: lineId,
          period,
          total_volume: cached.reduce((s, d) => s + (d.volume || 0), 0),
          device_count: cached.length,
          devices: cached,
        });
      }
      // cached === null → absence is cached, nothing to add
    }
  }

  const missingLines = Object.keys(missingByLine).map(Number);

  if (missingLines.length === 0) {
    console.log('[EnterpriseCache] Full cache hit');
    return cachedRecords;
  }

  // ── 2. Determine minimal fetch range ───────────────────────────────────────
  const allMissingPeriods = Object.values(missingByLine).flat().sort();
  const fetchFrom = allMissingPeriods[0].slice(0, 10);
  const fetchTo   = allMissingPeriods[allMissingPeriods.length - 1].slice(0, 10);

  console.log(
    `[EnterpriseCache] Miss: ${missingLines.length} lines, ${allMissingPeriods.length} periods` +
    ` (${fetchFrom} → ${fetchTo})`
  );

  // ── 3. Fetch from API ───────────────────────────────────────────────────────
  let freshData = [];
  try {
    freshData = await fetchFn(missingLines, fetchFrom, fetchTo, periodType) || [];
  } catch (err) {
    console.error('[EnterpriseCache] Fetch error:', err);
    return cachedRecords; // return what we have
  }

  // ── 4. Build lookup from fresh data ────────────────────────────────────────
  const freshLookup = {}; // lineId → { normalizedPeriod → devices[] }
  for (const record of freshData) {
    const lid = record.line_id;
    const pk  = normalizePeriod(record.period, periodType);
    if (!freshLookup[lid]) freshLookup[lid] = {};
    freshLookup[lid][pk] = record.devices || [];
  }

  // ── 5. Write to cache (data or null for each missing slot) ─────────────────
  for (const lineId of missingLines) {
    for (const period of missingByLine[lineId]) {
      const devices = freshLookup[lineId]?.[period];
      writeEntry(
        makeKey(periodType, lineId, period),
        devices !== undefined ? devices : null
      );
    }
  }

  // ── 6. Merge and return ────────────────────────────────────────────────────
  return [...cachedRecords, ...freshData];
}
