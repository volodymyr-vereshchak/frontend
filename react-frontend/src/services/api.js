class APIError extends Error {
  constructor(message, status = null, url = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.url = url;
  }
}

class ApiClient {
  constructor() {
    this.baseUrl = 'http://localhost:8000';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
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
        console.log(`Making ${requestOptions.method || 'GET'} request to ${url} (attempt ${attempt})`);

        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          throw new APIError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            url
          );
        }

        const data = await response.json();
        console.log(`Successful request to ${url}`, data);
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

// Combined data processing (replicating Python logic)
export const dataApi = {
  async getLines() {
    try {
      console.log('Fetching lines and gas volume data...');

      // Fetch both datasets
      const [linesData, gasVolumeData] = await Promise.all([
        lineApi.getLinesByLumg(),
        gasVolumeApi.getGasVolumesByLumg()
      ]);

      console.log('Lines data:', linesData);
      console.log('Gas volume data:', gasVolumeData);

      if (!linesData && !gasVolumeData) {
        console.warn('No data received from both LineAPI and GasVolumeAPI');
        return [];
      }

      if (!linesData) {
        console.warn('No line data available');
        return [];
      }

      if (!gasVolumeData) {
        console.warn('No gas volume data available, returning line data only');
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

      console.log('Successfully merged data:', mergedData);
      return mergedData;

    } catch (error) {
      console.error('Error in getLines:', error);
      return [];
    }
  }
};

export default apiClient;