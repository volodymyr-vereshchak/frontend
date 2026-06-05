/**
 * Overview Calculator
 * Utility functions for calculating GRS overview metrics
 */

export class OverviewCalculator {
  /**
   * Format date for API (YYYY-MM-DD HH:00:00)
   */
  static formatDateForAPI(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:00:00`;
  }

  /**
   * Calculate total 24h volume for specified lines
   */
  static calculate24hTotal(data, lineIds) {
    if (!data || !Array.isArray(data)) return 0;

    const total = data
      .filter(record => lineIds.includes(record.line_id))
      .reduce((sum, record) => sum + (record.volume || 0), 0);

    // Round to 3 decimal places
    return Math.round(total * 1000) / 1000;
  }

  /**
   * Calculate comparison between current and previous values
   */
  static calculateComparison(current, previous) {
    const change = current - previous;
    const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

    return {
      current: Math.round(current * 1000) / 1000,
      previous: Math.round(previous * 1000) / 1000,
      change: Math.round(change * 1000) / 1000,
      changePercent: Math.round(changePercent * 10) / 10,
      isIncrease: change > 0,
      isDecrease: change < 0,
      isEqual: Math.abs(change) < 0.001
    };
  }

  /**
   * Calculate last hour flow comparison for each line
   */
  static calculateLastHourFlow(data, lineIds) {
    if (!Array.isArray(data) || !Array.isArray(lineIds)) return [];

    const results = [];

    for (const lineId of lineIds) {
      // Get records for this line, sorted by period descending
      const lineRecords = data
        .filter(record => record.line_id === lineId)
        .map(record => ({
          ...record,
          periodDate: new Date(record.period)
        }))
        .filter(record => !isNaN(record.periodDate.getTime()))
        .sort((a, b) => b.periodDate - a.periodDate);

      if (lineRecords.length < 2) {
        continue; // Not enough data
      }

      const lastHour = lineRecords[0].volume || 0;
      const previousHour = lineRecords[1].volume || 0;
      const change = lastHour - previousHour;
      const changePercent = previousHour !== 0 ? (change / previousHour) * 100 : 0;

      results.push({
        lineId,
        lastHour,
        previousHour,
        change,
        changePercent,
        isIncrease: change > 0,
        isDecrease: change < 0
      });
    }

    return results;
  }

  /**
   * Calculate 24h volume by line with comparison
   */
  static calculate24hVolumeByLine(currentData, previousData, lineIds) {
    if (!Array.isArray(currentData) || !Array.isArray(previousData) || !Array.isArray(lineIds)) {
      return [];
    }

    const results = [];

    for (const lineId of lineIds) {
      // Calculate current 24h volume
      const current24h = currentData
        .filter(record => record.line_id === lineId)
        .reduce((sum, record) => sum + (record.volume || 0), 0);

      // Calculate previous 24h volume
      const previous24h = previousData
        .filter(record => record.line_id === lineId)
        .reduce((sum, record) => sum + (record.volume || 0), 0);

      const change = current24h - previous24h;
      const changePercent = previous24h !== 0 ? (change / previous24h) * 100 : 0;

      results.push({
        lineId,
        current24h,
        previous24h,
        change,
        changePercent,
        isIncrease: change > 0,
        isDecrease: change < 0
      });
    }

    return results;
  }

  /**
   * Get last pressure readings for each line with dP data
   */
  static getLastPressures(data, lineIds, lines, paramsMap = null) {
    if (!data || !Array.isArray(data) || !lines) {
      return {};
    }

    const pressures = {};

    for (const lineId of lineIds) {
      // Get records for this line, sorted by period descending
      const lineRecords = data
        .filter(record => record.line_id === lineId)
        .map(record => ({
          ...record,
          periodDate: record.period ? new Date(record.period) : null
        }))
        .filter(record => record.periodDate && !isNaN(record.periodDate.getTime()))
        .sort((a, b) => b.periodDate - a.periodDate);

      if (lineRecords.length === 0) {
        continue; // No data for this line
      }

      const lastRecord = lineRecords[0];
      const line = lines.find(l => l.id === lineId);

      // Restrict to the last 24h relative to this line's most recent record.
      // The caller passes a wider (~3-day) dataset so sparse lines still get
      // records; current/max/min for pressure & dP must use a true 24h window.
      const windowStart = lastRecord.periodDate.getTime() - 24 * 60 * 60 * 1000;
      const records24h = lineRecords.filter(
        record => record.periodDate.getTime() >= windowStart
      );

      // Check if this is a high pressure line (from DB field, fallback to false)
      const isHighPressure = line ? (line.is_high_pressure || false) : false;

      // Calculate pressure with differential adjustment for low pressure non-meter lines
      let pressure = lastRecord.pressure || 0;
      const wVolumeDp = lastRecord.w_volume_dp || 0;

      if (!isHighPressure && line && !line.meter) {
        pressure = pressure - (wVolumeDp / 10000);
      }

      // Round to 3 decimal places
      pressure = Math.round(pressure * 1000) / 1000;

      // Calculate max dP over last 24h
      const maxDp24h = records24h.reduce((max, record) => {
        const dp = record.w_volume_dp || 0;
        return dp > max ? dp : max;
      }, 0);

      // Add dP data for both restrictor devices (non-meters) and meters
      const dpData = (line && paramsMap && paramsMap[lineId]) ? {
        currentDp: Math.round(wVolumeDp * 100) / 100, // Use w_volume_dp directly, no division
        maxDp24h: Math.round(maxDp24h * 100) / 100, // Max dP over last 24h
        minDp: paramsMap[lineId].min_dp || 0,
        maxDp: paramsMap[lineId].max_dp || (paramsMap[lineId].min_dp + 100) || 100,
        hasDpData: (paramsMap[lineId].max_dp || 0) > (paramsMap[lineId].min_dp || 0),
        isMeter: line.meter === true
      } : null;

      // Min/max pressure over last 24h records (with same formula applied)
      const pressureValues = records24h.map(r => {
        let p = r.pressure || 0;
        if (!isHighPressure && line && !line.meter) {
          p = p - ((r.w_volume_dp || 0) / 10000);
        }
        return Math.round(p * 1000) / 1000;
      });
      const minPressure24h = pressureValues.length ? Math.min(...pressureValues) : null;
      const maxPressure24h = pressureValues.length ? Math.max(...pressureValues) : null;

      pressures[lineId] = {
        pressure: pressure,
        minPressure24h,
        maxPressure24h,
        timestamp: lastRecord.periodDate,
        isHighPressure: isHighPressure,
        recordCount: lineRecords.length,
        dpData: dpData
      };
    }

    return pressures;
  }

  /**
   * Calculate period boundaries for current and previous 24h
   */
  static calculatePeriods() {
    const now = new Date();
    const currentEnd = new Date(now);
    currentEnd.setMinutes(0, 0, 0); // Round to hour

    const currentStart = new Date(currentEnd);
    currentStart.setHours(currentStart.getHours() - 23);

    const previousEnd = new Date(currentStart);
    previousEnd.setHours(previousEnd.getHours() - 1);

    const previousStart = new Date(previousEnd);
    previousStart.setHours(previousStart.getHours() - 23);

    return {
      current: {
        start: currentStart,
        end: currentEnd
      },
      previous: {
        start: previousStart,
        end: previousEnd
      }
    };
  }

  /**
   * Get pressure gauge range based on pressure type
   */
  static getPressureRange(isHighPressure) {
    return isHighPressure ? { min: 0, max: 50 } : { min: 0, max: 7 };
  }

  /**
   * Get pressure color (always green for now)
   */
  static getPressureColor(pressure, isHighPressure) {
    return '#B9E42B';
  }
}
