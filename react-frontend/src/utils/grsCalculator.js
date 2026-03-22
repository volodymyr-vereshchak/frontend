import { grsConfig } from '../config/grsConfig.js';

export class GRSCalculator {
  /**
   * Calculate GRS report data based on lines and hourly archive data
   * Replicates Python logic from HostlibUpdater.create_message
   */
  static calculateGRSReport(linesData, hourlyData) {
    // Handle different response formats
    let lines = linesData;
    let hourly = hourlyData;

    // If response is wrapped in an object, extract the array
    if (linesData && typeof linesData === 'object' && !Array.isArray(linesData)) {
      if (linesData.data && Array.isArray(linesData.data)) {
        lines = linesData.data;
      } else if (linesData.results && Array.isArray(linesData.results)) {
        lines = linesData.results;
      } else {
        console.log('Lines data structure:', linesData);
        return { success: false, error: 'Lines data is not an array and does not contain data/results field' };
      }
    }

    if (hourlyData && typeof hourlyData === 'object' && !Array.isArray(hourlyData)) {
      if (hourlyData.data && Array.isArray(hourlyData.data)) {
        hourly = hourlyData.data;
      } else if (hourlyData.results && Array.isArray(hourlyData.results)) {
        hourly = hourlyData.results;
      } else {
        console.log('Hourly data structure:', hourlyData);
        return { success: false, error: 'Hourly data is not an array and does not contain data/results field' };
      }
    }

    if (!lines || !Array.isArray(lines)) {
      return { success: false, error: 'Missing or invalid lines data' };
    }

    if (!hourly || !Array.isArray(hourly)) {
      return { success: false, error: 'Missing or invalid hourly data' };
    }


    try {
      // Use passed lines array IDs (from branch + include_in_report filtering)
      const lineIds = lines.map(l => l.id);

      // Data is already filtered to last 24 hours by the API
      const filteredHourlyData = hourly.filter(record =>
        lineIds.includes(record.line_id)
      );


      if (filteredHourlyData.length === 0) {
        return { success: false, error: 'No hourly data found for configured GRS lines' };
      }

      // Find date range for display
      const allPeriods = filteredHourlyData
        .map(record => record.period ? new Date(record.period) : null)
        .filter(date => date && !isNaN(date.getTime()))
        .sort((a, b) => a - b); // Sort ascending

      if (allPeriods.length === 0) {
        return { success: false, error: 'No valid periods found in hourly data' };
      }

      const startDate = allPeriods[0]; // Earliest period in the data
      const lastPeriod = allPeriods[allPeriods.length - 1]; // Latest period in the data
      const endDate = new Date(lastPeriod.getTime() + 60 * 60 * 1000); // Add 1 hour to last period


      // Calculate total volume for all GRS lines
      const totalVolume = filteredHourlyData.reduce((sum, record) => sum + (record.volume || 0), 0);

      // Create line reports
      const lineReports = [];

      for (const lineId of lineIds) {
        // Get line info
        const line = lines.find(l => l.id === lineId);
        if (!line) {
            continue;
        }


        // Get hourly data for this line (already filtered to last 24 hours)
        const lineHourlyData = filteredHourlyData.filter(record => record.line_id === lineId);

        if (lineHourlyData.length === 0) {
          continue;
        }


        // Calculate volume sum for this line
        const lineVolume = lineHourlyData.reduce((sum, record) => sum + (record.volume || 0), 0);

        // Get last record for pressure calculation
        const lastRecord = lineHourlyData[lineHourlyData.length - 1];

        // Calculate pressure (replicate Python logic)
        let pressure = 0;
        if (lastRecord) {
          pressure = lastRecord.pressure || 0;

          // For non-meters, subtract w_volume_dp / 10000
          if (line && !line.meter) {
            const wVolumeDp = lastRecord.w_volume_dp || 0;
            pressure = pressure - (wVolumeDp / grsConfig.PRESSURE_DIVISOR);
          }
        }

        // Round to 3 decimal places
        pressure = Math.round(pressure * 1000) / 1000;

        // Determine if this is a high pressure line (показывает Pвх вместо Pвых)
        const isHighPressureLine = grsConfig.HIGH_P_LINES_IDS.includes(lineId);

        // Check if we have incomplete data (should be 24 records)
        const hasIncompleteData = lineHourlyData.length !== 24;

        lineReports.push({
          lineId,
          lineName: line.name || `Линия ${lineId}`,
          volume: Math.round(lineVolume * 1000) / 1000, // Round to 3 decimal places
          pressure,
          isHighPressureLine,
          hasIncompleteData,
          recordCount: lineHourlyData.length
        });
      }

      // Sort by line order as passed in (branch-filtered order)
      lineReports.sort((a, b) =>
        lineIds.indexOf(a.lineId) - lineIds.indexOf(b.lineId)
      );

      return {
        success: true,
        data: {
          totalVolume: Math.round(totalVolume * 1000) / 1000,
          startDate,
          endDate,
          lineReports
        }
      };

    } catch (error) {
      console.error('Error calculating GRS report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Format the calculated GRS report data into a display message
   * Similar to Python create_message format but structured
   */
  static formatReportMessage(reportData) {
    if (!reportData || !reportData.success) {
      return 'Ошибка при расчете отчета';
    }

    const { totalVolume, startDate, endDate, lineReports } = reportData.data || {};

    if (!lineReports || !Array.isArray(lineReports)) {
      return 'Ошибка: отсутствуют данные о линиях';
    }

    let message = 'Объем по ГРС за последние 24 часа:\n';

    if (startDate && endDate) {
      message += `${startDate.toLocaleString('ru')} - ${endDate.toLocaleString('ru')}\n\n`;
    }

    message += `**ГРС всего**: ${(totalVolume || 0).toLocaleString('ru')} м³\n\n`;

    lineReports.forEach(report => {
      if (report.hasIncompleteData) {
        message += '🔴 '; // Attention emoji for incomplete data
      }

      const pressureLabel = report.isHighPressureLine ? 'Pвх' : 'Pвых';
      message += `**${report.lineName}**: ${report.volume.toLocaleString('ru')} м³; ${pressureLabel}: ${report.pressure.toLocaleString('ru')} кг/см²\n\n`;
    });

    return message;
  }
}