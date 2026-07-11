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
// v4: v3 entries were zero-poisoned by summing the devices array, which
// include_devices=false responses no longer carry — bump invalidates them.
const PREFIX = 'ent4_';
const BUDGET_BYTES = 3 * 1024 * 1024; // 3 MB UTF-16 (out of ~5 MB Chrome quota)
const ALL_PREFIXES = ['ent4_', 'ent3_', 'ent2_', 'ent_']; // older — legacy, evicted naturally as oldest

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeKey(periodType, lineId, period) {
  const t = periodType === 'hourly' ? 'h' : 'd';
  return `${PREFIX}${t}_${lineId}_${period}`;
}

// Shift a 'YYYY-MM-DD' string by `delta` days (pure UTC math, no timezone/DST).
function shiftDateStr(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function entrySize(key, value) {
  return ((key?.length || 0) + (value?.length || 0)) * 2;
}

/** Sum of all enterprise cache entries in UTF-16 bytes */
export function getCacheSize() {
  let total = 0;
  for (const key of Object.keys(localStorage)) {
    if (!ALL_PREFIXES.some(p => key.startsWith(p))) continue;
    total += entrySize(key, localStorage.getItem(key));
  }
  return total;
}

/**
 * Evict oldest enterprise cache entries (by write ts) until total size ≤ targetBytes.
 * Corrupt JSON entries are removed unconditionally.
 */
export function enforceCacheBudget(targetBytes = BUDGET_BYTES) {
  const entries = [];
  let total = 0;
  for (const key of Object.keys(localStorage)) {
    if (!ALL_PREFIXES.some(p => key.startsWith(p))) continue;
    const value = localStorage.getItem(key);
    if (value === null) continue;
    try {
      const parsed = JSON.parse(value);
      const size = entrySize(key, value);
      entries.push({ key, ts: parsed?.ts || 0, size });
      total += size;
    } catch {
      localStorage.removeItem(key);
    }
  }
  if (total <= targetBytes) return;
  entries.sort((a, b) => a.ts - b.ts);
  for (const e of entries) {
    if (total <= targetBytes) break;
    localStorage.removeItem(e.key);
    total -= e.size;
  }
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
  const value = JSON.stringify({ ts: Date.now(), data });
  try {
    localStorage.setItem(key, value);
    return;
  } catch {}
  cleanExpired();
  try {
    localStorage.setItem(key, value);
    return;
  } catch {}
  enforceCacheBudget(Math.max(0, BUDGET_BYTES - entrySize(key, value)));
  try {
    localStorage.setItem(key, value);
  } catch {
    console.warn('[EnterpriseCache] Failed to cache entry after eviction:', key);
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

/** Remove expired entries and whole legacy-version caches. Call on app startup. */
export function cleanExpired() {
  for (const key of Object.keys(localStorage)) {
    if (!ALL_PREFIXES.some(p => key.startsWith(p))) continue;
    if (!key.startsWith(PREFIX)) {
      localStorage.removeItem(key); // an older cache version — drop entirely
      continue;
    }
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
    .filter(k => ALL_PREFIXES.some(p => k.startsWith(p)))
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
 * @param {Function} fetchFn    - async (lineIds, fromDate, toDate, periodType, onProgress?) => record[]
 * @param {Function} [onProgress] - poll progress callback ({done,total,phase});
 *                                  forwarded to fetchFn, fires only on cache miss
 * @returns {Promise<Array>}    - same structure as raw API response
 */
export async function getEnterpriseWithCache(lineIds, fromDate, toDate, periodType, fetchFn, onProgress) {
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
      } else if (cached !== null) {
        // Cached value is a number (total volume, current format)
        // or legacy devices array — both emit a synthetic record for the chart overlay.
        const vol = typeof cached === 'number'
          ? cached
          : Array.isArray(cached) ? cached.reduce((s, d) => s + (d.volume || 0), 0) : 0;
        cachedRecords.push({ line_id: lineId, period, devices: [{ volume: vol }] });
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
  const firstDate = allMissingPeriods[0].slice(0, 10);
  // Enterprise (DPD) data is commercial-day aligned: from_date=D returns periods
  // starting at D 07:00, so a date's 00:00–06:00 hours belong to the PREVIOUS
  // commercial day. For hourly, fetch one day earlier to cover the first date's
  // early hours — otherwise they'd be wrongly cached as "no data" (null).
  const fetchFrom = periodType === 'hourly' ? shiftDateStr(firstDate, -1) : firstDate;
  const fetchTo   = allMissingPeriods[allMissingPeriods.length - 1].slice(0, 10);

  console.log(
    `[EnterpriseCache] Miss: ${missingLines.length} lines, ${allMissingPeriods.length} periods` +
    ` (${fetchFrom} → ${fetchTo})`
  );

  // ── 3. Fetch from API ───────────────────────────────────────────────────────
  let freshData = [];
  try {
    freshData = await fetchFn(missingLines, fetchFrom, fetchTo, periodType, onProgress) || [];
  } catch (err) {
    console.error('[EnterpriseCache] Fetch error:', err);
    return cachedRecords; // return what we have
  }

  // ── 4. Build lookup from fresh data ────────────────────────────────────────
  const freshLookup = {}; // lineId → { normalizedPeriod → total volume }
  for (const record of freshData) {
    const lid = record.line_id;
    const pk  = normalizePeriod(record.period, periodType);
    if (!freshLookup[lid]) freshLookup[lid] = {};
    // Strictly total_volume — the API always provides it. Summing the devices
    // array is forbidden here: include_devices=false responses carry it empty
    // (summing cached zeros for every period — the v3 poisoning). A record
    // without total_volume ends up cached as null ("no data").
    freshLookup[lid][pk] = record.total_volume ?? null;
  }

  // ── 5. Greedy write: newest periods first; evict oldest existing on demand ─
  const writeQueue = [];
  const writeKeys = new Set();
  for (const lineId of missingLines) {
    for (const period of missingByLine[lineId]) {
      const totalVol = freshLookup[lineId]?.[period];
      const key = makeKey(periodType, lineId, period);
      // Store only total volume (number) instead of full devices array.
      // Reduces cache size by ~100x (300 devices × N periods fits in 3 MB now).
      writeQueue.push({ key, data: totalVol !== undefined ? totalVol : null, period });
      writeKeys.add(key);
    }
  }
  writeQueue.sort((a, b) => b.period.localeCompare(a.period));

  // Build eviction queue from existing entries (oldest ts first), excluding
  // keys we're about to overwrite.
  const evictable = [];
  let currentSize = 0;
  for (const k of Object.keys(localStorage)) {
    if (!ALL_PREFIXES.some(p => k.startsWith(p))) continue;
    const v = localStorage.getItem(k);
    if (v === null) continue;
    const sz = entrySize(k, v);
    currentSize += sz;
    if (writeKeys.has(k)) continue; // will be overwritten anyway
    try {
      const parsed = JSON.parse(v);
      evictable.push({ key: k, ts: parsed?.ts || 0, size: sz });
    } catch {
      localStorage.removeItem(k);
      currentSize -= sz;
    }
  }
  evictable.sort((a, b) => a.ts - b.ts); // oldest first

  let cached = 0, skipped = 0;
  for (const { key, data } of writeQueue) {
    const value = JSON.stringify({ ts: Date.now(), data });
    const size = entrySize(key, value);

    // Evict oldest existing entries until incoming entry fits
    while (currentSize + size > BUDGET_BYTES && evictable.length > 0) {
      const old = evictable.shift();
      localStorage.removeItem(old.key);
      currentSize -= old.size;
    }

    if (currentSize + size > BUDGET_BYTES) {
      skipped++;
      continue;
    }
    try {
      localStorage.setItem(key, value);
      currentSize += size;
      cached++;
    } catch {
      skipped++;
    }
  }
  if (skipped > 0) {
    console.warn(
      `[EnterpriseCache] Cached ${cached}/${cached + skipped} entries ` +
      `(${skipped} skipped — over budget ${(BUDGET_BYTES / 1024 / 1024).toFixed(1)} MB)`
    );
  }

  // ── 6. Merge and return ────────────────────────────────────────────────────
  return [...cachedRecords, ...freshData];
}
