import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { P_UNITS, UNIT_LABELS } from '../constants/pressureUnits';
import { lineApi, branchApi, lumgApi, gasVolumeApi, archiveDataApi, paramArchiveApi } from '../services/api';
import './FlowRateCalc.css';

// ─── Constants (exact values from CalcDSTU8586.dll / Ask2 XAML) ───────────────

const T0 = 293.15;       // standard temperature, K (20°C, ДСТУ 8585)
const P0 = 0.101325;     // standard pressure, MPa
const RHO_AIR = 1.2041;  // density of air at standard conditions, kg/m³

// P_UNITS (pressure unit list) lives in ../constants/pressureUnits so the
// per-line unit selectors share the exact same set. Order is significant —
// see the note there. index 0=Па, 1=кПа (default P/DP), 7=мм рт.ст.

// Material list: exact order from Material.ListMaterials (CalcDSTU8586.dll)
// Both pipe and orifice use this same list.
// Default: pipe = index 2 (20), orifice = index 15 (12Х18Н9Т)
const MATERIALS = [
  { label: '10',             a: 11.7e-6 },
  { label: '15',             a: 11.8e-6 },
  { label: '20',             a: 11.9e-6 },
  { label: '06ХН28МДТ',     a: 15.8e-6 },
  { label: '08Х13',          a: 10.5e-6 },
  { label: '08Х18Н10',       a: 16.5e-6 },
  { label: '08Х18Н10T',      a: 16.5e-6 },
  { label: '08Х22Н6Т',       a: 16.0e-6 },
  { label: '09Г2С',          a: 12.0e-6 },
  { label: '10Г2',           a: 11.9e-6 },
  { label: '10Х14Г14Н4Т',   a: 17.0e-6 },
  { label: '12Х13',          a: 10.5e-6 },
  { label: '12Х17',          a: 10.8e-6 },
  { label: '12Х18Н10Т',      a: 16.6e-6 },
  { label: '12Х18Н12Т',      a: 16.5e-6 },
  { label: '12Х18Н9Т',       a: 16.7e-6 },
  { label: '12Х18Н9ТЛ',      a: 16.7e-6 },
  { label: '12Х1МФ',         a: 12.5e-6 },
  { label: '15К',            a: 11.7e-6 },
  { label: '20К',            a: 11.8e-6 },
  { label: '15Х5М',          a: 11.5e-6 },
  { label: '15ХМ',           a: 12.5e-6 },
  { label: '16ГС',           a: 12.2e-6 },
  { label: '18Х2Н4МА',       a: 11.5e-6 },
  { label: '20Л',            a: 11.9e-6 },
  { label: '20Х13',          a: 10.5e-6 },
  { label: '20ХМЛ',          a: 12.5e-6 },
  { label: '22К',            a: 11.8e-6 },
  { label: '25Л',            a: 12.0e-6 },
  { label: '25Х1МФ',         a: 12.5e-6 },
  { label: '25Х2М1Ф',        a: 12.5e-6 },
  { label: '30',             a: 11.9e-6 },
  { label: '35',             a: 11.7e-6 },
  { label: '30Х13',          a: 10.5e-6 },
  { label: '30ХМ',           a: 12.5e-6 },
  { label: '30ХМА',          a: 12.5e-6 },
  { label: '31Х19Н9МВБТ',    a: 16.0e-6 },
  { label: '35Л',            a: 11.5e-6 },
  { label: '37Х12Н8Г8МФБ',   a: 16.5e-6 },
  { label: '38ХА',           a: 12.5e-6 },
  { label: '38ХН3МФА',       a: 12.0e-6 },
  { label: '40',             a: 11.8e-6 },
  { label: '45',             a: 11.7e-6 },
  { label: '40Х',            a: 12.0e-6 },
  { label: '45Л',            a: 11.7e-6 },
];

// Language-dependent dropdown labels are built inside the component via t().
// The two method names (GERG-91 / NX-19) are kept untranslated (standard notation).
const KST_METHOD_NAMES = ['', 'GERG-91 мод.', 'NX-19 мод.'];

// Standard + formula each displayed quantity is computed by. These are document
// designations, identical in both UI languages, so they are not localised.
// Numbering follows CalcDSTU8586/GOST30319, which this module ports 1:1 — the
// formula numbers below match the ones cited in those assemblies' own methods.
const STD = {
  zGerg: 'ГОСТ 30319.2, ф. 37',
  zNx:   'ГОСТ 30319.2, ф. 6',
  zc:    'ГОСТ 30319.1, ф. 36',
  k:     'ГОСТ 30319.1',
  rhoW:  'ГОСТ 30319.1, ф. 6',
  mu:    'ГОСТ 30319.1, ф. 44/45',
  tpk:   'ГОСТ 30319.2, ф. 18',
  ppk:   'ГОСТ 30319.2, ф. 17',
  DT:    'ДСТУ ГОСТ 8.586.1, ф. 5.5',
  dT:    'ДСТУ ГОСТ 8.586.1, ф. 5.4',
  beta:  'ДСТУ ГОСТ 8.586.1, ф. 3.1',
  C:     'ДСТУ ГОСТ 8.586.2, ф. 5.6',
  ksh:   'ДСТУ ГОСТ 8.586.2, ф. 5.11',
  kbl:   'ДСТУ ГОСТ 8.586.2, ф. 5.13/5.16',
  eps:   'ДСТУ ГОСТ 8.586.2, ф. 5.7',
  re:    'ДСТУ ГОСТ 8.586.5, ф. 5.11',
  q:     'ДСТУ ГОСТ 8.586.5, ф. 5.8',
};

// ─── Physics ──────────────────────────────────────────────────────────────────

// ─── ГОСТ 30319 (ported 1:1 from GOST30319.dll, as used by Ask2) ─────────────
// Common argument convention: rho — standard density kg/m³, xa — N₂ mole
// fraction, xy — CO₂ mole fraction, P_MPa — absolute pressure, Ts — K.

// ф. 36 — compressibility factor at standard conditions.
function zStd(rho, xa, xy) {
  return 1 - (0.0741 * rho - 0.006 - 0.063 * xa - 0.0575 * xy) ** 2;
}

// ф. 17 / 18 — pseudocritical pressure (MPa) and temperature (K).
function ppk(rho, xa, xy) { return 2.9585 * (1.608 - 0.05994 * rho + xy - 0.392 * xa); }
function tpk(rho, xa, xy) { return 88.25 * (0.9915 + 1.759 * rho - xy - 1.681 * xa); }

