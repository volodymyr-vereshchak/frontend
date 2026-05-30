// Configuration for GRS Report - dynamically loaded from backend via window.APP_CONFIG
export const grsConfig = (() => {
  // Try to get config from runtime (injected by Python server)
  if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.GRS_CONFIG) {
    return window.APP_CONFIG.GRS_CONFIG;
  }

  // Fallback to default values if runtime config is not available
  return {
    // Contract hour = commercial-day start (07:00 → 07:00). Global for the whole
    // project: a commercial day runs from CONTRACT_HOUR to CONTRACT_HOUR next day.
    // Overridable at runtime via window.APP_CONFIG.GRS_CONFIG.CONTRACT_HOUR.
    CONTRACT_HOUR: 7,

    // LUMG ID to use in Overview tab
    LUMG_ID: 2,

    // Line IDs to include in GRS report (physical lines only)
    LINES_IDS: [1, 4, 5, 21, 20, 19, 18, 16, 6, 8, 15, 17, 12, 10, 11],

    // High pressure lines IDs (show Pвх instead of Pвых)
    HIGH_P_LINES_IDS: [1, 6, 8, 12],

    // Trends IDs (physical + virtual lines for trends page)
    TRENDS_IDS: [6, 11, 16, 17, 18, 19, 20, 21, 1001, 1002, 1003, 1004],

    // Pressure calculation: for non-meters, subtract w_volume_dp/10000 from pressure
    PRESSURE_DIVISOR: 10000
  };
})();