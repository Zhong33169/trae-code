import { useState, useEffect } from 'react';
import { api, setAuth, getCurrentUser, clearAuth } from '../lib/api';
import { ROLE_LABELS } from '../lib/types';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const quickLogin = async (role: string) => {
    const accounts: Record<string, { username: string; password: string }> = {
      admission: { username: 'admission1', password: '123456' },
      academic: { username: 'academic1', password: '123456' },
      admin: { username: 'admin1', password: '123456' },
    };
    const acc = accounts[role];
    if (acc) {
      setUsername(acc.username);
      setPassword(acc.password);
      handleLogin(acc.username, acc.password);
    }
  };

  const handleLogin = async (u?: string, p?: string) => {
    const user = u || username;
    const pass = p || password;
    setError('');
    setLoading(true);
    try {
      const result = await api.login(user, pass);
      setAuth(result.token, result.user);
      window.location.href = '/';
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>职业技能学校</h1>
        <h2>附件缺失补正学员报名单系统</h2>
        
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
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="quick-login">
          <p>快速登录（演示用）：</p>
          <div className="role-buttons">
            <button onClick={() => quickLogin('admission')} className="btn-role admission">
              招生顾问
            </button>
            <button onClick={() => quickLogin('academic')} className="btn-role academic">
              教务主管
            </button>
            <button onClick={() => quickLogin('admin')} className="btn-role admin">
              校务负责人
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }
        .login-box {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          width: 100%;
          max-width: 420px;
        }
        h1 {
          text-align: center;
          color: #1f2937;
          margin: 0 0 8px 0;
          font-size: 24px;
        }
        h2 {
          text-align: center;
          color: #6b7280;
          margin: 0 0 24px 0;
          font-size: 16px;
          font-weight: normal;
        }
        .form-group {
          margin-bottom: 16px;
        }
        label {
          display: block;
          margin-bottom: 6px;
          color: #374151;
          font-size: 14px;
          font-weight: 500;
        }
        input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
        }
        input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .error {
          background: #fef2f2;
          color: #dc2626;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }
        .btn-primary {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-primary:hover {
          opacity: 0.9;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .quick-login {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        .quick-login p {
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 12px;
        }
        .role-buttons {
          display: flex;
          gap: 8px;
        }
        .btn-role {
          flex: 1;
          padding: 10px 8px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .btn-role:hover {
          background: #f9fafb;
        }
        .btn-role.admission:hover { border-color: #10b981; color: #10b981; }
        .btn-role.academic:hover { border-color: #3b82f6; color: #3b82f6; }
        .btn-role.admin:hover { border-color: #8b5cf6; color: #8b5cf6; }
      `}</style>
    </div>
  );
}
