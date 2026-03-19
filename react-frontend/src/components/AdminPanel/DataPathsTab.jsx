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

  const load = async () => {
    const data = await lumgApi.getAll();
    if (!data) return;
    setLumgs(data);
    const pathMap = {};
    await Promise.all(
      data.map(async (lumg) => {
        const dp = await lumgApi.getDataPath(lumg.id);
        pathMap[lumg.id] = dp || null;
      })
    );
    setPaths(pathMap);
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

  return (
    <div>
      <h3 style={{ color: '#fff', marginBottom: 12, fontSize: 16 }}>Шляхи архівних даних — ЛУМГ</h3>
      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>ЛУМГ</th><th>Шлях</th><th>Активний</th><th></th></tr>
        </thead>
        <tbody>
          {lumgs.map(lumg => {
            const dp = paths[lumg.id];
            const isEditing = lumg.id in editing;
            const ed = editing[lumg.id] || {};
            const st = status[lumg.id];
            return (
              <tr key={lumg.id}>
                <td>{lumg.id}</td>
                <td>{lumg.name}</td>
                <td>
                  {isEditing ? (
                    <input
                      className="admin-input"
                      style={{ minWidth: 300 }}
                      value={ed.path}
                      onChange={e => setEditing(prev => ({ ...prev, [lumg.id]: { ...prev[lumg.id], path: e.target.value } }))}
                      placeholder="/data/archive.zip"
                    />
                  ) : (
                    dp ? <code style={{ color: '#B9E42B', fontSize: 12 }}>{dp.path}</code> : <span style={{ color: '#666' }}>—</span>
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="checkbox"
                      checked={ed.active}
                      onChange={e => setEditing(prev => ({ ...prev, [lumg.id]: { ...prev[lumg.id], active: e.target.checked } }))}
                    />
                  ) : (
                    dp
                      ? <span className={dp.active ? 'badge-active' : 'badge-inactive'}>{dp.active ? 'Так' : 'Ні'}</span>
                      : null
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {isEditing ? (
                    <>
                      <button className="btn-primary" style={{ marginRight: 4 }} onClick={() => handleSave(lumg.id)}>Зберегти</button>
                      <button className="btn-secondary" onClick={() => cancelEdit(lumg.id)}>Скасувати</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-edit" onClick={() => startEdit(lumg)}>{dp ? 'Ред.' : 'Додати'}</button>
                      {dp && <button className="btn-danger" onClick={() => handleDelete(lumg.id)}>Видалити</button>}
                    </>
                  )}
                  {st && <div className={`admin-status ${st.ok ? 'ok' : 'error'}`}>{st.msg}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
