import { useState, useEffect } from 'react';
import { setCurrentUser, getCurrentUserRole, getCurrentUserId } from '../lib/api';

const roleUsers = {
  registrar: [
    { id: 'u001', name: '张登记员' },
    { id: 'u002', name: '李登记员' },
  ],
  reviewer: [
    { id: 'u003', name: '王主管' },
    { id: 'u004', name: '赵主管' },
  ],
  director: [
    { id: 'u005', name: '陈主任' },
    { id: 'u006', name: '刘主任' },
  ],
};

const roleLabels: Record<string, string> = {
  registrar: '登记员',
  reviewer: '审核主管',
  director: '复核负责人',
};

export default function RoleSwitcher() {
  const [role, setRole] = useState('registrar');
  const [userId, setUserId] = useState('u001');
  const [userName, setUserName] = useState('张登记员');

  useEffect(() => {
    const savedRole = localStorage.getItem('currentRole') || 'registrar';
    const savedUserId = localStorage.getItem('currentUserId') || 'u001';
    const savedUserName = localStorage.getItem('currentUserName') || '张登记员';
    setRole(savedRole);
    setUserId(savedUserId);
    setUserName(savedUserName);
    setCurrentUser(savedUserId, savedRole);
  }, []);

  const switchRole = (newRole: string) => {
    const users = roleUsers[newRole as keyof typeof roleUsers];
    const user = users[0];
    setRole(newRole);
    setUserId(user.id);
    setUserName(user.name);
    setCurrentUser(user.id, newRole);
    localStorage.setItem('currentRole', newRole);
    localStorage.setItem('currentUserId', user.id);
    localStorage.setItem('currentUserName', user.name);
    window.dispatchEvent(new CustomEvent('userChanged'));
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div className="role-selector">
        {Object.keys(roleLabels).map((r) => (
          <button
            key={r}
            className={`role-btn ${role === r ? 'active' : ''}`}
            onClick={() => switchRole(r)}
          >
            {roleLabels[r]}
          </button>
        ))}
      </div>
      <div className="user-info">
        <span className="user-role">{roleLabels[role]}</span>
        <span className="user-name">{userName}</span>
      </div>
    </div>
  );
}
