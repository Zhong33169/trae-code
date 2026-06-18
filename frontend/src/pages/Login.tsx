import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, setUserToStorage } from '../utils/api';
import type { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const demoAccounts = [
  { username: 'registrar1', name: '张登记', role: '展商登记员' },
  { username: 'registrar2', name: '李登记', role: '展商登记员' },
  { username: 'auditor1', name: '王审核', role: '展商审核主管' },
  { username: 'auditor2', name: '赵审核', role: '展商审核主管' },
  { username: 'reviewer1', name: '陈复核', role: '展会主办方复核负责人' },
];

export default function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('registrar1');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await api.login(username, password);
      setToken(result.access_token);
      setUserToStorage(result.user);
      onLogin(result.user);
      navigate('/applications');
    } catch (e: any) {
      setError(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (acc: string) => {
    setUsername(acc);
    setPassword('123456');
    setTimeout(() => {
      // 触发登录
      const event = new KeyboardEvent('keyup', { key: 'Enter' });
      window.dispatchEvent(event);
    }, 50);
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">展商申请管理系统</h1>
        <p className="login-subtitle">展会主办方内部审批平台</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <div className="form-item">
          <label className="form-label">用户名</label>
          <input
            className="form-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyUp={handleKeyUp}
            placeholder="请输入用户名"
          />
        </div>

        <div className="form-item">
          <label className="form-label">密码</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={handleKeyUp}
            placeholder="请输入密码"
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: '16px' }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? '登录中...' : '登 录'}
        </button>

        <div className="login-hint">
          <strong>演示账号（密码均为 123456）：</strong>
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {demoAccounts.map((acc) => (
              <button
                key={acc.username}
                className="btn btn-sm btn-default"
                onClick={() => {
                  setUsername(acc.username);
                  setPassword('123456');
                }}
              >
                {acc.name}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#999' }}>
            点击账号按钮可快速填充，再点登录按钮进入
          </div>
        </div>
      </div>
    </div>
  );
}