// NX-19 мод. — ГОСТ 30319.2, ф. 6…16.
function zNX19(rho, xa, xy, P_MPa, Ts) {
  const Ta  = 0.71892 * (Ts / tpk(rho, xa, xy)) + 0.0007;
  const Pa  = 0.6714 * (P_MPa / ppk(rho, xa, xy)) + 0.0147;
  const dTa = Ta - 1.09;

  // F is piecewise over (Pa, ΔTa). The DLL applies these as three sequential
  // (not mutually exclusive) tests, so on an overlapping boundary the last
  // matching branch wins — preserved here deliberately.
  let F = NaN;
  if (Pa >= 0 && Pa <= 2 && dTa >= 0 && dTa <= 0.3) {
    F = 75e-5 * Pa ** 2.3 / Math.exp(20 * dTa)
      + 0.0011 * Math.sqrt(dTa) * (Pa * (2.17 - Pa + 1.4 * Math.sqrt(dTa))) ** 2;
  }
  if (Pa >= 0 && Pa <= 1.3 && dTa >= -0.25 && dTa <= 0) {
    F = 75e-5 * Pa ** 2.3 * (2 - Math.exp(20 * dTa))
      + 1.317 * Pa * (1.69 - Pa ** 2) * dTa ** 4;
  }
  if (Pa >= 1.3 && Pa <= 2 && dTa >= -0.21 && dTa <= 0) {
    F = 75e-5 * Pa ** 2.3 * (2 - Math.exp(20 * dTa))
      + 0.455 * (1.3 - Pa) * (1.69 * 2 ** 1.25 - Pa ** 2)
        * (dTa * (0.03249 + 18.028 * dTa ** 2) + dTa ** 2 * (42.844 + 200 * dTa ** 2));
  }

  const O1 = Ta ** 5 / (Ta ** 2 * (6.60756 * Ta - 4.42646) + 3.22706);       // ф. 11
  const O0 = (Ta ** 2 * (1.77218 - 0.8879 * Ta) + 0.305131) * O1 / Ta ** 4;  // ф. 10
  const B1 = 2 * O1 / 3 - O0 ** 2;                                           // ф. 9
  const B0 = O0 * (O1 - O0 ** 2) + 0.1 * O1 * Pa * (F - 1);                  // ф. 8
  const B2 = (B0 + Math.sqrt(B0 ** 2 + B1 ** 3)) ** (1 / 3);                 // ф. 7
  return (1 + 0.00132 / Ta ** 3.25) ** 2 * Pa / (10 * (B1 / B2 - B2 + O0));  // ф. 6
}

// GERG-91 мод. — ГОСТ 30319.2, ф. 20…22, 34, 35, 37, 43.
function zGERG91(rho, xa, xy, P_MPa, Ts) {
  const xe = 1 - xa - xy;                                       // ф. 22
  const Me = (24.05525 * zStd(rho, xa, xy) * rho
              - 28.0135 * xa - 44.01 * xy) / xe;                // ф. 35
  const H  = 128.64 + 47.479 * Me;                              // ф. 34

  // ф. 20 — second virial coefficient Bm
  const F0  = 0.72 + 1.875e-5 * (320 - Ts) ** 2;
  const B22 = -0.86834 + 0.0040376 * Ts - 5.1657e-6 * Ts ** 2;
  const B12 = -0.339693 + 0.00161176 * Ts - 2.04429e-6 * Ts ** 2;
  const B11 = -0.1446 + 0.00074091 * Ts - 9.1195e-7 * Ts ** 2;
  const Bee = -0.425468 + 0.002865 * Ts - 4.62073e-6 * Ts ** 2
    + (8.77118e-4 - 5.56281e-6 * Ts + 8.81514e-9 * Ts ** 2) * H
    + (-8.24747e-7 + 4.31436e-9 * Ts - 6.08319e-12 * Ts ** 2) * H * H;
  const Bm = xe ** 2 * Bee + xe * xa * F0 * (Bee + B11)
    - 1.73 * xe * xy * Math.sqrt(Bee * B22)
    + xa ** 2 * B11 + 2 * xa * xy * B12 + xy ** 2 * B22;

  // ф. 21 — third virial coefficient Cm
  const G0   = 0.92 + 0.0013 * (Ts - 270);
  const C122 = 0.00358783 + 8.06674e-6 * Ts - 3.25798e-8 * Ts ** 2;
  const C112 = 0.00552066 - 1.68609e-5 * Ts + 1.57169e-8 * Ts ** 2;
  const C222 = 0.0020513 + 3.4888e-5 * Ts - 8.3703e-8 * Ts ** 2;
  const C111 = 0.0078498 - 3.9895e-5 * Ts + 6.1187e-8 * Ts ** 2;
  const Ceee = -0.302488 + 0.00195861 * Ts - 3.16302e-6 * Ts ** 2
    + (6.46422e-4 - 4.22876e-6 * Ts + 6.88157e-9 * Ts ** 2) * H
    + (-3.32805e-7 + 2.2316e-9 * Ts - 3.67713e-12 * Ts ** 2) * H ** 2;
  const Cm = xe ** 3 * Ceee
    + 3 * xe ** 2 * xa * G0 * (Ceee * Ceee * C111) ** (1 / 3)
    + 2.76 * xe ** 2 * xy * (Ceee * Ceee * C222) ** (1 / 3)
    + 3 * xe * xa * xa * G0 * (Ceee * C111 * C111) ** (1 / 3)
    + 6.6 * xe * xa * xy * (Ceee * C111 * C222) ** (1 / 3)
    + 2.76 * xe * xy ** 2 * (Ceee * C222 * C222) ** (1 / 3)
    + xa ** 3 * C111 + 3 * xa * xa * xy * C112
    + 3 * xa * xy * xy * C122 + xy ** 3 * C222;

  const b  = 1000 * P_MPa / (2.7715 * Ts);                      // ф. 43
  const D1 = 1 + b * Bm;
  const D2 = 1 + 1.5 * (b * Bm + b * b * Cm);
  const D3 = (D2 - Math.sqrt(D2 * D2 - D1 ** 3)) ** (1 / 3);
  return (1 + D3 + D1 / D3) / 3;                                // ф. 37
}

// Dynamic viscosity, ф. 44/45 ГОСТ 30319.1. Result in Pa·s.
function gasViscosity(rho, xa, xy, P_MPa, Ts) {
  const corr = 1 + (P_MPa / ppk(rho, xa, xy)) ** 2
                   / (30 * (Ts / tpk(rho, xa, xy) - 1));
  return 3.24 * (Math.sqrt(Ts) + 1.37 - 9.09 * rho ** 0.125)
       / (Math.sqrt(rho) + 2.08 - 1.5 * (xa + xy)) * corr * 1e-6;
}

// Isentropic exponent (adiabat), ф. 28 ГОСТ 30319.1. CO₂ does not enter it.
function adiabat(rho, xa, P_MPa, Ts) {
  const r = P_MPa / Ts;
  return 1.556 * (1 + 0.074 * xa) - 0.00039 * Ts * (1 - 0.68 * xa) - 0.208 * rho
       + r ** 1.43 * (384 * (1 - xa) * r ** 0.8 + 26.4 * xa);
}

// Reader-Harris/Gallagher discharge coefficient, ф. 5.6 ДСТУ ГОСТ 8.586.2.
// D_mm is the *working* (thermally expanded) pipe bore, matching GetC() in the DLL.
function dischargeCoeff(beta, Re_D, otborIdx, D_mm) {
  let L1, L2p;
  if (otborIdx === 1) { L1 = 1; L2p = 0.47; }            // трьохрадіусний (D-D/2)
  else if (otborIdx === 2) { L1 = 25.4 / D_mm; L2p = 25.4 / D_mm; }  // фланцевий
  else { L1 = 0; L2p = 0; }                               // кутовий

  const A = (19000 * beta / Re_D) ** 0.8;
  const M2 = 2 * L2p / (1 - beta);
  // Small-bore correction: applies only below D = 71.12 mm (2.8").
  const smallBore = D_mm >= 71.12 ? 0 : 0.011 * (0.75 - beta) * (2.8 - D_mm / 25.4);
  return 0.5961 + 0.0261 * beta ** 2 - 0.216 * beta ** 8
    + 0.000521 * (1e6 * beta / Re_D) ** 0.7
    + (0.0188 + 0.0063 * A) * beta ** 3.5 * (1e6 / Re_D) ** 0.3
    + (0.043 + 0.080 * Math.exp(-10 * L1) - 0.123 * Math.exp(-7 * L1))
      * (1 - 0.11 * A) * beta ** 4 / (1 - beta ** 4)
    - 0.031 * (M2 - 0.8 * M2 ** 1.1) * beta ** 1.3
    + smallBore;
}

