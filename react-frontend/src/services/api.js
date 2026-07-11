import { grsConfig } from '../config/grsConfig.js';

class APIError extends Error {
  constructor(message, status = null, url = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.url = url;
  }
}

const DEFAULT_API_URL = '/api';

// ── Per-endpoint request timeouts ──────────────────────────────────────────
// A stalled TCP connection (flaky network) and a slow backend look identical to
// fetch() — both are just "no response yet". So we keep generous timeouts for
// genuinely heavy work (DPD enterprise data, reports) and only fail fast on
// trivial/hot metadata endpoints, where anything past a few seconds means a
// dead connection, not real work — letting the idempotent retry reconnect.
const TIMEOUT_DPD = 610000;     // enterprise DPD polls — just above nginx's 600s,
                                // so the server (not the browser) produces the error
const TIMEOUT_HEAVY = 120000;   // report generation
const TIMEOUT_LIGHT = 12000;    // instant, high-frequency metadata/config
const TIMEOUT_DEFAULT = 30000;  // archive data queries (daily/hourly/counts/…)

function timeoutForEndpoint(endpoint) {
  if (/^\/enterprise\/volumes/.test(endpoint)) return TIMEOUT_DPD;
  if (/^\/get_report/.test(endpoint)) return TIMEOUT_HEAVY;
  if (/^\/(auth|config|lines|virtual_lines)/.test(endpoint)) return TIMEOUT_LIGHT;
  return TIMEOUT_DEFAULT;
}

// Enterprise volume fetches fan out into hundreds of DPD requests server-side.
// Auto-retrying one of these on a 5xx/timeout multiplies that load (each retry
// launched a fresh full DPD poll — the duplicate storm of 2026-07) and never
// helped: a poll that just failed after minutes will fail again. One attempt;
// the user decides whether to retry from the UI.
function retriesForEndpoint(endpoint, maxRetries) {
  return /^\/enterprise\/volumes/.test(endpoint) ? 1 : maxRetries;
}

// ── Session-expiry handling ────────────────────────────────────────────────
// When any request comes back 401 the session has expired (JWT cookie gone).
// We first try one transparent re-auth via /auth/me — under AUTO_LOGIN the
// backend re-mints the cookie, so the original request can be replayed and the
// user never notices. If re-auth fails the user is truly logged out and we
// notify the app (UserContext) to drop to the login screen.
let _onSessionLost = null;   // () => void, registered by UserContext
let _reauthPromise = null;   // de-dupes concurrent re-auth attempts

export function setSessionHandlers({ onSessionLost } = {}) {
  _onSessionLost = onSessionLost || null;
}

async function _tryReauth(baseUrl) {
  if (!_reauthPromise) {
    _reauthPromise = fetch(`${baseUrl}/auth/me`, { credentials: 'include' })
      .then(r => r.ok)
      .catch(() => false)
      .finally(() => { _reauthPromise = null; });
  }
  return _reauthPromise;
}

class ApiClient {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  get baseUrl() {
    // Динамически получаем URL при каждом запросе
    return (window.APP_CONFIG && window.APP_CONFIG.API_URL) || import.meta.env.VITE_API_URL || DEFAULT_API_URL;
  }

  async _makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const { timeout: timeoutOpt, headers, _reauthTried = false, ...rest } = options;
    // Endpoint-derived timeout unless the caller passed an explicit one.
    const timeout = timeoutOpt ?? timeoutForEndpoint(endpoint);
    const maxRetries = retriesForEndpoint(endpoint, this.maxRetries);
    const method = (rest.method || 'GET').toUpperCase();
    // Only idempotent methods are safe to retry on network/5xx errors.
    // POST/PATCH are NOT retried — a network blip after the server already
    // processed the request would otherwise cause a duplicate submission.
    const isIdempotent = method === 'GET' || method === 'PUT' || method === 'DELETE' || method === 'HEAD';

