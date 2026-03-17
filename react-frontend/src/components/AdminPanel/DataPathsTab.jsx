import React, { useEffect, useState } from 'react';
import { lumgApi } from '../../services/api';

export default function DataPathsTab() {
  const [lumgs, setLumgs] = useState([]);
  const [paths, setPaths] = useState({});   // lumg_id -> { path, active } | null
  const [editing, setEditing] = useState({}); // lumg_id -> { path, active }
  const [status, setStatus] = useState({});  // lumg_id -> { ok, msg }

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
