import React, { useState } from 'react';
import './WhatsNewModal.css';
import { useLanguage } from '../contexts/LanguageContext';
import { CHANGELOG } from '../constants/changelog';

// Format a YYYY-MM-DD string as DD.MM.YYYY without any timezone shift.
function formatDate(date) {
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(date);
}

// Paginated "What's new" dialog — one changelog entry per page (newest first).
export default function WhatsNewModal({ onClose }) {
  const { t, currentLanguage } = useLanguage();
  const lang = currentLanguage === 'uk' ? 'uk' : 'ru';
  const [page, setPage] = useState(0);

  const total = CHANGELOG.length;
  const entry = CHANGELOG[page];
  if (!entry) return null;

  return (
    <div className="wn-overlay" onClick={onClose}>
      <div className="wn-modal" onClick={e => e.stopPropagation()}>
        <div className="wn-header">
          <h3>{t('whatsNewTitle')}</h3>
          <button className="wn-close" onClick={onClose} aria-label="close">×</button>
        </div>

        <div className="wn-body">
          <div className="wn-date">{formatDate(entry.date)}</div>
          <div className="wn-entry-title">{entry.title[lang]}</div>
          <ul className="wn-items">
            {entry.items[lang].map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </div>

        <div className="wn-footer">
          <button
            className="wn-nav"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page <= 0}
            title={t('whatsNewNewer')}
          >‹</button>
          <span className="wn-page">{page + 1} / {total}</span>
          <button
            className="wn-nav"
            onClick={() => setPage(p => Math.min(total - 1, p + 1))}
            disabled={page >= total - 1}
            title={t('whatsNewOlder')}
          >›</button>
        </div>
      </div>
    </div>
  );
}