    const requestOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        ...(headers || {}),
      },
      credentials: 'include',
      mode: 'cors',
      ...rest,
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Real per-request timeout: native fetch ignores a `timeout` option, so we
      // enforce it with an AbortController — otherwise a hung request never ends.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...requestOptions, signal: controller.signal });
        clearTimeout(timer);

        if (!response.ok) {
          // Session expired → try one transparent re-auth, then replay the
          // request once. /auth/* endpoints are excluded to avoid a loop.
          if (response.status === 401 && !endpoint.startsWith('/auth/')) {
            if (!_reauthTried && await _tryReauth(this.baseUrl)) {
              clearTimeout(timer);
              return await this._makeRequest(endpoint, { ...options, _reauthTried: true });
            }
            // Re-auth failed, or the replay was still unauthorized → logged out.
            if (_onSessionLost) _onSessionLost();
          }

          let detail = response.statusText;
          try {
            const body = await response.json();
            if (body.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
          } catch (_) {}
          throw new APIError(detail, response.status, url);
        }

        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return true;
        }
        return await response.json();

      } catch (error) {
        clearTimeout(timer);

        // Never retry client errors (4xx) — re-throw immediately
        if (error instanceof APIError && error.status >= 400 && error.status < 500) {
          throw error;
        }

        const isTimeout = error.name === 'AbortError';
        const canRetry = isIdempotent && attempt < maxRetries;

        if (!canRetry) {
          if (isTimeout) throw new APIError(`Request timed out after ${timeout}ms`, null, url);
          if (error instanceof APIError) throw error;
          if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
            throw new APIError(`Connection failed - check if backend is running: ${error.message}`, null, url);
          }
          if (error.message && error.message.includes('CORS')) {
            throw new APIError(`CORS error - check backend CORS settings: ${error.message}`, null, url);
          }
          throw new APIError(`Request failed: ${error.message || error}`, null, url);
        }

        console.warn(`Request attempt ${attempt} failed (${method} ${endpoint}), retrying:`, error.message || error);
        // Exponential backoff (only for idempotent network/5xx/timeout errors)
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  async get(endpoint, params = null) {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, v));
          } else {
            searchParams.append(key, value);
          }
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    return await this._makeRequest(url, { method: 'GET' });
  }

  async post(endpoint, data = null) {
    const options = { method: 'POST' };
    if (data) options.body = JSON.stringify(data);
    return await this._makeRequest(endpoint, options);
  }

  async put(endpoint, data = null) {
    try {
      const options = { method: 'PUT' };
      if (data) {
        options.body = JSON.stringify(data);
      }
      return await this._makeRequest(endpoint, options);
    } catch (error) {
      console.error(`API PUT error for ${endpoint}:`, error);
      return null;
    }
  }

  async patch(endpoint, data = null) {
    const options = { method: 'PATCH' };
    if (data) options.body = JSON.stringify(data);
    return await this._makeRequest(endpoint, options);
  }

  async delete(endpoint) {
    try {
      return await this._makeRequest(endpoint, { method: 'DELETE' });
    } catch (error) {
      console.error(`API DELETE error for ${endpoint}:`, error);
      return null;
    }
  }

  async getMe() {
    return await this._makeRequest('/auth/me', { method: 'GET' });
  }

  async login(username, password, rememberMe = false) {
    return await this._makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, remember_me: rememberMe }),
    });
  }

  async logout() {
    return await this._makeRequest('/auth/logout', { method: 'POST' });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export const authApi = {
  me:     ()                              => apiClient.getMe(),
  login:  (username, password, remember)  => apiClient.login(username, password, remember),
  logout: ()                              => apiClient.logout(),
};

// Line API methods
export const lineApi = {
  async getLinesByLumg(lumgId = 1) {
    return await apiClient.get('/lines/', { lumg_id: lumgId });
  },
  getAll:    ()           => apiClient.get('/lines/'),
  create:    (data)       => apiClient.post('/lines/', data),
  update:    (id, data)   => apiClient.patch(`/lines/${id}`, data),
  delete:    (id)         => apiClient.delete(`/lines/${id}`),
};

// Update API methods
export const updateApi = {
  updateAll:    ()              => apiClient.post('/update_data/'),
  updateLumg:   (id)            => apiClient.post(`/update_data/${id}`),
  updateDirect: (lumg_id, path) => apiClient.post('/update_data/direct', { lumg_id, path }),
  getStatus:    ()              => apiClient.get('/update_data/status'),
  resetStatus:  ()              => apiClient.post('/update_data/reset'),
};

// Gas Volume Calculation API methods
export const gasVolumeApi = {
  async getGasVolumesByLumg(lumgId = 1) {
    return await apiClient.get('/gas-volume-calcs/', { lumg_id: lumgId });
  },
  async getGasVolumeCalcs() {
    return await apiClient.get('/gas-volume-calcs/');
  },
  create: (data)     => apiClient.post('/gas-volume-calcs/', data),
  update: (id, data) => apiClient.patch(`/gas-volume-calcs/${id}`, data),
  delete: (id)       => apiClient.delete(`/gas-volume-calcs/${id}`),
};

// Archive counts API methods (И - changes, А - alarms)
export const archiveCountsApi = {
  async getEditCounts(lineIds, fromDate, toDate) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate
    };
    return await apiClient.get('/edit_counts/', params);
  },

  async getSysCounts(lineIds, fromDate, toDate) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate
    };
    return await apiClient.get('/sys_counts/', params);
  }
};

