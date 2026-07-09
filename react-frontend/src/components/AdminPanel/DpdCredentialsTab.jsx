import React, { useEffect, useState } from 'react';
import { branchApi, dpdCredentialApi, enterpriseApi } from '../../services/api';
import { clearEnterpriseCache } from '../../services/enterpriseCache';

function DpdCacheControls() {
  const [status, setStatus] = useState(null); // { ok, msg }
  const [busy, setBusy] = useState(false);

  const handleClear = async () => {
    if (!window.confirm('Очистити серверний кеш даних ДПД? Наступні запити знову опитають ДПД.')) return;
    setBusy(true);
    setStatus(null);
    const result = await enterpriseApi.clearDpdCache(); // null on failure
    if (result) {
      clearEnterpriseCache(); // also drop the browser-side cache so views re-fetch
      setStatus({ ok: true, msg: `Кеш очищено (${result.deleted ?? 0} записів)` });
    } else {
      setStatus({ ok: false, msg: 'Помилка очищення кешу' });
    }
    setBusy(false);
  };

  return (
    <div style={{ marginBottom: 16, padding: '12px 16px', background: '#2a2a2a', borderRadius: 8, border: '1px solid #3E3E3E' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#fff', fontWeight: 600, minWidth: 140 }}>Кеш даних ДПД</span>
        <span style={{ color: '#aaa', fontSize: 12, flex: 1 }}>
          Опитані дані зберігаються 7 днів. Очищення змушує систему заново опитати ДПД.
        </span>
        <button className="btn-danger" onClick={handleClear} disabled={busy}>
          {busy ? 'Очищення…' : 'Очистити кеш'}
        </button>
      </div>
      {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`} style={{ marginTop: 6 }}>{status.msg}</div>}
    </div>
  );
}

function DpdBranchCredentials() {
  const [branches, setBranches] = useState([]);
  const [creds, setCreds] = useState({});       // branch_id -> { username, api_base_url, auth_url, timeout_sec } | null
  const [editing, setEditing] = useState({});   // branch_id -> { username, password, api_base_url, auth_url, timeout_sec }
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
    const c = creds[branch.id];
    setEditing(prev => ({
      ...prev,
      [branch.id]: {
        username: c?.username || '',
        password: '',
        api_base_url: c?.api_base_url || '',
        auth_url: c?.auth_url || '',
        timeout_sec: c?.timeout_sec ?? 30,
      },
    }));
    setStatus(prev => { const n = { ...prev }; delete n[branch.id]; return n; });
  };

  const cancelEdit = (id) => {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSave = async (id) => {
    const { username, password, api_base_url, auth_url, timeout_sec } = editing[id];
    const payload = { username, api_base_url, auth_url, timeout_sec: Number(timeout_sec) };
    if (password) payload.password = password;
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
      {branches.map(b => {
        const c = creds[b.id];
        const isEditing = b.id in editing;
        const ed = editing[b.id] || {};
        const st = status[b.id];
        const passVisible = showPass[b.id];

        return (
          <div key={b.id} style={{ marginBottom: 12, padding: '12px 16px', background: '#2a2a2a', borderRadius: 8, border: '1px solid #3E3E3E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isEditing ? 10 : 0, flexWrap: 'wrap' }}>
              <span style={{ color: '#fff', fontWeight: 600, minWidth: 140 }}>{b.name}</span>

              {!isEditing ? (
                <>
                  {c ? (
                    <div style={{ flex: 1, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ color: '#B9E42B', fontSize: 12 }}>{c.username}</span>
                      {c.api_base_url && <code style={{ color: '#aaa', fontSize: 11 }}>{c.api_base_url}</code>}
                    </div>
                  ) : (
                    <span style={{ color: '#666', fontSize: 12, flex: 1 }}>Не налаштовано</span>
                  )}
                  <button className="btn-edit" onClick={() => startEdit(b)}>{c ? 'Ред.' : 'Додати'}</button>
                  {c && <button className="btn-danger" onClick={() => handleDelete(b.id)}>Видалити</button>}
                </>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn-primary" onClick={() => handleSave(b.id)}>Зберегти</button>
                  <button className="btn-secondary" onClick={() => cancelEdit(b.id)}>Скасувати</button>
                </div>
              )}
            </div>

            {isEditing && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ color: '#aaa', fontSize: 12 }}>
                  API Base URL
                  <input className="admin-input" style={{ display: 'block', width: '100%', marginTop: 3 }}
                    value={ed.api_base_url}
                    onChange={e => setEditing(p => ({ ...p, [b.id]: { ...p[b.id], api_base_url: e.target.value } }))}
                    placeholder="https://dpd.example.com/api"
                  />
                </label>
                <label style={{ color: '#aaa', fontSize: 12 }}>
                  Auth URL
                  <input className="admin-input" style={{ display: 'block', width: '100%', marginTop: 3 }}
                    value={ed.auth_url}
                    onChange={e => setEditing(p => ({ ...p, [b.id]: { ...p[b.id], auth_url: e.target.value } }))}
                    placeholder="https://dpd.example.com/auth/token"
                  />
                </label>
                <label style={{ color: '#aaa', fontSize: 12 }}>
                  Логін
                  <input className="admin-input" style={{ display: 'block', width: '100%', marginTop: 3 }}
                    value={ed.username}
                    onChange={e => setEditing(p => ({ ...p, [b.id]: { ...p[b.id], username: e.target.value } }))}
                    placeholder="Логін"
                  />
                </label>
                <label style={{ color: '#aaa', fontSize: 12 }}>
                  {c ? 'Новий пароль (необов\'язково)' : 'Пароль'}
                  <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                    <input className="admin-input" style={{ flex: 1 }}
                      type={passVisible ? 'text' : 'password'}
                      value={ed.password}
                      onChange={e => setEditing(p => ({ ...p, [b.id]: { ...p[b.id], password: e.target.value } }))}
                      placeholder={c ? '(не змінювати)' : 'Пароль'}
                    />
                    <button className="btn-secondary" style={{ fontSize: 12, padding: '3px 8px' }}
                      onClick={() => setShowPass(p => ({ ...p, [b.id]: !p[b.id] }))}>
                      {passVisible ? '🙈' : '👁'}
                    </button>
                  </div>
                </label>
                <label style={{ color: '#aaa', fontSize: 12 }}>
                  Таймаут (сек)
                  <input className="admin-input" style={{ display: 'block', width: 100, marginTop: 3 }}
                    type="number" min={1} max={300}
                    value={ed.timeout_sec}
                    onChange={e => setEditing(p => ({ ...p, [b.id]: { ...p[b.id], timeout_sec: e.target.value } }))}
                  />
                </label>
              </div>
            )}

            {st && <div className={`admin-status ${st.ok ? 'ok' : 'error'}`} style={{ marginTop: 6 }}>{st.msg}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function DpdCredentialsTab() {
  return (
    <div>
      <p style={{ color: '#aaa', fontSize: 13, marginBottom: 20 }}>
        Налаштування DPD API для опитування промисловості. Кожен філіал має власні URL та облікові дані.
      </p>
      <DpdCacheControls />
      <DpdBranchCredentials />
    </div>
  );
}
