import { useState } from 'react';

const users = [
  { id: 'user-reg-1', name: '李登记', role: 'registrar', roleLabel: '处方登记员', store: '朝阳店' },
  { id: 'user-reg-2', name: '王登记', role: 'registrar', roleLabel: '处方登记员', store: '海淀店' },
  { id: 'user-aud-1', name: '张审核', role: 'auditor', roleLabel: '处方审核主管', store: '朝阳店' },
  { id: 'user-aud-2', name: '刘审核', role: 'auditor', roleLabel: '处方审核主管', store: '海淀店' },
  { id: 'user-rev-1', name: '陈复核', role: 'reviewer', roleLabel: '连锁药房复核负责人', store: '总店' }
];

export default function UserSelector({ currentUserId, onUserChange }) {
  const currentUser = users.find(u => u.id === currentUserId) || users[0];

  const handleChange = (e) => {
    const userId = e.target.value;
    const user = users.find(u => u.id === userId);
    if (user) {
      onUserChange(user);
    }
  };

  return (
    <div className="user-selector">
      <span>当前用户：</span>
      <select value={currentUserId} onChange={handleChange}>
        {users.map(u => (
          <option key={u.id} value={u.id}>
            {u.name}（{u.roleLabel} - {u.store}）
          </option>
        ))}
      </select>
    </div>
  );
}

export { users };
