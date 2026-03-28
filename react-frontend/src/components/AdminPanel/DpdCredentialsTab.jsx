import React, { useEffect, useState } from 'react';
import { branchApi, dpdGlobalConfigApi, dpdCredentialApi } from '../../services/api';

// ─── Global Config (api_base_url, auth_url, timeout_sec) ─────────────────────

function DpdGlobalConfigSection() {
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ api_base_url: '', auth_url: '', timeout_sec: 30 });
  const [st, setSt] = useState(null);

  const load = async () => {
    try {
      const data = await dpdGlobalConfigApi.get();
      setConfig(data || null);
      setLoadError(false);
    } catch (err) {
      if (err?.status === 404) {
        setConfig(null);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = () => {
    setForm(config
      ? { api_base_url: config.api_base_url, auth_url: config.auth_url, timeout_sec: config.timeout_sec }
      : { api_base_url: '', auth_url: '', timeout_sec: 30 }
    );
    setEditing(true);
    setSt(null);
  };

  const handleSave = async () => {
    const payload = { ...form, timeout_sec: Number(form.timeout_sec) };
    const result = await dpdGlobalConfigApi.upsert(payload);
    if (result) {
      setConfig(result);
      setEditing(false);
      setSt({ ok: true, msg: 'Збережено' });
    } else {
      setSt({ ok: false, msg: 'Помилка збереження' });
    }
  };

  return (
    <div style={{ marginBottom: 28, padding: 16, background: '#2a2a2a', borderRadius: 8, border: '1px solid #3E3E3E' }}>
      <div style={{ color: '#fff', fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Глобальні налаштування DPD API</div>

      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {config ? (
            <>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: '#888' }}>Base URL: </span>
                <code style={{ color: '#B9E42B' }}>{config.api_base_url}</code>
              </div>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: '#888' }}>Auth URL: </span>
                <code style={{ color: '#B9E42B' }}>{config.auth_url}</code>
              </div>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: '#888' }}>Таймаут: </span>
                <span style={{ color: '#ccc' }}>{config.timeout_sec}с</span>
              </div>
            </>
          ) : (
            <span style={{ color: '#666', fontSize: 13 }}>Не налаштовано</span>
          )}
          <button className="btn-edit" onClick={startEdit}>{config ? 'Редагувати' : 'Налаштувати'}</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'end' }}>
          <label style={{ color: '#aaa', fontSize: 12 }}>
            API Base URL
            <input
              className="admin-input"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
              value={form.api_base_url}
              onChange={e => setForm(p => ({ ...p, api_base_url: e.target.value }))}
              placeholder="https://dpd.example.com/api"
            />
          </label>
          <label style={{ color: '#aaa', fontSize: 12 }}>
            Auth URL
            <input
              className="admin-input"
              style={{ display: 'block', width: '100%', marginTop: 4 }}
              value={form.auth_url}
              onChange={e => setForm(p => ({ ...p, auth_url: e.target.value }))}
              placeholder="https://dpd.example.com/auth/token"
            />
          </label>
          <label style={{ color: '#aaa', fontSize: 12 }}>
            Таймаут (сек)
            <input
              className="admin-input"
              style={{ display: 'block', width: 80, marginTop: 4 }}
              type="number"
              min={1}
              max={300}
              value={form.timeout_sec}
              onChange={e => setForm(p => ({ ...p, timeout_sec: e.target.value }))}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
            <button className="btn-primary" onClick={handleSave}>Зберегти</button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>Скасувати</button>
          </div>
        </div>
      )}

      {loadError && <div className="admin-status error" style={{ marginTop: 8 }}>Помилка завантаження — перевірте підключення до API</div>}
      {st && <div className={`admin-status ${st.ok ? 'ok' : 'error'}`} style={{ marginTop: 8 }}>{st.msg}</div>}
    </div>
  );
}


// ─── Per-branch Credentials (username/password) ───────────────────────────────