// ─── Correction factors Кш / Кп (ported 1:1 from CalcDSTU8586.dll) ────────────
// Without these the pipe roughness, the orifice edge radius and the operating
// time have no effect on the result at all — see ф. 5.8 ДСТУ ГОСТ 8.586.5,
// where the flow is C·E·Кш·Кп·ε·…

// Table 2 coefficients for Ra_max, ф. 5.10. Indexed [Re band][power of lg(Re)][k].
// Re bands: 0 → (1e4, 1e5], 1 → (1e5, 3e6], 2 → (3e6, 1e8].
const RA_MAX_BK = [
  [[8.87,     6.7307,   -10.244  ], [-3.7114,  -5.5844,   5.7094  ],
   [0.41841,  0.732485, -0.76477 ], [0,         0,        0       ]],
  [[27.23,   -25.928,    1.7622  ], [-11.458,  12.426,   -3.8765  ],
   [1.6117,  -2.09397,   1.05567 ], [-0.07567,  0.106143,-0.076764]],
  [[16.5416, 322.594,  -92.029   ], [-6.60709,-132.2,    37.935   ],
   [0.88147,  17.795,   -5.1885  ], [-0.039226,-0.799765, 0.23583 ]],
];

// C#'s Math.Round is banker's rounding (half-to-even); JS Math.round is half-up.
// Ra_max feeds a rounded intermediate, so match the DLL exactly.
function roundHalfEven(v, digits) {
  const f = 10 ** digits;
  const x = v * f;
  if (Math.abs(x - Math.trunc(x)) === 0.5) {
    const fl = Math.floor(x);
    return (fl % 2 === 0 ? fl : fl + 1) / f;
  }
  return Math.round(x) / f;
}

// ф. 5.10 — upper bound of admissible pipe roughness Ra. D_m, result in metres.
function raMax(Re, beta, D_m) {
  let v;
  if (Re <= 1e4) {
    v = 0.718866 * beta ** -3.887 + 0.36;
  } else {
    const band = Re <= 1e5 ? 0 : Re <= 3e6 ? 1 : Re <= 1e8 ? 2 : -1;
    if (band < 0) return NaN;
    const lg = Math.log10(Re);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let k = 0; k <= 3; k++) {
      b0 += RA_MAX_BK[band][k][0] * lg ** k;
      b1 += RA_MAX_BK[band][k][1] * lg ** k;
      b2 += RA_MAX_BK[band][k][2] * lg ** k;
    }
    v = b0 * (beta < 0.65 ? beta : 0.65) ** b1 + b2;
  }
  const r = v < 1 ? roundHalfEven(v, 2) : v < 10 ? roundHalfEven(v, 1) : roundHalfEven(v, 0);
  return r >= 15 ? 0.0015 * D_m : D_m * r / 1e4;
}

// ф. 5.10 — lower bound of admissible pipe roughness Ra, metres.
function raMin(Re, beta, D_m) {
  if (Re < 3e6) return 0;
  const lg = Math.log10(Re);
  const v = beta < 0.65
    ? 7.1592 - 12.387 * beta - (2.0118 - 3.469 * beta) * lg
      + (0.1382 - 0.23762 * beta) * lg ** 2
    : -0.892353 + 0.24308 * lg - 0.0162562 * lg ** 2;
  return v <= 0 ? 0 : D_m * (Math.trunc(v * 1000) / 1000) / 1e4;
}

// ф. 5.12 — friction factor λ.
function lambdaFriction(Re, Ash, kd, kr, D_m) {
  return 1 / (1.74 - 2 * Math.log10(
    2 * Ash / D_m - 37.36 * Math.log10(kd - kr * Math.log10(kd + 3.3333 * kr)) / Re
  )) ** 2;
}

// ф. 5.11 — pipe roughness correction Кш. Rsh_m, D_m in metres.
// Equals 1 while Ra sits inside the admissible band; only outside it does the
// roughness bite.
function roughnessCoeff(Re, beta, D_m, Rsh_m) {
  const rMin = raMin(Re, beta, D_m);
  const rMax = raMax(Re, beta, D_m);
  const Ra = Rsh_m / Math.PI;
  if (!(Ra < rMin) && !(Ra > rMax)) return 1;
  const bound = Ra < rMin ? rMin : rMax;
  const kr = 5.035 / Re;
  const Ash = Math.PI * bound;
  // 0.84678488… = π · 0.26954
  const kd = 0.8467848838485929 * bound / D_m;
  const l1 = lambdaFriction(Re, Rsh_m, 0.26954 * Rsh_m / D_m, kr, D_m);
  const l2 = lambdaFriction(Re, Ash, kd, kr, D_m);
  return 1 + 5.22 * beta ** 3.5 * (l1 - l2);
}

// Asymptotic edge-blunting radius, m (ф. 5.14 ДСТУ ГОСТ 8.586.2).
const R_EDGE_MAX = 0.000195;

// ф. 5.13/5.16 — orifice edge blunting correction Кп. d_m, rn_m in metres,
// years = operating time. timeType 0 = наработка (ttwoRun, radius at that
// moment), 1 = міжконтрольний інтервал (ttwoPeriod, radius averaged over it).
//
// NOTE: the two branches test the 0.0004·d threshold against *different*
// radii — ttwoRun against the initial rn, ttwoPeriod against the averaged
// value. That asymmetry is what CalcDSTU8586.dll does; kept for parity.
function bluntnessCoeff({ d_m, rn_m, years, timeType }) {
  if (timeType === 1) {
    // As years → 0 the average degenerates to rn (l'Hôpital), so guard the
    // division rather than returning NaN.
    const rAvg = years > 0
      ? R_EDGE_MAX - (3 / years) * (R_EDGE_MAX - rn_m) * (1 - Math.exp(-years / 3))
      : rn_m;
    return rAvg <= 0.0004 * d_m ? 1 : 0.9826 + (rAvg / d_m + 0.0007773) ** 0.6;
  }
  if (rn_m <= 0.0004 * d_m) return 1;
  const rk = R_EDGE_MAX - (R_EDGE_MAX - rn_m) * Math.exp(-years / 3);
  return 0.9826 + (rk / d_m + 0.0007773) ** 0.6;
}

// ISO 5167-2 expansibility factor for gas (κ uses adiabat from ГОСТ 30319.1 ф.28)
function expansibility(beta, dP_Pa, P1_Pa, kappa) {
  const tau = 1 - dP_Pa / P1_Pa;
  return 1 - (0.351 + 0.256 * beta ** 4 + 0.93 * beta ** 8) * (1 - tau ** (1 / kappa));
}

