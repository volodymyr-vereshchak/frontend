import React, { useEffect, useState, useCallback } from 'react';
import { branchApi, lumgApi } from '../../services/api';

// ─── Branch Config Section ────────────────────────────────────────────────────

function BranchConfigSection({ branch, allLumgs }) {
  const [dp, setDp] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ path: '', active: true });
  const [mappings, setMappings] = useState([]);
  const [preview, setPreview] = useState(null); // null | 'loading' | 'error' | []
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState(null);

  const branchLumgs = allLumgs.filter(l => l.branch_id === branch.id);

  const load = useCallback(async () => {
    setStatus(null);
    setPreview(null);
    const [pathData, mapsData] = await Promise.all([
      branchApi.getConfigPath(branch.id).catch(() => null),
      branchApi.getConfigMappings(branch.id).catch(() => []),
    ]);
    setDp(pathData || null);
    setMappings(mapsData || []);
    setEditing(false);
  }, [branch.id]);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => {
    setEditForm({ path: dp?.path || '', active: dp?.active ?? true });
    setEditing(true);
  };

  const handleSavePath = async () => {
    try {
      const result = await branchApi.setConfigPath(branch.id, editForm);
      setDp(result);
      setEditing(false);
      setStatus({ ok: true, msg: 'Шлях збережено' });
      setPreview(null);
    } catch (err) {
      setStatus({ ok: false, msg: err?.message || 'Помилка збереження' });
    }
  };

  const handleDeletePath = async () => {
    if (!window.confirm('Видалити шлях?')) return;
    await branchApi.deleteConfigPath(branch.id);
    setDp(null);
    setMappings([]);
    setPreview(null);
    setStatus({ ok: true, msg: 'Видалено' });
  };

  const handlePreview = async () => {
    setPreview('loading');
    setStatus(null);
    const result = await branchApi.previewConfig(branch.id);
    if (result && Array.isArray(result)) {
      setPreview(result);
      const existingMap = {};
      mappings.forEach(m => { existingMap[m.gis_name] = m.lumg_id; });
      setMappings(result.map(gis => ({
        gis_name: gis.gis_name,
        lumg_id: existingMap[gis.gis_name] ?? null,
      })));
    } else {
      setPreview('error');
      setStatus({ ok: false, msg: 'Не вдалося прочитати файл' });
    }
  };

  const handleSaveMappings = async () => {
    try {
      const result = await branchApi.setConfigMappings(branch.id, mappings);
      if (result) setMappings(result);
      setStatus({ ok: true, msg: 'Маппінг збережено' });
    } catch (err) {
      setStatus({ ok: false, msg: err?.message || 'Помилка збереження маппінгу' });
    }
  };

  const handleUpdateNames = async () => {
    setUpdating(true);
    setStatus(null);
    try {
      await branchApi.updateNames(branch.id);
      setStatus({ ok: true, msg: 'Імена оновлено' });
    } catch (err) {
      setStatus({ ok: false, msg: err?.message || 'Помилка оновлення імен' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ marginBottom: 24, padding: 16, background: '#222', borderRadius: 8, border: '1px solid #3E3E3E' }}>
      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Конфіг імен (ASK.CFG)
      </div>

      {/* Path row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {editing ? (
          <>
            <input
              className="admin-input"
              style={{ flex: 1, minWidth: 280 }}
              value={editForm.path}
              onChange={e => setEditForm(prev => ({ ...prev, path: e.target.value }))}
              placeholder="backend/data/askcfgs/ZP/askroc.CFG"
              onKeyDown={e => e.key === 'Enter' && handleSavePath()}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#aaa', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={e => setEditForm(prev => ({ ...prev, active: e.target.checked }))}
              />
              Активний
            </label>
            <button className="btn-primary" onClick={handleSavePath}>Зберегти</button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>Скасувати</button>
          </>
        ) : (
          <>
            {dp
              ? <code style={{ color: '#B9E42B', fontSize: 12, flex: 1, wordBreak: 'break-all' }}>{dp.path}</code>
              : <span style={{ color: '#666', flex: 1 }}>Шлях не вказано</span>
            }
            <button className="btn-edit" onClick={startEdit}>{dp ? 'Ред.' : 'Додати шлях'}</button>
            {dp && <button className="btn-danger" onClick={handleDeletePath}>Видалити</button>}
            {dp && (
              <button className="btn-secondary" onClick={handlePreview} disabled={preview === 'loading'}>
                {preview === 'loading' ? 'Читання…' : 'Переглянути CFG'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Mapping table */}
      {Array.isArray(preview) && preview.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <button className="btn-secondary" style={{ fontSize: 12, padding: '2px 10px' }}
              onClick={() => setPreview(null)}>▲ Згорнути</button>
          </div>
          <table className="admin-table" style={{ marginBottom: 8 }}>
            <thead>
              <tr>
                <th>ЛУМГ в CFG (gis_name)</th>
                <th>Приладів</th>
                <th>Ліній</th>
                <th>ЛУМГ в БД</th>
              </tr>
            </thead>
            <tbody>
              {preview.map(gis => {
                const mapping = mappings.find(m => m.gis_name === gis.gis_name);
                return (
                  <tr key={gis.gis_name}>
                    <td><code style={{ fontSize: 12 }}>{gis.gis_name}</code></td>
                    <td>{gis.flow_count}</td>
                    <td>{gis.line_count}</td>
                    <td>
                      <select
                        className="overview-select"
                        style={{ minWidth: 160 }}
                        value={mapping?.lumg_id ?? ''}
                        onChange={e => setMappings(prev => prev.map(m =>
                          m.gis_name === gis.gis_name
                            ? { ...m, lumg_id: e.target.value ? Number(e.target.value) : null }
                            : m
                        ))}
                      >
                        <option value="">— не вибрано —</option>
                        {branchLumgs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={handleSaveMappings}>Зберегти маппінг</button>
            <button className="btn-primary" disabled={updating || mappings.every(m => !m.lumg_id)} onClick={handleUpdateNames}>
              {updating ? 'Оновлення…' : 'Оновити імена'}
            </button>
          </div>
        </div>
      )}

      {/* Saved mappings summary */}
      {!Array.isArray(preview) && mappings.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#aaa', fontSize: 12 }}>
            Маппінгів: {mappings.filter(m => m.lumg_id).length}/{mappings.length}
          </span>
          <button className="btn-primary" disabled={updating} onClick={handleUpdateNames}>
            {updating ? 'Оновлення…' : 'Оновити імена'}
          </button>
        </div>
      )}

      {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`} style={{ marginTop: 8 }}>{status.msg}</div>}
    </div>
  );
}

// ─── Single LUMG Row ──────────────────────────────────────────────────────────

function LumgRow({ lumg, initialDp, initialEis }) {
  const [dp, setDp] = useState(initialDp ?? null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ path: '', active: true });
  const [status, setStatus] = useState(null);
  const [eisCodes, setEisCodes] = useState(initialEis ?? []);
  const [eisOpen, setEisOpen] = useState(false);
  const [eisInput, setEisInput] = useState('');
  const [eisStatus, setEisStatus] = useState(null);
  const [scan, setScan] = useState(null); // null | 'loading' | string[]
  const [scanSelected, setScanSelected] = useState(new Set());

  const startEdit = () => {
    setEditForm({ path: dp?.path || '', active: dp?.active ?? true });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      const result = await lumgApi.setDataPath(lumg.id, editForm);
      setDp(result);
      setEditing(false);
      setStatus({ ok: true, msg: 'Збережено' });
    } catch (err) {
      setStatus({ ok: false, msg: err?.message || 'Помилка' });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Видалити шлях?')) return;
    try {
      await lumgApi.deleteDataPath(lumg.id);
      setDp(null);
      setStatus({ ok: true, msg: 'Видалено' });
    } catch (err) {
      setStatus({ ok: false, msg: err?.message || 'Помилка' });
    }
  };

  const handleAddEis = async () => {
    const code = eisInput.trim();
    if (!code) return;
    try {
      const result = await lumgApi.addEisCode(lumg.id, { eis_code: code });
      setEisCodes(prev => [...prev, result]);
      setEisInput('');
      setEisStatus({ ok: true, msg: 'Додано' });
    } catch (err) {
      setEisStatus({ ok: false, msg: err?.message || 'Помилка' });
    }
  };

  const handleDeleteEis = async (code) => {
    try {
      await lumgApi.deleteEisCode(lumg.id, code);
      setEisCodes(prev => prev.filter(e => e.eis_code !== code));
    } catch (err) {
      setEisStatus({ ok: false, msg: err?.message || 'Помилка видалення' });
    }
  };

  const handleScan = async () => {
    setScan('loading');
    try {
      const result = await lumgApi.scanEis(lumg.id);
      if (Array.isArray(result)) {
        const existing = new Set(eisCodes.map(e => e.eis_code));
        const newOnes = result.filter(r => !existing.has(r));
        setScan(newOnes);
        setScanSelected(new Set(newOnes));
      } else {
        setScan([]);
        setEisStatus({ ok: false, msg: 'Помилка сканування' });
      }
    } catch (err) {
      setScan([]);
      setEisStatus({ ok: false, msg: err?.message || 'Помилка сканування' });
    }
  };

  const handleAddSelected = async () => {
    let added = 0;
    for (const code of scanSelected) {
      try {
        const result = await lumgApi.addEisCode(lumg.id, { eis_code: code });
        setEisCodes(prev => [...prev, result]);
        added++;
      } catch {}
    }
    setScan(null);
    setEisStatus({ ok: true, msg: `Додано ${added} кодів` });
  };

  return (
    <div style={{ padding: '12px 14px', background: '#2a2a2a', borderRadius: 6, border: '1px solid #3E3E3E', marginBottom: 8 }}>
      {/* Path row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ color: '#fff', fontWeight: 600, minWidth: 120 }}>{lumg.name}</span>
        <span style={{
          background: eisCodes.length > 0 ? '#1e2e08' : '#2a2a2a',
          color: eisCodes.length > 0 ? '#B9E42B' : '#888',
          padding: '1px 8px', borderRadius: 10, fontSize: 11
        }}>
          {eisCodes.length > 0 ? `EIS (${eisCodes.length})` : 'Прямий'}
        </span>

        {editing ? (
          <>
            <input
              className="admin-input"
              style={{ flex: 1, minWidth: 240 }}
              value={editForm.path}
              onChange={e => setEditForm(prev => ({ ...prev, path: e.target.value }))}
              placeholder="hostlibs/ZP"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#aaa', fontSize: 12 }}>
              <input type="checkbox" checked={editForm.active}
                onChange={e => setEditForm(prev => ({ ...prev, active: e.target.checked }))} />
              Активний
            </label>
            <button className="btn-primary" onClick={handleSave}>Зберегти</button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>Скасувати</button>
          </>
        ) : (
          <>
            {dp
              ? <code style={{ color: '#B9E42B', fontSize: 12, flex: 1, wordBreak: 'break-all' }}>{dp.path}</code>
              : <span style={{ color: '#666', flex: 1 }}>Шлях не вказано</span>
            }
            <button className="btn-edit" onClick={startEdit}>{dp ? 'Ред.' : 'Додати шлях'}</button>
            {dp && <button className="btn-danger" onClick={handleDelete}>Видалити</button>}
          </>
        )}
      </div>

      {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`} style={{ marginTop: 4 }}>{status.msg}</div>}

      {/* EIS section */}
      <div style={{ marginTop: 8 }}>
        <button className="btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }}
          onClick={() => setEisOpen(v => !v)}>
          {eisOpen ? '▲' : '▾'} ЄІС коди ({eisCodes.length})
        </button>

        {eisOpen && (
          <div style={{ marginTop: 8, paddingLeft: 4 }}>
            {eisCodes.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {eisCodes.map(e => (
                  <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#1e2e08', color: '#B9E42B', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
                    {e.eis_code}
                    <button onClick={() => handleDeleteEis(e.eis_code)}
                      style={{ background: 'none', border: 'none', color: '#e05252', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1 }}
                      title="Видалити">✕</button>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>ЄІС коди не додано</div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <input
                className="admin-input"
                style={{ minWidth: 220, fontSize: 12 }}
                placeholder="Ввести ЄІС код вручну"
                value={eisInput}
                onChange={e => setEisInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddEis()}
              />
              <button className="btn-primary" style={{ fontSize: 12 }} onClick={handleAddEis}>Додати</button>
              {dp && (
                <button className="btn-secondary" style={{ fontSize: 12 }}
                  onClick={handleScan} disabled={scan === 'loading'}>
                  {scan === 'loading' ? 'Сканування…' : '🔍 Сканувати архів'}
                </button>
              )}
            </div>

            {Array.isArray(scan) && scan.length > 0 && (
              <div style={{ background: '#222', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>
                  Знайдено нових папок ({scan.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {scan.map(code => (
                    <label key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#ccc' }}>
                      <input type="checkbox" checked={scanSelected.has(code)}
                        onChange={() => setScanSelected(prev => {
                          const s = new Set(prev);
                          s.has(code) ? s.delete(code) : s.add(code);
                          return s;
                        })} />
                      {code}
                    </label>
                  ))}
                </div>
                <button className="btn-primary" style={{ fontSize: 12 }}
                  disabled={scanSelected.size === 0} onClick={handleAddSelected}>
                  Додати вибрані ({scanSelected.size})
                </button>
              </div>
            )}
            {Array.isArray(scan) && scan.length === 0 && (
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Нових папок не знайдено</div>
            )}

            {eisStatus && <div className={`admin-status ${eisStatus.ok ? 'ok' : 'error'}`}>{eisStatus.msg}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LUMG Paths Section ───────────────────────────────────────────────────────

function LumgPathsSection({ lumgs }) {
  const [paths, setPaths] = useState({});
  const [eisCodes, setEisCodes] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lumgs.length) return;
    setLoading(true);
    Promise.all(
      lumgs.map(async (lumg) => {
        const [dp, eis] = await Promise.all([
          lumgApi.getDataPath(lumg.id).catch(() => null),
          lumgApi.getEisCodes(lumg.id).catch(() => []),
        ]);
        return { id: lumg.id, dp: dp || null, eis: eis || [] };
      })
    ).then(results => {
      const pm = {}, em = {};
      results.forEach(r => { pm[r.id] = r.dp; em[r.id] = r.eis; });
      setPaths(pm);
      setEisCodes(em);
      setLoading(false);
    });
  }, [lumgs.map(l => l.id).join(',')]);

  if (!lumgs.length) return (
    <div style={{ color: '#666', fontSize: 13, padding: '16px 0' }}>У цій філії немає ЛУМГ</div>
  );

  if (loading) return (
    <div style={{ color: '#888', fontSize: 13, padding: '16px 0' }}>Завантаження…</div>
  );

  return (
    <div>
      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Шляхи архівних даних — ЛУМГ
      </div>
      {lumgs.map(lumg => (
        <LumgRow
          key={lumg.id}
          lumg={lumg}
          initialDp={paths[lumg.id]}
          initialEis={eisCodes[lumg.id]}
        />
      ))}
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function DataPathsTab() {
  const [branches, setBranches] = useState([]);
  const [allLumgs, setAllLumgs] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  useEffect(() => {
    Promise.all([branchApi.getAll(), lumgApi.getAll()]).then(([b, l]) => {
      const branchList = b || [];
      const lumgList = l || [];
      setBranches(branchList);
      setAllLumgs(lumgList);
      if (branchList.length > 0) setSelectedBranchId(branchList[0].id);
    });
  }, []);

  const selectedBranch = branches.find(b => b.id === selectedBranchId) || null;
  const branchLumgs = allLumgs.filter(l => l.branch_id === selectedBranchId);

  return (
    <div>
      {/* Branch selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '12px 16px', background: '#1e1e1e', borderRadius: 8, border: '1px solid #3E3E3E' }}>
        <label style={{ color: '#B9E42B', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Філія:</label>
        <select
          style={{ background: '#2a2a2a', color: '#e0e0e0', border: '1px solid #404040', borderRadius: 4, padding: '6px 12px', fontSize: 14, minWidth: 220, flex: 1, maxWidth: 400 }}
          value={selectedBranchId || ''}
          onChange={e => setSelectedBranchId(Number(e.target.value))}
        >
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {selectedBranch && (
          <span style={{ color: '#666', fontSize: 12 }}>
            ЛУМГ: {branchLumgs.length}
          </span>
        )}
      </div>

      {selectedBranch && (
        <div key={selectedBranch.id}>
          <BranchConfigSection branch={selectedBranch} allLumgs={allLumgs} />
          <LumgPathsSection lumgs={branchLumgs} />
        </div>
      )}
    </div>
  );
}
