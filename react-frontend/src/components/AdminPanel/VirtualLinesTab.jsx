import React, { useEffect, useState } from 'react';
import { virtualLineApi, branchApi, lumgApi, lineApi, dataApi } from '../../services/api';
import { useStatusMessage } from './common/useStatusMessage';

const EMPTY_FORM = {
  name: '',
  description: '',
  branch_id: '',
  lumg_id: '',
  physical_line_ids: [],
};

// ── Modal for picking lines ────────────────────────────────────────────────────
const LinePickerModal = ({ available, search, onSearch, onAdd, onClose }) => (
  <div
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}
    onClick={onClose}
  >
    <div
      style={{
        background: '#1e1e1e', border: '1px solid #555', borderRadius: 8,
        width: 380, maxHeight: '65vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #333',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: '#B9E42B', fontWeight: 600, fontSize: 14 }}>Додати лінію до кільця</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}
        >✕</button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 16px 6px' }}>
        <input
          className="admin-input"
          style={{ width: '100%', boxSizing: 'border-box', minWidth: 0 }}
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Пошук по ID або назві…"
          autoFocus
        />
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '0 8px 10px' }}>
        {available.length === 0 && (
          <div style={{ color: '#555', fontSize: 13, padding: '10px 8px' }}>Нічого не знайдено</div>
        )}
        {available.map(line => (
          <div
            key={line.id}
            onClick={() => onAdd(line)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 8px', borderRadius: 4, cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 13, color: '#ccc' }}>
              <span style={{ color: '#555', marginRight: 4 }}>{line.id}:</span>{line.name}
            </span>
            <span style={{ color: '#B9E42B', fontSize: 20, lineHeight: 1 }}>+</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Flag toggle button ────────────────────────────────────────────────────────
const FlagToggle = ({ active, busy, onClick }) => (
  <button
    onClick={onClick}
    disabled={busy}
    style={{
      padding: '2px 10px', borderRadius: 12, border: 'none',
      cursor: busy ? 'wait' : 'pointer',
      background: active ? '#4CAF50' : '#555',
      color: '#fff', fontSize: 12, opacity: busy ? 0.6 : 1,
      transition: 'background 0.15s',
    }}
  >
    {active ? 'Так' : 'Ні'}
  </button>
);

// ── Main component ────────────────────────────────────────────────────────────
export default function VirtualLinesTab() {
  const [vlines, setVlines]     = useState([]);
  const [branches, setBranches] = useState([]);
  const [lumgs, setLumgs]       = useState([]);
  const [allLines, setAllLines] = useState([]);
  const [gvcs, setGvcs]         = useState([]);

  const [form, setForm]       = useState(EMPTY_FORM);
  const [editId, setEditId]   = useState(null);
  const [status, showStatus]  = useStatusMessage();

  const [modal, setModal]           = useState(false);
  const [lineSearch, setLineSearch] = useState('');

  const [saving, setSaving] = useState({});   // { `${id}_${field}`: true }

  const load = async () => {
    const [vlData, brData, lgData, lnData, gvcData] = await Promise.all([
      virtualLineApi.getAll(),
      branchApi.getAll(),
      lumgApi.getAll(),
      lineApi.getAll(),
      dataApi.getGasVolumeCalcs(),
    ]);
    if (vlData) setVlines(vlData);
    if (brData) setBranches(brData);
    if (lgData) setLumgs(lgData);
    if (lnData) setAllLines(lnData);
    if (gvcData) setGvcs(gvcData);
  };

  useEffect(() => { load(); }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredLumgs = form.branch_id
    ? lumgs.filter(l => l.branch_id === parseInt(form.branch_id))
    : lumgs;

  // GVC IDs that belong to the selected LUMG
  const lumgGvcIds = form.lumg_id
    ? new Set(gvcs.filter(g => g.lumg_id === parseInt(form.lumg_id)).map(g => g.id))
    : null;

  const availableLines = allLines.filter(l => {
    if (form.physical_line_ids.includes(l.id)) return false;
    // If LUMG is selected — show only lines from that LUMG's GVCs
    if (lumgGvcIds && !lumgGvcIds.has(l.gas_volume_calc_id)) return false;
    if (lineSearch === '') return true;
    return String(l.id).includes(lineSearch) || l.name.toLowerCase().includes(lineSearch.toLowerCase());
  });

  const getLineName = (id) => allLines.find(l => l.id === id)?.name || String(id);
  const branchName  = (id) => branches.find(b => b.id === id)?.name || String(id);
  const lumgName    = (id) => lumgs.find(l => l.id === id)?.name || '—';

  // ── Form helpers ──────────────────────────────────────────────────────────
  const setField = (field, value) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleBranchChange = (val) =>
    setForm(prev => ({ ...prev, branch_id: val, lumg_id: '' }));

  const addLine    = (line)   => setForm(prev => ({ ...prev, physical_line_ids: [...prev.physical_line_ids, line.id] }));
  const removeLine = (lineId) => setForm(prev => ({ ...prev, physical_line_ids: prev.physical_line_ids.filter(id => id !== lineId) }));

  const resetForm = () => { setForm(EMPTY_FORM); setEditId(null); setLineSearch(''); setModal(false); };

  // ── Submit create/update ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // When editing keep existing flags; when creating default to false
    const existing = editId ? vlines.find(v => v.id === editId) : null;
    const payload = {
      name:               form.name,
      description:        form.description || null,
      branch_id:          parseInt(form.branch_id),
      lumg_id:            parseInt(form.lumg_id),
      active:             existing ? existing.active             : true,
      include_in_trends:  existing ? existing.include_in_trends  : false,
      physical_line_ids:  form.physical_line_ids,
    };

    const result = editId
      ? await virtualLineApi.update(editId, payload)
      : await virtualLineApi.create(payload);

    if (result) {
      showStatus(true, editId ? 'Оновлено' : 'Кільце створено');
      resetForm();
      await load();
    } else {
      showStatus(false, 'Помилка збереження');
    }
  };

  // ── Inline flag toggle ────────────────────────────────────────────────────
  const handleFlagToggle = async (vl, field) => {
    const key = `${vl.id}_${field}`;
    setSaving(prev => ({ ...prev, [key]: true }));

    const payload = {
      name:              vl.name,
      description:       vl.description,
      branch_id:         vl.branch_id,
      lumg_id:           vl.lumg_id,
      active:            vl.active,
      include_in_trends: vl.include_in_trends,
      physical_line_ids: vl.physical_line_ids || [],
      [field]:           !vl[field],
    };

    const result = await virtualLineApi.update(vl.id, payload);
    setSaving(prev => ({ ...prev, [key]: false }));
    if (result) {
      setVlines(prev => prev.map(v => v.id === vl.id ? { ...v, [field]: !v[field] } : v));
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleEdit = (vl) => {
    setEditId(vl.id);
    setForm({
      name:              vl.name,
      description:       vl.description || '',
      branch_id:         String(vl.branch_id || ''),
      lumg_id:           vl.lumg_id ? String(vl.lumg_id) : '',
      physical_line_ids: vl.physical_line_ids || [],
    });
    setLineSearch('');
    setModal(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити кільце?')) return;
    const ok = await virtualLineApi.delete(id);
    if (ok) await load();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Form ── */}
      <form className="admin-form" onSubmit={handleSubmit}>

        <div className="admin-form-group">
          <label>Назва</label>
          <input
            className="admin-input"
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            required
            placeholder="Назва кільця"
          />
        </div>

        <div className="admin-form-group" style={{ flex: '2 1 200px' }}>
          <label>Опис</label>
          <input
            className="admin-input"
            style={{ minWidth: 0 }}
            value={form.description}
            onChange={e => setField('description', e.target.value)}
            placeholder="Необов'язково"
          />
        </div>

        <div className="admin-form-group">
          <label>Філіал</label>
          <select
            className="admin-select"
            value={form.branch_id}
            onChange={e => handleBranchChange(e.target.value)}
            required
          >
            <option value="">— обрати —</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div className="admin-form-group">
          <label>ЛУМГ</label>
          <select
            className="admin-select"
            value={form.lumg_id}
            onChange={e => setField('lumg_id', e.target.value)}
            required
          >
            <option value="">— обрати —</option>
            {filteredLumgs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {/* Lines row + submit button — full width */}
        <div style={{ flexBasis: '100%', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div className="admin-form-group" style={{ flex: 1, minWidth: 0 }}>
            <label>Лінії кільця</label>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
              minHeight: 34, padding: '5px 8px',
              background: '#141414', border: '1px solid #383838', borderRadius: 4,
            }}>
              {form.physical_line_ids.length === 0 && (
                <span style={{ color: '#555', fontSize: 12 }}>Немає ліній</span>
              )}
              {form.physical_line_ids.map(id => (
                <span key={id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: '#1a2e3a', color: '#90CAF9',
                  border: '1px solid #2a4a5a',
                  borderRadius: 12, padding: '2px 8px 2px 10px', fontSize: 12,
                }}>
                  <span style={{ color: '#4a7a9a', marginRight: 2 }}>{id}:</span>
                  {getLineName(id)}
                  <button
                    type="button"
                    onClick={() => removeLine(id)}
                    style={{
                      background: 'none', border: 'none', color: '#ef5350',
                      cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 14, marginLeft: 2,
                    }}
                  >×</button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => { setLineSearch(''); setModal(true); }}
                disabled={!form.branch_id || !form.lumg_id}
                title={!form.branch_id || !form.lumg_id ? 'Спочатку оберіть філіал та ЛУМГ' : ''}
                style={{
                  background: 'none',
                  border: `1px dashed ${!form.branch_id || !form.lumg_id ? '#555' : '#B9E42B'}`,
                  color: !form.branch_id || !form.lumg_id ? '#555' : '#B9E42B',
                  borderRadius: 12, padding: '2px 10px',
                  cursor: !form.branch_id || !form.lumg_id ? 'not-allowed' : 'pointer',
                  fontSize: 12, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (form.branch_id && form.lumg_id) e.currentTarget.style.background = '#B9E42B22'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                + Додати
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button className="btn-primary" type="submit">
              {editId ? 'Зберегти' : 'Створити'}
            </button>
            {editId && (
              <button className="btn-secondary" type="button" onClick={resetForm}>
                Скасувати
              </button>
            )}
          </div>
        </div>
      </form>

      {status && (
        <div className={`admin-status ${status.ok ? 'ok' : 'error'}`} style={{ marginBottom: 12 }}>
          {status.msg}
        </div>
      )}

      {/* ── Table ── */}
      <table className="admin-table">
        <thead>
          <tr>
            <th style={{ color: '#666', width: 40 }}>ID</th>
            <th>Назва</th>
            <th>ЛУМГ</th>
            <th style={{ textAlign: 'center' }}>Ліній</th>
            <th style={{ textAlign: 'center' }}>В тренди</th>
            <th style={{ textAlign: 'center' }}>Активне</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vlines.map(vl => (
            <tr key={vl.id} style={editId === vl.id ? { background: '#1a2a1a' } : {}}>
              <td style={{ color: '#555', fontSize: 12 }}>{vl.id}</td>
              <td>
                <span style={{ color: '#e0e0e0' }}>{vl.name}</span>
                {vl.description && (
                  <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{vl.description}</div>
                )}
              </td>
              <td style={{ color: '#888', fontSize: 12 }}>{lumgName(vl.lumg_id)}</td>
              <td style={{ textAlign: 'center', color: '#888', fontSize: 12 }}>
                {(vl.physical_line_ids || []).length}
              </td>
              <td style={{ textAlign: 'center' }}>
                <FlagToggle
                  active={vl.include_in_trends}
                  busy={saving[`${vl.id}_include_in_trends`]}
                  onClick={() => handleFlagToggle(vl, 'include_in_trends')}
                />
              </td>
              <td style={{ textAlign: 'center' }}>
                <FlagToggle
                  active={vl.active}
                  busy={saving[`${vl.id}_active`]}
                  onClick={() => handleFlagToggle(vl, 'active')}
                />
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn-edit" onClick={() => handleEdit(vl)}>Ред.</button>
                <button className="btn-danger" onClick={() => handleDelete(vl.id)}>Видалити</button>
              </td>
            </tr>
          ))}
          {vlines.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: '#555', padding: 20 }}>
                Немає кілець — створіть перше вище
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Line picker modal ── */}
      {modal && (
        <LinePickerModal
          available={availableLines}
          search={lineSearch}
          onSearch={setLineSearch}
          onAdd={(line) => { addLine(line); setLineSearch(''); }}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