// Edit Archive API methods (detailed intervention data)
export const editArchiveApi = {
  // Full list — used by exports and any caller that needs every row.
  async getEditData(lineIds, fromDate, toDate) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate
    };
    return await apiClient.get('/edit/', params);
  },
  // Server-side paginated page — returns { total, items }.
  async getEditDataPaged(lineIds, fromDate, toDate, { skip = 0, limit = 50, orderBy = 'period', orderDir = 'asc' } = {}) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate,
      skip,
      limit,
      order_by: orderBy,
      order_dir: orderDir,
    };
    return await apiClient.get('/edit/paged/', params);
  }
};

// Sys (alarms) Archive API methods
export const sysArchiveApi = {
  // Full list — used by exports and any caller that needs every row.
  async getSysData(lineIds, fromDate, toDate) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate
    };
    return await apiClient.get('/sys/', params);
  },
  // Server-side paginated page — returns { total, items }.
  async getSysDataPaged(lineIds, fromDate, toDate, { skip = 0, limit = 50, orderBy = 'period', orderDir = 'asc' } = {}) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate,
      skip,
      limit,
      order_by: orderBy,
      order_dir: orderDir,
    };
    return await apiClient.get('/sys/paged/', params);
  }
};


// Archive data API methods
export const archiveDataApi = {
  async getDailyData(lineIds, fromDate, toDate) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate
    };
    return await apiClient.get('/daily/', params);
  },

  async getHourlyData(lineIds, fromDate, toDate) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate
    };
    return await apiClient.get('/hourly/', params);
  },

  async getLastPeriod(lineIds = []) {
    const params = lineIds.length ? { line_id: lineIds } : {};
    const result = await apiClient.get('/hourly_last_period/', params);
    return result?.last_period ? new Date(result.last_period) : null;
  },

  async getHourlyDataLast24h(lineIds = grsConfig.LINES_IDS) {
    try {
      // Use last available period for these specific lines as anchor
      const lastPeriod = await this.getLastPeriod(lineIds);
      const anchor = lastPeriod || new Date();
      // +2 days buffer: toISOString() is UTC, so +1h can still land on the same UTC date
      // for timezones UTC+3 and later. Use +2 days to guarantee endDate > anchor's local day.
      const endDate = new Date(anchor.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      // 3 days back: covers current 24h + previous 24h + buffer
      const startDate = new Date(anchor.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const result = await this.getHourlyData(lineIds, startDate, endDate);
      return (result && result.length > 0) ? result : [];
    } catch (error) {
      console.error('Error in getHourlyDataLast24h:', error);
      return null;
    }
  }
};

// Parameter archive API methods
export const paramArchiveApi = {
  async getParamsForLines(lineIds) {
    if (!lineIds || lineIds.length === 0) return [];
    try {
      const result = await apiClient.get('/param/', { line_id: lineIds });
      return Array.isArray(result) ? result : [];
    } catch (err) {
      console.warn('Failed to load params:', err);
      return [];
    }
  }
};

// Enterprise volume API methods
export const enterpriseApi = {
  async getEnterpriseVolumes(lineIds, fromDate, toDate, periodType = 'daily') {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate,
      period_type: periodType
    };
    return await apiClient.get('/enterprise/volumes/', params);
  },

  async getAllEnterprises() {
    return await apiClient.get('/enterprise/mappings/');
  },

  // Admin only (any DELETE requires the admin role server-side)
  clearDpdCache: () => apiClient.delete('/enterprise/cache/'),

  // DB CRUD
  getAll:   ()           => apiClient.get('/enterprise-mappings/'),
  create:   (data)       => apiClient.post('/enterprise-mappings/', data),
  update:   (id, data)   => apiClient.patch(`/enterprise-mappings/${id}`, data),
  delete:   (id)         => apiClient.delete(`/enterprise-mappings/${id}`),

  // Excel template download
  downloadTemplate() {
    const base = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || import.meta.env.VITE_API_URL || '';
    window.open(`${base}/enterprise-mappings/template`, '_blank');
  },

  // Export current DB data to Excel
  downloadExport() {
    const base = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || import.meta.env.VITE_API_URL || '';
    window.open(`${base}/enterprise-mappings/export`, '_blank');
  },

  // Excel upload (multipart)
  async uploadExcel(file, branchId) {
    const base = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || import.meta.env.VITE_API_URL || '';
    const formData = new FormData();
    formData.append('file', file);
    const url = branchId
      ? `${base}/enterprise-mappings/upload?branch_id=${branchId}`
      : `${base}/enterprise-mappings/upload`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
    }
    return response.json();
  },
};

