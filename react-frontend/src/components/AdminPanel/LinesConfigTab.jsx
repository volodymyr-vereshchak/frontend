import React, { useEffect, useState } from 'react';
import { branchApi, lumgApi, lineApi, gasVolumeApi } from '../../services/api';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { UNIT_LABELS, PRESSURE_UNIT_DEFAULT, DP_UNIT_DEFAULT } from '../../constants/pressureUnits';

const EMPTY_ADD = { name: '', line: '', meter: false, gas_volume_calc_id: '' };

export default function LinesConfigTab() {
  const [branches, setBranches]         = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useLocalStorage('hlv-lines-branch', '');
  const [lumgs, setLumgs]               = useState([]);
  const [allLumgs, setAllLumgs]         = useState([]);
  const [selectedLumgId, setSelectedLumgId] = useLocalStorage('hlv-lines-lumg', '');
  const [calcs, setCalcs]               = useState([]);
  const [lines, setLines]               = useState([]);
  const [saving, setSaving]             = useState({});
  const [editingId, setEditingId]       = useState(null);
  const [editForm, setEditForm]         = useState({});
  const [deletingId, setDeletingId]     = useState(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [addForm, setAddForm]           = useState(EMPTY_ADD);
  const [addError, setAddError]         = useState(null);
  const [adding, setAdding]             = useState(false);

  useEffect(() => {
    Promise.all([branchApi.getAll(), lumgApi.getAll()]).then(([branchData, lumgData]) => {
      if (branchData) setBranches(branchData);
      if (lumgData) setAllLumgs(lumgData);
      if (branchData?.length > 0) {
        setSelectedBranchId(prev =>
          branchData.some(b => String(b.id) === prev) ? prev : String(branchData[0].id)
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
    if (!selectedLumgId) { setLines([]); setCalcs([]); return; }
    const id = parseInt(selectedLumgId);
    setLines([]);
    Promise.all([
      lineApi.getLinesByLumg(id),
      gasVolumeApi.getGasVolumesByLumg(id),
    ]).then(([linesData, calcsData]) => {
      if (linesData) setLines(linesData);
      if (calcsData) {
        setCalcs(calcsData);
        setAddForm(f => ({ ...f, gas_volume_calc_id: calcsData[0]?.id ? String(calcsData[0].id) : '' }));
      }
    });
  }, [selectedLumgId]);

  const reloadLines = () =>
    lineApi.getLinesByLumg(parseInt(selectedLumgId)).then(d => { if (d) setLines(d); });

  // ── Toggle ──────────────────────────────────────────────────────────────────

  const handleToggle = async (line, field) => {
    const newValue = !line[field];
    setSaving(prev => ({ ...prev, [`${line.id}_${field}`]: true }));
    const result = await lineApi.update(line.id, { [field]: newValue });
    setSaving(prev => ({ ...prev, [`${line.id}_${field}`]: false }));
    if (result) setLines(prev => prev.map(l => l.id === line.id ? { ...l, [field]: newValue } : l));
  };

  // ── Unit selection (pressure / dp) ────────────────────────────────────────────

  const handleUnitChange = async (line, field, value) => {
    if (line[field] === value) return;
    const prevValue = line[field];
    setSaving(prev => ({ ...prev, [`${line.id}_${field}`]: true }));
    setLines(prev => prev.map(l => l.id === line.id ? { ...l, [field]: value } : l));
    const result = await lineApi.update(line.id, { [field]: value });
    setSaving(prev => ({ ...prev, [`${line.id}_${field}`]: false }));
    if (!result) {
      setLines(prev => prev.map(l => l.id === line.id ? { ...l, [field]: prevValue } : l));
    }
  };

  const UnitSelect = ({ line, field, fallback }) => {
    const key = `${line.id}_${field}`;
    return (
      <select className="admin-select" value={line[field] || fallback} disabled={saving[key]}
        onChange={e => handleUnitChange(line, field, e.target.value)}
        style={{ minWidth: 0, width: 92, fontSize: 11, opacity: saving[key] ? 0.6 : 1 }}>
        {UNIT_LABELS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
    );
  };

  // ── Edit name ───────────────────────────────────────────────────────────────

  const startEdit = (line) => {
    setEditingId(line.id);
    setEditForm({ name: line.name, line: String(line.line), meter: line.meter, gas_volume_calc_id: String(line.gas_volume_calc_id) });
  };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (line) => {
    if (!editForm.name.trim()) return;
    setSaving(prev => ({ ...prev, [`${line.id}_edit`]: true }));
    const result = await lineApi.update(line.id, {
      name: editForm.name.trim(),
      line: parseInt(editForm.line),
      meter: editForm.meter,
      gas_volume_calc_id: parseInt(editForm.gas_volume_calc_id),
    });
    setSaving(prev => ({ ...prev, [`${line.id}_edit`]: false }));
    if (result) {
      setLines(prev => prev.map(l => l.id === line.id ? { ...l, ...result } : l));
      setEditingId(null);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити лінію та всі її архівні дані?')) return;
    setLines(prev => prev.filter(l => l.id !== id));
    setDeletingId(id);
    const ok = await lineApi.delete(id);
    setDeletingId(null);
    if (!ok) reloadLines();
  };

  // ── Add ─────────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    setAddError(null);
    if (!addForm.name.trim()) { setAddError('Введіть назву'); return; }
    if (!addForm.line || isNaN(parseInt(addForm.line))) { setAddError('Введіть номер лінії'); return; }
    if (!addForm.gas_volume_calc_id) { setAddError('Оберіть обчислювач'); return; }
    setAdding(true);
    const result = await lineApi.create({
      name: addForm.name.trim(),
      line: parseInt(addForm.line),
      meter: addForm.meter,
      gas_volume_calc_id: parseInt(addForm.gas_volume_calc_id),
      include_in_report: false,
      include_in_trends: false,
      is_high_pressure: false,
    });
    setAdding(false);
    if (result) {
      setLines(prev => [...prev, result]);
      setAddForm(f => ({ ...EMPTY_ADD, gas_volume_calc_id: f.gas_volume_calc_id }));
      setShowAdd(false);
    } else {
      setAddError('Помилка збереження (можливо, номер лінії вже існує)');
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const Toggle = ({ line, field }) => {
    const key = `${line.id}_${field}`;
    const active = line[field];
    const busy = saving[key];
    return (
      <button onClick={() => handleToggle(line, field)} disabled={busy} style={{
        padding: '2px 10px', borderRadius: 12, border: 'none',
        cursor: busy ? 'wait' : 'pointer',
        background: active ? '#4CAF50' : '#555',
        color: '#fff', fontSize: 12, opacity: busy ? 0.6 : 1,
      }}>
        {active ? 'Так' : 'Ні'}
      </button>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

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
            {showAdd ? 'Скасувати' : '+ Додати лінію'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ border: '1px solid #4CAF50', borderRadius: 6, padding: 12, marginBottom: 12, background: '#1a2a1a' }}>
          <strong style={{ color: '#B9E42B', fontSize: 13 }}>Нова лінія</strong>
          <div className="admin-form" style={{ marginTop: 8 }}>
            <div className="admin-form-group">
              <label>Назва</label>
              <input className="admin-input" style={{ minWidth: 180 }}
                value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Назва лінії" />
            </div>
            <div className="admin-form-group">
              <label>№ лінії</label>
              <input className="admin-input" type="number" style={{ width: 70 }}
                value={addForm.line} onChange={e => setAddForm(f => ({ ...f, line: e.target.value }))}
                placeholder="0" />
            </div>
            <div className="admin-form-group">
              <label>Обчислювач</label>
              <select className="admin-select" value={addForm.gas_volume_calc_id}
                onChange={e => setAddForm(f => ({ ...f, gas_volume_calc_id: e.target.value }))}>
                <option value="">— обрати —</option>
                {calcs.map(c => <option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label>Лічильник</label>
              <button type="button" onClick={() => setAddForm(f => ({ ...f, meter: !f.meter }))} style={{
                padding: '2px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: addForm.meter ? '#4CAF50' : '#555', color: '#fff', fontSize: 12,
              }}>
                {addForm.meter ? 'Так' : 'Ні'}
              </button>
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
            <th>№</th>
            <th>Назва</th>
            <th>Лічильник</th>
            <th>Обчислювач</th>
            <th>В звіт</th>
            <th>В тренди</th>
            <th>Вис. тиск</th>
            <th>Тиск, од.</th>
            <th>Перепад, од.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.id}>
              <td>{l.id}</td>
              <td>
                {editingId === l.id ? (
                  <input className="admin-input" type="number" value={editForm.line}
                    onChange={e => setEditForm(f => ({ ...f, line: e.target.value }))}
                    style={{ width: 60 }} />
                ) : l.line}
              </td>
              <td>
                {editingId === l.id ? (
                  <input className="admin-input" value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus style={{ minWidth: 0, width: 130 }} />
                ) : l.name}
              </td>
              <td>
                {editingId === l.id ? (
                  <button type="button" onClick={() => setEditForm(f => ({ ...f, meter: !f.meter }))} style={{
                    padding: '2px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: editForm.meter ? '#4CAF50' : '#555', color: '#fff', fontSize: 12,
                  }}>
                    {editForm.meter ? 'Так' : 'Ні'}
                  </button>
                ) : (
                  <span style={{ color: l.meter ? '#4CAF50' : '#666', fontSize: 12 }}>{l.meter ? 'Так' : 'Ні'}</span>
                )}
              </td>
              <td>
                {editingId === l.id ? (
                  <select className="admin-select" value={editForm.gas_volume_calc_id}
                    onChange={e => setEditForm(f => ({ ...f, gas_volume_calc_id: e.target.value }))}
                    style={{ minWidth: 0, maxWidth: 120, fontSize: 11 }}>
                    {calcs.map(c => <option key={c.id} value={c.id}>{c.name || `#${c.id}`}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 11, color: '#aaa' }}>
                    {calcs.find(c => c.id === l.gas_volume_calc_id)?.name || `#${l.gas_volume_calc_id}`}
                  </span>
                )}
              </td>
              <td><Toggle line={l} field="include_in_report" /></td>
              <td><Toggle line={l} field="include_in_trends" /></td>
              <td><Toggle line={l} field="is_high_pressure" /></td>
              <td><UnitSelect line={l} field="pressure_unit" fallback={PRESSURE_UNIT_DEFAULT} /></td>
              <td><UnitSelect line={l} field="dp_unit" fallback={DP_UNIT_DEFAULT} /></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {editingId === l.id ? (
                  <>
                    <button title="Зберегти" onClick={() => saveEdit(l)} disabled={saving[`${l.id}_edit`]}
                      style={{ padding: '3px 9px', marginRight: 4, borderRadius: 4, border: 'none',
                        cursor: saving[`${l.id}_edit`] ? 'wait' : 'pointer',
                        background: '#4CAF50', color: '#fff', fontSize: 14, fontWeight: 700 }}>
                      ✓
                    </button>
                    <button title="Скасувати" onClick={cancelEdit}
                      style={{ padding: '3px 9px', borderRadius: 4, border: 'none', cursor: 'pointer',
                        background: '#555', color: '#fff', fontSize: 14, fontWeight: 700 }}>
                      ✗
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-edit" onClick={() => startEdit(l)}>Ред.</button>
                    <button className="btn-danger" onClick={() => handleDelete(l.id)} disabled={deletingId !== null}>
                      {deletingId === l.id ? '…' : 'Видалити'}
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
