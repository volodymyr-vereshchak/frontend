import React, { useEffect, useState } from 'react';
import { lumgApi, lineApi } from '../../services/api';

export default function LinesConfigTab() {
  const [lumgs, setLumgs] = useState([]);
  const [selectedLumgId, setSelectedLumgId] = useState('');
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    lumgApi.getAll().then(data => {
      if (data) {
        setLumgs(data);
        if (data.length > 0) setSelectedLumgId(String(data[0].id));
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedLumgId) return;
    setLines([]);
    lineApi.getLinesByLumg(parseInt(selectedLumgId)).then(data => {
      if (data) setLines(data);
    });
  }, [selectedLumgId]);

  const handleToggle = async (line, field) => {
    const newValue = !line[field];
    setSaving(prev => ({ ...prev, [`${line.id}_${field}`]: true }));
    const result = await lineApi.update(line.id, { [field]: newValue });
    setSaving(prev => ({ ...prev, [`${line.id}_${field}`]: false }));
    if (result) {
      setLines(prev => prev.map(l => l.id === line.id ? { ...l, [field]: newValue } : l));
    }
  };

  const Toggle = ({ line, field }) => {
    const key = `${line.id}_${field}`;
    const active = line[field];
    const busy = saving[key];
    return (
      <button
        onClick={() => handleToggle(line, field)}
        disabled={busy}
        style={{
          padding: '2px 10px',
          borderRadius: 12,
          border: 'none',
          cursor: busy ? 'wait' : 'pointer',
          background: active ? '#4CAF50' : '#555',
          color: '#fff',
          fontSize: 12,
          opacity: busy ? 0.6 : 1,
        }}
      >
        {active ? 'Так' : 'Ні'}
      </button>
    );
  };

  return (
    <div>
      <div className="admin-form" style={{ marginBottom: 8 }}>
        <div className="admin-form-group">
          <label>ЛУМГ</label>
          <select
            className="admin-select"
            value={selectedLumgId}
            onChange={e => setSelectedLumgId(e.target.value)}
          >
            {lumgs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Назва</th>
            <th>В звіт</th>
            <th>В тренди</th>
            <th>Висок. тиск</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.id}>
              <td>{l.id}</td>
              <td>{l.name}</td>
              <td><Toggle line={l} field="include_in_report" /></td>
              <td><Toggle line={l} field="include_in_trends" /></td>
              <td><Toggle line={l} field="is_high_pressure" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
