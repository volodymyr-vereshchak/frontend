import React, { useState } from 'react';
import './FlowComparisonTable.css';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Flow Comparison Table Component
 * Displays last hour flow vs previous hour for each GRS line
 */
const FlowComparisonTable = ({ data, lineNames }) => {
  const { t } = useLanguage();
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  if (!data || data.length === 0) {
    return (
      <div className="comparison-table-empty">
        <p>{t('noData')}</p>
      </div>
    );
  }

  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return num.toLocaleString('ru', { maximumFractionDigits: 3 });
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === bValue) return 0;

    const comparison = aValue < bValue ? -1 : 1;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const getChangeIcon = (isIncrease, isDecrease) => {
    if (isIncrease) return '↑';
    if (isDecrease) return '↓';
    return '—';
  };

  const getChangeColor = (isIncrease, isDecrease) => {
    if (isIncrease) return 'increase';
    if (isDecrease) return 'decrease';
    return 'neutral';
  };

  const isSignificantChange = (changePercent) => {
    return Math.abs(changePercent) > 10;
  };

  return (
    <div className="flow-comparison-table-container">
      <table className="comparison-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('lineId')} className="sortable">
              {t('lineName')}
              {sortConfig.key === 'lineId' && (
                <span className="sort-indicator">{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th onClick={() => handleSort('lastHour')} className="sortable numeric" title={`${t('lastHour')} (${t('volumeUnit')}/ч)`}>
              {t('lastHourShort')}
              {sortConfig.key === 'lastHour' && (
                <span className="sort-indicator">{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th onClick={() => handleSort('previousHour')} className="sortable numeric" title={`${t('previousHour')} (${t('volumeUnit')}/ч)`}>
              {t('previousHourShort')}
              {sortConfig.key === 'previousHour' && (
                <span className="sort-indicator">{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th onClick={() => handleSort('change')} className="sortable numeric" title={`${t('change')} (${t('volumeUnit')}/ч)`}>
              {t('changeShort')} ({t('volumeUnit')}/ч)
              {sortConfig.key === 'change' && (
                <span className="sort-indicator">{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th onClick={() => handleSort('changePercent')} className="sortable numeric" title={`${t('change')} (%)`}>
              {t('changeShort')} (%)
              {sortConfig.key === 'changePercent' && (
                <span className="sort-indicator">{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => {
            const lineName = lineNames ? lineNames[row.lineId] : `${t('unknownLine')} ${row.lineId}`;
            const changeClass = getChangeColor(row.isIncrease, row.isDecrease);
            const isSignificant = isSignificantChange(row.changePercent);

            return (
              <tr
                key={row.lineId}
                className={isSignificant ? 'significant-change' : ''}
              >
                <td className="line-name-cell">{lineName}</td>
                <td className="numeric">{formatNumber(row.lastHour)}</td>
                <td className="numeric">{formatNumber(row.previousHour)}</td>
                <td className={`numeric ${changeClass}`}>
                  {row.change > 0 ? '+' : ''}{formatNumber(row.change)}
                </td>
                <td className={`numeric change-cell ${changeClass}`}>
                  <span className="change-icon">{getChangeIcon(row.isIncrease, row.isDecrease)}</span>
                  {formatNumber(Math.abs(row.changePercent))}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FlowComparisonTable;