function DpdBranchCredentials() {
  const [branches, setBranches] = useState([]);
  const [creds, setCreds] = useState({});       // branch_id -> { username } | null
  const [editing, setEditing] = useState({});   // branch_id -> { username, password }
  const [showPass, setShowPass] = useState({}); // branch_id -> bool
  const [status, setStatus] = useState({});     // branch_id -> { ok, msg }

  const load = async () => {
    const data = await branchApi.getAll();
    if (!data) return;
    setBranches(data);
    const credMap = {};
    await Promise.all(
      data.map(async (b) => {
        const cred = await dpdCredentialApi.get(b.id).catch(() => null);
        credMap[b.id] = cred || null;
      })
    );
    setCreds(credMap);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (branch) => {
    setEditing(prev => ({
      ...prev,
      [branch.id]: { username: creds[branch.id]?.username || '', password: '' },
    }));
    setStatus(prev => { const n = { ...prev }; delete n[branch.id]; return n; });
  };

  const cancelEdit = (id) => {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSave = async (id) => {
    const { username, password } = editing[id];
    const payload = { username };
    if (password) payload.password = password;
    // New record requires password
    if (!creds[id] && !password) {
      setStatus(prev => ({ ...prev, [id]: { ok: false, msg: 'Пароль обов\'язковий для нового запису' } }));
      return;
    }
    const result = await dpdCredentialApi.upsert(id, payload);
    if (result) {
      setCreds(prev => ({ ...prev, [id]: result }));
      setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
      setStatus(prev => ({ ...prev, [id]: { ok: true, msg: 'Збережено' } }));
    } else {
      setStatus(prev => ({ ...prev, [id]: { ok: false, msg: 'Помилка збереження' } }));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити DPD креденшали для цього філіалу?')) return;
    await dpdCredentialApi.delete(id);
    setCreds(prev => ({ ...prev, [id]: null }));
    setStatus(prev => ({ ...prev, [id]: { ok: true, msg: 'Видалено' } }));
  };

  return (
    <div>
      <div style={{ color: '#fff', fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Логін / Пароль — по філіалах</div>
      {branches.map(b => {
        const c = creds[b.id];
        const isEditing = b.id in editing;
        const ed = editing[b.id] || {};
        const st = status[b.id];
        const passVisible = showPass[b.id];

        return (
          <div key={b.id} style={{ marginBottom: 10, padding: '10px 16px', background: '#2a2a2a', borderRadius: 8, border: '1px solid #3E3E3E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#fff', fontWeight: 600, minWidth: 140 }}>{b.name}</span>

              {!isEditing ? (
                <>
                  {c
                    ? <span style={{ color: '#B9E42B', fontSize: 12, flex: 1 }}>{c.username}</span>
                    : <span style={{ color: '#666', fontSize: 12, flex: 1 }}>Не налаштовано</span>
                  }
                  <button className="btn-edit" onClick={() => startEdit(b)}>{c ? 'Ред.' : 'Додати'}</button>
                  {c && <button className="btn-danger" onClick={() => handleDelete(b.id)}>Видалити</button>}
                </>
              ) : (
                <>
                  <input
                    className="admin-input"
                    style={{ width: 180 }}
                    value={ed.username}
                    onChange={e => setEditing(prev => ({ ...prev, [b.id]: { ...prev[b.id], username: e.target.value } }))}
                    placeholder="Логін"
                  />
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      className="admin-input"
                      style={{ width: 180 }}
                      type={passVisible ? 'text' : 'password'}
                      value={ed.password}
                      onChange={e => setEditing(prev => ({ ...prev, [b.id]: { ...prev[b.id], password: e.target.value } }))}
                      placeholder={c ? 'Новий пароль (необов\'язково)' : 'Пароль'}
                    />
                    <button
                      className="btn-secondary"
                      style={{ fontSize: 12, padding: '3px 8px' }}
                      onClick={() => setShowPass(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                    >{passVisible ? '🙈' : '👁'}</button>
                  </div>
                  <button className="btn-primary" onClick={() => handleSave(b.id)}>Зберегти</button>
                  <button className="btn-secondary" onClick={() => cancelEdit(b.id)}>Скасувати</button>
                </>
              )}
            </div>
            {st && <div className={`admin-status ${st.ok ? 'ok' : 'error'}`} style={{ marginTop: 6 }}>{st.msg}</div>}
          </div>
        );
      })}
    </div>
  );
}


// ─── Tab ──────────────────────────────────────────────────────────────────────

export default function DpdCredentialsTab() {
  return (
    <div>
      <p style={{ color: '#aaa', fontSize: 13, marginBottom: 20 }}>
        Налаштування для опитування промисловості через DPD API. URL однаковий для всіх — логін/пароль на кожен філіал.
      </p>
      <DpdGlobalConfigSection />
      <DpdBranchCredentials />
    </div>
  );
}
