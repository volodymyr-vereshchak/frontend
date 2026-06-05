// Shared pressure / differential-pressure unit list.
// Order matches Units.ListUnits from CalcDSTU8586.dll — DO NOT reorder:
// FlowRateCalc relies on the index to pick the conversion factor `k`.
// index 0=Па, 1=кПа (default P/DP in flow calc), 7=мм рт.ст.
export const P_UNITS = [
  { label: 'Па',        k: 1        },
  { label: 'кПа',       k: 1e3      },
  { label: 'МПа',       k: 1e6      },
  { label: 'бар',       k: 1e5      },
  { label: 'кгс/см²',   k: 98066.5  },
  { label: 'кгс/м²',    k: 9.80665  },
  { label: 'PSI',       k: 6894.76  },
  { label: 'мм рт.ст',  k: 133.322  },
];

// Plain label list for per-line unit selectors (display-only, no conversion).
export const UNIT_LABELS = P_UNITS.map(u => u.label);

// Defaults match the previously hardcoded units (кг/см² / кг/м²).
export const PRESSURE_UNIT_DEFAULT = 'кгс/см²';
export const DP_UNIT_DEFAULT = 'кгс/м²';