// Device catalog API (manufacturers + corrector types)
export const deviceCatalogApi = {
  // Manufacturers
  getManufacturers:      ()           => apiClient.get('/device-catalog/manufacturers/'),
  createManufacturer:    (data)       => apiClient.post('/device-catalog/manufacturers/', data),
  updateManufacturer:    (id, data)   => apiClient.patch(`/device-catalog/manufacturers/${id}`, data),
  deleteManufacturer:    (id)         => apiClient.delete(`/device-catalog/manufacturers/${id}`),
  // Corrector types
  getCorectorTypes:      (mfr_id)     => apiClient.get('/device-catalog/corector-types/', mfr_id ? { manufacturer_id: mfr_id } : {}),
  createCorectorType:    (data)       => apiClient.post('/device-catalog/corector-types/', data),
  updateCorectorType:    (id, data)   => apiClient.patch(`/device-catalog/corector-types/${id}`, data),
  deleteCorectorType:    (id)         => apiClient.delete(`/device-catalog/corector-types/${id}`),
  // Preload
  preload:               (force = false) => apiClient.post(`/device-catalog/preload?force=${force}`),
  exportPreload:         ()           => apiClient.post('/device-catalog/export-preload'),
};

// Admin: Calc types API
export const calcTypeApi = {
  getAll:        ()           => apiClient.get('/gas-volume-calc-types/'),
  create:        (data)       => apiClient.post('/gas-volume-calc-types/', data),
  update:        (id, data)   => apiClient.patch(`/gas-volume-calc-types/${id}`, data),
  delete:        (id)         => apiClient.delete(`/gas-volume-calc-types/${id}`),
  exportPreload: ()           => apiClient.post('/gas-volume-calc-types/export-preload'),
};

// Admin: SysType API
export const sysTypeApi = {
  getAll:  ({ calcTypeId, search, skip = 0, limit = 50 } = {}) => {
    const p = new URLSearchParams({ skip, limit });
    if (calcTypeId) p.set('calc_type_id', calcTypeId);
    if (search)     p.set('search', search);
    return apiClient.get(`/sys-types/?${p}`);
  },
  create:  (data)       => apiClient.post('/sys-types/', data),
  update:  (id, data)   => apiClient.patch(`/sys-types/${id}`, data),
  delete:  (id)         => apiClient.delete(`/sys-types/${id}`),
};

// Admin: EditType API
export const editTypeApi = {
  getAll:  ({ calcTypeId, search, skip = 0, limit = 50 } = {}) => {
    const p = new URLSearchParams({ skip, limit });
    if (calcTypeId) p.set('calc_type_id', calcTypeId);
    if (search)     p.set('search', search);
    return apiClient.get(`/edit-types/?${p}`);
  },
  create:  (data)       => apiClient.post('/edit-types/', data),
  update:  (id, data)   => apiClient.patch(`/edit-types/${id}`, data),
  delete:  (id)         => apiClient.delete(`/edit-types/${id}`),
};

