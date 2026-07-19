import React, { useEffect, useRef, useState } from 'react';
import { dpdLineApi, branchApi, lumgApi, deviceCatalogApi } from '../../services/api';
import { useStatusMessage } from './common/useStatusMessage';

const EMPTY_FORM = {
  name: '',
  description: '',
  branch_id: '',
  lumg_id: '',
  devices: [],
};

const EMPTY_DEVICE = {
  ser_num: '',
  manufacturer_id: '',
  corector_type_id: '',
  ch_num: 0,
  installed_date: '',
  installed_hour: 7,
};

const fmtDT = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:00`;
};

// ── Flag toggle button (same as VirtualLinesTab) ──────────────────────────────
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
export default function DpdLinesTab() {
  const [lines, setLines]             = useState([]);
  const [branches, setBranches]       = useState([]);
  const [lumgs, setLumgs]             = useState([]);
  const [manufacturers, setMfrs]      = useState([]);
  const [corectorTypes, setCts]       = useState([]);

  const [form, setForm]       = useState(EMPTY_FORM);
  const [editId, setEditId]   = useState(null);
  const [status, showStatus]  = useStatusMessage();
  const [saving, setSaving]   = useState({});   // { `${id}_${field}`: true }

  // { [lineId]: {status, kind, progress_done, progress_total, error} }
  const [jobs, setJobs] = useState({});
  const pollTimers = useRef({});

  const load = async () => {
    const [lnData, brData, lgData, mfData, ctData] = await Promise.all([
      dpdLineApi.getAll().catch(() => null),
      branchApi.getAll().catch(() => null),
      lumgApi.getAll().catch(() => null),
      deviceCatalogApi.getManufacturers().catch(() => null),
      deviceCatalogApi.getCorectorTypes().catch(() => null),
    ]);
    if (lnData) setLines(lnData);
    if (brData) setBranches(brData);
    if (lgData) setLumgs(lgData);
    if (mfData) setMfrs(mfData);
    if (ctData) setCts(ctData);
    // Resume polling for lines with a running job (e.g. after tab re-open)
    if (lnData) {
      for (const line of lnData) {
        const st = await dpdLineApi.initStatus(line.id).catch(() => null);
        if (st) {
          setJobs(prev => ({ ...prev, [line.id]: st }));
          if (st.status === 'running') startPolling(line.id);
        }
      }
    }
  };

  useEffect(() => {
    load();
    return () => Object.values(pollTimers.current).forEach(clearInterval);
  }, []);

  // ── Job status polling ────────────────────────────────────────────────────
  const startPolling = (lineId) => {
    if (pollTimers.current[lineId]) return;
    pollTimers.current[lineId] = setInterval(async () => {
      const st = await dpdLineApi.initStatus(lineId).catch(() => null);
      if (!st) return;
      setJobs(prev => ({ ...prev, [lineId]: st }));
      if (st.status !== 'running') {
        clearInterval(pollTimers.current[lineId]);
        delete pollTimers.current[lineId];
      }
    }, 2000);
  };

  const handleInit = async (line) => {
    if (!window.confirm(
      `Ініціалізація «${line.name}»: архіви лінії буде ПОВНІСТЮ очищено і ` +
      `перечитано з ДПД по всій історії приладів. Продовжити?`
    )) return;
    try {
      await dpdLineApi.init(line.id);
      setJobs(prev => ({ ...prev, [line.id]: { status: 'running', kind: 'init' } }));
      startPolling(line.id);
    } catch (err) {
      showStatus(false, err.message || 'Помилка запуску ініціалізації');
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredLumgs = form.branch_id
    ? lumgs.filter(l => l.branch_id === parseInt(form.branch_id))
    : lumgs;

  const lumgName   = (id) => lumgs.find(l => l.id === id)?.name || '—';
  const ctsForMfr  = (mfrId) => corectorTypes.filter(ct => ct.manufacturer_id === parseInt(mfrId));
  const mfrOfCt    = (ctId) => corectorTypes.find(ct => ct.id === parseInt(ctId))?.manufacturer_id;

  // Devices of the form sorted by install datetime (windows derive from order)
  const sortedFormDevices = [...form.devices]
    .map((d, idx) => ({ ...d, _idx: idx }))
    .sort((a, b) => (a.installed_date + a.installed_hour) < (b.installed_date + b.installed_hour) ? -1 : 1);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleBranchChange = (val) =>
    setForm(prev => ({ ...prev, branch_id: val, lumg_id: '' }));

  const addDevice = () =>
    setForm(prev => ({ ...prev, devices: [...prev.devices, { ...EMPTY_DEVICE }] }));

  const removeDevice = (idx) =>
    setForm(prev => ({ ...prev, devices: prev.devices.filter((_, i) => i !== idx) }));

  const setDeviceField = (idx, field, value) =>
    setForm(prev => ({
      ...prev,
      devices: prev.devices.map((d, i) => {
        if (i !== idx) return d;
        const next = { ...d, [field]: value };
        // Changing the manufacturer resets the model
        if (field === 'manufacturer_id') next.corector_type_id = '';
        return next;
      }),
    }));

  const resetForm = () => { setForm(EMPTY_FORM); setEditId(null); };

  // ── Submit create/update ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    for (const d of form.devices) {
      if (!d.ser_num || !d.corector_type_id || !d.installed_date) {
        showStatus(false, 'Заповніть серійний номер, модель і дату встановлення кожного приладу');
        return;
      }
    }

    const existing = editId ? lines.find(v => v.id === editId) : null;
    const payload = {
      name:              form.name,
      description:       form.description || null,
      branch_id:         parseInt(form.branch_id),
      lumg_id:           form.lumg_id ? parseInt(form.lumg_id) : null,
      active:            existing ? existing.active            : true,
      include_in_trends: existing ? existing.include_in_trends : false,
      include_in_report: existing ? existing.include_in_report : false,
      devices: form.devices.map(d => ({
        ser_num:          parseInt(d.ser_num),
        corector_type_id: parseInt(d.corector_type_id),
        ch_num:           parseInt(d.ch_num) || 0,
        installed_from:   `${d.installed_date}T${String(d.installed_hour).padStart(2, '0')}:00:00`,
      })),
    };

    try {
      const result = editId
        ? await dpdLineApi.update(editId, payload)
        : await dpdLineApi.create(payload);
      if (result) {
        showStatus(true, editId
          ? 'Оновлено. Якщо змінилися прилади чи дати — виконайте повторну ініціалізацію лінії'
          : 'Лінію створено — виконайте ініціалізацію, щоб завантажити архіви');
        resetForm();
        await load();
      }
    } catch (err) {
      showStatus(false, err.message || 'Помилка збереження');
    }
  };

  // ── Inline flag toggle ────────────────────────────────────────────────────
  const handleFlagToggle = async (line, field) => {
    const key = `${line.id}_${field}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    const payload = {
      name:              line.name,
      description:       line.description,
      branch_id:         line.branch_id,
      lumg_id:           line.lumg_id,
      active:            line.active,
      include_in_trends: line.include_in_trends,
      include_in_report: line.include_in_report,
      devices: (line.devices || []).map(d => ({
        ser_num: d.ser_num, corector_type_id: d.corector_type_id,
        ch_num: d.ch_num, installed_from: d.installed_from,
      })),
      [field]: !line[field],
    };
    try {
      const result = await dpdLineApi.update(line.id, payload);
      if (result) {
        setLines(prev => prev.map(v => v.id === line.id ? { ...v, [field]: !v[field] } : v));
      }
    } catch (err) {
      showStatus(false, err.message || 'Помилка збереження');
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  // ── Edit / delete ─────────────────────────────────────────────────────────
  const handleEdit = (line) => {
    setEditId(line.id);
    setForm({
      name:        line.name,
      description: line.description || '',
      branch_id:   String(line.branch_id || ''),
      lumg_id:     line.lumg_id ? String(line.lumg_id) : '',
      devices: (line.devices || []).map(d => ({
        ser_num:          String(d.ser_num),
        manufacturer_id:  String(mfrOfCt(d.corector_type_id) || ''),
        corector_type_id: String(d.corector_type_id),
        ch_num:           d.ch_num,
        installed_date:   d.installed_from.slice(0, 10),
        installed_hour:   new Date(d.installed_from).getHours(),
      })),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (line) => {
    if (!window.confirm(
      `Видалити лінію «${line.name}» разом з її архівами та історією приладів?`
    )) return;
    const ok = await dpdLineApi.delete(line.id);
    if (ok) await load();
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderJobCell = (line) => {
    const job = jobs[line.id];
    if (!job || job.status === 'idle') return null;
    if (job.status === 'running') {
      const pct = job.progress_total
        ? Math.round((job.progress_done || 0) / job.progress_total * 100)
        : null;
      return (
        <span style={{ color: '#FFC107', fontSize: 12 }}>
          ⟳ {job.kind === 'init' ? 'Ініціалізація' : 'Оновлення'}
          {pct !== null ? ` ${pct}%` : '…'}
        </span>
      );
    }
    if (job.status === 'error') {
      return (
        <span style={{ color: '#ef5350', fontSize: 12 }} title={job.error || ''}>
          ⚠ Помилка
        </span>
      );
    }
    if (job.status === 'done') {
      return (
        <span style={{ color: '#4CAF50', fontSize: 12 }}>
          ✓ {fmtDT(job.finished_at) || 'Готово'}
        </span>
      );
    }
    return null;
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
            placeholder="Назва лінії"
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
          >
            <option value="">—</option>
            {filteredLumgs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {/* ── Device history editor — full width ── */}
        <div style={{ flexBasis: '100%' }}>
          <label style={{ display: 'block', marginBottom: 6 }}>
            Історія приладів
            <span style={{ color: '#666', fontSize: 11, marginLeft: 8 }}>
              (кожен прилад діє від своєї дати встановлення до встановлення наступного)
            </span>
          </label>

          {form.devices.length === 0 && (
            <div style={{ color: '#555', fontSize: 12, marginBottom: 6 }}>
              Немає приладів — додайте перший
            </div>
          )}

          {sortedFormDevices.map((dev, orderIdx) => {
            const idx = dev._idx;
            const next = sortedFormDevices[orderIdx + 1];
            const windowLabel = dev.installed_date
              ? `діє з ${dev.installed_date} ${String(dev.installed_hour).padStart(2, '0')}:00 ` +
                (next && next.installed_date
                  ? `до ${next.installed_date} ${String(next.installed_hour).padStart(2, '0')}:00`
                  : '— дотепер')
              : '';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end',
                  padding: '8px 10px', marginBottom: 6,
                  background: '#141414', border: '1px solid #383838', borderRadius: 4,
                }}
              >
                <span style={{
                  color: '#B9E42B', fontSize: 12, minWidth: 18, textAlign: 'center',
                  paddingBottom: 6,
                }}>
                  {orderIdx + 1}.
                </span>
                <div className="admin-form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 11 }}>Серійний №</label>
                  <input
                    className="admin-input" type="number" min="0"
                    style={{ width: 110 }}
                    value={dev.ser_num}
                    onChange={e => setDeviceField(idx, 'ser_num', e.target.value)}
                  />
                </div>
                <div className="admin-form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 11 }}>Виробник</label>
                  <select
                    className="admin-select"
                    value={dev.manufacturer_id}
                    onChange={e => setDeviceField(idx, 'manufacturer_id', e.target.value)}
                  >
                    <option value="">— обрати —</option>
                    {manufacturers.map(m => (
                      <option key={m.id} value={m.id}>{m.short_name}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 11 }}>Модель коректора</label>
                  <select
                    className="admin-select"
                    value={dev.corector_type_id}
                    onChange={e => setDeviceField(idx, 'corector_type_id', e.target.value)}
                    disabled={!dev.manufacturer_id}
                  >
                    <option value="">— обрати —</option>
                    {ctsForMfr(dev.manufacturer_id).map(ct => (
                      <option key={ct.id} value={ct.id}>{ct.model_name}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 11 }}>Канал</label>
                  <input
                    className="admin-input" type="number" min="0" max="9"
                    style={{ width: 55 }}
                    value={dev.ch_num}
                    onChange={e => setDeviceField(idx, 'ch_num', e.target.value)}
                  />
                </div>
                <div className="admin-form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 11 }}>Дата встановлення</label>
                  <input
                    className="admin-input" type="date"
                    value={dev.installed_date}
                    onChange={e => setDeviceField(idx, 'installed_date', e.target.value)}
                  />
                </div>
                <div className="admin-form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 11 }}>Година</label>
                  <select
                    className="admin-select"
                    value={dev.installed_hour}
                    onChange={e => setDeviceField(idx, 'installed_hour', parseInt(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <span style={{ color: '#666', fontSize: 11, paddingBottom: 6, flex: 1 }}>
                  {windowLabel}
                </span>
                <button
                  type="button"
                  onClick={() => removeDevice(idx)}
                  style={{
                    background: 'none', border: 'none', color: '#ef5350',
                    cursor: 'pointer', fontSize: 16, paddingBottom: 6,
                  }}
                  title="Прибрати прилад"
                >✕</button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addDevice}
            style={{
              background: 'none', border: '1px dashed #B9E42B', color: '#B9E42B',
              borderRadius: 12, padding: '3px 12px', cursor: 'pointer', fontSize: 12,
            }}
          >
            + Додати прилад
          </button>
        </div>

        <div style={{ flexBasis: '100%', display: 'flex', gap: 6 }}>
          <button className="btn-primary" type="submit">
            {editId ? 'Зберегти' : 'Створити'}
          </button>
          {editId && (
            <button className="btn-secondary" type="button" onClick={resetForm}>
              Скасувати
            </button>
          )}
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
            <th>Поточний прилад</th>
            <th style={{ textAlign: 'center' }}>Приладів</th>
            <th style={{ textAlign: 'center' }}>В тренди</th>
            <th style={{ textAlign: 'center' }}>В звіт</th>
            <th style={{ textAlign: 'center' }}>Активна</th>
            <th>Стан</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map(line => {
            const devs = line.devices || [];
            const current = devs.length ? devs[devs.length - 1] : null;
            const running = jobs[line.id]?.status === 'running';
            return (
              <tr key={line.id} style={editId === line.id ? { background: '#1a2a1a' } : {}}>
                <td style={{ color: '#555', fontSize: 12 }}>{line.id}</td>
                <td>
                  <span style={{ color: '#e0e0e0' }}>{line.name}</span>
                  {line.description && (
                    <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{line.description}</div>
                  )}
                </td>
                <td style={{ color: '#888', fontSize: 12 }}>{lumgName(line.lumg_id)}</td>
                <td style={{ color: '#888', fontSize: 12 }}>
                  {current ? (
                    <>
                      <span style={{ color: '#90CAF9' }}>№{current.ser_num}</span>
                      {' '}{current.model_name}
                      <div style={{ fontSize: 11, color: '#555' }}>
                        з {fmtDT(current.installed_from)}
                      </div>
                    </>
                  ) : '—'}
                </td>
                <td style={{ textAlign: 'center', color: '#888', fontSize: 12 }}>{devs.length}</td>
                <td style={{ textAlign: 'center' }}>
                  <FlagToggle
                    active={line.include_in_trends}
                    busy={saving[`${line.id}_include_in_trends`]}
                    onClick={() => handleFlagToggle(line, 'include_in_trends')}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <FlagToggle
                    active={line.include_in_report}
                    busy={saving[`${line.id}_include_in_report`]}
                    onClick={() => handleFlagToggle(line, 'include_in_report')}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <FlagToggle
                    active={line.active}
                    busy={saving[`${line.id}_active`]}
                    onClick={() => handleFlagToggle(line, 'active')}
                  />
                </td>
                <td>{renderJobCell(line)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn-edit"
                    onClick={() => handleInit(line)}
                    disabled={running || devs.length === 0}
                    title={devs.length === 0
                      ? 'Додайте прилад перед ініціалізацією'
                      : 'Очистити архіви лінії та перечитати з ДПД'}
                    style={running ? { opacity: 0.5, cursor: 'wait' } : {}}
                  >
                    Ініц.
                  </button>
                  <button className="btn-edit" onClick={() => handleEdit(line)}>Ред.</button>
                  <button className="btn-danger" onClick={() => handleDelete(line)}>Видалити</button>
                </td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={10} style={{ textAlign: 'center', color: '#555', padding: 20 }}>
                Немає ДПД-ліній — створіть першу вище
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
