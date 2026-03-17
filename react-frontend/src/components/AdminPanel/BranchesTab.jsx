import React, { useEffect, useState } from 'react';
import { branchApi } from '../../services/api';

export default function BranchesTab() {
  const [branches, setBranches] = useState([]);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [editId, setEditId] = useState(null);
  const [status, setStatus] = useState(null);

  const load = async () => {
    const data = await branchApi.getAll();
    if (data) setBranches(data);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    const payload = { name, short_name: shortName || null };
    let result;
    if (editId) {
      result = await branchApi.update(editId, payload);
    } else {
      result = await branchApi.create(payload);
    }
    if (result) {
      setStatus({ ok: true, msg: editId ? 'Оновлено' : 'Створено' });
      setName(''); setShortName(''); setEditId(null);
      load();
    } else {
      setStatus({ ok: false, msg: 'Помилка' });
    }
  };

  const handleEdit = (branch) => {
    setEditId(branch.id);
    setName(branch.name);
    setShortName(branch.short_name || '');
    setStatus(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити філіал?')) return;
    await branchApi.delete(id);
    load();
  };

  const handleCancel = () => {
    setEditId(null); setName(''); setShortName(''); setStatus(null);
  };

  return (
    <div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-group">
          <label>Назва</label>
          <input className="admin-input" value={name} onChange={e => setName(e.target.value)} required placeholder="Назва філіалу" />
        </div>
        <div className="admin-form-group">
          <label>Скорочена назва</label>
          <input className="admin-input" value={shortName} onChange={e => setShortName(e.target.value)} placeholder="Скорочено" />
        </div>
        <button className="btn-primary" type="submit">{editId ? 'Зберегти' : 'Додати'}</button>
        {editId && <button className="btn-secondary" type="button" onClick={handleCancel}>Скасувати</button>}
      </form>
      {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`}>{status.msg}</div>}

      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>Назва</th><th>Скорочено</th><th></th></tr>
        </thead>
        <tbody>
          {branches.map(b => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{b.name}</td>
              <td>{b.short_name || '—'}</td>
              <td>
                <button className="btn-edit" onClick={() => handleEdit(b)}>Ред.</button>
                <button className="btn-danger" onClick={() => handleDelete(b.id)}>Видалити</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