// Enterprise Poll Analysis API methods
export const enterprisePollApi = {
  async getAllEnterprises() {
    return await apiClient.get('/enterprise/mappings/');
  },

  async pollEnterprise(lineIds, fromDate, toDate, periodType = 'daily') {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate,
      period_type: periodType
    };
    return await apiClient.get('/enterprise/volumes/', params);
  }
  ,

  async pollEnterpriseDevice(lineId, serNum, mfDev, typeDev, chNum, fromDate, toDate, periodType = 'daily') {
    const params = {
      serNum: serNum,
      mfDev: mfDev,
      typeDev: typeDev,
      chNum: chNum,
      from_date: fromDate,
      to_date: toDate,
      period_type: periodType
    };
    if (lineId != null) params.line_id = lineId;
    return await apiClient.get('/enterprise/volumes/', params);
  }
};

// Enterprise volumes over the NDJSON progress stream. Same data as the plain
// GET endpoints, but the backend emits progress events while the DPD poll
// runs, so long polls can show a real progress bar.
export const enterpriseStream = {
  /**
   * @param {object} params - { line_id?: number[], serNum?, mfDev?, typeDev?,
   *   chNum?, from_date, to_date, period_type, virtual?: boolean }
   * @param {object} [opts] - { onProgress?: ({done,total,phase}) => void,
   *   signal?: AbortSignal }
   * @returns {Promise<Array>} aggregated records (same shape as the plain GET)
   * @throws Error with `.fallback === true` when the stream transport itself
   *   failed before delivering a result — the caller should retry over the
   *   plain GET. In-band `error` events (DPD down etc.) throw WITHOUT the
   *   flag: the plain GET would fail the same way.
   */
  async fetchVolumes(params, { onProgress, signal, _reauthTried = false } = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (Array.isArray(value)) value.forEach(v => query.append(key, v));
      else query.append(key, value);
    });
    const url = `${apiClient.baseUrl}/enterprise/volumes/stream?${query}`;

    let response;
    try {
      response = await fetch(url, {
        credentials: 'include',
        mode: 'cors',
        signal,
        headers: { 'Accept': 'application/x-ndjson' },
      });
    } catch (err) {
      if (err.name !== 'AbortError') err.fallback = true;
      throw err;
    }
    // Session expired → one transparent re-auth + retry, mirroring apiClient.
    // Without this a 401 would silently degrade to the no-progress fallback.
    if (response.status === 401 && !_reauthTried && await _tryReauth(apiClient.baseUrl)) {
      return this.fetchVolumes(params, { onProgress, signal, _reauthTried: true });
    }
    if (!response.ok || !response.body) {
      const err = new Error(`Stream HTTP ${response.status}`);
      err.fallback = true;
      throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = null;

    const handleLine = (line) => {
      if (!line) return;
      let event;
      try { event = JSON.parse(line); } catch { return; }
      if (event.type === 'progress') {
        onProgress?.({ done: event.done, total: event.total, phase: 'polling' });
      } else if (event.type === 'status') {
        onProgress?.({ phase: event.phase });
      } else if (event.type === 'result') {
        result = event.data;
      } else if (event.type === 'error') {
        throw new Error(event.detail || 'Enterprise poll failed');
      }
      // ping events are ignored — they only keep the connection alive
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        handleLine(line);
      }
    }
    handleLine(buffer.trim());

    if (result === null) {
      const err = new Error('Stream ended without a result');
      err.fallback = true;
      throw err;
    }
    return result;
  },
};

// ========================================
// Virtual Lines API (with virtual lines support)
// ========================================

export const virtualLineApi = {
  getAll:   ()           => apiClient.get('/virtual_lines/'),
  create:   (data)       => apiClient.post('/virtual_lines/', data),
  update:   (id, data)   => apiClient.patch(`/virtual_lines/${id}`, data),
  delete:   (id)         => apiClient.delete(`/virtual_lines/${id}`),
};

export const virtualLinesApi = {
  async getVisibleLines() {
    return await apiClient.get('/virtual_lines/visible');
  },

  // Всі віртуальні лінії філії (опційно лише з include_in_trends)
  async getByBranch(branchId, { trendsOnly = false } = {}) {
    const params = { branch_id: branchId };
    if (trendsOnly) params.include_in_trends = true;
    return await apiClient.get('/virtual_lines/', params);
  }
};

export const archiveDataVirtualApi = {
  async getDailyDataVirtual(lineIds, fromDate, toDate) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate
    };
    return await apiClient.get('/daily_virtual/', params);
  },

  async getHourlyDataVirtual(lineIds, fromDate, toDate) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate
    };
    return await apiClient.get('/hourly_virtual/', params);
  }
};

