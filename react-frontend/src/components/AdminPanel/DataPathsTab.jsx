import React, { useEffect, useState } from 'react';
import { branchApi, lumgApi } from '../../services/api';

// ─── Branch Config Paths + Mapping ───────────────────────────────────────────

function BranchDataPaths() {
  const [branches, setBranches] = useState([]);
  const [allLumgs, setAllLumgs] = useState([]);
  const [paths, setPaths] = useState({});       // branch_id -> dp | null
  const [editing, setEditing] = useState({});   // branch_id -> { path, active }
  const [mappings, setMappings] = useState({});  // branch_id -> [{gis_name, lumg_id}]
  const [preview, setPreview] = useState({});    // branch_id -> [{gis_name, flow_count, line_count}] | 'loading' | 'error'
  const [updating, setUpdating] = useState({});  // branch_id -> bool
  const [status, setStatus] = useState({});      // branch_id -> { ok, msg }

  const load = async () => {
    const [branchData, lumgData] = await Promise.all([branchApi.getAll(), lumgApi.getAll()]);
    if (!branchData) return;
    setBranches(branchData);
    setAllLumgs(lumgData || []);

    const pathMap = {};
    const mappingMap = {};
    await Promise.all(
      branchData.map(async (b) => {
        const [dp, maps] = await Promise.all([
          branchApi.getConfigPath(b.id),
          branchApi.getConfigMappings(b.id),
        ]);
        pathMap[b.id] = dp || null;
        mappingMap[b.id] = maps || [];
      })
    );
    setPaths(pathMap);
    setMappings(mappingMap);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (branch) => {
    const current = paths[branch.id];
    setEditing(prev => ({
      ...prev,
      [branch.id]: { path: current?.path || '', active: current?.active ?? true }
    }));
  };

  const cancelEdit = (id) => {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
    setStatus(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSavePath = async (id) => {
    const { path, active } = editing[id];
    const result = await branchApi.setConfigPath(id, { path, active });
    if (result) {
      setStatus(prev => ({ ...prev, [id]: { ok: true, msg: 'Шлях збережено' } }));
      setPaths(prev => ({ ...prev, [id]: result }));
      setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
      // Clear old preview when path changes
      setPreview(prev => { const n = { ...prev }; delete n[id]; return n; });
    } else {
      setStatus(prev => ({ ...prev, [id]: { ok: false, msg: 'Помилка збереження' } }));
    }
  };

  const handleDeletePath = async (id) => {
    if (!window.confirm('Видалити шлях?')) return;
    await branchApi.deleteConfigPath(id);
    setPaths(prev => ({ ...prev, [id]: null }));
    setPreview(prev => { const n = { ...prev }; delete n[id]; return n; });
    setMappings(prev => ({ ...prev, [id]: [] }));
    setStatus(prev => ({ ...prev, [id]: { ok: true, msg: 'Видалено' } }));
  };

  const handlePreview = async (id) => {
    setPreview(prev => ({ ...prev, [id]: 'loading' }));
    setStatus(prev => { const n = { ...prev }; delete n[id]; return n; });
    const result = await branchApi.previewConfig(id);
    if (result && Array.isArray(result)) {
      setPreview(prev => ({ ...prev, [id]: result }));
      // Merge with existing mappings — keep lumg_id if already mapped
      const existing = mappings[id] || [];
      const existingMap = {};
      existing.forEach(m => { existingMap[m.gis_name] = m.lumg_id; });
      const merged = result.map(gis => ({
        gis_name: gis.gis_name,
        lumg_id: existingMap[gis.gis_name] ?? null,
      }));
      setMappings(prev => ({ ...prev, [id]: merged }));
    } else {
      setPreview(prev => ({ ...prev, [id]: 'error' }));
      setStatus(prev => ({ ...prev, [id]: { ok: false, msg: 'Не вдалося прочитати файл' } }));
    }
  };

  const handleMappingChange = (branchId, gisName, lumgId) => {
    setMappings(prev => ({
      ...prev,
      [branchId]: (prev[branchId] || []).map(m =>
        m.gis_name === gisName ? { ...m, lumg_id: lumgId } : m
      ),
    }));
  };

  const handleSaveMappings = async (id) => {
    const data = (mappings[id] || []);
    const result = await branchApi.setConfigMappings(id, data);
    if (result) {
      setMappings(prev => ({ ...prev, [id]: result }));
      setStatus(prev => ({ ...prev, [id]: { ok: true, msg: 'Маппінг збережено' } }));
    } else {
      setStatus(prev => ({ ...prev, [id]: { ok: false, msg: 'Помилка збереження маппінгу' } }));
    }
  };

  const handleUpdateNames = async (id) => {
    setUpdating(prev => ({ ...prev, [id]: true }));
    setStatus(prev => ({ ...prev, [id]: null }));
    const result = await branchApi.updateNames(id);
    setUpdating(prev => ({ ...prev, [id]: false }));
    if (result) {
      setStatus(prev => ({ ...prev, [id]: { ok: true, msg: 'Імена оновлено' } }));
    } else {
      setStatus(prev => ({ ...prev, [id]: { ok: false, msg: 'Помилка оновлення імен' } }));
    }
  };

  return (
    <div style={{ marginBottom: 40 }}>
      <h3 style={{ color: '#fff', marginBottom: 12, fontSize: 16 }}>Конфіг імен (ASK.CFG) — Філіали</h3>

      {branches.map(b => {
        const dp = paths[b.id];
        const isEditing = b.id in editing;
        const ed = editing[b.id] || {};
        const st = status[b.id];
        const isUpdating = updating[b.id];
        const pv = preview[b.id];
        const branchMappings = mappings[b.id] || [];
        const branchLumgs = allLumgs.filter(l => l.branch_id === b.id);

        return (
          <div key={b.id} style={{ marginBottom: 24, padding: 16, background: '#2a2a2a', borderRadius: 8, border: '1px solid #3E3E3E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ color: '#fff', fontWeight: 600, minWidth: 120 }}>{b.name}</span>

              {/* Path field */}
              {isEditing ? (
                <>
                  <input
                    className="admin-input"
                    style={{ flex: 1, minWidth: 280 }}
                    value={ed.path}
                    onChange={e => setEditing(prev => ({ ...prev, [b.id]: { ...prev[b.id], path: e.target.value } }))}
                    placeholder="C:/data/ask.CFG"
                  />
                  <input
                    type="checkbox"
                    checked={ed.active}
                    onChange={e => setEditing(prev => ({ ...prev, [b.id]: { ...prev[b.id], active: e.target.checked } }))}
                    title="Активний"
                  />
                  <button className="btn-primary" onClick={() => handleSavePath(b.id)}>Зберегти</button>
                  <button className="btn-secondary" onClick={() => cancelEdit(b.id)}>Скасувати</button>
                </>
              ) : (
                <>
                  {dp
                    ? <code style={{ color: '#B9E42B', fontSize: 12, flex: 1 }}>{dp.path}</code>
                    : <span style={{ color: '#666', flex: 1 }}>Шлях не вказано</span>
                  }
                  <button className="btn-edit" onClick={() => startEdit(b)}>{dp ? 'Ред.' : 'Додати шлях'}</button>
                  {dp && <button className="btn-danger" onClick={() => handleDeletePath(b.id)}>Видалити</button>}
                  {dp && (
                    <button className="btn-secondary" onClick={() => handlePreview(b.id)}>
                      {pv === 'loading' ? 'Читання…' : 'Переглянути CFG'}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Mapping table */}
            {Array.isArray(pv) && pv.length > 0 && (
              <div style={{ marginTop: 10 }}>
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
                    {pv.map(gis => {
                      const mapping = branchMappings.find(m => m.gis_name === gis.gis_name);
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
                              onChange={e => handleMappingChange(b.id, gis.gis_name, e.target.value ? Number(e.target.value) : null)}
                            >
                              <option value="">— не вибрано —</option>
                              {branchLumgs.map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={() => handleSaveMappings(b.id)}>Зберегти маппінг</button>
                  <button
                    className="btn-primary"
                    disabled={isUpdating || branchMappings.every(m => !m.lumg_id)}
                    onClick={() => handleUpdateNames(b.id)}
                  >
                    {isUpdating ? 'Оновлення…' : 'Оновити імена'}
                  </button>
                </div>
              </div>
            )}

            {/* Saved mappings summary (when no preview loaded) */}
            {!Array.isArray(pv) && branchMappings.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#aaa', fontSize: 12 }}>
                  Збережено маппінгів: {branchMappings.filter(m => m.lumg_id).length}/{branchMappings.length}
                </span>
                <button
                  className="btn-primary"
                  disabled={isUpdating}
                  onClick={() => handleUpdateNames(b.id)}
                >
                  {isUpdating ? 'Оновлення…' : 'Оновити імена'}
                </button>
              </div>
            )}

            {st && <div className={`admin-status ${st.ok ? 'ok' : 'error'}`} style={{ marginTop: 8 }}>{st.msg}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── LUMG Data Paths ──────────────────────────────────────────────────────────

function LumgDataPaths() {
  const [lumgs, setLumgs] = useState([]);
  const [paths, setPaths] = useState({});
  const [editing, setEditing] = useState({});
  const [status, setStatus] = useState({});
  // EIS codes state
  const [eisCodes, setEisCodes] = useState({});       // lumg_id → [{id, eis_code}]
  const [eisExpanded, setEisExpanded] = useState({}); // lumg_id → bool
  const [eisInput, setEisInput] = useState({});       // lumg_id → string
  const [scanResults, setScanResults] = useState({});  // lumg_id → string[] | 'loading'
  const [scanSelected, setScanSelected] = useState({}); // lumg_id → Set<string>
  const [eisStatus, setEisStatus] = useState({});     // lumg_id → {ok, msg}

  const load = async () => {
    const data = await lumgApi.getAll();
    if (!data) return;
    setLumgs(data);
    const pathMap = {};
    const eisMap = {};
    await Promise.all(
      data.map(async (lumg) => {
        const [dp, eis] = await Promise.all([
          lumgApi.getDataPath(lumg.id),
          lumgApi.getEisCodes(lumg.id),
        ]);
        pathMap[lumg.id] = dp || null;
        eisMap[lumg.id] = eis || [];
      })
    );
    setPaths(pathMap);
    setEisCodes(eisMap);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (lumg) => {
    const current = paths[lumg.id];
    setEditing(prev => ({
      ...prev,
      [lumg.id]: { path: current?.path || '', active: current?.active ?? true }
    }));
  };

  const cancelEdit = (lumgId) => {
    setEditing(prev => { const n = { ...prev }; delete n[lumgId]; return n; });
    setStatus(prev => { const n = { ...prev }; delete n[lumgId]; return n; });
  };

  const handleSave = async (lumgId) => {
    const { path, active } = editing[lumgId];
    const result = await lumgApi.setDataPath(lumgId, { path, active });
    if (result) {
      setStatus(prev => ({ ...prev, [lumgId]: { ok: true, msg: 'Збережено' } }));
      setPaths(prev => ({ ...prev, [lumgId]: result }));
      setEditing(prev => { const n = { ...prev }; delete n[lumgId]; return n; });
    } else {
      setStatus(prev => ({ ...prev, [lumgId]: { ok: false, msg: 'Помилка' } }));
    }
  };

  const handleDelete = async (lumgId) => {
    if (!window.confirm('Видалити шлях?')) return;
    await lumgApi.deleteDataPath(lumgId);
    setPaths(prev => ({ ...prev, [lumgId]: null }));
    setStatus(prev => ({ ...prev, [lumgId]: { ok: true, msg: 'Видалено' } }));
  };

  // EIS handlers
  const toggleEis = (lumgId) =>
    setEisExpanded(prev => ({ ...prev, [lumgId]: !prev[lumgId] }));

  const handleAddEis = async (lumgId) => {
    const code = (eisInput[lumgId] || '').trim();
    if (!code) return;
    const result = await lumgApi.addEisCode(lumgId, { eis_code: code });
    if (result?.id) {
      setEisCodes(prev => ({ ...prev, [lumgId]: [...(prev[lumgId] || []), result] }));
      setEisInput(prev => ({ ...prev, [lumgId]: '' }));
      setEisStatus(prev => ({ ...prev, [lumgId]: { ok: true, msg: 'Додано' } }));
    } else {
      setEisStatus(prev => ({ ...prev, [lumgId]: { ok: false, msg: result?.detail || 'Помилка' } }));
    }
  };

  const handleDeleteEis = async (lumgId, code) => {
    await lumgApi.deleteEisCode(lumgId, code);
    setEisCodes(prev => ({ ...prev, [lumgId]: (prev[lumgId] || []).filter(e => e.eis_code !== code) }));
  };

  const handleScan = async (lumgId) => {
    setScanResults(prev => ({ ...prev, [lumgId]: 'loading' }));
    const result = await lumgApi.scanEis(lumgId);
    if (Array.isArray(result)) {
      const existing = new Set((eisCodes[lumgId] || []).map(e => e.eis_code));
      const newOnes = result.filter(r => !existing.has(r));
      setScanResults(prev => ({ ...prev, [lumgId]: newOnes }));
      setScanSelected(prev => ({ ...prev, [lumgId]: new Set(newOnes) }));
    } else {
      setScanResults(prev => ({ ...prev, [lumgId]: [] }));
      setEisStatus(prev => ({ ...prev, [lumgId]: { ok: false, msg: 'Помилка сканування' } }));
    }
  };

  const handleAddSelected = async (lumgId) => {
    const sel = scanSelected[lumgId] || new Set();
    for (const code of sel) {
      const result = await lumgApi.addEisCode(lumgId, { eis_code: code });
      if (result?.id) {
        setEisCodes(prev => ({ ...prev, [lumgId]: [...(prev[lumgId] || []), result] }));
      }
    }
    setScanResults(prev => { const n = { ...prev }; delete n[lumgId]; return n; });
    setEisStatus(prev => ({ ...prev, [lumgId]: { ok: true, msg: `Додано ${sel.size} кодів` } }));
  };

  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 12, fontSize: 16 }}>Шляхи архівних даних — ЛУМГ</h3>

      {lumgs.map(lumg => {
        const dp = paths[lumg.id];
        const isEditing = lumg.id in editing;
        const ed = editing[lumg.id] || {};
        const st = status[lumg.id];
        const eis = eisCodes[lumg.id] || [];
        const isEisOpen = eisExpanded[lumg.id];
        const scan = scanResults[lumg.id];
        const selSet = scanSelected[lumg.id] || new Set();
        const eisSt = eisStatus[lumg.id];

        return (
          <div key={lumg.id} style={{ marginBottom: 16, padding: 16, background: '#2a2a2a', borderRadius: 8, border: '1px solid #3E3E3E' }}>
            {/* Path row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ color: '#fff', fontWeight: 600, minWidth: 120 }}>{lumg.name}</span>
              {isEditing ? (
                <>
                  <input
                    className="admin-input"
                    style={{ flex: 1, minWidth: 280 }}
                    value={ed.path}
                    onChange={e => setEditing(prev => ({ ...prev, [lumg.id]: { ...prev[lumg.id], path: e.target.value } }))}
                    placeholder="/data/archive.zip"
                  />
                  <input
                    type="checkbox"
                    checked={ed.active}
                    onChange={e => setEditing(prev => ({ ...prev, [lumg.id]: { ...prev[lumg.id], active: e.target.checked } }))}
                    title="Активний"
                  />
                  <button className="btn-primary" onClick={() => handleSave(lumg.id)}>Зберегти</button>
                  <button className="btn-secondary" onClick={() => cancelEdit(lumg.id)}>Скасувати</button>
                </>
              ) : (
                <>
                  {dp
                    ? <code style={{ color: '#B9E42B', fontSize: 12, flex: 1 }}>{dp.path}</code>
                    : <span style={{ color: '#666', flex: 1 }}>Шлях не вказано</span>
                  }
                  <button className="btn-edit" onClick={() => startEdit(lumg)}>{dp ? 'Ред.' : 'Додати шлях'}</button>
                  {dp && <button className="btn-danger" onClick={() => handleDelete(lumg.id)}>Видалити</button>}
                </>
              )}
            </div>
            {st && <div className={`admin-status ${st.ok ? 'ok' : 'error'}`} style={{ marginTop: 4 }}>{st.msg}</div>}

            {/* EIS codes section */}
            <div style={{ marginTop: 10 }}>
              <button
                className="btn-secondary"
                style={{ fontSize: 12, padding: '3px 10px' }}
                onClick={() => toggleEis(lumg.id)}
              >
                {isEisOpen ? '▲' : '▾'} ЄІС коди ({eis.length})
              </button>

              {isEisOpen && (
                <div style={{ marginTop: 8, paddingLeft: 4 }}>
                  {/* Current EIS codes */}
                  {eis.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {eis.map(e => (
                        <span key={e.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#1e2e08', color: '#B9E42B', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
                          {e.eis_code}
                          <button
                            onClick={() => handleDeleteEis(lumg.id, e.eis_code)}
                            style={{ background: 'none', border: 'none', color: '#e05252', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1 }}
                            title="Видалити"
                          >✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {eis.length === 0 && (
                    <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>ЄІС коди не додано</div>
                  )}

                  {/* Add manually */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                    <input
                      className="admin-input"
                      style={{ minWidth: 220, fontSize: 12 }}
                      placeholder="Ввести ЄІС код вручну"
                      value={eisInput[lumg.id] || ''}
                      onChange={e => setEisInput(prev => ({ ...prev, [lumg.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddEis(lumg.id)}
                    />
                    <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => handleAddEis(lumg.id)}>Додати</button>
                    {dp && (
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 12 }}
                        onClick={() => handleScan(lumg.id)}
                        disabled={scan === 'loading'}
                      >
                        {scan === 'loading' ? 'Сканування…' : '🔍 Сканувати архів'}
                      </button>
                    )}
                  </div>

                  {/* Scan results */}
                  {Array.isArray(scan) && scan.length > 0 && (
                    <div style={{ background: '#222', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Знайдено нових папок ({scan.length}). Вибери для додавання:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {scan.map(code => (
                          <label key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12, color: '#ccc' }}>
                            <input
                              type="checkbox"
                              checked={selSet.has(code)}
                              onChange={() => setScanSelected(prev => {
                                const s = new Set(prev[lumg.id] || []);
                                s.has(code) ? s.delete(code) : s.add(code);
                                return { ...prev, [lumg.id]: s };
                              })}
                            />
                            {code}
                          </label>
                        ))}
                      </div>
                      <button
                        className="btn-primary"
                        style={{ fontSize: 12 }}
                        disabled={selSet.size === 0}
                        onClick={() => handleAddSelected(lumg.id)}
                      >
                        Додати вибрані ({selSet.size})
                      </button>
                    </div>
                  )}
                  {Array.isArray(scan) && scan.length === 0 && (
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Нових папок не знайдено</div>
                  )}

                  {eisSt && <div className={`admin-status ${eisSt.ok ? 'ok' : 'error'}`}>{eisSt.msg}</div>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function DataPathsTab() {
  return (
    <div>
      <BranchDataPaths />
      <LumgDataPaths />
    </div>
  );
}
