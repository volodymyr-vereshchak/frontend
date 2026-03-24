import React, { useEffect, useState } from 'react';
import { branchApi, lumgApi, gasVolumeApi, calcTypeApi } from '../../services/api';
import { useLocalStorage } from '../../hooks/useLocalStorage';

const EMPTY_ADD = { name: '', address: '', c_time: '600', type_id: '' };

export default function CalcsTab() {
  const [branches, setBranches]               = useState([]);
  const [allLumgs, setAllLumgs]               = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useLocalStorage('hlv-calcs-branch', '');
  const [lumgs, setLumgs]                     = useState([]);
  const [selectedLumgId, setSelectedLumgId]   = useLocalStorage('hlv-calcs-lumg', '');
  const [calcTypes, setCalcTypes]             = useState([]);
  const [calcs, setCalcs]                     = useState([]);
  const [editingId, setEditingId]             = useState(null);
  const [editForm, setEditForm]               = useState({});
  const [deletingId, setDeletingId]           = useState(null);
  const [saving, setSaving]                   = useState(false);
  const [showAdd, setShowAdd]                 = useState(false);
  const [addForm, setAddForm]                 = useState(EMPTY_ADD);
  const [addError, setAddError]               = useState(null);
  const [adding, setAdding]                   = useState(false);

  useEffect(() => {
    Promise.all([branchApi.getAll(), lumgApi.getAll(), calcTypeApi.getAll()]).then(([b, l, ct]) => {
      if (b) setBranches(b);
      if (l) setAllLumgs(l);
      if (ct) setCalcTypes(ct);
      if (b?.length > 0) {
        setSelectedBranchId(prev =>
          b.some(x => String(x.id) === prev) ? prev : String(b[0].id)
        );
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedBranchId || allLumgs.length === 0) return;
    const filtered = allLumgs.filter(l => String(l.branch_id) === selectedBranchId);
    setLumgs(filtered);
    if (filtered.length > 0) {
      setSelectedLumgId(prev =>
        filtered.some(l => String(l.id) === prev) ? prev : String(filtered[0].id)
      );
    } else {
      setSelectedLumgId('');
    }
  }, [selectedBranchId, allLumgs]);

  useEffect(() => {
    if (!selectedLumgId) { setCalcs([]); return; }
    gasVolumeApi.getGasVolumesByLumg(parseInt(selectedLumgId)).then(d => {
      if (d) setCalcs(d);
    });
  }, [selectedLumgId]);

  const reloadCalcs = () =>
    gasVolumeApi.getGasVolumesByLumg(parseInt(selectedLumgId)).then(d => { if (d) setCalcs(d); });

  const typeName = (type_id) => calcTypes.find(t => t.id === type_id)?.type_name || (type_id ? `#${type_id}` : '—');

  // ── Edit ──────────────────────────────────────────────────────────────────

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({ name: c.name, address: String(c.address), c_time: String(c.c_time), type_id: c.type_id ? String(c.type_id) : '' });
  };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (c) => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    const result = await gasVolumeApi.update(c.id, {
      name: editForm.name.trim(),
      address: parseInt(editForm.address),
      c_time: parseInt(editForm.c_time),
      type_id: editForm.type_id ? parseInt(editForm.type_id) : null,
    });
    setSaving(false);
    if (result) {
      setCalcs(prev => prev.map(x => x.id === c.id ? { ...x, ...result } : x));
      setEditingId(null);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити вичислювач та всі його лінії і архівні дані?')) return;
    setCalcs(prev => prev.filter(c => c.id !== id));
    setDeletingId(id);
    const ok = await gasVolumeApi.delete(id);
    setDeletingId(null);
    if (!ok) reloadCalcs();
  };

  // ── Add ───────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    setAddError(null);
    if (!addForm.name.trim()) { setAddError('Введіть назву'); return; }
    if (!addForm.address || isNaN(parseInt(addForm.address))) { setAddError('Введіть адресу'); return; }
    if (!selectedLumgId) { setAddError('Оберіть ЛУМГ'); return; }
    setAdding(true);
    const result = await gasVolumeApi.create({
      name: addForm.name.trim(),
      address: parseInt(addForm.address),
      c_time: parseInt(addForm.c_time) || 600,
      lumg_id: parseInt(selectedLumgId),
      type_id: addForm.type_id ? parseInt(addForm.type_id) : null,
    });
    setAdding(false);
    if (result) {
      setCalcs(prev => [...prev, result]);
      setAddForm(EMPTY_ADD);
      setShowAdd(false);
    } else {
      setAddError('Помилка збереження (можливо, адреса вже існує)');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Filters */}
      <div className="admin-form" style={{ marginBottom: 8 }}>
        <div className="admin-form-group">
          <label>Філія</label>
          <select className="admin-select" value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="admin-form-group">
          <label>ЛУМГ</label>
          <select className="admin-select" value={selectedLumgId} onChange={e => setSelectedLumgId(e.target.value)}>
            {lumgs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="admin-form-group" style={{ alignSelf: 'flex-end' }}>
          <button className="btn-primary" onClick={() => { setShowAdd(v => !v); setAddError(null); }}>
            {showAdd ? 'Скасувати' : '+ Додати вичислювач'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ border: '1px solid #4CAF50', borderRadius: 6, padding: 12, marginBottom: 12, background: '#1a2a1a' }}>
          <strong style={{ color: '#B9E42B', fontSize: 13 }}>Новий вичислювач</strong>
          <div className="admin-form" style={{ marginTop: 8 }}>
            <div className="admin-form-group">
              <label>Назва</label>
              <input className="admin-input" style={{ minWidth: 180 }}
                value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Назва вичислювача" />
            </div>
            <div className="admin-form-group">
              <label>Адреса</label>
              <input className="admin-input" type="number" style={{ width: 80 }}
                value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))}
                placeholder="1" />
            </div>
            <div className="admin-form-group">
              <label>c_time</label>
              <input className="admin-input" type="number" style={{ width: 80 }}
                value={addForm.c_time} onChange={e => setAddForm(f => ({ ...f, c_time: e.target.value }))}
                placeholder="600" />
            </div>
            <div className="admin-form-group">
              <label>Тип</label>
              <select className="admin-select" value={addForm.type_id}
                onChange={e => setAddForm(f => ({ ...f, type_id: e.target.value }))}>
                <option value="">— обрати —</option>
                {calcTypes.map(t => <option key={t.id} value={t.id}>{t.type_name}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={handleAdd} disabled={adding}>
              {adding ? 'Збереження…' : 'Зберегти'}
            </button>
          </div>
          {addError && <div className="admin-status error">{addError}</div>}
        </div>
      )}

      {/* Table */}
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Адреса</th>
            <th>Назва</th>
            <th>c_time</th>
            <th>Тип</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {calcs.length === 0 && (
            <tr><td colSpan={6} style={{ color: '#555', textAlign: 'center', padding: 16 }}>
              {selectedLumgId ? 'Немає вичислювачів' : 'Оберіть ЛУМГ'}
            </td></tr>
          )}
          {calcs.map(c => (
            <tr key={c.id}>
              <td style={{ color: '#555', fontSize: 11 }}>{c.id}</td>
              <td>
                {editingId === c.id ? (
                  <input className="admin-input" type="number" value={editForm.address}
                    onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    style={{ width: 70 }} />
                ) : <span style={{ fontFamily: 'monospace', color: '#B9E42B' }}>{c.address}</span>}
              </td>
              <td>
                {editingId === c.id ? (
                  <input className="admin-input" value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    autoFocus style={{ minWidth: 180 }} />
                ) : c.name}
              </td>
              <td>
                {editingId === c.id ? (
                  <input className="admin-input" type="number" value={editForm.c_time}
                    onChange={e => setEditForm(f => ({ ...f, c_time: e.target.value }))}
                    style={{ width: 70 }} />
                ) : c.c_time}
              </td>
              <td>
                {editingId === c.id ? (
                  <select className="admin-select" value={editForm.type_id}
                    onChange={e => setEditForm(f => ({ ...f, type_id: e.target.value }))}>
                    <option value="">—</option>
                    {calcTypes.map(t => <option key={t.id} value={t.id}>{t.type_name}</option>)}
                  </select>
                ) : <span style={{ fontSize: 11, color: '#aaa' }}>{typeName(c.type_id)}</span>}
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {editingId === c.id ? (
                  <>
                    <button className="btn-edit" onClick={() => saveEdit(c)} disabled={saving}>Зберегти</button>
                    <button className="btn-secondary" onClick={cancelEdit}>Скасувати</button>
                  </>
                ) : (
                  <>
                    <button className="btn-edit" onClick={() => startEdit(c)}>Ред.</button>
                    <button className="btn-danger" onClick={() => handleDelete(c.id)} disabled={deletingId !== null}>
                      {deletingId === c.id ? '…' : 'Видалити'}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
