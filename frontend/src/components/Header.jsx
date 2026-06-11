import { useState } from 'preact/hooks';

export default function Header({ user, meta, onSwitchRole, navigate, page }) {
  const [selectedUserId, setSelectedUserId] = useState(user.id);
  const [selectedRole, setSelectedRole] = useState(user.role);

  const demoUsers = [
    { id: 'registrar_demo', name: '演示-登记员', role: 'registrar', roleLabel: '门店订货登记员' },
    { id: 'supervisor_demo', name: '演示-审核主管', role: 'supervisor', roleLabel: '门店订货审核主管' },
    { id: 'reviewer_demo', name: '演示-复核负责人', role: 'reviewer', roleLabel: '餐饮连锁总部复核负责人' },
  ];

  function handleSwitch() {
    onSwitchRole(selectedUserId, selectedRole);
  }

  function handleUserChange(userId) {
    const u = demoUsers.find(d => d.id === userId);
    setSelectedUserId(userId);
    if (u) setSelectedRole(u.role);
  }

  return (
    <header className="app-header">
      <div className="brand" onClick={() => navigate('list')} style={{ cursor: 'pointer' }}>
        <div className="logo">餐</div>
        <span>餐饮连锁总部 · 到期预警处理门店订货单系统</span>
      </div>

      <div className="user-area">
        <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
          <a onClick={() => navigate('list')} style={{ fontWeight: page === 'list' ? 600 : 'normal', color: page === 'list' ? 'var(--primary)' : 'var(--gray-600)' }}>订货单列表</a>
          <a onClick={() => navigate('audit')} style={{ fontWeight: page === 'audit' ? 600 : 'normal', color: page === 'audit' ? 'var(--primary)' : 'var(--gray-600)' }}>审计日志</a>
        </div>

        <div className="role-select">
          <select value={selectedUserId} onChange={(e) => handleUserChange(e.target.value)}>
            {demoUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}（{u.roleLabel}）
              </option>
            ))}
          </select>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
            {meta?.roles?.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button className="btn-primary btn-sm" onClick={handleSwitch}>切换角色</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
          当前：<strong style={{ color: 'var(--gray-800)' }}>{user.name}</strong>
          <span style={{ marginLeft: 6 }} className="tag blue">{meta?.roleNames?.[user.role] || user.role}</span>
        </div>
      </div>
    </header>
  );
}
