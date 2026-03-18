import React, { useState } from 'react';
import './AdminPanel.css';
import BranchesTab from './BranchesTab';
import LumgsTab from './LumgsTab';
import DataPathsTab from './DataPathsTab';
import UpdateTab from './UpdateTab';
import LinesConfigTab from './LinesConfigTab';
import VirtualLinesTab from './VirtualLinesTab';

const TABS = [
  { id: 'branches',      label: 'Філіали' },
  { id: 'lumgs',         label: 'ЛУМГ' },
  { id: 'paths',         label: 'Шляхи даних' },
  { id: 'lines_config',  label: 'Лінії' },
  { id: 'virtual_lines', label: 'Кільця' },
  { id: 'update',        label: 'Оновлення' },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('branches');

  return (
    <div className="admin-panel">
      <h2>Адміністрування</h2>
      <div className="admin-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="admin-tab-content">
        {activeTab === 'branches'      && <BranchesTab />}
        {activeTab === 'lumgs'         && <LumgsTab />}
        {activeTab === 'paths'         && <DataPathsTab />}
        {activeTab === 'lines_config'  && <LinesConfigTab />}
        {activeTab === 'virtual_lines' && <VirtualLinesTab />}
        {activeTab === 'update'        && <UpdateTab />}
      </div>
    </div>
  );
}