// kD / kd are the linear-expansion factors (1 + α(t)·(t−20)) of pipe and orifice.
// Rsh_mm — pipe roughness, rEdge_mm — orifice edge radius, years/timeType — the
// operating time pair. All of these reach the result through Кш and Кп.
function orificeFlow({ D_mm, d_mm, kD, kd, dP_Pa, P1_Pa, rho_w, mu, otborIdx, kappa,
                       Rsh_mm, rEdge_mm, years, timeType }) {
  const DT = D_mm * 1e-3 * kD;
  const dT = d_mm * 1e-3 * kd;
  const beta = dT / DT;
  const E = 1 / Math.sqrt(1 - beta ** 4);
  const A0 = Math.PI / 4 * dT ** 2;
  const eps = expansibility(beta, dP_Pa, P1_Pa, kappa);
  // Кп depends only on geometry and time, so it is constant across the iteration.
  const Kbl = bluntnessCoeff({ d_m: dT, rn_m: rEdge_mm * 1e-3, years, timeType });

  const DT_mm = DT * 1e3;
  let C = 0.6, Ksh = 1;
  let qm = C * eps * E * A0 * Math.sqrt(2 * dP_Pa * rho_w);
  for (let i = 0; i < 25; i++) {
    const Re = qm > 0 ? 4 * qm / (Math.PI * mu * DT) : 1;
    const Cn = dischargeCoeff(beta, Re, otborIdx, DT_mm);
    // Кш is Re-dependent, so it must be re-evaluated inside the loop.
    Ksh = roughnessCoeff(Re, beta, DT, Rsh_mm * 1e-3);
    const qn = Cn * Ksh * Kbl * eps * E * A0 * Math.sqrt(2 * dP_Pa * rho_w);
    if (Math.abs(qn - qm) < 1e-12) { C = Cn; qm = qn; break; }
    C = Cn; qm = qn;
  }
  const Re_D = 4 * qm / (Math.PI * mu * DT);
  return { qm, C, Ksh, Kbl, eps, beta, DT_mm, dT_mm: dT * 1e3, Re_D };
}

// ─── Sub-components (defined outside to prevent focus loss on re-render) ──────

function InputRow({ id, label, value, onChange, unit, min, max, step, error, placeholder }) {
  return (
    <>
      <div className="cf-row">
        <label className="cf-label" htmlFor={id} dangerouslySetInnerHTML={{ __html: label }} />
        <input id={id} type="number" className={`cf-input${error ? ' error' : ''}`}
          value={value} step={step} min={min} max={max}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? `${min}–${max}`} />
        <span className="cf-unit" dangerouslySetInnerHTML={{ __html: unit }} />
      </div>
      {error && <div className="cf-error">{error}</div>}
    </>
  );
}

function InputUnitRow({ id, label, value, onChange, uIdx, onUnit, units, min, max, step, error }) {
  return (
    <>
      <div className="cf-row cf-row-unit">
        <label className="cf-label" htmlFor={id} dangerouslySetInnerHTML={{ __html: label }} />
        <input id={id} type="number" className={`cf-input${error ? ' error' : ''}`}
          value={value} step={step} min={min} max={max}
          onChange={e => onChange(e.target.value)} />
        <select className="cf-unit-select" value={uIdx}
          onChange={e => onUnit(Number(e.target.value))}>
          {units.map((u, i) => <option key={i} value={i}>{u.label}</option>)}
        </select>
      </div>
      {error && <div className="cf-error">{error}</div>}
    </>
  );
}

function SelectRow({ id, label, value, onChange, opts, placeholderIdx }) {
  return (
    <div className="cf-row">
      <label className="cf-label" htmlFor={id} dangerouslySetInnerHTML={{ __html: label }} />
      <select id={id} className="cf-select" value={value}
        onChange={e => onChange(Number(e.target.value))}>
        {opts.map((o, i) => (
          <option key={i} value={i} disabled={placeholderIdx === i && i === 0}>
            {typeof o === 'string' ? o : o.label}
          </option>
        ))}
      </select>
      <span className="cf-unit" />
    </div>
  );
}

// `std` names the standard and formula the value was computed by — see STD below.
function ResRow({ label, value, unit, std }) {
  return (
    <div className="cf-res-row">
      <span className="cf-res-label">
        <span dangerouslySetInnerHTML={{ __html: label }} />
        {std && <span className="cf-res-std">{std}</span>}
      </span>
      <span className="cf-res-value">{value}</span>
      <span className="cf-res-unit" dangerouslySetInnerHTML={{ __html: unit }} />
    </div>
  );
}

function fmt(n, d = 4) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  return n.toFixed(d);
}

// ─── Auto-fill helpers ──────────────────────────────────────────────────────

// Linear-expansion polynomial coefficients (a0, a1, a2) from ДСТУ ГОСТ 8.586.1
// Додаток Г, table Г.1: α(t) = 1e-6·[a0 + a1·(t/1000) + a2·(t/1000)²], t in °C.
// Aligned 1:1 to the MATERIALS array order above. The param archive stores these
// same values (ParamList exposes A0/A1/A2 scaled to exactly a0/a1/a2), so the
// material is recovered by matching the full triple. null = not in the standard
// table (no auto-match).
const MATERIAL_COEFFS = [
  [10.8,   9.0,    -4.2],      // 0  10
  [11.1,   7.9,    -3.9],      // 1  15
  [11.1,   7.7,    -3.4],      // 2  20
  [9.153,  30.944, -26.478],   // 3  06ХН28МДТ
  [9.971,  9.095,  -4.115],    // 4  08Х13
  [15.325, 11.25,  0],         // 5  08Х18Н10
  [15.47,  10.5,   0],         // 6  08Х18Н10T
  [6.4,    60.0,   0],         // 7  08Х22Н6Т
  [10.66,  12.0,   0],         // 8  09Г2С
  [9.94,   22.667, 0],         // 9  10Г2
  [15.22,  13.0,   0],         // 10 10Х14Г14Н4Т
  [9.557,  11.067, -5.0],      // 11 12Х13
  null,                        // 12 12Х17 (not in table)
  [16.205, 6.571,  0],         // 13 12Х18Н10Т
  [16.205, 6.571,  0],         // 14 12Х18Н12Т
  [15.6,   8.3,    -6.5],      // 15 12Х18Н9Т
  [16.466, 5.36,   3.0],       // 16 12Х18Н9ТЛ
  [10.0,   9.6,    -6.0],      // 17 12Х1МФ
  [10.8,   10.0,   0],         // 18 15К
  [10.8,   10.0,   0],         // 19 20К
  [10.1,   2.7,    0],         // 20 15Х5М
  [11.448, 12.638, -7.137],    // 21 15ХМ
  [9.903,  20.561, -15.675],   // 22 16ГС
  [11.065, 11.224, -5.381],    // 23 18Х2Н4МА
  [11.66,  9.0,    0],         // 24 20Л
  [9.52,   11.333, 0],         // 25 20Х13
  [9.83,   18.812, -14.191],   // 26 20ХМЛ
  [9.142,  34.34,  -43.526],   // 27 22К
  [10.75,  12.5,   0],         // 28 25Л
  [10.235, 13.64,  -13.0],     // 29 25Х1МФ
  [12.02,  8.0,    0],         // 30 25Х2М1Ф
  [10.2,   10.4,   -5.6],      // 31 30
  [10.2,   10.4,   -5.6],      // 32 35
  [9.642,  9.6,    -4.472],    // 33 30Х13
  [10.72,  14.667, 0],         // 34 30ХМ
  [10.72,  14.667, 0],         // 35 30ХМА
  [16.216, 6.4,    0],         // 36 31Х19Н9МВБТ
  null,                        // 37 35Л (not in fetched table)
  [15.8,   0.0,    0],         // 38 37Х12Н8Г8МФБ
  [12.345, 5.433,  5.36],      // 39 38ХА
  [11.446, 9.574,  -4.945],    // 40 38ХН3МФА
  [10.821, 17.872, -10.986],   // 41 40
  [10.821, 17.872, -10.986],   // 42 45
  [10.819, 15.487, -9.28],     // 43 40Х
  [11.6,   0.0,    0],         // 44 45Л
];

