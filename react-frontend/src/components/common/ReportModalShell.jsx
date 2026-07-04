import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Спільний каркас модалок-звітів: overlay, шапка із заголовком і хрестиком,
 * футер із кнопкою «Закрити» (плюс опційні додаткові кнопки).
 * Тіло звіту передається як children.
 */
export default function ReportModalShell({
  isOpen,
  onClose,
  title,
  className = '',
  footerExtra = null,
  children,
}) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {children}

        <div className="modal-footer">
          {footerExtra}
          <button className="btn btn-secondary" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
}

/** Стандартний блок «завантаження» усередині тіла звіту. */
export function LoadingBlock({ text }) {
  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>{text}</p>
    </div>
  );
}

/** Стандартний блок помилки усередині тіла звіту. */
export function ErrorBlock({ error }) {
  const { t } = useLanguage();
  return (
    <div className="error-container">
      <div className="error-icon">⚠️</div>
      <p className="error-message">{t('error')}: {error}</p>
    </div>
  );
}

/** Селект філії з підписом — однаковий у всіх звітах. */
export function BranchSelect({ branches, value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ color: '#B9E42B', fontSize: 13, whiteSpace: 'nowrap' }}>{label}:</label>
      <select
        style={{ background: '#2a2a2a', color: '#e0e0e0', border: '1px solid #404040', borderRadius: 4, padding: '5px 10px', fontSize: 13, minWidth: 180 }}
        value={value || ''}
        onChange={onChange}
      >
        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </div>
  );
}
