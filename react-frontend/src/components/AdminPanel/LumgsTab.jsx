import React, { useEffect, useState } from 'react';
import { lumgApi, branchApi } from '../../services/api';

export default function LumgsTab() {
  const [lumgs, setLumgs] = useState([]);
  const [branches, setBranches] = useState([]);
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [filterBranchId, setFilterBranchId] = useState('');
  const [editId, setEditId] = useState(null);
  const [status, setStatus] = useState(null);

  const load = async () => {
    const [lumgData, branchData] = await Promise.all([lumgApi.getAll(), branchApi.getAll()]);
    if (lumgData) setLumgs(lumgData);
    if (branchData) setBranches(branchData);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    const payload = { name, branch_id: parseInt(branchId) };
    let result;
    if (editId) {
      result = await lumgApi.update(editId, payload);
    } else {
      result = await lumgApi.create(payload);
    }
    if (result) {
      setStatus({ ok: true, msg: editId ? 'Оновлено' : 'Створено' });
      setName(''); setBranchId(''); setEditId(null);
      load();
    } else {
      setStatus({ ok: false, msg: 'Помилка' });
    }
  };

  const handleEdit = (lumg) => {
    setEditId(lumg.id);
    setName(lumg.name);
    setBranchId(String(lumg.branch_id || ''));
    setStatus(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити ЛУМГ?')) return;
    await lumgApi.delete(id);
    load();
  };

  const handleCancel = () => {
    setEditId(null); setName(''); setBranchId(''); setStatus(null);
  };

  const branchName = (id) => branches.find(b => b.id === id)?.name || id;

  const visibleLumgs = filterBranchId
    ? lumgs.filter(l => l.branch_id === parseInt(filterBranchId))
    : lumgs;

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-group">
          <label>Назва</label>
          <input className="admin-input" value={name} onChange={e => setName(e.target.value)} required placeholder="Назва ЛУМГ" />
        </div>
        <div className="admin-form-group">
          <label>Філіал</label>
          <select className="admin-select" value={branchId} onChange={e => setBranchId(e.target.value)} required>
            <option value="">— обрати —</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <button className="btn-primary" type="submit">{editId ? 'Зберегти' : 'Додати'}</button>
        {editId && <button className="btn-secondary" type="button" onClick={handleCancel}>Скасувати</button>}
      </form>
      {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`}>{status.msg}</div>}

      <div className="admin-form" style={{ marginBottom: 8 }}>
        <div className="admin-form-group">
          <label>Фільтр по філіалу</label>
          <select className="admin-select" value={filterBranchId} onChange={e => setFilterBranchId(e.target.value)}>
            <option value="">Всі</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>Назва</th><th>Філіал</th><th></th></tr>
        </thead>
        <tbody>
          {visibleLumgs.map(l => (
            <tr key={l.id}>
              <td>{l.id}</td>
              <td>{l.name}</td>
              <td>{branchName(l.branch_id)}</td>
              <td>
                <button className="btn-edit" onClick={() => handleEdit(l)}>Ред.</button>
                <button className="btn-danger" onClick={() => handleDelete(l.id)}>Видалити</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
