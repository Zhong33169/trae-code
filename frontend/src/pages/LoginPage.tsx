import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types';

const ROLES: { username: string; role: Role; name: string; desc: string }[] = [
  {
    username: 'registrar',
    role: 'registrar',
    name: '跨境登记员',
    desc: '负责订单登记、材料补正、提交审核',
  },
  {
    username: 'supervisor',
    role: 'supervisor',
    name: '跨境审核主管',
    desc: '负责订单初审、批量审核、退回补正',
  },
  {
    username: 'reviewer',
    role: 'reviewer',
    name: '跨境电商复核负责人',
    desc: '负责订单复核、批量复核、归档',
  },
];

export function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    try {
      await login(ROLES[selectedRole].username);
      navigate('/orders');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">跨境电商订单到期预警系统</h1>
        <p className="login-subtitle">请选择您的角色登录</p>
        <div className="role-select-list">
          {ROLES.map((role, index) => (
            <div
              key={role.role}
              className={`role-item ${selectedRole === index ? 'selected' : ''}`}
              onClick={() => setSelectedRole(index)}
            >
              <div className="role-item-name">{role.name}</div>
              <div className="role-item-desc">{role.desc}</div>
            </div>
          ))}
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '24px', padding: '12px', fontSize: '16px' }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? '登录中...' : '登录系统'}
        </button>
      </div>
    </div>
  );
}
