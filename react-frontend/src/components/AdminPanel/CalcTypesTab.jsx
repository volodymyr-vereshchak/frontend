import React, { useEffect, useState } from 'react';
import { calcTypeApi } from '../../services/api';
import { useStatusMessage } from './common/useStatusMessage';

export default function CalcTypesTab() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState({});
  const [form, setForm] = useState({ type_id: '', type_name: '' });
  const [status, showStatus] = useStatusMessage();
  const [isExporting, setIsExporting] = useState(false);

  const load = async () => {
    const data = await calcTypeApi.getAll();
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(i =>
    !search ||
    String(i.type_id).includes(search) ||
    i.type_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const result = await calcTypeApi.create({ type_id: Number(form.type_id), type_name: form.type_name.trim() });
      if (result?.id) { setForm({ type_id: '', type_name: '' }); load(); showStatus(true, 'Додано'); }
    } catch (err) { showStatus(false, err.message || 'Помилка'); }
  };

  const startEdit = (item) =>
    setEditing(prev => ({ ...prev, [item.id]: { type_id: item.type_id, type_name: item.type_name } }));

  const cancelEdit = (id) =>
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });

  const handleSave = async (id) => {
    const ed = editing[id];
    try {
      const result = await calcTypeApi.update(id, { type_id: Number(ed.type_id), type_name: ed.type_name.trim() });
      if (result?.id) { cancelEdit(id); await load(); showStatus(true, 'Збережено'); }
    } catch (err) { showStatus(false, err.message || 'Помилка'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити тип обчислювача?')) return;
    const ok = await calcTypeApi.delete(id);
    if (ok) { await load(); showStatus(true, 'Видалено'); }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await calcTypeApi.exportPreload();
      showStatus(true, `JSON збережено: типів ${res.exported.flowtype}, аварій ${res.exported.sysname}, змін ${res.exported.editname}`);
    } catch (err) {
      showStatus(false, err.message || 'Помилка збереження');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <input
          className="admin-input"
          placeholder="Пошук за ID або назвою…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <span style={{ color: '#555', fontSize: 12 }}>{filtered.length} / {items.length}</span>
        <button
          className="btn-secondary"
          onClick={handleExport}
          disabled={isExporting}
          title="Зберегти поточний стан БД у preload JSON-файли"
          style={{ marginLeft: 'auto', fontSize: 12 }}
        >
          {isExporting ? '⏳ Зберігання…' : '💾 Зберегти в JSON'}
        </button>
      </div>

      {/* Add form */}
      <form className="admin-form" onSubmit={handleCreate} style={{ marginBottom: 14 }}>
        <div className="admin-form-group">
          <label>ID типу</label>
          <input
            className="admin-input" type="number" required
            value={form.type_id} onChange={e => setForm(f => ({ ...f, type_id: e.target.value }))}
            placeholder="1" style={{ minWidth: 80 }}
          />
        </div>
        <div className="admin-form-group">
          <label>Назва</label>
          <input
            className="admin-input" required
            value={form.type_name} onChange={e => setForm(f => ({ ...f, type_name: e.target.value }))}
            placeholder="ВЕГА-1" style={{ minWidth: 220 }}
          />
        </div>
        <button className="btn-primary" type="submit">Додати</button>
      </form>

      {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`} style={{ marginBottom: 8 }}>{status.msg}</div>}

      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>ID типу</th><th>Назва</th><th></th></tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={4} style={{ color: '#555', textAlign: 'center', padding: 16 }}>
              {search ? 'Нічого не знайдено' : 'Немає типів'}
            </td></tr>
          )}
          {filtered.map(item => {
            const ed = editing[item.id];
            if (ed) return (
              <tr key={item.id} style={{ background: '#1e2e08' }}>
                <td>{item.id}</td>
                <td>
                  <input className="admin-input" type="number" style={{ minWidth: 70 }}
                    value={ed.type_id}
                    onChange={e => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], type_id: e.target.value } }))}
                  />
                </td>
                <td>
                  <input className="admin-input" style={{ minWidth: 200 }}
                    value={ed.type_name}
                    onChange={e => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], type_name: e.target.value } }))}
                  />
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => handleSave(item.id)}>Зберегти</button>
                  <button className="btn-secondary" style={{ fontSize: 11, marginLeft: 4 }} onClick={() => cancelEdit(item.id)}>Скасувати</button>
                </td>
              </tr>
            );
            return (
              <tr key={item.id}>
                <td style={{ color: '#555', fontSize: 11 }}>{item.id}</td>
                <td><span style={{ fontFamily: 'monospace', color: '#B9E42B' }}>{item.type_id}</span></td>
                <td>{item.type_name}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn-edit" onClick={() => startEdit(item)}>Ред.</button>
                  <button className="btn-danger" onClick={() => handleDelete(item.id)}>Видалити</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
