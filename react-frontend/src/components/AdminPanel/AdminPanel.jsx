import React, { useState } from 'react';
import './AdminPanel.css';
import BranchesTab from './BranchesTab';
import LumgsTab from './LumgsTab';
import DataPathsTab from './DataPathsTab';
import UpdateTab from './UpdateTab';
import LinesConfigTab from './LinesConfigTab';
import CalcsTab from './CalcsTab';
import VirtualLinesTab from './VirtualLinesTab';
import EnterprisesTab from './EnterprisesTab';
import DeviceMappingsTab from './DeviceMappingsTab';
import CalcTypesTab from './CalcTypesTab';
import EventTypesTab from './EventTypesTab';
import UsersTab from './UsersTab';
import DpdCredentialsTab from './DpdCredentialsTab';

const GROUPS = [
  {
    id: 'system',
    label: 'Система',
    icon: '⚙',
    items: [
      { id: 'users', label: 'Користувачі' },
    ],
  },
  {
    id: 'network',
    label: 'Мережа',
    icon: '🗺',
    items: [
      { id: 'branches',        label: 'Філіали' },
      { id: 'lumgs',           label: 'ЛУМГ' },
      { id: 'paths',           label: 'Шляхи даних' },
      { id: 'dpd_credentials', label: 'DPD Креденшали' },
      { id: 'update',          label: 'Оновлення' },
    ],
  },
  {
    id: 'lines',
    label: 'Лінії',
    icon: '〰',
    items: [
      { id: 'lines_config',  label: 'Конфігурація' },
      { id: 'calcs',         label: 'Вичислювачі' },
      { id: 'virtual_lines', label: 'Кільця' },
    ],
  },
  {
    id: 'catalog',
    label: 'Довідники',
    icon: '📋',
    items: [
      { id: 'enterprises',    label: 'Промисловість' },
      { id: 'device_catalog', label: 'Обладнання' },
      { id: 'calc_types',     label: 'Типи вичислювачів' },
      { id: 'event_types',    label: 'Аварії та зміни' },
    ],
  },
];

const CONTENT_MAP = {
  users:          <UsersTab />,
  update:         <UpdateTab />,
  branches:       <BranchesTab />,
  lumgs:          <LumgsTab />,
  paths:          <DataPathsTab />,
  lines_config:   <LinesConfigTab />,
  calcs:          <CalcsTab />,
  virtual_lines:  <VirtualLinesTab />,
  dpd_credentials: <DpdCredentialsTab />,
  enterprises:    <EnterprisesTab />,
  device_catalog: <DeviceMappingsTab />,
  calc_types:     <CalcTypesTab />,
  event_types:    <EventTypesTab />,
};

const TAB_LABELS = GROUPS.flatMap(g => g.items).reduce((acc, item) => {
  acc[item.id] = item.label;
  return acc;
}, {});

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users');
  const [collapsed, setCollapsed] = useState({});

  const toggleGroup = (id) =>
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="admin-layout">
      <nav className="admin-sidebar">
        <div className="admin-sidebar-header">Адмін</div>
        {GROUPS.map(group => (
          <div key={group.id} className="admin-nav-group">
            <button
              className="admin-nav-group-header"
              onClick={() => toggleGroup(group.id)}
            >
              <span className="admin-nav-icon">{group.icon}</span>
              <span className="admin-nav-group-label">{group.label}</span>
              <span className={`admin-nav-chevron ${collapsed[group.id] ? 'collapsed' : ''}`}>›</span>
            </button>
            {!collapsed[group.id] && (
              <div className="admin-nav-items">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    className={`admin-nav-item ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <main className="admin-main">
        <div className="admin-main-header">
          {TAB_LABELS[activeTab]}
        </div>
        <div className="admin-tab-content">
          {CONTENT_MAP[activeTab]}
        </div>
      </main>
    </div>
  );
}
