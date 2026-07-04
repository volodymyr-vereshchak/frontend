import React, { useEffect, useState } from 'react';
import { calcTypeApi, sysTypeApi, editTypeApi } from '../../services/api';
import Pagination from './common/Pagination';
import { useStatusMessage } from './common/useStatusMessage';

// ─── Generic event type table (server-side pagination + search) ───────────────

function EventTypeSection({ title, api, calcTypes, idField, nameField }) {
  const [items, setItems]           = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [filterCalcId, setFilterCalcId] = useState('');
  const [searchInput, setSearchInput]   = useState('');
  const [search, setSearch]             = useState('');
  const [editing, setEditing]       = useState({});
  const [form, setForm]             = useState({ [idField]: '', gas_volume_calc_type_id: '', [nameField]: '' });
  const [status, showStatus]        = useStatusMessage();
  const [pageSize, setPageSize]     = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search input → search state
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Server-side load
  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      setLoading(true);
      try {
        const data = await api.getAll({
          calcTypeId: filterCalcId || undefined,
          search:     search.trim() || undefined,
          skip:       (currentPage - 1) * pageSize,
          limit:      pageSize,
        });
        if (!cancelled) {
          setItems(Array.isArray(data?.items) ? data.items : []);
          setTotal(data?.total ?? 0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doLoad();
    return () => { cancelled = true; };
  }, [filterCalcId, search, currentPage, pageSize]);

  const calcTypeLabel = (typeId) => {
    const c = calcTypes.find(c => c.type_id === typeId);
    return c ? `${c.type_id} — ${c.type_name}` : `#${typeId}`;
  };

  const reload = () => {
    // Force re-fetch by toggling a dummy dep — simplest: reset page to current
    setCurrentPage(p => p);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const result = await api.create({
        [idField]: Number(form[idField]),
        gas_volume_calc_type_id: Number(form.gas_volume_calc_type_id),
        [nameField]: form[nameField].trim(),
      });
      if (result?.id) {
        setForm({ [idField]: '', gas_volume_calc_type_id: '', [nameField]: '' });
        setCurrentPage(1);
        showStatus(true, 'Додано');
      }
    } catch (err) { showStatus(false, err.message || 'Помилка'); }
  };

  const startEdit  = (item) => setEditing(prev => ({
    ...prev,
    [item.id]: {
      [idField]: item[idField],
      gas_volume_calc_type_id: item.gas_volume_calc_type_id,
      [nameField]: item[nameField],
    },
  }));
  const cancelEdit = (id) => setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });

  const handleSave = async (id) => {
    const ed = editing[id];
    try {
      const result = await api.update(id, {
        [idField]: Number(ed[idField]),
        gas_volume_calc_type_id: Number(ed.gas_volume_calc_type_id),
        [nameField]: ed[nameField].trim(),
      });
      if (result?.id) { cancelEdit(id); reload(); showStatus(true, 'Збережено'); }
    } catch (err) { showStatus(false, err.message || 'Помилка'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити запис?')) return;
    await api.delete(id);
    reload();
    showStatus(true, 'Видалено');
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ marginBottom: 36 }}>
      <h3 style={{ color: '#B9E42B', fontSize: 15, marginBottom: 12 }}>{title}</h3>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="admin-select"
          value={filterCalcId}
          onChange={e => { setFilterCalcId(e.target.value); setCurrentPage(1); }}
          style={{ minWidth: 180 }}
        >
          <option value="">Всі типи обчислювачів</option>
          {calcTypes.map(c => <option key={c.id} value={c.type_id}>{c.type_id} — {c.type_name}</option>)}
        </select>
        <input
          className="admin-input"
          placeholder="Пошук за кодом або назвою…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <span style={{ color: '#555', fontSize: 12 }}>{total} записів</span>
      </div>

      {/* Add form */}
      <form className="admin-form" onSubmit={handleCreate} style={{ marginBottom: 12 }}>
        <div className="admin-form-group">
          <label>Код</label>
          <input
            className="admin-input" type="number" required
            value={form[idField]} onChange={e => setForm(f => ({ ...f, [idField]: e.target.value }))}
            placeholder="1" style={{ minWidth: 80 }}
          />
        </div>
        <div className="admin-form-group">
          <label>Тип обчислювача</label>
          <select
            className="admin-select" required
            value={form.gas_volume_calc_type_id}
            onChange={e => setForm(f => ({ ...f, gas_volume_calc_type_id: e.target.value }))}
            style={{ minWidth: 160 }}
          >
            <option value="">— вибрати —</option>
            {calcTypes.map(c => <option key={c.id} value={c.type_id}>{c.type_id} — {c.type_name}</option>)}
          </select>
        </div>
        <div className="admin-form-group" style={{ flex: 1 }}>
          <label>Назва</label>
          <input
            className="admin-input" required
            value={form[nameField]} onChange={e => setForm(f => ({ ...f, [nameField]: e.target.value }))}
            placeholder="Опис події…" style={{ minWidth: 260 }}
          />
        </div>
        <button className="btn-primary" type="submit">Додати</button>
      </form>

      {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`} style={{ marginBottom: 8 }}>{status.msg}</div>}

      {/* ── Pagination controls ───────────────────────────────────────────── */}
      <Pagination
        pageSize={pageSize}
        onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ color: '#aaa' }}>Завантаження…</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 70 }}>Код</th>
              <th style={{ width: 160 }}>Тип обчислювача</th>
              <th>Назва</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} style={{ color: '#555', textAlign: 'center', padding: 16 }}>
                {search || filterCalcId ? 'Нічого не знайдено' : 'Немає записів'}
              </td></tr>
            )}
            {items.map(item => {
              const ed = editing[item.id];
              if (ed) return (
                <tr key={item.id} style={{ background: '#1e2e08' }}>
                  <td>
                    <input className="admin-input" type="number" style={{ minWidth: 70 }}
                      value={ed[idField]}
                      onChange={e => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], [idField]: e.target.value } }))}
                    />
                  </td>
                  <td>
                    <select className="admin-select" style={{ minWidth: 140 }}
                      value={ed.gas_volume_calc_type_id}
                      onChange={e => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], gas_volume_calc_type_id: e.target.value } }))}
                    >
                      {calcTypes.map(c => <option key={c.id} value={c.type_id}>{c.type_id} — {c.type_name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="admin-input" style={{ width: '100%', minWidth: 240 }}
                      value={ed[nameField]}
                      onChange={e => setEditing(prev => ({ ...prev, [item.id]: { ...prev[item.id], [nameField]: e.target.value } }))}
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
                  <td>
                    <span style={{ fontFamily: 'monospace', color: '#B9E42B' }}>{item[idField]}</span>
                  </td>
                  <td style={{ fontSize: 12, color: '#888' }}>{calcTypeLabel(item.gas_volume_calc_type_id)}</td>
                  <td>{item[nameField]}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn-edit" onClick={() => startEdit(item)}>Ред.</button>
                    <button className="btn-danger" onClick={() => handleDelete(item.id)}>Видалити</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function EventTypesTab() {
  const [calcTypes, setCalcTypes] = useState([]);
  const [section, setSection] = useState('sys');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);

  useEffect(() => {
    calcTypeApi.getAll().then(data => setCalcTypes(Array.isArray(data) ? data : []));
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await calcTypeApi.exportPreload();
      setExportStatus({ ok: true, msg: `JSON збережено: типів ${res.exported.flowtype}, аварій ${res.exported.sysname}, змін ${res.exported.editname}` });
    } catch (err) {
      setExportStatus({ ok: false, msg: err.message || 'Помилка збереження' });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportStatus(null), 4000);
    }
  };

  return (
    <div>
      {/* Sub-tabs + Export button */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid #2a2a2a', paddingBottom: 10, alignItems: 'center' }}>
        {[
          { id: 'sys',  label: 'Аварії' },
          { id: 'edit', label: 'Зміни параметрів' },
        ].map(t => (
          <button
            key={t.id}
            className={section === t.id ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setSection(t.id)}
          >
            {t.label}
          </button>
        ))}
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
      {exportStatus && (
        <div className={`admin-status ${exportStatus.ok ? 'ok' : 'error'}`} style={{ marginBottom: 10 }}>
          {exportStatus.msg}
        </div>
      )}

      {section === 'sys' && (
        <EventTypeSection
          title="Аварії та системні події"
          api={sysTypeApi}
          calcTypes={calcTypes}
          idField="sys_type_id"
          nameField="sys_name"
        />
      )}
      {section === 'edit' && (
        <EventTypeSection
          title="Зміни параметрів"
          api={editTypeApi}
          calcTypes={calcTypes}
          idField="edit_type_id"
          nameField="edit_name"
        />
      )}
    </div>
  );
}
