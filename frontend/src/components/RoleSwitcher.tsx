import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLE_NAMES } from '../types';
import './RoleSwitcher.css';

const RoleSwitcher: React.FC = () => {
  const { currentRole, currentUsername, users, roles, switchRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const groupedUsers = users.reduce((acc, user) => {
    if (!acc[user.role]) {
      acc[user.role] = [];
    }
    acc[user.role].push(user);
    return acc;
  }, {} as Record<string, typeof users>);

  const currentUserName = users.find(u => u.username === currentUsername)?.name || currentUsername;

  return (
    <div className="role-switcher">
      <button
        className="role-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="role-badge">
          {ROLE_NAMES[currentRole] || currentRole}
        </span>
        <span className="user-name">{currentUserName}</span>
        <span className="dropdown-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="role-dropdown">
          <div className="dropdown-title">切换角色 / 用户</div>
          {Object.entries(groupedUsers).map(([role, userList]) => (
            <div key={role} className="role-group">
              <div className="role-group-title">
                {roles[role]?.name || role}
              </div>
              {userList.map(user => (
                <div
                  key={user.username}
                  className={`user-option ${currentUsername === user.username ? 'active' : ''}`}
                  onClick={() => {
                    switchRole(role, user.username);
                    setIsOpen(false);
                  }}
                >
                  {user.name}
                  <span className="username">({user.username})</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoleSwitcher;
