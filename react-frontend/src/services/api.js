import { grsConfig } from '../config/grsConfig.js';

class APIError extends Error {
  constructor(message, status = null, url = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.url = url;
  }
}

const DEFAULT_API_URL = '';

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
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip'
      },
      mode: 'cors',
      timeout: 30000
    };

    const requestOptions = { ...defaultOptions, ...options };


    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          throw new APIError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            url
          );
        }

        const data = await response.json();
        return data;

      } catch (error) {
        console.error(`Request attempt ${attempt} failed:`, error);
        console.error(`Error details:`, {
          name: error.name,
          message: error.message,
          stack: error.stack
        });

        if (attempt === this.maxRetries) {
          if (error instanceof APIError) {
            throw error;
          }

          if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
            throw new APIError(`Connection failed - check if backend is running: ${error.message}`, null, url);
          }

          if (error.message.includes('CORS')) {
            throw new APIError(`CORS error - check backend CORS settings: ${error.message}`, null, url);
          }

          throw new APIError(`Request failed after ${this.maxRetries} attempts: ${error.message}`, null, url);
        }

        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  async get(endpoint, params = null) {
    try {
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
    } catch (error) {
      console.error(`API GET error for ${endpoint}:`, error);
      return null;
    }
  }

  async post(endpoint, data = null) {
    try {
      const options = {
        method: 'POST'
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      return await this._makeRequest(endpoint, options);
    } catch (error) {
      console.error(`API POST error for ${endpoint}:`, error);
      return null;
    }
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Line API methods
export const lineApi = {
  async getLinesByLumg(lumgId = 1) {
    return await apiClient.get('/lines/', { lumg_id: lumgId });
  }
};

// Gas Volume Calculation API methods
export const gasVolumeApi = {
  async getGasVolumesByLumg(lumgId = 1) {
    return await apiClient.get('/gas-volume-calcs/', { lumg_id: lumgId });
  }
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
  async getEditData(lineIds, fromDate, toDate) {
    const params = {
      line_id: lineIds,
      from_date: fromDate,
      to_date: toDate
    };
    const data = await apiClient.get('/edit/', params);

    // Apply value conversion for old_value and new_value (int -> hex -> float)
    if (data && Array.isArray(data)) {
      return data.map(record => ({
        ...record,
        old_value: Number(convertIntToHexToFloat(record.old_value).toFixed(4)),
        new_value: Number(convertIntToHexToFloat(record.new_value).toFixed(4))
      }));
    }

    return data;
  }
};

// Value conversion function (replicate Python struct.unpack logic)
function convertIntToHexToFloat(intValue) {
  if (intValue === null || intValue === undefined) {
    return 0;
  }

  // Convert integer to 32-bit signed integer (equivalent to struct.pack("!i", value))
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  // Write as big-endian signed 32-bit integer
  view.setInt32(0, intValue, false); // false = big-endian

  // Read as big-endian 32-bit float (equivalent to struct.unpack("!f", ...))
  const floatValue = view.getFloat32(0, false); // false = big-endian

  return floatValue;
}

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

  async getHourlyDataLast24h() {
    try {
      // Get hourly data for last 24 hours (replicate Python logic)
      // Python: end = get_last_period(), start = end - timedelta(hours=23)

      const now = new Date();

      // Get broader range to ensure we have data - last 5 days to be safe
      // Use tomorrow as end date to include all of today's data
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const endDate = tomorrow.toISOString().split('T')[0]; // Tomorrow (2025-09-18)
      const startDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 5 days ago

      // Get data for all configured GRS lines
      const result = await this.getHourlyData(grsConfig.LINES_IDS, startDate, endDate);

      if (!result || result.length === 0) {
        return [];
      }

      // Find the last (most recent) period in the data that has actual data
      // Sort by period descending to get the latest first
      const sortedData = result.sort((a, b) => new Date(b.period) - new Date(a.period));

      // Look for the latest period that is not at 00:00 (midnight) as it might be incomplete
      let lastPeriod = null;
      for (let i = 0; i < Math.min(50, sortedData.length); i++) {
        const periodDate = new Date(sortedData[i].period);

        // Skip midnight hours (00:00) as they might be incomplete data
        if (periodDate.getHours() !== 0) {
          lastPeriod = periodDate;
          break;
        }
      }

      // If no non-midnight period found, use the actual last period
      if (!lastPeriod) {
        lastPeriod = new Date(sortedData[0].period);
      }

      // Calculate start period (23 hours before last period)
      const startPeriod = new Date(lastPeriod.getTime() - 23 * 60 * 60 * 1000);

      // Filter data to get exactly 24 hours (from startPeriod to lastPeriod inclusive)
      const filteredData = result.filter(record => {
        const recordDate = new Date(record.period);
        return recordDate >= startPeriod && recordDate <= lastPeriod;
      });

      return filteredData;
    } catch (error) {
      console.error('Error in getHourlyDataLast24h:', error);
      return null;
    }
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

export default apiClient;