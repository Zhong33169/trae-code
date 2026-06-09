import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roles = [
  { key: 'registrar', username: 'registrar1', name: '登记员', desc: '发起/补正服务单' },
  { key: 'reviewer', username: 'reviewer1', name: '审核主管', desc: '审核课程服务单' },
  { key: 'finalizer', username: 'finalizer1', name: '复核负责人', desc: '复核归档服务单' },
];

function Login() {
  const [selectedRole, setSelectedRole] = useState('registrar');
  const [username, setUsername] = useState('registrar1');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      navigate('/orders', { replace: true });
    }
  }, [user, navigate]);

  const handleRoleSelect = (role) => {
    setSelectedRole(role.key);
    setUsername(role.username);
    setPassword('123456');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      navigate('/orders', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>📋 K12培训课程服务单系统</h2>
        <p className="subtitle">现场扫码核验 · 全流程跟踪管理</p>
        
        <div className="role-selector">
          {roles.map((role) => (
            <div
              key={role.key}
              className={`role-btn ${selectedRole === role.key ? 'active' : ''}`}
              onClick={() => handleRoleSelect(role)}
            >
              <div className="role-name">{role.name}</div>
              <div className="role-desc">{role.desc}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div style={{ marginTop: '20px', fontSize: '12px', color: '#999', textAlign: 'center' }}>
          演示账号密码均为：123456
        </div>
      </div>
    </div>
  );
}

export default Login;
