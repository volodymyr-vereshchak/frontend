import React, { useEffect, useState } from 'react';
import { userManagementApi, branchApi } from '../../services/api';
import { useStatusMessage } from './common/useStatusMessage';

const ROLES = ['viewer', 'admin'];

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [status, showStatus] = useStatusMessage(4000);
  const [shownPassword, setShownPassword] = useState(null); // { userId, username, password }

  // Create form state
  const [form, setForm] = useState({ username: '', display_name: '', role: 'viewer', branch_ids: [] });
  const [creating, setCreating] = useState(false);

  // Edit state: userId → { display_name, role, branch_ids }
  const [editingUser, setEditingUser] = useState({});

  const load = async () => {
    const [usersData, branchesData] = await Promise.all([
      userManagementApi.getAll(),
      branchApi.getAll(),
    ]);
    if (usersData) setUsers(usersData);
    if (branchesData) setBranches(branchesData);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await userManagementApi.create({
        username: form.username.trim().toLowerCase(),
        display_name: form.display_name || null,
        role: form.role,
        branch_ids: form.branch_ids,
      });
      if (result) {
        setShownPassword({ userId: result.user.id, username: result.user.username, password: result.password });
        setForm({ username: '', display_name: '', role: 'viewer', branch_ids: [] });
        await load();
        showStatus(true, 'Користувача створено');
      }
    } catch (err) {
      showStatus(false, err.message || 'Помилка створення');
    }
    setCreating(false);
  };

  const handleToggleActive = async (user) => {
    try {
      const result = await userManagementApi.update(user.id, { active: !user.active });
      if (result) {
        await load();
        showStatus(true, user.active ? 'Деактивовано' : 'Активовано');
      }
    } catch (err) {
      showStatus(false, err.message || 'Помилка зміни статусу');
    }
  };

  const handleResetPassword = async (user) => {
    try {
      const result = await userManagementApi.resetPassword(user.id);
      if (result) {
        setShownPassword({ userId: user.id, username: user.username, password: result.password });
      }
    } catch (err) {
      showStatus(false, 'Помилка скидання паролю');
    }
  };

  const handleDelete = async (user) => {
    const ok = window.confirm(
      `Видалити користувача "${user.username}"?\n\nЦю дію не можна скасувати. ` +
      `Якщо потрібно лише тимчасово заблокувати доступ — скористайтесь «Деактив.».`
    );
    if (!ok) return;
    try {
      await userManagementApi.remove(user.id);
      if (shownPassword?.userId === user.id) setShownPassword(null);
      await load();
      showStatus(true, 'Користувача видалено');
    } catch (err) {
      showStatus(false, err.message || 'Помилка видалення');
    }
  };

  const handleBranchToggle = (bid) => {
    setForm(f => ({
      ...f,
      branch_ids: f.branch_ids.includes(bid)
        ? f.branch_ids.filter(b => b !== bid)
        : [...f.branch_ids, bid],
    }));
  };

  const getBranchName = (id) => branches.find(b => b.id === id)?.name || `branch ${id}`;

  const startEditUser = (u) => {
    setEditingUser(prev => ({
      ...prev,
      [u.id]: {
        display_name: u.display_name || '',
        role: u.role,
        branch_ids: u.allowed_branch_ids || [],
      },
    }));
  };

  const cancelEditUser = (id) =>
    setEditingUser(prev => { const n = { ...prev }; delete n[id]; return n; });

  const handleSaveUser = async (u) => {
    const ed = editingUser[u.id];
    try {
      const result = await userManagementApi.update(u.id, {
        display_name: ed.display_name || null,
        role: ed.role,
        branch_ids: ed.role === 'admin' ? [] : ed.branch_ids,
      });
      if (result) {
        await load();
        cancelEditUser(u.id);
        showStatus(true, 'Збережено');
      } else {
        showStatus(false, 'Помилка збереження');
      }
    } catch (err) {
      showStatus(false, err.message || 'Помилка збереження');
    }
  };

  const toggleEditBranch = (userId, bid) => {
    setEditingUser(prev => {
      const cur = prev[userId];
      const has = cur.branch_ids.includes(bid);
      return { ...prev, [userId]: { ...cur, branch_ids: has ? cur.branch_ids.filter(b => b !== bid) : [...cur.branch_ids, bid] } };
    });
  };

  return (
    <div>
      {/* Password reveal banner */}
      {shownPassword && (
        <div style={{
          background: '#1a2f0a', border: '1px solid #B9E42B', borderRadius: 6,
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16
        }}>
          <span style={{ color: '#B9E42B', fontWeight: 600 }}>Пароль для {shownPassword.username}:</span>
          <span style={{
            fontFamily: 'monospace', fontSize: 15, background: '#2a3a10',
            padding: '2px 12px', borderRadius: 4, letterSpacing: 1, color: '#e8f5c0'
          }}>
            {shownPassword.password}
          </span>
          <button
            className="btn-secondary"
            style={{ marginLeft: 'auto', fontSize: 11 }}
            onClick={() => { navigator.clipboard?.writeText(shownPassword.password); }}
          >
            Копіювати
          </button>
          <button
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}
            onClick={() => setShownPassword(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Create form */}
      <form className="admin-form" onSubmit={handleCreate} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="admin-form-group">
            <label>Логін</label>
            <input
              className="admin-input"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
              placeholder="user_xx"
              style={{ minWidth: 120 }}
            />
          </div>
          <div className="admin-form-group">
            <label>Відображуване ім'я</label>
            <input
              className="admin-input"
              value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Ім'я Прізвище"
            />
          </div>
          <div className="admin-form-group">
            <label>Роль</label>
            <select
              className="admin-select"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              style={{ minWidth: 100 }}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button className="btn-primary" type="submit" disabled={creating}>
            {creating ? '...' : 'Створити'}
          </button>
        </div>

        {/* Branch selector */}
        {form.role === 'viewer' && (
          <div>
            <div style={{ fontSize: 11, color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Доступ до філій
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {branches.map(b => (
                <label
                  key={b.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                    background: form.branch_ids.includes(b.id) ? '#2a3a10' : '#252525',
                    border: `1px solid ${form.branch_ids.includes(b.id) ? '#B9E42B' : '#444'}`,
                    borderRadius: 4, padding: '2px 8px', fontSize: 12,
                    color: form.branch_ids.includes(b.id) ? '#B9E42B' : '#a0a0a0',
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ display: 'none' }}
                    checked={form.branch_ids.includes(b.id)}
                    onChange={() => handleBranchToggle(b.id)}
                  />
                  {b.short_name || b.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </form>

      {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`}>{status.msg}</div>}

      {/* Users table */}
      <table className="admin-table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Логін</th>
            <th>Ім'я</th>
            <th>Роль</th>
            <th>Філії</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const ed = editingUser[u.id];
            if (ed) {
              return (
                <React.Fragment key={u.id}>
                  <tr style={{ background: '#1e2e08' }}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.username}</td>
                    <td>
                      <input
                        className="admin-input"
                        style={{ minWidth: 140, fontSize: 12 }}
                        value={ed.display_name}
                        onChange={e => setEditingUser(prev => ({ ...prev, [u.id]: { ...prev[u.id], display_name: e.target.value } }))}
                        placeholder="Ім'я Прізвище"
                      />
                    </td>
                    <td>
                      <select
                        className="admin-select"
                        style={{ minWidth: 90, fontSize: 12 }}
                        value={ed.role}
                        onChange={e => setEditingUser(prev => ({ ...prev, [u.id]: { ...prev[u.id], role: e.target.value } }))}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td colSpan={2}>
                      {ed.role === 'viewer' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {branches.map(b => (
                            <label key={b.id} style={{
                              display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                              background: ed.branch_ids.includes(b.id) ? '#2a3a10' : '#252525',
                              border: `1px solid ${ed.branch_ids.includes(b.id) ? '#B9E42B' : '#444'}`,
                              borderRadius: 4, padding: '2px 8px', fontSize: 11,
                              color: ed.branch_ids.includes(b.id) ? '#B9E42B' : '#a0a0a0',
                            }}>
                              <input type="checkbox" style={{ display: 'none' }}
                                checked={ed.branch_ids.includes(b.id)}
                                onChange={() => toggleEditBranch(u.id, b.id)}
                              />
                              {b.short_name || b.name}
                            </label>
                          ))}
                        </div>
                      )}
                      {ed.role === 'admin' && <span style={{ color: '#888', fontSize: 12 }}>Доступ до всіх філій</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => handleSaveUser(u)}>Зберегти</button>
                      <button className="btn-secondary" style={{ fontSize: 11, marginLeft: 4 }} onClick={() => cancelEditUser(u.id)}>Скасувати</button>
                    </td>
                  </tr>
                </React.Fragment>
              );
            }
            return (
              <tr key={u.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.username}</td>
                <td>{u.display_name || '—'}</td>
                <td>
                  <span style={{
                    background: u.role === 'admin' ? '#2a1a3a' : '#1a2a3a',
                    color: u.role === 'admin' ? '#c090e0' : '#60a0d0',
                    padding: '1px 8px', borderRadius: 10, fontSize: 11
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ fontSize: 11, color: '#888', maxWidth: 200 }}>
                  {u.allowed_branch_ids?.length > 0
                    ? u.allowed_branch_ids.map(id => getBranchName(id)).join(', ')
                    : '—'}
                </td>
                <td>
                  <span className={u.active ? 'badge-active' : 'badge-inactive'}>
                    {u.active ? 'Активний' : 'Неактивний'}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn-edit" style={{ fontSize: 11 }} onClick={() => startEditUser(u)}>Ред.</button>
                  <button className="btn-edit" style={{ fontSize: 11 }} onClick={() => handleResetPassword(u)} title="Згенерувати новий пароль">Новий пароль</button>
                  <button className={u.active ? 'btn-danger' : 'btn-edit'} style={{ fontSize: 11 }} onClick={() => handleToggleActive(u)}>
                    {u.active ? 'Деактив.' : 'Активув.'}
                  </button>
                  <button className="btn-danger" style={{ fontSize: 11, marginLeft: 4 }} onClick={() => handleDelete(u)} title="Видалити користувача назавжди">
                    Видалити
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
