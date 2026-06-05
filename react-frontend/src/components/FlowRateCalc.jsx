import React, { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { P_UNITS } from '../constants/pressureUnits';
import './FlowRateCalc.css';

// ─── Constants (exact values from CalcDSTU8586.dll / Ask2 XAML) ───────────────

const T0 = 293.15;       // standard temperature, K (20°C, ДСТУ 8585)
const P0 = 0.101325;     // standard pressure, MPa
const Z0 = 0.99988;      // Z at standard conditions
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

// ─── Physics ──────────────────────────────────────────────────────────────────

function pseudocritical(gamma, co2pct, n2pct) {
  // Sutton (1985) + corrections for CO2 and N2
  const Tpc = (169.2 + 349.5 * gamma - 74 * gamma ** 2) * (5 / 9);
  const Ppc = (756.8 - 131 * gamma - 3.6 * gamma ** 2) * 0.006895;
  return {
    Tpc: Tpc * (1 - 0.12 * co2pct / 100 - 0.06 * n2pct / 100),
    Ppc: Ppc * (1 - 0.06 * co2pct / 100 - 0.03 * n2pct / 100),
  };
}

// GERG-91 / ГОСТ 30319.2: Dranchuk-Abou-Kassem iterative method
function zGERG91(Pr, Tr) {
  const c = [0.3265,-1.0700,-0.5339,0.01569,-0.05165,
              0.5475,-0.7361,0.1844,0.1056,0.6134,0.7210];
  const [A1,A2,A3,A4,A5,A6,A7,A8,A9,A10,A11] = c;
  let Z = 1.0;
  for (let i = 0; i < 60; i++) {
    const rho = 0.27 * Pr / (Z * Tr);
    const r2 = rho * rho;
    const r5 = r2 * r2 * rho;
    const ex = Math.exp(-A11 * r2);
    const Zn = 1
      + (A1 + A2/Tr + A3/Tr**3 + A4/Tr**4 + A5/Tr**5) * rho
      + (A6 + A7/Tr + A8/Tr**2) * r2
      - A9 * (A7/Tr + A8/Tr**2) * r5
      + A10 * (1 + A11*r2) * (r2/Tr**3) * ex;
    if (Math.abs(Zn - Z) < 1e-7) { Z = Zn; break; }
    Z = Zn;
  }
  return Z;
}

// NX-19 / ГОСТ 30319.1: Papay simplified correlation
function zNX19(Pr, Tr) {
  return 1 - 3.52 * Pr / 10 ** (0.9813 * Tr) + 0.274 * Pr ** 2 / 10 ** (0.8157 * Tr);
}

// Dynamic viscosity, ГОСТ 30319.1 formula 44/45
function gasViscosity(gamma, T_K) {
  const M = gamma * 28.97;
  return (9.4 + 0.02 * M) * T_K ** 1.5 / (209 + 19 * M + T_K) * 1e-7;
}

// ISO 5167-2 Reader-Harris/Gallagher discharge coefficient
function dischargeCoeff(beta, Re_D, otborIdx, D_mm) {
  let L1, L2p;
  if (otborIdx === 1) { L1 = 1; L2p = 0.47; }            // трьохрадіусний (D-D/2)
  else if (otborIdx === 2) { L1 = 25.4 / D_mm; L2p = 25.4 / D_mm; }  // фланцевий
  else { L1 = 0; L2p = 0; }                               // кутовий

  const A = (19000 * beta / Re_D) ** 0.8;
  const M2 = 2 * L2p / (1 - beta);
  return 0.5961 + 0.0261 * beta ** 2 - 0.216 * beta ** 8
    + 0.000521 * (1e6 * beta / Re_D) ** 0.7
    + (0.0188 + 0.0063 * A) * beta ** 3.5 * (1e6 / Re_D) ** 0.3
    + (0.043 + 0.080 * Math.exp(-10 * L1) - 0.123 * Math.exp(-7 * L1))
      * (1 - 0.11 * A) * beta ** 4 / (1 - beta ** 4)
    - 0.031 * (M2 - 0.8 * M2 ** 1.1) * beta ** 1.3;
}

// ISO 5167-2 expansibility factor for gas (κ uses adiabat from ГОСТ 30319.1 ф.28)
function expansibility(beta, dP_Pa, P1_Pa, kappa) {
  const tau = 1 - dP_Pa / P1_Pa;
  return 1 - (0.351 + 0.256 * beta ** 4 + 0.93 * beta ** 8) * (1 - tau ** (1 / kappa));
}

function orificeFlow({ D_mm, d_mm, alphaD, alphad, T, dP_Pa, P1_Pa, rho_w, mu, otborIdx, kappa }) {
  const DT = D_mm * 1e-3 * (1 + alphaD * (T - 20));
  const dT = d_mm * 1e-3 * (1 + alphad * (T - 20));
  const beta = dT / DT;
  const E = 1 / Math.sqrt(1 - beta ** 4);
  const A0 = Math.PI / 4 * dT ** 2;
  const eps = expansibility(beta, dP_Pa, P1_Pa, kappa);

  let C = 0.6;
  let qm = C * eps * E * A0 * Math.sqrt(2 * dP_Pa * rho_w);
  for (let i = 0; i < 25; i++) {
    const Re = qm > 0 ? 4 * qm / (Math.PI * mu * DT) : 1;
    const Cn = dischargeCoeff(beta, Re, otborIdx, D_mm);
    const qn = Cn * eps * E * A0 * Math.sqrt(2 * dP_Pa * rho_w);
    if (Math.abs(qn - qm) < 1e-12) { C = Cn; qm = qn; break; }
    C = Cn; qm = qn;
  }
  const Re_D = 4 * qm / (Math.PI * mu * DT);
  return { qm, C, eps, beta, DT_mm: DT * 1e3, dT_mm: dT * 1e3, Re_D };
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

function ResRow({ label, value, unit }) {
  return (
    <div className="cf-res-row">
      <span className="cf-res-label" dangerouslySetInnerHTML={{ __html: label }} />
      <span className="cf-res-value">{value}</span>
      <span className="cf-res-unit" dangerouslySetInnerHTML={{ __html: unit }} />
    </div>
  );
}

function fmt(n, d = 4) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—';
  return n.toFixed(d);
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

    const rho = req('rho', pf(s.rho), 0.66, 1.0);
    const co2 = pf(s.co2) ?? 0;
    const n2  = pf(s.n2)  ?? 0;
    if (co2 < 0 || co2 > 16) errs.co2 = t('fcRangeCo2N2');
    if (n2  < 0 || n2  > 16) errs.n2  = t('fcRangeCo2N2');
    const t   = req('t', pf(s.t), -23.15, 70);
    const pv  = req('p', pf(s.p), 0);

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const pPa = pv * P_UNITS[s.pU].k;
    const P1_Pa = s.pType === 0
      ? pPa
      : pPa + (pf(s.patm) ?? 101325) * P_UNITS[s.patmU].k;
    if (P1_Pa <= 0) { setErrors({ p: t('fcPMustPositive') }); return; }

    const gamma = rho / RHO_AIR;
    const T_K   = t + 273.15;
    const P_MPa = P1_Pa * 1e-6;
    const { Tpc, Ppc } = pseudocritical(gamma, co2, n2);
    const Pr = P_MPa / Ppc;
    const Tr = T_K / Tpc;
    const Z  = s.kst === 1 ? zGERG91(Pr, Tr) : zNX19(Pr, Tr);
    const Kp = (P_MPa / P0) * (T0 / T_K) * (Z0 / Z);
    const rho_w = rho * Kp;
    const mu    = gasViscosity(gamma, T_K);

    // Isentropic exponent (adiabat) – ГОСТ 30319.1 ф.28 simplified
    const kappa = 1.31 + 0.02 * (P_MPa - 0.101325) / 9.9;

    let oRes = null, Q_w = 0, Q_std = null;

    if (mtype === 'orifice') {
      const D20v = req('D20', pf(s.D20), 50, 1200);
      const d20v = req('d20', pf(s.d20), 12.5, 960);
      const dpv  = req('dp',  pf(s.dp),  0);
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }

      const dP_Pa = dpv * P_UNITS[s.dpU].k;
      if (dP_Pa >= P1_Pa) { setErrors({ dp: t('fcDpMustLessP') }); return; }

      const alphaD = MATERIALS[s.matPipe]?.a   ?? 11.9e-6;
      const alphad = MATERIALS[s.matOrifice]?.a ?? 16.7e-6;
      const DT = D20v * (1 + alphaD * (t - 20));
      const dT = d20v * (1 + alphad * (t - 20));
      const beta = dT / DT;
      if (beta < 0.1 || beta > 0.75) {
        setErrors({ d20: `β = ${beta.toFixed(4)} ${t('fcBetaRange')}` });
        return;
      }

      oRes = orificeFlow({ D_mm: D20v, d_mm: d20v, alphaD, alphad, T: t,
        dP_Pa, P1_Pa, rho_w, mu, otborIdx: s.otbor, kappa });
      Q_w   = oRes.qm / rho_w * 3600;
      Q_std = oRes.qm / rho  * 3600;
    } else {
      Q_w   = pf(s.qw) ?? 0;
      Q_std = Q_w > 0 ? Q_w * Kp : null;
    }

    setResults({ Z, Kp, rho_w, rho, gamma, Tpc, Ppc, Pr, Tr, P_MPa, T_K, mu, kappa, oRes, Q_w, Q_std });
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
                onChange={() => { setMtype('orifice'); setResults(null); }} />
              {t('fcOrificeDevice')}
            </label>
            <label className="cf-radio">
              <input type="radio" name="mtype" checked={mtype === 'meter'}
                onChange={() => { setMtype('meter'); setResults(null); }} />
              {t('fcMeter')}
            </label>
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
                  min={0.66} max={1.0} step="0.0001" error={errors.rho} />
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
                    min={0} max={2.5} step="0.001" />
                </div>
                <div>
                  <InputRow id="d20" label="d₂₀, мм:" value={s.d20}
                    onChange={v => set('d20', v)} unit="мм"
                    min={12.5} max={960} step="0.01" error={errors.d20} />
                  <SelectRow id="matOrifice" label={t('fcMatOrificeLabel')} value={s.matOrifice}
                    onChange={v => set('matOrifice', v)} opts={MATERIALS} />
                  <InputRow id="rEdge" label={t('fcEdgeRadiusLabel')} value={s.rEdge}
                    onChange={v => set('rEdge', v)} unit="мм"
                    min={0} max={1.0} step="0.01" placeholder="0" />
                  <SelectRow id="timeType" label={t('fcTimeTypeLabel')} value={s.timeType}
                    onChange={v => set('timeType', v)} opts={TIME_TYPES} />
                  <InputRow id="timeOrifice" label={t('fcTimeOrificeLabel')} value={s.timeOrifice}
                    onChange={v => set('timeOrifice', v)} unit={t('fcUnitYear')}
                    min={0} max={100} step="0.1" placeholder="0" />
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
                <ResRow label={t('fcZ')} value={fmt(results.Z, 5)} unit="—" />
                <ResRow label={t('fcRhoW')} value={fmt(results.rho_w, 4)} unit="кг/м³" />
                <ResRow label={t('fcMu')} value={fmt(results.mu * 1e6, 3)} unit="мкПа·с" />

                <div className="cf-res-group">{t('fcPseudocritical')}</div>
                <ResRow label="T<sub>пк</sub>" value={fmt(results.Tpc, 2)} unit="K" />
                <ResRow label="P<sub>пк</sub>" value={fmt(results.Ppc, 4)} unit="МПа" />
                <ResRow label="P<sub>пр</sub>" value={fmt(results.Pr, 4)} unit="—" />
                <ResRow label="T<sub>пр</sub>" value={fmt(results.Tr, 4)} unit="—" />

                {results.oRes && (
                  <>
                    <div className="cf-res-group">{t('fcOrificeGroup')}</div>
                    <ResRow label="D<sub>T</sub>" value={fmt(results.oRes.DT_mm, 3)} unit="мм" />
                    <ResRow label="d<sub>T</sub>" value={fmt(results.oRes.dT_mm, 3)} unit="мм" />
                    <ResRow label="β = d/D" value={fmt(results.oRes.beta, 4)} unit="—" />
                    <ResRow label={t('fcC')} value={fmt(results.oRes.C, 5)} unit="—" />
                    <ResRow label={t('fcEps')} value={fmt(results.oRes.eps, 5)} unit="—" />
                    <ResRow label="Re<sub>D</sub>" value={results.oRes.Re_D.toFixed(0)} unit="—" />
                  </>
                )}

                <div className="cf-res-group">{t('fcVolumeReduction')}</div>
                <ResRow label={t('fcKp')} value={fmt(results.Kp, 5)} unit="—" />
                {results.Q_w > 0 && (
                  <ResRow label={t('fcQw')}
                    value={fmt(results.Q_w, 4)} unit={t('fcUnitM3h')} />
                )}
                {results.Q_std !== null && (
                  <div className="cf-res-row cf-res-highlight">
                    <span className="cf-res-label" dangerouslySetInnerHTML={{ __html:
                      mtype === 'orifice' ? t('fcQstOrifice') : t('fcVstMeter')
                    }} />
                    <span className="cf-res-value">{fmt(results.Q_std, 4)}</span>
                    <span className="cf-res-unit">
                      {mtype === 'orifice' ? t('fcUnitM3hStd') : t('fcUnitM3Std')}
                    </span>
                  </div>
                )}

                <div className="fc-info-box" style={{ marginTop: 12 }}>
                  <strong>К<sub>ст</sub>:</strong> {kstMethod} (ГОСТ 30319)<br />
                  {results.oRes ? <><strong>C, ε:</strong> ДСТУ ГОСТ 8.586.2<br /></> : null}
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
