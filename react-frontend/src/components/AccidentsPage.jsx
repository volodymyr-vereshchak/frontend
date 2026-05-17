import React, { useState, useEffect, useMemo } from 'react';
import './AccidentsPage.css';
import { useLanguage } from '../contexts/LanguageContext';
import apiClient, { branchApi, lumgApi, gasVolumeApi, lineApi } from '../services/api';
import * as XLSX from 'xlsx';
import { pairAccidents, groupAccidentsByType } from '../utils/accidentsCalculator';

function formatDurationMs(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}:${ss}`;
}

function groupOccurrencesByLine(occurrences, allLines) {
  const byLine = {};
  occurrences.forEach(occ => {
    const lid = occ.line_id;
    if (!byLine[lid]) byLine[lid] = [];
    byLine[lid].push(occ);
  });
  return Object.entries(byLine).map(([lid, occs]) => {
    const starts = occs.map(o => new Date(o.startTime).getTime());
    const ends   = occs.map(o => new Date(o.endTime).getTime());
    const totalMs = occs.reduce((s, o) =>
      s + (new Date(o.endTime) - new Date(o.startTime)), 0);
    const line = allLines.find(l => l.id === Number(lid));
    return {
      line_id:   Number(lid),
      line_name: line ? (line.name || `Лінія ${lid}`) : `Лінія ${lid}`,
      firstStart: new Date(Math.min(...starts)).toISOString(),
      lastEnd:    new Date(Math.max(...ends)).toISOString(),
      count:      occs.length,
      durationFormatted: formatDurationMs(totalMs),
    };
  });
}

export default function AccidentsPage() {
  const { t } = useLanguage();

  const [branches, setBranches]         = useState([]);
  const [lumgs, setLumgs]               = useState([]);
  const [calcs, setCalcs]               = useState([]);
  const [lines, setLines]               = useState([]);
  const [initLoading, setInitLoading]   = useState(true);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedCalc,   setSelectedCalc]   = useState('');
  const [selectedLine,   setSelectedLine]   = useState('');

  const today = new Date();
  const [fromDate, setFromDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));

  const [groupedAccidents, setGroupedAccidents] = useState([]);
  const [expandedRows,     setExpandedRows]     = useState(new Set());
  const [stats,            setStats]            = useState(null);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState(null);
  const [dataLoaded,       setDataLoaded]       = useState(false);

  useEffect(() => {
    Promise.all([
      branchApi.getAll(),
      lumgApi.getAll(),
      gasVolumeApi.getGasVolumeCalcs(),
      lineApi.getAll(),
    ]).then(([br, lu, ca, li]) => {
      setBranches(br || []);
      setLumgs(lu || []);
      setCalcs(ca || []);
      setLines(li || []);
    }).catch(() => {
      setError('Помилка завантаження списку обчислювачів і ліній');
    }).finally(() => setInitLoading(false));
  }, []);

  const filteredCalcs = useMemo(() => {
    if (!selectedBranch) return calcs;
    const ids = lumgs.filter(l => l.branch_id == selectedBranch).map(l => l.id);
    return calcs.filter(c => ids.includes(c.lumg_id));
  }, [selectedBranch, calcs, lumgs]);

  const filteredLines = useMemo(() => {
    if (selectedCalc) return lines.filter(l => l.gas_volume_calc_id == selectedCalc);
    if (selectedBranch) {
      const lumgIds = lumgs.filter(l => l.branch_id == selectedBranch).map(l => l.id);
      const calcIds = calcs.filter(c => lumgIds.includes(c.lumg_id)).map(c => c.id);
      return lines.filter(l => calcIds.includes(l.gas_volume_calc_id));
    }
    return lines;
  }, [selectedCalc, selectedBranch, calcs, lumgs, lines]);

  const handleBranchChange = (val) => {
    setSelectedBranch(val);
    setSelectedCalc('');
    setSelectedLine('');
  };

  const handleCalcChange = (val) => {
    setSelectedCalc(val);
    setSelectedLine('');
  };

  const loadData = async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    setGroupedAccidents([]);
    setExpandedRows(new Set());
    setStats(null);
    setDataLoaded(false);

    try {
      let lineIds;
      if (selectedLine) {
        lineIds = [Number(selectedLine)];
      } else {
        lineIds = filteredLines.map(l => l.id);
        if (!lineIds.length) lineIds = lines.map(l => l.id);
      }

      const sysData = await apiClient.get('/sys/', {
        line_id:   lineIds,
        from_date: fromDate,
        to_date:   toDate,
      });

      const paired  = pairAccidents(sysData || [], { fromDate, toDate });
      const grouped = groupAccidentsByType(paired);

      setGroupedAccidents(grouped);
      setDataLoaded(true);

      const totalMs = grouped.reduce((s, g) => s + g.totalDuration, 0);
      setStats({
        total:    paired.length,
        types:    grouped.length,
        duration: formatDurationMs(totalMs),
      });
    } catch (err) {
      setError('Помилка при завантаженні даних: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (index) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const exportToExcel = () => {
    if (!groupedAccidents.length) return;
    const rows = [['Звіт по аваріях'], [], ['Тип аварії', 'З', 'По', 'Випадків', 'Тривалість']];

    groupedAccidents.forEach(group => {
      const allStarts = group.occurrences.map(o => new Date(o.startTime).getTime());
      const allEnds   = group.occurrences.map(o => new Date(o.endTime).getTime());
      rows.push([
        group.sys_name,
        formatDateTime(new Date(Math.min(...allStarts)).toISOString()),
        formatDateTime(new Date(Math.max(...allEnds)).toISOString()),
        group.totalCount,
        group.totalDurationFormatted,
      ]);
      groupOccurrencesByLine(group.occurrences, lines).forEach(lg => {
        rows.push([`  ${lg.line_name}`, formatDateTime(lg.firstStart), formatDateTime(lg.lastEnd), lg.count, lg.durationFormatted]);
      });
      rows.push([]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 60 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Аварії');
    XLSX.writeFile(wb, `accidents_${fromDate}_${toDate}.xlsx`);
  };

  return (
    <div className="accidents-page">
      {/* Header */}
      <div className="acc-header">
        <h2>⚠️ {t('accidentsReport')}</h2>
        <p>{t('accidentsDescription')}</p>
      </div>

      {/* Controls */}
      <div className="acc-controls">
        <div className="acc-controls-row">
          <div className="acc-field">
            <label>{t('branch')}</label>
            <select value={selectedBranch} onChange={e => handleBranchChange(e.target.value)} disabled={initLoading}>
              <option value="">Всі філії</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="acc-field">
            <label>Обчислювач</label>
            <select value={selectedCalc} onChange={e => handleCalcChange(e.target.value)} disabled={initLoading}>
              <option value="">Всі обчислювачі</option>
              {filteredCalcs.map(c => <option key={c.id} value={c.id}>{c.name || `Обчислювач ${c.id}`}</option>)}
            </select>
          </div>

          <div className="acc-field">
            <label>Лінія</label>
            <select value={selectedLine} onChange={e => setSelectedLine(e.target.value)} disabled={initLoading}>
              <option value="">Всі лінії</option>
              {filteredLines.map(l => <option key={l.id} value={l.id}>{l.name || `Лінія ${l.id}`}</option>)}
            </select>
          </div>

          <div className="acc-field">
            <label>З</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>

          <div className="acc-field">
            <label>По</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>

          <button className="acc-btn-primary" onClick={loadData} disabled={loading || initLoading}>
            {loading ? t('loading') : 'Завантажити дані'}
          </button>

          <button className="acc-btn-secondary" onClick={exportToExcel} disabled={!dataLoaded}>
            📊 Експорт в Excel
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="acc-stats">
          <div className="acc-stat-card">
            <div className="acc-stat-label">Всього аварій</div>
            <div className="acc-stat-value">{stats.total}</div>
          </div>
          <div className="acc-stat-card">
            <div className="acc-stat-label">Типів аварій</div>
            <div className="acc-stat-value">{stats.types}</div>
          </div>
          <div className="acc-stat-card">
            <div className="acc-stat-label">Загальна тривалість</div>
            <div className="acc-stat-value acc-stat-value--sm">{stats.duration}</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="acc-error">{error}</div>}

      {/* Table */}
      <div className="acc-table-wrap">
        {loading && (
          <div className="acc-loading">
            <div className="acc-spinner" />
            <span>Завантаження даних...</span>
          </div>
        )}

        {!loading && dataLoaded && groupedAccidents.length === 0 && (
          <div className="acc-empty">Немає даних для відображення</div>
        )}

        {!loading && groupedAccidents.length > 0 && (
          <table className="acc-table">
            <thead>
              <tr>
                <th className="acc-col-name">{t('operationType')}</th>
                <th className="acc-col-time">З</th>
                <th className="acc-col-time">По</th>
                <th className="acc-col-num">Випадків</th>
                <th className="acc-col-dur">{t('duration')}</th>
              </tr>
            </thead>
            <tbody>
              {groupedAccidents.map((group, index) => {
                const isOpen = expandedRows.has(index);
                const allStarts = group.occurrences.map(o => new Date(o.startTime).getTime());
                const allEnds   = group.occurrences.map(o => new Date(o.endTime).getTime());
                const groupFirst = formatDateTime(new Date(Math.min(...allStarts)).toISOString());
                const groupLast  = formatDateTime(new Date(Math.max(...allEnds)).toISOString());

                return (
                  <React.Fragment key={group.sys_type_id}>
                    <tr className="acc-group-row" onClick={() => toggleRow(index)}>
                      <td className="acc-col-name">
                        <span className="acc-expand">{isOpen ? '▼' : '▶'}</span>
                        {group.sys_name}
                      </td>
                      <td className="acc-col-time">{groupFirst}</td>
                      <td className="acc-col-time">{groupLast}</td>
                      <td className="acc-col-num">{group.totalCount}</td>
                      <td className="acc-col-dur">{group.totalDurationFormatted}</td>
                    </tr>
                    {isOpen && groupOccurrencesByLine(group.occurrences, lines).map(lg => (
                      <tr key={`${index}_${lg.line_id}`} className="acc-detail-row">
                        <td className="acc-col-name acc-detail-name">{lg.line_name}</td>
                        <td className="acc-col-time">{formatDateTime(lg.firstStart)}</td>
                        <td className="acc-col-time">{formatDateTime(lg.lastEnd)}</td>
                        <td className="acc-col-num">{lg.count}</td>
                        <td className="acc-col-dur">{lg.durationFormatted}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && !dataLoaded && !error && (
          <div className="acc-empty">Оберіть параметри та натисніть «Завантажити дані»</div>
        )}
      </div>
    </div>
  );
}
