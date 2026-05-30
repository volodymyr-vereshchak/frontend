import React, { useEffect, useRef, useState } from 'react';
import { lumgApi, updateApi } from '../../services/api';

// ─── Direct update section ────────────────────────────────────────────────────
function DirectUpdateSection({ lumgs, isRunning, onStart }) {
  const [lumgId, setLumgId] = useState('');
  const [path, setPath] = useState('');
  const [err, setErr] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!lumgId || !path.trim()) { setErr('Виберіть ЛУМГ і вкажіть шлях'); return; }
    try {
      await onStart(Number(lumgId), path.trim());
    } catch (ex) {
      setErr(ex.message || 'Помилка');
    }
  };

  return (
    <div style={{ marginTop: 28, borderTop: '1px solid #2a2a2a', paddingTop: 20 }}>
      <div style={{ color: '#B9E42B', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
        Пряме оновлення (режим 2)
      </div>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
        Читає всі файли з вказаного шляху напряму до одного ЛУМГ, ігноруючи EIS-коди. Використовується для завантаження архівних даних.
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="admin-form-group">
          <label>ЛУМГ</label>
          <select className="admin-select" value={lumgId} onChange={e => setLumgId(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">— вибрати —</option>
            {lumgs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="admin-form-group" style={{ flex: 1 }}>
          <label>Шлях до архіву</label>
          <input
            className="admin-input"
            style={{ width: '100%', minWidth: 300 }}
            value={path}
            onChange={e => setPath(e.target.value)}
            placeholder="/data/archive.zip або /data/folder"
          />
        </div>
        <button className="btn-primary" type="submit" disabled={isRunning}>
          {isRunning ? '...' : 'Запустити'}
        </button>
      </form>
      {err && <div className="admin-status error" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}

const LUMG_STATUS_LABEL = {
  pending: { icon: '⏸', text: 'В черзі',      color: '#888' },
  queued:  { icon: '⏳', text: 'Очікує',        color: '#aaa' },
  running: { icon: '🔄', text: 'Виконується',   color: '#2196F3' },
  done:    { icon: '✓',  text: 'Готово',         color: '#4CAF50' },
  error:   { icon: '✗',  text: 'Помилка',        color: '#f44336' },
};

export default function UpdateTab() {
  const [lumgs, setLumgs] = useState([]);
  const [allJob, setAllJob] = useState({ status: 'idle', started_at: null, finished_at: null, error: null, lumgs: {} });
  const [blockedMsg, setBlockedMsg] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    lumgApi.getAll().then(data => { if (data) setLumgs(data); });
    updateApi.getStatus().then(s => {
      if (s) {
        setAllJob(s);
        if (s.status === 'running') startPolling();
      }
    });
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

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

  const formatTs = (isoStr) => {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleUpdateAll = async () => {
    setBlockedMsg(null);
    try {
      await updateApi.updateAll();
      setAllJob({ status: 'running', started_at: new Date().toISOString(), finished_at: null, error: null, lumgs: {} });
      startPolling();
    } catch (err) {
      if (err.status === 429) {
        setBlockedMsg('Оновлення вже виконується. Зачекайте завершення.');
        // Sync actual state from backend
        const s = await updateApi.getStatus();
        if (s) { setAllJob(s); startPolling(); }
      }
    }
  };

  const handleResetStatus = async () => {
    try {
      const s = await updateApi.resetStatus();
      if (s) setAllJob(s);
      setBlockedMsg(null);
    } catch (_) {}
  };

  const handleUpdateLumg = async (id) => {
    setBlockedMsg(null);
    try {
      await updateApi.updateLumg(id);
      // Start fresh: clear old statuses so only this LUMG shows progress
      setAllJob(prev => ({ ...prev, status: 'running', lumgs: { [id]: 'running' } }));
      startPolling();
    } catch (err) {
      if (err.status === 429) {
        setBlockedMsg('Оновлення вже виконується. Зачекайте завершення.');
        const s = await updateApi.getStatus();
        if (s) { setAllJob(s); startPolling(); }
      }
    }
  };

  const handleDirectUpdate = async (lumgId, path) => {
    setBlockedMsg(null);
    try {
      await updateApi.updateDirect(lumgId, path);
      setAllJob(prev => ({ ...prev, status: 'running', lumgs: { ...prev.lumgs, [lumgId]: 'running' } }));
      startPolling();
    } catch (err) {
      if (err.status === 429) {
        setBlockedMsg('Оновлення вже виконується. Зачекайте завершення.');
        const s = await updateApi.getStatus();
        if (s) { setAllJob(s); startPolling(); }
      }
      throw err;
    }
  };

  const allStatusLabel = () => {
    const { status, started_at, finished_at, error } = allJob;
    if (status === 'idle') return null;
    if (status === 'running') {
      const ts = started_at ? ` (з ${formatTs(started_at)})` : '';
      return <span style={{ color: '#aaa' }}>⏳ Оновлення…{ts}</span>;
    }
    if (status === 'done')
      return <span style={{ color: '#4CAF50' }}>✓ Готово ({formatTs(finished_at)})</span>;
    if (status === 'error')
      return <span style={{ color: '#f44336' }}>✗ Помилка: {error}</span>;
    return null;
  };

  const lumgStatusCell = (lumgId) => {
    const jobActive = allJob.status === 'running' || allJob.status === 'done' || allJob.status === 'error';
    const s = jobActive ? allJob.lumgs?.[lumgId] : null;
    if (!s) return null;
    const cfg = LUMG_STATUS_LABEL[s];
    if (!cfg) return null;
    return <span style={{ color: cfg.color }}>{cfg.icon} {cfg.text}</span>;
  };

  const isRunning = allJob.status === 'running';

  return (
    <div>
      {blockedMsg && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4, color: '#856404' }}>
          ⚠️ {blockedMsg}
        </div>
      )}

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-primary" onClick={handleUpdateAll} disabled={isRunning}>
          Оновити всі
        </button>
        {allStatusLabel()}
        {isRunning && (
          <button
            className="btn-edit"
            style={{ marginLeft: 'auto', background: '#333', color: '#aaa', fontSize: 12 }}
            onClick={handleResetStatus}
            title="Скинути статус якщо оновлення зависло"
          >
            Скинути
          </button>
        )}
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
              <td>{lumgStatusCell(l.id)}</td>
              <td>
                <button
                  className="btn-edit"
                  onClick={() => handleUpdateLumg(l.id)}
                  disabled={isRunning}
                >
                  Оновити
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <DirectUpdateSection lumgs={lumgs} isRunning={isRunning} onStart={handleDirectUpdate} />
    </div>
  );
}
