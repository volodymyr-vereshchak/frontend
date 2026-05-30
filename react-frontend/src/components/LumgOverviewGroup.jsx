import React from 'react';
import './LumgOverviewGroup.css';
import PressureGaugesGrid from './PressureGaugesGrid';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Collapsible LUMG group for the Overview tab.
 * Renders a header (LUMG name + line count + chevron) and, when expanded,
 * the grid of pressure/flow/volume tiles for the lines belonging to this LUMG.
 */
const LumgOverviewGroup = ({ group, data, collapsed, onToggle }) => {
  const { t } = useLanguage();
  const {
    pressures,
    lineNames,
    pressureTimestamps,
    flowComparisons,
    volumeComparisons,
    currentPeriod,
  } = data;

  const lineIdSet = new Set(group.lineIds);

  // Subset of pressures keyed by this LUMG's line ids
  const subPressures = {};
  group.lineIds.forEach(id => {
    if (pressures && pressures[id]) subPressures[id] = pressures[id];
  });

  const subFlow = (flowComparisons || []).filter(f => lineIdSet.has(f.lineId));
  const subVolume = (volumeComparisons || []).filter(v => lineIdSet.has(v.lineId));

  return (
    <div className={`lumg-group${collapsed ? ' lumg-group--collapsed' : ''}`}>
      <button
        type="button"
        className="lumg-group-header"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span className={`lumg-group-chevron${collapsed ? ' collapsed' : ''}`}>▾</span>
        <span className="lumg-group-name">{group.lumgName}</span>
        <span className="lumg-group-count">
          {group.lineIds.length} {t('linesCount')}
        </span>
      </button>

      {!collapsed && (
        Object.keys(subPressures).length > 0 ? (
          <div className="lumg-group-body">
            <PressureGaugesGrid
              pressures={subPressures}
              lineNames={lineNames}
              timestamps={pressureTimestamps}
              referenceTime={currentPeriod?.end}
              flowComparisons={subFlow}
              volumeComparisons={subVolume}
            />
          </div>
        ) : (
          <div className="lumg-group-empty">{t('noLinesInLumg')}</div>
        )
      )}
    </div>
  );
};

export default LumgOverviewGroup;