// Linear-expansion factor K = 1 + α(t)·(t − 20), ф. 5.6/5.7 ДСТУ ГОСТ 8.586.1
// (GetKpipe/GetKorifice in the DLL). α is temperature-dependent via the table Г.1
// polynomial; materials missing from that table fall back to the constant α.
function expansionFactor(matIdx, tC) {
  const c = MATERIAL_COEFFS[matIdx];
  const alpha = c
    ? 1e-6 * (c[0] + c[1] * (tC / 1000) + c[2] * (tC / 1000) ** 2)
    : (MATERIALS[matIdx]?.a ?? 11.9e-6);
  return 1 + alpha * (tC - 20);
}

// Recover the MATERIALS index from the param's expansion polynomial (A0,A1,A2 —
// the displayed ParamList values, equal to table Г.1's a0/a1/a2). Matches the
// full triple (so e.g. steel 20 ≠ 15 ≠ 10, which differ only in a1/a2). Returns
// the index, or null if nothing is close (material not in the standard table).
function matchMaterialIndex(A0, A1, A2) {
  if (A0 == null || isNaN(A0)) return null;
  const p = [A0, A1 || 0, A2 || 0];
  let best = null, bestDist = Infinity;
  MATERIAL_COEFFS.forEach((c, i) => {
    if (!c) return;
    const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
    if (d < bestDist) { bestDist = d; best = i; }
  });
  // The param equals one table row, so the right material gives dist ≈ 0; allow a
  // little slack for rounding but reject when nothing is reasonably close.
  return bestDist <= 1.0 ? best : null;
}

// Index of a unit label in the shared P_UNITS list; falls back when not found.
function unitIndexByLabel(label, fallback) {
  const i = UNIT_LABELS.indexOf(label);
  return i >= 0 ? i : fallback;
}

// Round pulled values for the form: 2 decimals for most fields, 4 for density
// (which needs the extra precision). Strips float noise from the archive.
const round2 = (v) => (v == null || isNaN(v)) ? v : Math.round(v * 100) / 100;
const round4 = (v) => (v == null || isNaN(v)) ? v : Math.round(v * 1e4) / 1e4;