export const enterpriseVirtualApi = {
  async getEnterpriseVolumesVirtual(lineIds, fromDate, toDate, periodType = 'daily') {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate,
      period_type: periodType
    };
    return await apiClient.get('/enterprise/volumes_virtual/', params);
  }
};

// Virtual lines helper utilities
export const virtualLinesHelper = {
  isVirtualLineObject(line) {
    return line && line.is_virtual === true;
  }
};

// Commercial day aggregation utilities
export const commercialDayUtils = {
  // Aggregate hourly counts to commercial days (07:00 to 06:00)
  aggregateEditCountsToCommercialDays(editCounts, lineIds = []) {
    return this.aggregateCountsToCommercialDays(editCounts, lineIds, 'edit_counts');
  },

  aggregateSysCountsToCommercialDays(sysCounts, lineIds = []) {
    return this.aggregateCountsToCommercialDays(sysCounts, lineIds, 'sys_counts');
  },

  aggregateCountsToCommercialDays(countsData, lineIds = [], countField) {
    if (!countsData || countsData.length === 0) return [];


    const commercialDays = {};

    countsData.forEach((record, index) => {
      try {
        // Handle different date formats - API returns hour_group instead of period
        let dateObj;
        const periodField = record.period || record.hour_group;

        if (typeof periodField === 'string') {
          dateObj = new Date(periodField);
        } else if (periodField instanceof Date) {
          dateObj = periodField;
        } else {
          return; // Skip this record
        }

        // Validate date
        if (isNaN(dateObj.getTime())) {
          return; // Skip this record
        }

        const hour = dateObj.getHours();

        // Determine commercial day date (as in Python: hour < 7 goes to previous day)
        let commercialDate;
        if (hour >= 7) {
          // After 07:00 - belongs to current day
          commercialDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        } else {
          // Before 07:00 - belongs to previous day
          commercialDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() - 1);
        }

        // Format as YYYY-MM-DD
        const year = commercialDate.getFullYear();
        const month = String(commercialDate.getMonth() + 1).padStart(2, '0');
        const day = String(commercialDate.getDate()).padStart(2, '0');
        const commercialDateStr = `${year}-${month}-${day}`;

        // line_id нет в API ответе, используем переданные lineIds
        const lineId = record.line_id || (lineIds.length > 0 ? lineIds[0] : 1);
        const key = `${lineId}_${commercialDateStr}`;

        if (!commercialDays[key]) {
          commercialDays[key] = {
            line_id: lineId,
            period: commercialDateStr,
            [countField]: 0
          };
        }

        // API возвращает record_count, переименовываем как в Python
        const countValue = record.record_count || 0;
        commercialDays[key][countField] += countValue;

      } catch (error) {
      }
    });

    return Object.values(commercialDays);
  }
};

// GRS Report API methods
export const reportsApi = {
  async getGRSReport() {
    return await apiClient.get('/get_report/');
  },

  async getGRSReportData() {
    // Get structured data for GRS report calculation
    try {
      const [linesData, hourlyData] = await Promise.all([
        lineApi.getLinesByLumg(1),
        archiveDataApi.getHourlyDataLast24h()
      ]);

      return {
        lines: linesData || [],
        hourlyData: hourlyData || [],
        success: true
      };
    } catch (error) {
      console.error('Error fetching GRS report data:', error);
      return { success: false, error: error.message };
    }
  }
};

