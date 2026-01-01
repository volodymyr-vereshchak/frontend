import React, { useState } from 'react';
import './VolumeComparisonTable.css';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Volume Comparison Table Component
 * Displays 24h volume comparison for each GRS line with totals
 */
const VolumeComparisonTable = ({ data, lineNames }) => {
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

  // Calculate totals
  const totals = data.reduce((acc, row) => {
    acc.current24h += row.current24h;
    acc.previous24h += row.previous24h;
    acc.change += row.change;
    return acc;
  }, { current24h: 0, previous24h: 0, change: 0 });

  const totalChangePercent = totals.previous24h !== 0
    ? ((totals.change / totals.previous24h) * 100)
    : 0;

  const totalIsIncrease = totals.change > 0;
  const totalIsDecrease = totals.change < 0;

  return (
    <div className="volume-comparison-table-container">
      <table className="comparison-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('lineId')} className="sortable">
              {t('lineName')}
              {sortConfig.key === 'lineId' && (
                <span className="sort-indicator">{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th onClick={() => handleSort('current24h')} className="sortable numeric" title={`${t('current24h')} (${t('volumeUnit')})`}>
              {t('current24hShort')}
              {sortConfig.key === 'current24h' && (
                <span className="sort-indicator">{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th onClick={() => handleSort('previous24h')} className="sortable numeric" title={`${t('previous24h')} (${t('volumeUnit')})`}>
              {t('previous24hShort')}
              {sortConfig.key === 'previous24h' && (
                <span className="sort-indicator">{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
              )}
            </th>
            <th onClick={() => handleSort('change')} className="sortable numeric" title={`${t('change')} (${t('volumeUnit')})`}>
              {t('changeShort')} ({t('volumeUnit')})
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
            const lineName = lineNames ? lineNames[row.lineId] : `Линия ${row.lineId}`;
            const changeClass = getChangeColor(row.isIncrease, row.isDecrease);
            const isSignificant = isSignificantChange(row.changePercent);

            return (
              <tr
                key={row.lineId}
                className={isSignificant ? 'significant-change' : ''}
              >
                <td className="line-name-cell">{lineName}</td>
                <td className="numeric">{formatNumber(row.current24h)}</td>
                <td className="numeric">{formatNumber(row.previous24h)}</td>
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
        <tfoot>
          <tr className="total-row">
            <td className="total-label">{t('total')}</td>
            <td className="numeric total-value">{formatNumber(totals.current24h)}</td>
            <td className="numeric total-value">{formatNumber(totals.previous24h)}</td>
            <td className={`numeric ${getChangeColor(totalIsIncrease, totalIsDecrease)}`}>
              {totals.change > 0 ? '+' : ''}{formatNumber(totals.change)}
            </td>
            <td className={`numeric change-cell ${getChangeColor(totalIsIncrease, totalIsDecrease)}`}>
              <span className="change-icon">{getChangeIcon(totalIsIncrease, totalIsDecrease)}</span>
              {formatNumber(Math.abs(totalChangePercent))}%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default VolumeComparisonTable;
