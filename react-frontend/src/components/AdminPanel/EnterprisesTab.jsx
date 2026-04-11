import React, { useEffect, useRef, useState } from 'react';
import { enterpriseApi, lineApi, lumgApi, branchApi, gasVolumeApi } from '../../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const MF_DEV_OPTIONS = [
  { value: 1, label: 'РадмирТех' },
  { value: 3, label: 'ГРЕМПІС' },
  { value: 4, label: 'Тандем' },
  { value: 5, label: 'Укргазтех' },
];
const MF_DEV_LABEL = Object.fromEntries(MF_DEV_OPTIONS.map(o => [o.value, o.label]));

const EMPTY_FORM = {
  enterprise_name: '',
  branch_id: '',
  line_id: '',
  ser_num: '',
  mf_dev: '',
  type_dev: '',
  ch_num: '',
  active: true,
  enabled: true,
};

// ─── Helper sub-components ────────────────────────────────────────────────────

function BoolBtn({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{
      padding: '2px 10px', borderRadius: 12, border: 'none',
      cursor: 'pointer', background: value ? '#4CAF50' : '#555',
      color: '#fff', fontSize: 12,
    }}>
      {value ? 'Так' : 'Ні'}
    </button>
  );
}

function BranchSelect({ value, onChange, branches, placeholder = '— не вибрано —' }) {
  return (
    <select className="admin-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}

function LineSelect({ value, onChange, lines }) {
  return (
    <select className="admin-select" value={value} onChange={e => onChange(e.target.value)} style={{ minWidth: 140 }}>
      <option value="">{'— не прив\u2019язано —'}</option>
      {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  );
}

function MfSelect({ value, onChange }) {
  return (
    <select className="admin-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">—</option>
      {MF_DEV_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EnterprisesTab() {
  const [enterprises, setEnterprises] = useState([]);
  const [lines, setLines]             = useState([]);
  const [calcs, setCalcs]             = useState([]);
  const [lumgs, setLumgs]             = useState([]);
  const [branches, setBranches]       = useState([]);
  const [loading, setLoading]         = useState(false);

  // Filters
  const [search, setSearch]               = useState('');
  const [filterLineId, setFilterLine]     = useState('');
  const [filterLumgId, setFilterLumg]     = useState('');
  const [filterBranchId, setFilterBranch] = useState('');
  const [filterActive, setFilterActive]   = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');

  // Edit / add / delete
  const [editingId, setEditingId]         = useState(null);
  const [editForm, setEditForm]           = useState({});
  const [showAdd, setShowAdd]             = useState(false);
  const [addForm, setAddForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Pagination
  const [pageSize, setPageSize]     = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Excel
  const [uploadBranchId, setUploadBranchId] = useState('');
  const [uploadStatus, setUploadStatus]     = useState(null);
  const [uploading, setUploading]           = useState(false);
  const fileInputRef = useRef();

  // ─── Lookups ───────────────────────────────────────────────────────────────

  const calcById   = Object.fromEntries(calcs.map(c => [c.id, c]));
  const lumgById   = Object.fromEntries(lumgs.map(l => [l.id, l]));
  const branchById = Object.fromEntries(branches.map(b => [b.id, b]));

  // Effective branch for an enterprise:
  // 1. enterprise.branch_id (direct)
  // 2. derived from line → calc → lumg → branch_id
  const effectiveBranchId = (ent) => {
    if (ent.branch_id) return ent.branch_id;
    const line = lines.find(l => l.id === ent.line_id);
    if (!line) return null;
    const calc = calcById[line.gas_volume_calc_id];
    if (!calc) return null;
    return lumgById[calc.lumg_id]?.branch_id ?? null;
  };

  const effectiveLumgId = (ent) => {
    const line = lines.find(l => l.id === ent.line_id);
    if (!line) return null;
    const calc = calcById[line.gas_volume_calc_id];
    return calc?.lumg_id ?? null;
  };

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = () => {
    setLoading(true);
    Promise.all([
      enterpriseApi.getAll().catch(() => []),
      lineApi.getAll().catch(() => []),
      gasVolumeApi.getGasVolumeCalcs().catch(() => []),
      lumgApi.getAll().catch(() => []),
      branchApi.getAll().catch(() => []),
    ]).then(([ent, lns, cls, lmgs, brs]) => {
      setEnterprises(Array.isArray(ent)  ? ent  : []);
      setLines(      Array.isArray(lns)  ? lns  : []);
      setCalcs(      Array.isArray(cls)  ? cls  : []);
      setLumgs(      Array.isArray(lmgs) ? lmgs : []);
      setBranches(   Array.isArray(brs)  ? brs  : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, filterLineId, filterLumgId, filterBranchId, filterActive, filterEnabled, pageSize]);

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const lumgsForBranch = filterBranchId
    ? lumgs.filter(l => l.branch_id === Number(filterBranchId))
    : lumgs;

  const calcIdsForLumg = filterLumgId
    ? calcs.filter(c => c.lumg_id === Number(filterLumgId)).map(c => c.id)
    : null;
  const linesForLumg = calcIdsForLumg
    ? lines.filter(l => calcIdsForLumg.includes(l.gas_volume_calc_id))
    : lines;

  const filtered = enterprises.filter(ent => {
    if (search) {
      const q = search.toLowerCase();
      if (!ent.enterprise_name.toLowerCase().includes(q) && !String(ent.ser_num).includes(q))
        return false;
    }
    if (filterActive  !== '' && String(ent.active)  !== filterActive)  return false;
    if (filterEnabled !== '' && String(ent.enabled) !== filterEnabled) return false;
    if (filterLineId) {
      if (filterLineId === 'null' && ent.line_id !== null) return false;
      if (filterLineId !== 'null' && String(ent.line_id) !== filterLineId) return false;
    }
    if (filterLumgId && effectiveLumgId(ent) !== Number(filterLumgId)) return false;
    if (filterBranchId && effectiveBranchId(ent) !== Number(filterBranchId)) return false;
    return true;
  });

  // ─── Edit ──────────────────────────────────────────────────────────────────

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditForm({
      enterprise_name: e.enterprise_name,
      branch_id: e.branch_id ?? '',
      line_id:   e.line_id  ?? '',
      ser_num:   e.ser_num,
      mf_dev:    e.mf_dev,
      type_dev:  e.type_dev,
      ch_num:    e.ch_num,
      active:    e.active,
      enabled:   e.enabled,
    });
    setShowAdd(false);
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async () => {
    setSaving(true);
    const payload = {
      ...editForm,
      branch_id: editForm.branch_id === '' ? null : Number(editForm.branch_id),
      line_id:   editForm.line_id   === '' ? null : Number(editForm.line_id),
      ser_num:   Number(editForm.ser_num),
      mf_dev:    Number(editForm.mf_dev),
      type_dev:  Number(editForm.type_dev),
      ch_num:    Number(editForm.ch_num),
    };
    const result = await enterpriseApi.update(editingId, payload);
    setSaving(false);
    if (result) {
      setEnterprises(prev => prev.map(e => e.id === editingId ? result : e));
      setEditingId(null);
    }
  };

  // ─── Add ───────────────────────────────────────────────────────────────────

  const saveAdd = async () => {
    setSaving(true);
    const payload = {
      enterprise_name: addForm.enterprise_name,
      branch_id: addForm.branch_id === '' ? null : Number(addForm.branch_id),
      line_id:   addForm.line_id   === '' ? null : Number(addForm.line_id),
      ser_num:   Number(addForm.ser_num),
      mf_dev:    Number(addForm.mf_dev),
      type_dev:  Number(addForm.type_dev),
      ch_num:    Number(addForm.ch_num),
      active:    addForm.active,
      enabled:   addForm.enabled,
    };
    const result = await enterpriseApi.create(payload);
    setSaving(false);
    if (result) {
      setEnterprises(prev => [...prev, result]);
      setAddForm(EMPTY_FORM);
      setShowAdd(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setSaving(true);
    setEnterprises(prev => prev.filter(e => e.id !== deleteConfirm));
    const ok = await enterpriseApi.delete(deleteConfirm);
    setSaving(false);
    setDeleteConfirm(null);
    if (!ok) {
      loadData();
    }
  };

  // ─── Upload ────────────────────────────────────────────────────────────────

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadStatus(null);
    try {
      const result = await enterpriseApi.uploadExcel(file, uploadBranchId || undefined);
      setUploadStatus(result);
      if (result.imported > 0) loadData();
    } catch (err) {
      setUploadStatus({ imported: 0, errors: [err.message] });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ─── Label helpers ─────────────────────────────────────────────────────────

  const lineLabel   = (id) => lines.find(l => l.id === id)?.name || '—';
  const lumgLabel   = (ent) => {
    const lid = effectiveLumgId(ent);
    return lid ? (lumgById[lid]?.name || String(lid)) : '—';
  };
  const branchLabel = (ent) => {
    const bid = effectiveBranchId(ent);
    return bid ? (branchById[bid]?.name || String(bid)) : '—';
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Excel panel ──────────────────────────────────────────────────── */}
      <div style={{
        background: '#1a1a2e', border: '1px solid #333', borderRadius: 6,
        padding: '10px 14px', marginBottom: 12,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ color: '#aaa', fontSize: 13 }}>Excel:</span>

        <button className="btn-secondary" onClick={() => enterpriseApi.downloadTemplate()}
          title="Порожній шаблон для заповнення">↓ Шаблон</button>

        <button className="btn-secondary" onClick={() => enterpriseApi.downloadExport()}
          title="Вивантажити поточні підприємства з БД">↓ Експорт</button>

        <span style={{ color: '#aaa', fontSize: 12, marginLeft: 8 }}>Відділення для імпорту:</span>
        <BranchSelect
          value={uploadBranchId}
          onChange={setUploadBranchId}
          branches={branches}
          placeholder="— не вказано —"
        />

        <button className="btn-primary"
          onClick={() => {
            if (!uploadBranchId) { alert('Оберіть відділення перед імпортом'); return; }
            fileInputRef.current?.click();
          }}
          disabled={uploading}>
          {uploading ? '⏳ Імпорт…' : '↑ Імпортувати'}
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls"
          style={{ display: 'none' }} onChange={handleUpload} />

        {uploadStatus && (
          <span style={{ fontSize: 13, color: uploadStatus.errors?.length ? '#f44336' : '#4CAF50' }}>
            {uploadStatus.imported > 0 && `✓ Імпортовано: ${uploadStatus.imported}`}
            {uploadStatus.errors?.length > 0 && (
              <span title={uploadStatus.errors.join('\n')} style={{ cursor: 'help', marginLeft: 6 }}>
                ⚠ {uploadStatus.errors.length} попереджень
              </span>
            )}
          </span>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div style={{
        background: '#111', border: '1px solid #2a2a2a', borderRadius: 6,
        padding: '10px 14px', marginBottom: 10,
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <div className="admin-form-group" style={{ margin: 0 }}>
          <label>Пошук</label>
          <input className="admin-input" placeholder="Назва або серійний №"
            style={{ minWidth: 200 }} value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="admin-form-group" style={{ margin: 0 }}>
          <label>Відділення</label>
          <select className="admin-select" value={filterBranchId}
            onChange={e => { setFilterBranch(e.target.value); setFilterLumg(''); setFilterLine(''); }}>
            <option value="">Всі</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div className="admin-form-group" style={{ margin: 0 }}>
          <label>ЛУМГ</label>
          <select className="admin-select" value={filterLumgId}
            onChange={e => { setFilterLumg(e.target.value); setFilterLine(''); }}>
            <option value="">Всі</option>
            {lumgsForBranch.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div className="admin-form-group" style={{ margin: 0 }}>
          <label>Лінія</label>
          <select className="admin-select" value={filterLineId}
            onChange={e => setFilterLine(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">Всі</option>
            <option value="null">Без лінії</option>
            {linesForLumg.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div className="admin-form-group" style={{ margin: 0 }}>
          <label>Активний</label>
          <select className="admin-select" value={filterActive}
            onChange={e => setFilterActive(e.target.value)}>
            <option value="">Всі</option>
            <option value="true">Так</option>
            <option value="false">Ні</option>
          </select>
        </div>

        <div className="admin-form-group" style={{ margin: 0 }}>
          <label>Увімкнений</label>
          <select className="admin-select" value={filterEnabled}
            onChange={e => setFilterEnabled(e.target.value)}>
            <option value="">Всі</option>
            <option value="true">Так</option>
            <option value="false">Ні</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => {
            setSearch(''); setFilterBranch(''); setFilterLumg('');
            setFilterLine(''); setFilterActive(''); setFilterEnabled('');
          }}>Скинути</button>
          <button className="btn-secondary" onClick={loadData} disabled={loading}>
            {loading ? '…' : '↻'}
          </button>
          <button className="btn-primary" onClick={() => { setShowAdd(true); setEditingId(null); }}>
            + Додати
          </button>
        </div>
      </div>

      {/* ── Add form ─────────────────────────────────────────────────────── */}
      {showAdd && (
        <div style={{
          border: '1px solid #4CAF50', borderRadius: 6, padding: 12, marginBottom: 12,
          background: '#1a2a1a',
        }}>
          <strong style={{ color: '#B9E42B', fontSize: 13 }}>Нове підприємство</strong>
          <div className="admin-form" style={{ marginTop: 8 }}>
            <div className="admin-form-group">
              <label>Назва</label>
              <input className="admin-input" style={{ minWidth: 200 }}
                value={addForm.enterprise_name}
                onChange={e => setAddForm(f => ({ ...f, enterprise_name: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label>Відділення</label>
              <BranchSelect value={addForm.branch_id} branches={branches}
                onChange={v => setAddForm(f => ({ ...f, branch_id: v }))} />
            </div>
            <div className="admin-form-group">
              <label>Лінія</label>
              <LineSelect value={addForm.line_id} lines={lines}
                onChange={v => setAddForm(f => ({ ...f, line_id: v }))} />
            </div>
            <div className="admin-form-group">
              <label>SerNum</label>
              <input className="admin-input" type="number" style={{ width: 90 }}
                value={addForm.ser_num}
                onChange={e => setAddForm(f => ({ ...f, ser_num: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label>Виробник</label>
              <MfSelect value={addForm.mf_dev}
                onChange={v => setAddForm(f => ({ ...f, mf_dev: v }))} />
            </div>
            <div className="admin-form-group">
              <label>TypeDev</label>
              <input className="admin-input" type="number" style={{ width: 70 }}
                value={addForm.type_dev}
                onChange={e => setAddForm(f => ({ ...f, type_dev: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label>Канал</label>
              <input className="admin-input" type="number" style={{ width: 60 }}
                value={addForm.ch_num}
                onChange={e => setAddForm(f => ({ ...f, ch_num: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <label>Активний</label>
              <BoolBtn value={addForm.active} onChange={v => setAddForm(f => ({ ...f, active: v }))} />
            </div>
            <div className="admin-form-group">
              <label>Увімкнений</label>
              <BoolBtn value={addForm.enabled} onChange={v => setAddForm(f => ({ ...f, enabled: v }))} />
            </div>
            <button className="btn-primary" onClick={saveAdd} disabled={saving}>Зберегти</button>
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>Скасувати</button>
          </div>
        </div>
      )}

      {/* ── Count + Pagination ───────────────────────────────────────────── */}
      {(() => {
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ color: '#666', fontSize: 12 }}>
                Показано: {filtered.length} / {enterprises.length}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[10, 50, 100].map(size => (
                  <button key={size} onClick={() => setPageSize(size)} style={{
                    padding: '2px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 4,
                    border: '1px solid #3a3a3a',
                    background: pageSize === size ? '#1565c0' : '#2a2a2a',
                    color: pageSize === size ? '#fff' : '#aaa',
                  }}>{size}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '2px 8px', fontSize: 16, cursor: 'pointer', borderRadius: 4, border: '1px solid #3a3a3a', background: '#2a2a2a', color: '#aaa', lineHeight: 1 }}>
                  ‹
                </button>
                <span style={{ color: '#aaa', fontSize: 12 }}>{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '2px 8px', fontSize: 16, cursor: 'pointer', borderRadius: 4, border: '1px solid #3a3a3a', background: '#2a2a2a', color: '#aaa', lineHeight: 1 }}>
                  ›
                </button>
              </div>
            </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ color: '#aaa' }}>Завантаження…</p>
      ) : (
        <div>
          <table className="admin-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: 36 }} />   {/* ID */}
              <col style={{ width: '22%' }} /> {/* Підприємство */}
              <col style={{ width: '14%' }} /> {/* Відділення */}
              <col style={{ width: '14%' }} /> {/* Лінія */}
              <col style={{ width: 72 }} />    {/* SerNum */}
              <col style={{ width: '11%' }} /> {/* Виробник */}
              <col style={{ width: 62 }} />    {/* TypeDev */}
              <col style={{ width: 52 }} />    {/* Канал */}
              <col style={{ width: 50 }} />    {/* Актив */}
              <col style={{ width: 55 }} />    {/* Увімкн */}
              <col style={{ width: 130 }} />   {/* Дії */}
            </colgroup>
            <thead>
              <tr>
                <th>ID</th>
                <th>Підприємство</th>
                <th>Відділення</th>
                <th>Лінія</th>
                <th>SerNum</th>
                <th>Виробник</th>
                <th>TypeDev</th>
                <th>Канал</th>
                <th>Актив</th>
                <th>Увімкн</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={11} style={{ color: '#555', textAlign: 'center', padding: 20 }}>
                  Нічого не знайдено
                </td></tr>
              )}
              {paginated.map(ent => {
                const isEditing = editingId === ent.id;
                return (
                  <tr key={ent.id}>
                    <td>{ent.id}</td>

                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={ent.enterprise_name}>
                      {isEditing
                        ? <input className="admin-input" style={{ minWidth: 180 }}
                            value={editForm.enterprise_name}
                            onChange={e => setEditForm(f => ({ ...f, enterprise_name: e.target.value }))} />
                        : ent.enterprise_name}
                    </td>

                    {/* Відділення — пряме поле, або вираховується з лінії */}
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={branchLabel(ent)}>
                      {isEditing
                        ? <BranchSelect value={editForm.branch_id} branches={branches}
                            onChange={v => setEditForm(f => ({ ...f, branch_id: v }))} />
                        : <span style={{ color: ent.branch_id ? '#ccc' : '#666', fontSize: 12 }}>
                            {branchLabel(ent)}
                          </span>}
                    </td>

                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={lineLabel(ent.line_id)}>
                      {isEditing
                        ? <LineSelect value={editForm.line_id} lines={lines}
                            onChange={v => setEditForm(f => ({ ...f, line_id: v }))} />
                        : lineLabel(ent.line_id)}
                    </td>

                    <td>
                      {isEditing
                        ? <input className="admin-input" type="number" style={{ width: 90 }}
                            value={editForm.ser_num}
                            onChange={e => setEditForm(f => ({ ...f, ser_num: e.target.value }))} />
                        : ent.ser_num}
                    </td>

                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={MF_DEV_LABEL[ent.mf_dev] || String(ent.mf_dev)}>
                      {isEditing
                        ? <MfSelect value={editForm.mf_dev}
                            onChange={v => setEditForm(f => ({ ...f, mf_dev: v }))} />
                        : MF_DEV_LABEL[ent.mf_dev] || ent.mf_dev}
                    </td>

                    <td>
                      {isEditing
                        ? <input className="admin-input" type="number" style={{ width: 70 }}
                            value={editForm.type_dev}
                            onChange={e => setEditForm(f => ({ ...f, type_dev: e.target.value }))} />
                        : ent.type_dev}
                    </td>

                    <td>
                      {isEditing
                        ? <input className="admin-input" type="number" style={{ width: 60 }}
                            value={editForm.ch_num}
                            onChange={e => setEditForm(f => ({ ...f, ch_num: e.target.value }))} />
                        : ent.ch_num}
                    </td>

                    <td>
                      {isEditing
                        ? <BoolBtn value={editForm.active}
                            onChange={v => setEditForm(f => ({ ...f, active: v }))} />
                        : <span style={{ color: ent.active ? '#4CAF50' : '#888' }}>
                            {ent.active ? 'Так' : 'Ні'}
                          </span>}
                    </td>

                    <td>
                      {isEditing
                        ? <BoolBtn value={editForm.enabled}
                            onChange={v => setEditForm(f => ({ ...f, enabled: v }))} />
                        : <span style={{ color: ent.enabled ? '#4CAF50' : '#888' }}>
                            {ent.enabled ? 'Так' : 'Ні'}
                          </span>}
                    </td>

                    <td style={{ whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <>
                          <button className="btn-edit" onClick={saveEdit} disabled={saving}>Зберегти</button>
                          <button className="btn-secondary" onClick={cancelEdit}>Скасувати</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-edit" onClick={() => startEdit(ent)}>Ред.</button>
                          <button className="btn-danger" onClick={() => setDeleteConfirm(ent.id)}>Видалити</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
          </>
        );
      })()}

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#1e1e1e', border: '1px solid #c0392b', borderRadius: 8,
            padding: '24px 28px', maxWidth: 360, textAlign: 'center',
          }}>
            <p style={{ marginBottom: 16, color: '#eee' }}>
              Видалити підприємство #{deleteConfirm}?
            </p>
            <button className="btn-danger" onClick={confirmDelete} disabled={saving}
              style={{ marginRight: 10 }}>Видалити</button>
            <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Скасувати</button>
          </div>
        </div>
      )}
    </div>
  );
}
