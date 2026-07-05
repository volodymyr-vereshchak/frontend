import React, { useEffect, useState } from 'react';
import { deviceCatalogApi } from '../../services/api';
import { useStatusMessage } from './common/useStatusMessage';

// ─── Manufacturers ────────────────────────────────────────────────────────────

function ManufacturersSection({ onManufacturersChanged, manufacturers }) {
  const [shortName, setShortName] = useState('');
  const [fullName, setFullName]   = useState('');
  const [mfDev, setMfDev]         = useState('');
  const [editId, setEditId]       = useState(null);
  const [status, showStatus]      = useStatusMessage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { short_name: shortName, full_name: fullName, mf_dev: Number(mfDev) };
    try {
      const result = editId
        ? await deviceCatalogApi.updateManufacturer(editId, payload)
        : await deviceCatalogApi.createManufacturer(payload);
      if (result) {
        showStatus(true, editId ? 'Оновлено' : 'Додано');
        setShortName(''); setFullName(''); setMfDev(''); setEditId(null);
        onManufacturersChanged();
      } else {
        showStatus(false, 'Помилка');
      }
    } catch (err) {
      showStatus(false, err.message || 'Помилка');
    }
  };

  const handleEdit = (m) => {
    setEditId(m.id); setShortName(m.short_name); setFullName(m.full_name); setMfDev(m.mf_dev);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити виробника? Всі його моделі теж видаляться.')) return;
    await deviceCatalogApi.deleteManufacturer(id);
    onManufacturersChanged();
  };

  const handleCancel = () => {
    setEditId(null); setShortName(''); setFullName(''); setMfDev('');
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ color: '#B9E42B', fontSize: 15, marginBottom: 8 }}>Виробники</h3>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-group">
          <label>Скорочена назва</label>
          <input className="admin-input" value={shortName} onChange={e => setShortName(e.target.value)} placeholder="РадмирТех" required />
        </div>
        <div className="admin-form-group">
          <label>Повна назва (DPD)</label>
          <input className="admin-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="РадмирТех ТОВ СП, м. Харків" required style={{ minWidth: 280 }} />
        </div>
        <div className="admin-form-group">
          <label>mf_dev</label>
          <input className="admin-input" type="number" value={mfDev} onChange={e => setMfDev(e.target.value)} placeholder="1" required style={{ width: 70 }} />
        </div>
        <button className="btn-primary" type="submit">{editId ? 'Зберегти' : 'Додати'}</button>
        {editId && <button className="btn-secondary" type="button" onClick={handleCancel}>Скасувати</button>}
      </form>

      {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`}>{status.msg}</div>}

      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>Скорочена назва</th><th>Повна назва (DPD)</th><th>mf_dev</th><th></th></tr>
        </thead>
        <tbody>
          {manufacturers.map(m => (
            <tr key={m.id}>
              <td>{m.id}</td>
              <td>{m.short_name}</td>
              <td>{m.full_name}</td>
              <td>{m.mf_dev}</td>
              <td>
                <button className="btn-edit" onClick={() => handleEdit(m)}>Ред.</button>
                <button className="btn-danger" onClick={() => handleDelete(m.id)}>Видалити</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Corrector types ──────────────────────────────────────────────────────────

function CorectorTypesSection({ manufacturers }) {
  const [types, setTypes]         = useState([]);
  const [filterMfrId, setFilter]  = useState('');
  const [mfrId, setMfrId]         = useState('');
  const [modelName, setModelName] = useState('');
  const [typeDev, setTypeDev]     = useState('');
  const [editId, setEditId]       = useState(null);
  const [status, showStatus]      = useStatusMessage();

  const load = async () => {
    const data = await deviceCatalogApi.getCorectorTypes(filterMfrId || null);
    setTypes(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load(); }, [filterMfrId]);

  const mfrLabel = id => manufacturers.find(m => m.id === id)?.short_name || id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { manufacturer_id: Number(mfrId), model_name: modelName, type_dev: Number(typeDev) };
    try {
      const result = editId
        ? await deviceCatalogApi.updateCorectorType(editId, payload)
        : await deviceCatalogApi.createCorectorType(payload);
      if (result) {
        showStatus(true, editId ? 'Оновлено' : 'Додано');
        setMfrId(''); setModelName(''); setTypeDev(''); setEditId(null);
        await load();
      } else {
        showStatus(false, 'Помилка');
      }
    } catch (err) {
      showStatus(false, err.message || 'Помилка');
    }
  };

  const handleEdit = (t) => {
    setEditId(t.id); setMfrId(t.manufacturer_id); setModelName(t.model_name); setTypeDev(t.type_dev);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Видалити модель коректора?')) return;
    const ok = await deviceCatalogApi.deleteCorectorType(id);
    if (ok) await load();
  };

  const handleCancel = () => {
    setEditId(null); setMfrId(''); setModelName(''); setTypeDev('');
  };

  return (
    <div>
      <h3 style={{ color: '#B9E42B', fontSize: 15, marginBottom: 8 }}>Моделі коректорів</h3>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-form-group">
          <label>Виробник</label>
          <select className="admin-select" value={mfrId} onChange={e => setMfrId(e.target.value)} required>
            <option value="">— оберіть —</option>
            {manufacturers.map(m => <option key={m.id} value={m.id}>{m.short_name}</option>)}
          </select>
        </div>
        <div className="admin-form-group">
          <label>Модель</label>
          <input className="admin-input" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="ВЕГА-1.01" required style={{ minWidth: 160 }} />
        </div>
        <div className="admin-form-group">
          <label>type_dev</label>
          <input className="admin-input" type="number" value={typeDev} onChange={e => setTypeDev(e.target.value)} placeholder="5" required style={{ width: 70 }} />
        </div>
        <button className="btn-primary" type="submit">{editId ? 'Зберегти' : 'Додати'}</button>
        {editId && <button className="btn-secondary" type="button" onClick={handleCancel}>Скасувати</button>}
      </form>

      {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`}>{status.msg}</div>}

      <div className="admin-form" style={{ marginBottom: 8 }}>
        <div className="admin-form-group">
          <label>Фільтр за виробником</label>
          <select className="admin-select" value={filterMfrId} onChange={e => setFilter(e.target.value)}>
            <option value="">Всі</option>
            {manufacturers.map(m => <option key={m.id} value={m.id}>{m.short_name}</option>)}
          </select>
        </div>
      </div>

      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>Виробник</th><th>Модель</th><th>type_dev</th><th></th></tr>
        </thead>
        <tbody>
          {types.length === 0 && (
            <tr><td colSpan={5} style={{ color: '#555', textAlign: 'center', padding: 16 }}>Немає моделей</td></tr>
          )}
          {types.map(t => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{mfrLabel(t.manufacturer_id)}</td>
              <td>{t.model_name}</td>
              <td>{t.type_dev}</td>
              <td>
                <button className="btn-edit" onClick={() => handleEdit(t)}>Ред.</button>
                <button className="btn-danger" onClick={() => handleDelete(t.id)}>Видалити</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function DeviceMappingsTab() {
  const [manufacturers, setManufacturers] = useState([]);
  const [preloadStatus, setPreloadStatus] = useState(null);
  const [preloadForce, setPreloadForce] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const loadManufacturers = async () => {
    const data = await deviceCatalogApi.getManufacturers();
    setManufacturers(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadManufacturers(); }, []);

  const handlePreload = async () => {
    setPreloadStatus(null);
    try {
      const result = await deviceCatalogApi.preload(preloadForce);
      setPreloadStatus({ ok: true, msg: result?.message || 'Готово' });
      loadManufacturers();
    } catch (err) {
      setPreloadStatus({ ok: false, msg: err.message || 'Помилка' });
    }
  };

  const handleExport = async () => {
    setExportStatus(null);
    setIsExporting(true);
    try {
      const res = await deviceCatalogApi.exportPreload();
      setExportStatus({ ok: true, msg: `JSON збережено: виробників ${res.exported.manufacturers}, моделей ${res.exported.corector_types}` });
    } catch (err) {
      setExportStatus({ ok: false, msg: err.message || 'Помилка' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      {/* Preload button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 14px', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6 }}>
        <span style={{ color: '#888', fontSize: 13 }}>Передзавантаження каталогу виробників і коректорів:</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#a0a0a0' }}>
          <input type="checkbox" checked={preloadForce} onChange={e => setPreloadForce(e.target.checked)} />
          Перезаписати
        </label>
        <button className="btn-secondary" onClick={handlePreload}>Передзавантажити</button>
        {preloadStatus && <span className={`admin-status ${preloadStatus.ok ? 'ok' : 'error'}`}>{preloadStatus.msg}</span>}
      </div>

      {/* Export to preload JSON */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 14px', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6 }}>
        <span style={{ color: '#888', fontSize: 13 }}>Зберегти поточний стан каталогу у preload JSON-файл:</span>
        <button
          className="btn-secondary"
          onClick={handleExport}
          disabled={isExporting}
          title="Зберегти поточний стан БД у preload JSON-файл (device_catalog.json)"
        >
          {isExporting ? '⏳ Зберігання…' : '💾 Зберегти в JSON'}
        </button>
        {exportStatus && <span className={`admin-status ${exportStatus.ok ? 'ok' : 'error'}`}>{exportStatus.msg}</span>}
      </div>

      <ManufacturersSection manufacturers={manufacturers} onManufacturersChanged={loadManufacturers} />
      <CorectorTypesSection manufacturers={manufacturers} />
    </div>
  );
}
