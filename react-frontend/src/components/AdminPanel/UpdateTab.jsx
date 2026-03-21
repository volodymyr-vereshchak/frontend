import React, { useEffect, useRef, useState } from 'react';
import { lumgApi, updateApi } from '../../services/api';

export default function UpdateTab() {
  const [lumgs, setLumgs] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [timestamps, setTimestamps] = useState({});
  const [allJob, setAllJob] = useState({ status: 'idle', started_at: null, finished_at: null, error: null });
  const pollRef = useRef(null);

  useEffect(() => {
    lumgApi.getAll().then(data => { if (data) setLumgs(data); });
    // Sync status on mount (in case a job was running before)
    updateApi.getStatus().then(s => { if (s) setAllJob(s); });
  }, []);

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const s = await updateApi.getStatus();
      if (!s) return;
      setAllJob(s);
      if (s.status !== 'running') {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 2000);
  };

  useEffect(() => {
    // If we restored a running job on mount, start polling
    if (allJob.status === 'running') startPolling();
  }, []); // eslint-disable-line

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const setStatus = (key, value) => setStatuses(prev => ({ ...prev, [key]: value }));
  const setTimestamp = (key, value) => setTimestamps(prev => ({ ...prev, [key]: value }));

  const formatTs = (isoStr) => {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleUpdateAll = async () => {
    setAllJob({ status: 'running', started_at: new Date().toISOString(), finished_at: null, error: null });
    await updateApi.updateAll();
    startPolling();
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

  const allStatusLabel = () => {
    const { status, started_at, finished_at, error } = allJob;
    if (status === 'idle') return null;
    if (status === 'running') {
      const ts = started_at ? ` (з ${formatTs(started_at)})` : '';
      return <span style={{ color: '#aaa' }}>⏳ Оновлення…{ts}</span>;
    }
    if (status === 'done') {
      return <span style={{ color: '#4CAF50' }}>✓ Готово ({formatTs(finished_at)})</span>;
    }
    if (status === 'error') {
      return <span style={{ color: '#f44336' }}>✗ Помилка: {error}</span>;
    }
    return null;
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
          disabled={allJob.status === 'running'}
        >
          Оновити всі
        </button>
        {allStatusLabel()}
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
                  disabled={statuses[l.id] === 'loading' || allJob.status === 'running'}
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
