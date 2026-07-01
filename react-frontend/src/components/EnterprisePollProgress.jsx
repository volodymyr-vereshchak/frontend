import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './EnterprisePollProgress.css';

/**
 * Live progress bar for the enterprise (промисловість) DPD poll. Renders only
 * while a poll is in flight (progress has a positive total). Shared by the night
 * report, GRS trends and the archive chart overlay so the % logic lives in one
 * place.
 *
 * @param {{done:number,total:number}|null} progress
 */
export default function EnterprisePollProgress({ progress }) {
  const { t } = useLanguage();
  if (!progress || !progress.total) return null;

  const { done, total } = progress;
  const pct = Math.min(100, Math.round((done / total) * 100));

  return (
    <div className="ent-poll-progress">
      <div className="ent-poll-progress-head">
        <span>{t('pollingEnterprises')}</span>
        <span>{done}/{total} ({pct}%)</span>
      </div>
      <div className="ent-poll-progress-track">
        <div className="ent-poll-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