// Naive DD.MM.YYYY HH:00 of an archive period (no UTC shift).
function formatPeriodShort(period) {
  const m = String(period).replace(' ', 'T').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}))?/);
  if (!m) return String(period);
  const [, y, mo, d, h = '00'] = m;
  return `${d}.${mo}.${y} ${h}:00`;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INIT = {
  kst: 0,
  rho: '', co2: '', n2: '',
  pType: 0,
  patm: '101.325', patmU: 1,
  p: '', pU: 1,
  t: '',
  otbor: 0,
  dp: '', dpU: 0,
  D20: '', matPipe: 2, rsh: '0.05',
  d20: '', matOrifice: 15, rEdge: '0',
  timeType: 0, timeOrifice: '',
  qw: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlowRateCalc() {
  const { t } = useLanguage();
  const [mtype, setMtype] = useState('orifice');
  const [s, setS] = useState(INIT);
  const [errors, setErrors] = useState({});
  const [results, setResults] = useState(null);

  // ── Auto-fill-from-line state ──
  const [branches, setBranches] = useState([]);
  const [lumgs, setLumgs] = useState([]);
  const [calcs, setCalcs] = useState([]);
  const [lines, setLines] = useState([]);
  const [selBranch, setSelBranch] = useState('');
  const [selCalc, setSelCalc] = useState('');
  const [selLine, setSelLine] = useState('');
  const [pullStatus, setPullStatus] = useState(null); // { type:'ok'|'warn'|'loading', text, warns? }

  // Orifice → restrictor lines (meter=false); meter → counter lines (meter=true).
  const wantMeter = mtype === 'meter';

  // Load reference data once for the cascade (branch → calc → line).
  useEffect(() => {
    Promise.all([
      branchApi.getAll(),
      lumgApi.getAll(),
      gasVolumeApi.getGasVolumeCalcs(),
      lineApi.getAll(),
    ]).then(([br, lu, ca, li]) => {
      setBranches(br || []); setLumgs(lu || []); setCalcs(ca || []); setLines(li || []);
    }).catch(() => { /* non-fatal: manual entry still works */ });
  }, []);

  const filteredCalcs = useMemo(() => {
    // Only calcs that have at least one line of the selected device type.
    const calcIdsWithDevice = new Set(
      lines.filter(l => !!l.meter === wantMeter).map(l => l.gas_volume_calc_id)
    );
    let cs = calcs.filter(c => calcIdsWithDevice.has(c.id));
    if (selBranch) {
      const ids = lumgs.filter(l => l.branch_id == selBranch).map(l => l.id);
      cs = cs.filter(c => ids.includes(c.lumg_id));
    }
    return cs;
  }, [selBranch, calcs, lumgs, lines, wantMeter]);

  const filteredLines = useMemo(() => {
    const byDevice = lines.filter(l => !!l.meter === wantMeter);
    if (selCalc) return byDevice.filter(l => l.gas_volume_calc_id == selCalc);
    if (selBranch) {
      const lumgIds = lumgs.filter(l => l.branch_id == selBranch).map(l => l.id);
      const calcIds = calcs.filter(c => lumgIds.includes(c.lumg_id)).map(c => c.id);
      return byDevice.filter(l => calcIds.includes(l.gas_volume_calc_id));
    }
    return byDevice;
  }, [lines, wantMeter, selCalc, selBranch, lumgs, calcs]);

  // Localized dropdown labels (indices stay stable — only display text changes)
  const KST_METHODS = useMemo(
    () => [t('fcKstPlaceholder'), KST_METHOD_NAMES[1], KST_METHOD_NAMES[2]],
    [t]
  );
  const P_TYPES = useMemo(() => [t('fcPAbs'), t('fcPGauge')], [t]);
  const OTBOR = useMemo(() => [t('fcOtborCorner'), t('fcOtborRad'), t('fcOtborFlange')], [t]);
  const TIME_TYPES = useMemo(() => [t('fcTimeOp'), t('fcTimeInterctrl')], [t]);

  const set = useCallback((f, v) => {
    setS(prev => ({ ...prev, [f]: v }));
    setErrors(prev => { const e = { ...prev }; delete e[f]; return e; });
    setResults(null);
  }, []);

  // Pull the latest params + last hourly record for a line into the form.
  const pullFromLine = useCallback(async (lineId) => {
    const line = lines.find(l => l.id === Number(lineId));
    if (!line) return;
    setPullStatus({ type: 'loading', text: t('fcLineFillLoading') });
    try {
      const [params, lastPeriod] = await Promise.all([
        paramArchiveApi.getParamsForLines([line.id]),
        archiveDataApi.getLastPeriod([line.id]),
      ]);
      const param = Array.isArray(params) && params.length ? params[0] : null;

      // Last hourly record: fetch a window around the anchor period, take the newest.
      let hourly = null;
      const anchor = lastPeriod || new Date();
      const start = new Date(anchor.getTime() - 2 * 864e5).toISOString().slice(0, 10);
      const end   = new Date(anchor.getTime() + 2 * 864e5).toISOString().slice(0, 10);
      const recs = await archiveDataApi.getHourlyData([line.id], start, end);
      if (Array.isArray(recs) && recs.length) {
        hourly = recs.reduce((a, b) => (new Date(a.period) > new Date(b.period) ? a : b));
      }

      setS(prev => {
        const next = { ...prev };
        if (param) {
          if (param.density != null)  next.rho = String(round4(param.density));
          if (param.co2 != null)      next.co2 = String(round2(param.co2));
          if (param.n2 != null)       next.n2  = String(round2(param.n2));
          if (param.D20 != null)      next.D20 = String(round2(param.D20));
          if (param.d20 != null)      next.d20 = String(round2(param.d20));
          if (param.roughness != null) next.rsh = String(round2(param.roughness));
          if (param.radius != null)   next.rEdge = String(round2(param.radius));
          if (param.su_year != null)  next.timeOrifice = String(round2(param.su_year));
          const mO = matchMaterialIndex(param.A0su, param.A1su, param.A2su);
          if (mO != null) next.matOrifice = mO;
          const mP = matchMaterialIndex(param.A0pipe, param.A1pipe, param.A2pipe);
          if (mP != null) next.matPipe = mP;
        }
        if (hourly) {
          if (hourly.pressure != null) {
            next.p = String(round2(hourly.pressure));
            next.pU = unitIndexByLabel(line.pressure_unit, prev.pU);
            next.pType = 0; // archive pressure is absolute
          }
          if (hourly.temperature != null) next.t = String(round2(hourly.temperature));
          if (hourly.w_volume_dp != null) {
            if (wantMeter) {
              next.qw = String(round2(hourly.w_volume_dp));
            } else {
              next.dp = String(round2(hourly.w_volume_dp));
              next.dpU = unitIndexByLabel(line.dp_unit, prev.dpU);
            }
          }
        }
        return next;
      });
      setErrors({});
      setResults(null);

      const warns = [];
      if (!param)  warns.push(t('fcLineFillNoParams'));
      if (!hourly) warns.push(t('fcLineFillNoHourly'));
      if (!param && !hourly) {
        setPullStatus({ type: 'warn', text: warns.join('. ') });
      } else {
        const when = hourly ? formatPeriodShort(hourly.period) : '';
        const text = `${t('fcLineFillPulledFrom')} «${line.name || line.id}»` +
          (when ? ` ${t('fcLineFillAt')} ${when}` : '');
        setPullStatus({ type: warns.length ? 'warn' : 'ok', text, warns });
      }
    } catch (e) {
      setPullStatus({ type: 'warn', text: t('fcLineFillNoHourly') });
    }
  }, [lines, wantMeter, t]);

  const handleSelBranch = useCallback((v) => { setSelBranch(v); setSelCalc(''); setSelLine(''); setPullStatus(null); }, []);
  const handleSelCalc   = useCallback((v) => { setSelCalc(v); setSelLine(''); setPullStatus(null); }, []);
  const handleSelLine   = useCallback((v) => {
    setSelLine(v);
    if (v) pullFromLine(v); else setPullStatus(null);
  }, [pullFromLine]);

  // Switching device type changes which calcs/lines are eligible — reset both.
  const handleMtype = useCallback((next) => {
    setMtype(next); setResults(null); setSelCalc(''); setSelLine(''); setPullStatus(null);
  }, []);

  const handleCalc = useCallback(() => {
    const errs = {};
    const pf = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
    const req = (f, v, lo, hi) => {
      if (v === null) { errs[f] = t('fcEnterValue'); return null; }
      if (lo != null && v < lo) { errs[f] = `${t('fcMin')}: ${lo}`; return null; }
      if (hi != null && v > hi) { errs[f] = `${t('fcMax')}: ${hi}`; return null; }
      return v;
    };

    // Kst must be selected
    if (s.kst === 0) { setErrors({ kst: t('fcSelectKst') }); return; }

    // Ranges are the ГОСТ 30319 validity limits (InputParameters.CheckValues).
    const rho = req('rho', pf(s.rho), 0.67, 1.0);
    const co2 = pf(s.co2) ?? 0;
    const n2  = pf(s.n2)  ?? 0;
    if (co2 < 0 || co2 > 16) errs.co2 = t('fcRangeCo2N2');
    if (n2  < 0 || n2  > 16) errs.n2  = t('fcRangeCo2N2');
    const tC  = req('t', pf(s.t), -23.15, 70);
    const pv  = req('p', pf(s.p), 0);

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const pPa = pv * P_UNITS[s.pU].k;
    const P1_Pa = s.pType === 0
      ? pPa
      : pPa + (pf(s.patm) ?? 101325) * P_UNITS[s.patmU].k;
    if (P1_Pa <= 0) { setErrors({ p: t('fcPMustPositive') }); return; }

    const gamma = rho / RHO_AIR;
    const T_K   = tC + 273.15;
    const P_MPa = P1_Pa * 1e-6;
    // The Z correlations are only defined over 0.1…11 MPa absolute.
    if (P_MPa < 0.1 || P_MPa > 11) { setErrors({ p: t('fcPRangeAbs') }); return; }

    const xa = n2 / 100, xy = co2 / 100;
    const Tpc = tpk(rho, xa, xy);
    const Ppc = ppk(rho, xa, xy);
    const Pr  = P_MPa / Ppc;
    const Tr  = T_K / Tpc;
    const Zc = zStd(rho, xa, xy);
    const Z  = s.kst === 1 ? zGERG91(rho, xa, xy, P_MPa, T_K)
                           : zNX19(rho, xa, xy, P_MPa, T_K);
    // K = Z/Zc is what ГОСТ 30319 calls the compressibility ratio; the working
    // density and the conversion factor both go through it (ф. 6 ГОСТ 30319.1).
    const K  = Z / Zc;
    const Kp = (P_MPa / P0) * (T0 / T_K) / K;
    const rho_w = rho * Kp;
    const mu    = gasViscosity(rho, xa, xy, P_MPa, T_K);
    const kappa = adiabat(rho, xa, P_MPa, T_K);

    let oRes = null, Q_w = 0, Q_std = null;

    if (mtype === 'orifice') {
      const D20v = req('D20', pf(s.D20), 50, 1200);
      const d20v = req('d20', pf(s.d20), 12.5, 960);
      const dpv  = req('dp',  pf(s.dp),  0);
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }

      const dP_Pa = dpv * P_UNITS[s.dpU].k;
      if (dP_Pa >= P1_Pa) { setErrors({ dp: t('fcDpMustLessP') }); return; }

      // Ranges match TrySetRsh/TrySetRn/TrySetTorifice in CalcDSTU8586.dll.
      // Edge radius and operating time default to 0 (a freshly sharp orifice),
      // which drives Кп to 1 rather than erroring out.
      const rshv   = req('rsh', pf(s.rsh), 0.001, 2.5);
      const rEdgev = s.rEdge === '' ? 0 : req('rEdge', pf(s.rEdge), 0, 1.0);
      const yearsv = s.timeOrifice === '' ? 0 : req('timeOrifice', pf(s.timeOrifice), 0, 100);
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }

      const kD = expansionFactor(s.matPipe, tC);
      const kd = expansionFactor(s.matOrifice, tC);
      const DT = D20v * kD;
      const dT = d20v * kd;
      const beta = dT / DT;
      if (beta < 0.1 || beta > 0.75) {
        setErrors({ d20: `β = ${beta.toFixed(4)} ${t('fcBetaRange')}` });
        return;
      }

      oRes = orificeFlow({ D_mm: D20v, d_mm: d20v, kD, kd,
        dP_Pa, P1_Pa, rho_w, mu, otborIdx: s.otbor, kappa,
        Rsh_mm: rshv, rEdge_mm: rEdgev, years: yearsv, timeType: s.timeType });
      Q_w   = oRes.qm / rho_w * 3600;
      Q_std = oRes.qm / rho  * 3600;
    } else {
      Q_w   = pf(s.qw) ?? 0;
      Q_std = Q_w > 0 ? Q_w * Kp : null;
    }

    setResults({ kst: s.kst, Z, Zc, K, Kp, rho_w, rho, gamma, Tpc, Ppc, Pr, Tr, P_MPa, T_K, mu, kappa, oRes, Q_w, Q_std });
    setErrors({});
  }, [s, mtype, t]);

  const handleReset = useCallback(() => {
    setS(INIT); setErrors({}); setResults(null);
  }, []);

  const showAtm = s.pType === 1;
  const kstMethod = s.kst > 0 ? KST_METHODS[s.kst] : '';

  return (
    <div className="flow-calc-page">
      <div className="flow-calc-header">
        <h2>{t('fcTitle')}</h2>
      </div>

      <div className="flow-calc-body">

        {/* ── LEFT ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Device type radio */}
          <div className="cf-device-row">
            <span className="cf-device-label">{t('fcSelectConverter')}</span>
            <label className="cf-radio">
              <input type="radio" name="mtype" checked={mtype === 'orifice'}
                onChange={() => handleMtype('orifice')} />
              {t('fcOrificeDevice')}
            </label>
            <label className="cf-radio">
              <input type="radio" name="mtype" checked={mtype === 'meter'}
                onChange={() => handleMtype('meter')} />
              {t('fcMeter')}
            </label>
          </div>

          {/* Auto-fill from line */}
          <div className="flow-panel">
            <div className="flow-panel-header">{t('fcLineFillTitle')}</div>
            <div className="flow-panel-body">
              <div className="cf-row">
                <label className="cf-label" htmlFor="fc-fill-branch">{t('fcLineFillBranch')}:</label>
                <select id="fc-fill-branch" className="cf-select" value={selBranch}
                  onChange={e => handleSelBranch(e.target.value)}>
                  <option value="">{t('fcLineFillAllBranches')}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <span className="cf-unit" />
              </div>
              <div className="cf-row">
                <label className="cf-label" htmlFor="fc-fill-calc">{t('fcLineFillCalc')}:</label>
                <select id="fc-fill-calc" className="cf-select" value={selCalc}
                  onChange={e => handleSelCalc(e.target.value)}>
                  <option value="">{t('fcLineFillAllCalcs')}</option>
                  {filteredCalcs.map(c => <option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>)}
                </select>
                <span className="cf-unit" />
              </div>
              <div className="cf-row">
                <label className="cf-label" htmlFor="fc-fill-line">{t('fcLineFillLine')}:</label>
                <select id="fc-fill-line" className="cf-select" value={selLine}
                  onChange={e => handleSelLine(e.target.value)}>
                  <option value="">{t('fcLineFillSelectLine')}</option>
                  {filteredLines.map(l => <option key={l.id} value={l.id}>{l.name || `#${l.id}`}</option>)}
                </select>
                <span className="cf-unit" />
              </div>
              {pullStatus && (
                <div style={{ padding: '4px 2px 0', fontSize: 13,
                  color: pullStatus.type === 'ok' ? '#7bbf2b'
                       : pullStatus.type === 'warn' ? '#e0a020' : '#aaa' }}>
                  <div>{pullStatus.text}</div>
                  {pullStatus.warns && pullStatus.warns.length > 0 && (
                    <div style={{ color: '#e0a020' }}>{pullStatus.warns.join('; ')}</div>
                  )}
                  {pullStatus.type === 'ok' && (
                    <div style={{ color: '#888', marginTop: 2 }}>{t('fcLineFillHint')}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* General params */}
          <div className="flow-panel">
            <div className="flow-panel-header">{t('fcGeneralParams')}</div>
            <div className="flow-panel-body cf-general-grid">
              <div>
                <SelectRow id="kst" label="К<sub>ст</sub>:" value={s.kst}
                  onChange={v => set('kst', v)} opts={KST_METHODS} placeholderIdx={0} />
                {errors.kst && <div className="cf-error">{errors.kst}</div>}
                <InputRow id="rho" label={t('fcDensityLabel')} value={s.rho}
                  onChange={v => set('rho', v)} unit="кг/м³"
                  min={0.67} max={1.0} step="0.0001" error={errors.rho} />
                <InputRow id="co2" label={t('fcCo2Label')} value={s.co2}
                  onChange={v => set('co2', v)} unit="мол.%"
                  min={0} max={16} step="0.01" placeholder="0" error={errors.co2} />
                <InputRow id="n2" label={t('fcN2Label')} value={s.n2}
                  onChange={v => set('n2', v)} unit="мол.%"
                  min={0} max={16} step="0.01" placeholder="0" />
              </div>
              <div>
                <SelectRow id="pType" label={t('fcPressureTypeLabel')} value={s.pType}
                  onChange={v => set('pType', v)} opts={P_TYPES} />
                {showAtm ? (
                  <InputUnitRow id="patm" label={t('fcAtmPressureLabel')} value={s.patm}
                    onChange={v => set('patm', v)} uIdx={s.patmU} onUnit={v => set('patmU', v)}
                    units={P_UNITS} min={90000} max={120000} step="0.001" error={errors.patm} />
                ) : (
                  <div className="cf-row cf-row-empty">
                    <span className="cf-label" dangerouslySetInnerHTML={{ __html: t('fcAtmPressureLabel') }} />
                    <span className="cf-input-placeholder">—</span>
                    <span className="cf-unit" />
                  </div>
                )}
                <InputUnitRow id="p" label={t('fcPressureLabel')} value={s.p}
                  onChange={v => set('p', v)} uIdx={s.pU} onUnit={v => set('pU', v)}
                  units={P_UNITS} min={0} max={99999999} step="0.001" error={errors.p} />
                <InputRow id="t" label={t('fcTemperatureLabel')} value={s.t}
                  onChange={v => set('t', v)} unit="°C"
                  min={-23.15} max={70} step="0.1" error={errors.t} />
              </div>
            </div>
          </div>

          {/* Orifice params */}
          {mtype === 'orifice' && (
            <div className="flow-panel">
              <div className="flow-panel-header">{t('fcOrificeParams')}</div>
              <div className="flow-panel-body cf-orifice-grid">
                <div>
                  <SelectRow id="otbor" label={t('fcOtborLabel')} value={s.otbor}
                    onChange={v => set('otbor', v)} opts={OTBOR} />
                  <InputUnitRow id="dp" label={t('fcDpLabel')} value={s.dp}
                    onChange={v => set('dp', v)} uIdx={s.dpU} onUnit={v => set('dpU', v)}
                    units={P_UNITS} min={0} max={9999999} step="0.1" error={errors.dp} />
                  <InputRow id="D20" label="D₂₀, мм:" value={s.D20}
                    onChange={v => set('D20', v)} unit="мм"
                    min={50} max={1200} step="0.01" error={errors.D20} />
                  <SelectRow id="matPipe" label={t('fcMatPipeLabel')} value={s.matPipe}
                    onChange={v => set('matPipe', v)} opts={MATERIALS} />
                  <InputRow id="rsh" label={t('fcRoughnessLabel')} value={s.rsh}
                    onChange={v => set('rsh', v)} unit="мм"
                    min={0.001} max={2.5} step="0.001" error={errors.rsh} />
                </div>
                <div>
                  <InputRow id="d20" label="d₂₀, мм:" value={s.d20}
                    onChange={v => set('d20', v)} unit="мм"
                    min={12.5} max={960} step="0.01" error={errors.d20} />
                  <SelectRow id="matOrifice" label={t('fcMatOrificeLabel')} value={s.matOrifice}
                    onChange={v => set('matOrifice', v)} opts={MATERIALS} />
                  <InputRow id="rEdge" label={t('fcEdgeRadiusLabel')} value={s.rEdge}
                    onChange={v => set('rEdge', v)} unit="мм"
                    min={0} max={1.0} step="0.01" placeholder="0" error={errors.rEdge} />
                  <SelectRow id="timeType" label={t('fcTimeTypeLabel')} value={s.timeType}
                    onChange={v => set('timeType', v)} opts={TIME_TYPES} />
                  <InputRow id="timeOrifice" label={t('fcTimeOrificeLabel')} value={s.timeOrifice}
                    onChange={v => set('timeOrifice', v)} unit={t('fcUnitYear')}
                    min={0} max={100} step="0.1" placeholder="0" error={errors.timeOrifice} />
                </div>
              </div>
            </div>
          )}

          {/* Meter params */}
          {mtype === 'meter' && (
            <div className="flow-panel">
              <div className="flow-panel-header">{t('fcMeterParams')}</div>
              <div className="flow-panel-body">
                <InputRow id="qw" label={t('fcWorkVolumeLabel')} value={s.qw}
                  onChange={v => set('qw', v)} unit={t('fcUnitM3h')}
                  min={0} max={9999999} step="0.001" error={errors.qw} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="fc-btn-calc" onClick={handleCalc}>{t('fcCalculate')}</button>
            <button className="fc-btn-reset" onClick={handleReset}>{t('fcReset')}</button>
          </div>
          {Object.keys(errors).length > 0 && (
            <div className="cf-error" style={{ marginTop: 2 }}>
              {errors.kst || t('fcFixErrors')}
            </div>
          )}
        </div>

        {/* ── RIGHT: Results ── */}
        <div className="flow-panel" style={{ alignSelf: 'start' }}>
          <div className="flow-panel-header">{t('fcResults')}</div>
          <div className="flow-panel-body">
            {!results ? (
              <div className="fc-placeholder">
                <div className="fc-placeholder-icon">⚙</div>
                <p>{t('fcEnterParamsPrompt')}<br /><strong>{t('fcCalculate')}</strong></p>
              </div>
            ) : (
              <>
                <div className="cf-res-group">{t('fcGasParams')}</div>
                <ResRow label={t('fcGamma')} value={fmt(results.gamma, 4)} unit="—" />
                <ResRow label={t('fcZ')} value={fmt(results.Z, 5)} unit="—"
                  std={results.kst === 1 ? STD.zGerg : STD.zNx} />
                <ResRow label={t('fcZc')} value={fmt(results.Zc, 5)} unit="—" std={STD.zc} />
                <ResRow label={t('fcKcompr')} value={fmt(results.K, 5)} unit="—" std={STD.k} />
                <ResRow label={t('fcRhoW')} value={fmt(results.rho_w, 4)} unit="кг/м³" std={STD.rhoW} />
                <ResRow label={t('fcMu')} value={fmt(results.mu * 1e6, 3)} unit="мкПа·с" std={STD.mu} />

                <div className="cf-res-group">{t('fcPseudocritical')}</div>
                <ResRow label="T<sub>пк</sub>" value={fmt(results.Tpc, 2)} unit="K" std={STD.tpk} />
                <ResRow label="P<sub>пк</sub>" value={fmt(results.Ppc, 4)} unit="МПа" std={STD.ppk} />
                <ResRow label="P<sub>пр</sub>" value={fmt(results.Pr, 4)} unit="—" />
                <ResRow label="T<sub>пр</sub>" value={fmt(results.Tr, 4)} unit="—" />

                {results.oRes && (
                  <>
                    <div className="cf-res-group">{t('fcOrificeGroup')}</div>
                    <ResRow label="D<sub>T</sub>" value={fmt(results.oRes.DT_mm, 3)} unit="мм" std={STD.DT} />
                    <ResRow label="d<sub>T</sub>" value={fmt(results.oRes.dT_mm, 3)} unit="мм" std={STD.dT} />
                    <ResRow label="β = d/D" value={fmt(results.oRes.beta, 4)} unit="—" std={STD.beta} />
                    <ResRow label={t('fcC')} value={fmt(results.oRes.C, 5)} unit="—" std={STD.C} />
                    <ResRow label={t('fcKsh')} value={fmt(results.oRes.Ksh, 5)} unit="—" std={STD.ksh} />
                    <ResRow label={t('fcKbl')} value={fmt(results.oRes.Kbl, 5)} unit="—" std={STD.kbl} />
                    <ResRow label={t('fcEps')} value={fmt(results.oRes.eps, 5)} unit="—" std={STD.eps} />
                    <ResRow label="Re<sub>D</sub>" value={results.oRes.Re_D.toFixed(0)} unit="—" std={STD.re} />
                  </>
                )}

                <div className="cf-res-group">{t('fcVolumeReduction')}</div>
                <ResRow label={t('fcKp')} value={fmt(results.Kp, 5)} unit="—" std={STD.rhoW} />
                {results.Q_w > 0 && (
                  <ResRow label={t('fcQw')}
                    value={fmt(results.Q_w, 4)} unit={t('fcUnitM3h')}
                    std={mtype === 'orifice' ? STD.q : undefined} />
                )}
                {results.Q_std !== null && (
                  <div className="cf-res-row cf-res-highlight">
                    <span className="cf-res-label">
                      <span dangerouslySetInnerHTML={{ __html:
                        mtype === 'orifice' ? t('fcQstOrifice') : t('fcVstMeter')
                      }} />
                      <span className="cf-res-std">
                        {mtype === 'orifice' ? STD.q : STD.rhoW}
                      </span>
                    </span>
                    <span className="cf-res-value">{fmt(results.Q_std, 4)}</span>
                    <span className="cf-res-unit">
                      {mtype === 'orifice' ? t('fcUnitM3hStd') : t('fcUnitM3Std')}
                    </span>
                  </div>
                )}

                <div className="fc-info-box" style={{ marginTop: 12 }}>
                  <strong>К<sub>ст</sub>:</strong> {kstMethod} — ГОСТ 30319.2<br />
                  {results.oRes ? (
                    <>
                      <strong>{t('fcStdOrifice')}:</strong> ДСТУ ГОСТ 8.586.1, 8.586.2, 8.586.5<br />
                      <strong>κ:</strong> {fmt(results.kappa, 4)} — ГОСТ 30319.1, ф. 28<br />
                    </>
                  ) : null}
                  T₀ = 20 °C, P₀ = 101.325 кПа (ДСТУ 8585)
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
