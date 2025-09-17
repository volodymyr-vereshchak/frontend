// Configuration for GRS Report - copied from Python backend/settings.py
export const grsConfig = {
  // Line IDs to include in GRS report
  LINES_IDS: [1, 4, 5, 21, 20, 19, 18, 16, 6, 8, 15, 17, 12, 10, 11],

  // High pressure lines IDs (show Pвх instead of Pвых)
  HIGH_P_LINES_IDS: [1, 6, 8, 12],

  // Pressure calculation: for non-meters, subtract w_volume_dp/10000 from pressure
  PRESSURE_DIVISOR: 10000
};