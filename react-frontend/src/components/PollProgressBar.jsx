import React from 'react';
import './PollProgressBar.css';

/**
 * Progress bar for long enterprise (DPD) polls fed by the NDJSON stream.
 *
 * @param {object|null} progress - { done?, total?, phase? } from
 *   enterpriseStream.fetchVolumes onProgress, or null to render nothing.
 *   phase: 'waiting' (another poll holds the branch lock), 'polling',
 *   'aggregating' (server-side post-processing).
 */
export default function PollProgressBar({ progress }) {
  if (!progress) return null;
  const { done, total, phase } = progress;
  const pct = phase === 'polling' && total > 0
    ? Math.min(100, Math.round((done / total) * 100))
    : null;

  let label;
  if (phase === 'waiting') label = 'Очікування іншого опитування…';
  else if (phase === 'aggregating') label = 'Обробка даних…';
  else if (pct !== null) label = `Опитано ${done} із ${total} приладів (${pct}%)`;
  else label = 'Опитування…';

  return (
    <div className="poll-progress" role="progressbar"
         aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
      <div className="poll-progress-track">
        <div
          className={`poll-progress-fill${pct === null ? ' indeterminate' : ''}`}
          style={pct !== null ? { width: `${pct}%` } : undefined}
        />
      </div>
      <span className="poll-progress-label">{label}</span>
    </div>
  );
}
