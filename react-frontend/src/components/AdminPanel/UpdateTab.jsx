import React, { useEffect, useState } from 'react';
import { lumgApi, updateApi } from '../../services/api';

// status per lumg: null | 'loading' | 'ok' | 'error'
export default function UpdateTab() {
  const [lumgs, setLumgs] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [timestamps, setTimestamps] = useState({});
  const [allStatus, setAllStatus] = useState(null);
  const [allTimestamp, setAllTimestamp] = useState(null);

  useEffect(() => {
    lumgApi.getAll().then(data => { if (data) setLumgs(data); });
  }, []);

  const setStatus = (key, value) =>
    setStatuses(prev => ({ ...prev, [key]: value }));

  const setTimestamp = (key, value) =>
    setTimestamps(prev => ({ ...prev, [key]: value }));

  const formatTs = (isoStr) => {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleUpdateAll = async () => {
    setAllStatus('loading');
    setAllTimestamp(null);
    const result = await updateApi.updateAll();
    if (result) {
      setAllStatus('ok');
      setAllTimestamp(result.last_updated || null);
    } else {
      setAllStatus('error');
    }
  };

  const handleUpdateLumg = async (id) => {
    setStatus(id, 'loading');
    setTimestamp(id, null);
    const result = await updateApi.updateLumg(id);
    if (result) {
      setStatus(id, 'ok');
      setTimestamp(id, result.last_updated || null);
    } else {
      setStatus(id, 'error');
    }
  };

  const statusLabel = (s, ts) => {
    const tsStr = ts ? ` (${formatTs(ts)})` : '';
    if (s === 'loading') return <span style={{ color: '#aaa' }}>⏳ Оновлення…</span>;
    if (s === 'ok')      return <span style={{ color: '#4CAF50' }}>✓ Готово{tsStr}</span>;
    if (s === 'error')   return <span style={{ color: '#f44336' }}>✗ Помилка</span>;
    return null;
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="btn-primary"
          onClick={handleUpdateAll}
          disabled={allStatus === 'loading'}
        >
          Оновити всі
        </button>
        {statusLabel(allStatus, allTimestamp)}
      </div>

      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>Назва</th><th>Статус</th><th></th></tr>
        </thead>
        <tbody>
          {lumgs.map(l => (
            <tr key={l.id}>
              <td>{l.id}</td>
              <td>{l.name}</td>
              <td>{statusLabel(statuses[l.id], timestamps[l.id])}</td>
              <td>
                <button
                  className="btn-edit"
                  onClick={() => handleUpdateLumg(l.id)}
                  disabled={statuses[l.id] === 'loading'}
                >
                  Оновити
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
