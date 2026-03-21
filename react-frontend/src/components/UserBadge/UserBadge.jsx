import React, { useRef, useState, useEffect } from 'react';
import './UserBadge.css';
import { useUser } from '../../contexts/UserContext';

const UserBadge = () => {
  const { user, loading, logout } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return <div className="user-badge user-badge--loading">…</div>;
  }

  if (!user) {
    return null;
  }

  const displayName = user.display_name || user.username;
  const isAdmin = user.role === 'admin';

  return (
    <div className="user-badge-wrapper" ref={dropdownRef}>
      <button
        className="user-badge"
        onClick={() => setIsOpen(prev => !prev)}
        title={`${displayName} (${user.role})`}
      >
        <span className="user-badge__avatar">{displayName.charAt(0).toUpperCase()}</span>
        <span className="user-badge__name">{displayName}</span>
        <span className={`user-badge__role-dot user-badge__role-dot--${isAdmin ? 'admin' : 'viewer'}`} />
      </button>

      {isOpen && (
        <div className="user-badge-dropdown">
          <div className="user-badge-dropdown__header">
            <span className="user-badge-dropdown__username">{user.username}</span>
            <span className={`user-badge-dropdown__role user-badge-dropdown__role--${isAdmin ? 'admin' : 'viewer'}`}>
              {user.role}
            </span>
          </div>
          <button
            className="user-badge-dropdown__logout"
            onClick={logout}
          >
            Вийти
          </button>
        </div>
      )}
    </div>
  );
};

export default UserBadge;
