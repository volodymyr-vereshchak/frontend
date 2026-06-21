import React from 'react';
import './BottomNav.css';

/**
 * Fixed bottom navigation. `items` is [{ id, label, icon }]; extend it (and the
 * render switch in MobileApp) to add more sections later.
 */
export default function BottomNav({ items, active, onSelect }) {
  return (
    <nav className="m-bottomnav">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className={`m-bottomnav-item${active === item.id ? ' active' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <span className="m-bottomnav-icon">{item.icon}</span>
          <span className="m-bottomnav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