// Combined data processing (replicating Python logic)
export const dataApi = {
  async getLines() {
    try {

      // Fetch both datasets
      const [linesData, gasVolumeData] = await Promise.all([
        lineApi.getLinesByLumg(),
        gasVolumeApi.getGasVolumesByLumg()
      ]);


      if (!linesData && !gasVolumeData) {
        return [];
      }

      if (!linesData) {
        return [];
      }

      if (!gasVolumeData) {
        return linesData;
      }

      // Merge data (replicating pandas merge logic)
      const mergedData = [];

      // Create lookup map for gas volume data
      const gasVolumeMap = {};
      gasVolumeData.forEach(gv => {
        gasVolumeMap[gv.id] = {
          ...gv,
          name_gas_volume: gv.name,
          flow_id: gv.id
        };
      });

      // Merge lines with gas volume data
      linesData.forEach(line => {
        const gasVolume = gasVolumeMap[line.gas_volume_calc_id];
        mergedData.push({
          ...line,
          ...(gasVolume || {}),
          name_gas_volume: gasVolume?.name_gas_volume || null,
          flow_id: gasVolume?.flow_id || null
        });
      });

      // Sort by address (desc) and line (asc) - replicating pandas sort_values
      mergedData.sort((a, b) => {
        if (a.address !== b.address) {
          return (b.address || 0) - (a.address || 0); // descending
        }
        return (a.line || 0) - (b.line || 0); // ascending
      });

      return mergedData;

    } catch (error) {
      console.error('Error in getLines:', error);
      return [];
    }
  },

  async getGasVolumeCalcs() {
    try {
      return await apiClient.get('/gas-volume-calcs/');
    } catch (error) {
      console.error('Error in getGasVolumeCalcs:', error);
      return [];
    }
  }
};

// Admin: Branch API
export const branchApi = {
  getAll:         ()           => apiClient.get('/grmu_branch/'),
  create:         (data)       => apiClient.post('/grmu_branch/', data),
  update:         (id, data)   => apiClient.patch(`/grmu_branch/${id}`, data),
  delete:         (id)         => apiClient.delete(`/grmu_branch/${id}`),
  getConfigPath:      (id)         => apiClient.get(`/grmu_branch/${id}/data-path`),
  setConfigPath:      (id, data)   => apiClient.put(`/grmu_branch/${id}/data-path`, data),
  deleteConfigPath:   (id)         => apiClient.delete(`/grmu_branch/${id}/data-path`),
  previewConfig:      (id)         => apiClient.get(`/grmu_branch/${id}/config-preview`),
  getConfigMappings:  (id)         => apiClient.get(`/grmu_branch/${id}/config-mappings`),
  setConfigMappings:  (id, data)   => apiClient.put(`/grmu_branch/${id}/config-mappings`, data),
  updateNames:        (id)         => apiClient.post(`/grmu_branch/${id}/update-names`),
};

// Admin: DPD Global Config API (api_base_url, auth_url, timeout_sec — same for all branches)
export const dpdGlobalConfigApi = {
  get:    ()     => apiClient.get('/grmu_branch/dpd-config'),
  upsert: (data) => apiClient.put('/grmu_branch/dpd-config', data),
};

// Admin: DPD Credentials API (username/password — per branch)
export const dpdCredentialApi = {
  get:    (branchId)       => apiClient.get(`/grmu_branch/${branchId}/dpd-credential`),
  upsert: (branchId, data) => apiClient.put(`/grmu_branch/${branchId}/dpd-credential`, data),
  delete: (branchId)       => apiClient.delete(`/grmu_branch/${branchId}/dpd-credential`),
};

// Admin: Lumg API
export const lumgApi = {
  getAll:         ()           => apiClient.get('/lumgs/'),
  create:         (data)       => apiClient.post('/lumgs/', data),
  update:         (id, data)   => apiClient.patch(`/lumgs/${id}`, data),
  delete:         (id)         => apiClient.delete(`/lumgs/${id}`),
  getDataPath:    (id)         => apiClient.get(`/lumgs/${id}/data-path`),
  setDataPath:    (id, data)   => apiClient.put(`/lumgs/${id}/data-path`, data),
  deleteDataPath: (id)         => apiClient.delete(`/lumgs/${id}/data-path`),
  getEisCodes:    (id)         => apiClient.get(`/lumgs/${id}/eis-codes`),
  addEisCode:     (id, data)   => apiClient.post(`/lumgs/${id}/eis-codes`, data),
  deleteEisCode:  (id, code)   => apiClient.delete(`/lumgs/${id}/eis-codes/${encodeURIComponent(code)}`),
  scanEis:        (id)         => apiClient.get(`/lumgs/${id}/scan-eis`),
};

// Admin: User management API
export const userManagementApi = {
  getAll:        ()              => apiClient.get('/auth/users'),
  create:        (data)          => apiClient.post('/auth/users', data),
  update:        (id, data)      => apiClient.patch(`/auth/users/${id}`, data),
  resetPassword: (id)            => apiClient.post(`/auth/users/${id}/reset-password`),
  remove:        (id)            => apiClient.delete(`/auth/users/${id}`),
};

export default apiClient;