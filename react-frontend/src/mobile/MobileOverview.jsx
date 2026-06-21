import React, { useEffect, useMemo, useRef, useState } from 'react';
import './MobileOverview.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useOverviewData } from '../hooks/useOverviewData';
import PressureGauge from '../components/PressureGauge';

const pad = (n) => String(n).padStart(2, '0');
const fmtDateTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
const fmtVol = (n) =>
  (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toLocaleString('ru', { maximumFractionDigits: 1 });

/**
 * Mobile Overview: branch + LUMG selectors, a line jump dropdown (so you don't
 * have to swipe through many lines), a compact volume summary, and a swipeable
 * carousel of per-line cards. Date/time + active-lines are surfaced to the shell
 * header via onHeaderInfo. Reuses useOverviewData + PressureGauge.
 */
export default function MobileOverview({ onHeaderInfo }) {
  const { t } = useLanguage();
  const {
    branches,
    selectedBranchId,
    selectBranch,
    data,
    selectorLoading,
    isLoading,
    error,
    lastUpdateTime,
    reload,
  } = useOverviewData();

  const carouselRef = useRef(null);
  const [active, setActive] = useState(0);
  const [selectedLumgId, setSelectedLumgId] = useState(null); // null = all LUMGs

  // Push date/time + active count into the shell header; clear on unmount.
  useEffect(() => {
    if (!onHeaderInfo) return;
    if (data) {
      onHeaderInfo({
        time: fmtDateTime(lastUpdateTime),
        active: data.activeLines,
        total: data.totalLines,
      });
    } else {
      onHeaderInfo(null);
    }
    return () => onHeaderInfo(null);
  }, [data, lastUpdateTime, onHeaderInfo]);

  const lumgGroups = data?.lumgGroups || [];

  // Lines for the carousel: all report lines in LUMG order, optionally filtered to
  // one LUMG; only those that actually have pressure data.
  const lineIds = useMemo(() => {
    if (!data) return [];
    const groups = selectedLumgId
      ? lumgGroups.filter(g => g.lumgId === selectedLumgId)
      : lumgGroups;
    return groups.flatMap(g => g.lineIds).filter(id => data.pressures && data.pressures[id]);
  }, [data, lumgGroups, selectedLumgId]);

  const flowMap = useMemo(() => {
    const m = {};
    (data?.flowComparisons || []).forEach(f => { m[f.lineId] = f; });
    return m;
  }, [data]);
  const volumeMap = useMemo(() => {
    const m = {};
    (data?.volumeComparisons || []).forEach(v => { m[v.lineId] = v; });
    return m;
  }, [data]);

  // Reset to first card when the line set changes (branch/LUMG switch).
  useEffect(() => {
    setActive(0);
    if (carouselRef.current) carouselRef.current.scrollTo({ left: 0 });
  }, [selectedLumgId, selectedBranchId]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  const jumpTo = (idx) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
    setActive(idx);
  };

  const vc = data?.volumeComparison;
  const changeClass = vc?.isIncrease ? 'up' : vc?.isDecrease ? 'down' : 'flat';
  const changeIcon = vc?.isIncrease ? '▲' : vc?.isDecrease ? '▼' : '—';

  return (
    <div className="m-overview">
      {/* Controls: branch + LUMG */}
      <div className="m-controls">
        <select
          className="m-select"
          value={selectedBranchId ?? ''}
          onChange={(e) => { selectBranch(Number(e.target.value)); setSelectedLumgId(null); }}
          disabled={selectorLoading || branches.length === 0}
        >
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name || `Філія ${b.id}`}</option>
          ))}
        </select>

        <select
          className="m-select"
          value={selectedLumgId ?? ''}
          onChange={(e) => setSelectedLumgId(e.target.value ? Number(e.target.value) : null)}
          disabled={lumgGroups.length === 0}
        >
          <option value="">{t('allLumgs') || 'Всі ЛУМГ'}</option>
          {lumgGroups.map(g => (
            <option key={g.lumgId} value={g.lumgId}>{g.lumgName}</option>
          ))}
        </select>
      </div>

      {(selectorLoading || (isLoading && !data)) && (
        <div className="m-state">
          <div className="loading-spinner"></div>
          <p>{t('loading')}</p>
        </div>
      )}

      {!isLoading && error && !data && (
        <div className="m-state">
          <p className="m-error">⚠️ {error}</p>
          <button className="m-retry" onClick={reload}>{t('refreshNow')}</button>
        </div>
      )}

      {data && (
        <>
          {/* Compact summary: label on its own line, numbers below (table-like) */}
          <div className="m-summary">
            <span className="m-summary-label">{t('total24hVolume')}</span>
            <div className="m-summary-row">
              <span className="m-summary-value">{fmtVol(data.totalVolume24h)} м³</span>
              {vc && (
                <span className={`m-summary-change ${changeClass}`}>
                  {changeIcon} {fmtVol(Math.abs(vc.change))} ({fmtVol(Math.abs(vc.changePercent))}%)
                </span>
              )}
            </div>
          </div>

          {lineIds.length === 0 ? (
            <div className="m-state"><p>{t('noPressureData')}</p></div>
          ) : (
            <>
              {/* Line jump dropdown — pick a line instead of swiping */}
              <select
                className="m-select m-line-select"
                value={lineIds[active] != null ? String(lineIds[active]) : ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const idx = lineIds.indexOf(id);
                  if (idx >= 0) jumpTo(idx);
                }}
              >
                {lineIds.map((id, i) => (
                  <option key={id} value={String(id)}>
                    {`${i + 1}/${lineIds.length} · ${data.lineNames?.[id] || id}`}
                  </option>
                ))}
              </select>

              <div className="m-carousel" ref={carouselRef} onScroll={onScroll}>
                {lineIds.map(id => (
                  <div className="m-slide" key={id}>
                    <PressureGauge
                      lineId={id}
                      lineName={data.lineNames ? data.lineNames[id] : `${t('unknownLine')} ${id}`}
                      pressure={data.pressures[id]?.pressure || 0}
                      minPressure24h={data.pressures[id]?.minPressure24h}
                      maxPressure24h={data.pressures[id]?.maxPressure24h}
                      isHighPressure={data.pressures[id]?.isHighPressure || false}
                      timestamp={data.pressureTimestamps?.[id] || data.pressures[id]?.timestamp}
                      referenceTime={data.currentPeriod?.end}
                      flowData={flowMap[id]}
                      volumeData={volumeMap[id]}
                      dpData={data.pressures[id]?.dpData}
                      pressureUnit={data.pressures[id]?.pressureUnit}
                      dpUnit={data.pressures[id]?.dpUnit}
                    />
                  </div>
                ))}
              </div>

              <div className="m-dots">
                {lineIds.map((id, i) => (
                  <span
                    key={id}
                    className={`m-dot${i === active ? ' active' : ''}`}
                    onClick={() => jumpTo(i)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
