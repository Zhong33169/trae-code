import { h } from 'preact';
import { useState } from 'preact/hooks';
import { api, auth } from '../utils/api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(username, password);
      auth.setToken(res.token);
      auth.setUser(res.user);
      onLogin(res.user);
    } catch (err) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1890ff 0%,#096dd9 100%)', padding: 20 }}>
      <div class="login-box">
        <div class="login-title">消防隐患单节点超时追踪系统</div>
        <div class="login-subtitle">消防救援站管理平台</div>
        <form onSubmit={handleLogin}>
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input
              value={username}
              onInput={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input
              type="password"
              value={password}
              onInput={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div style={{ color: '#ff4d4f', marginBottom: 12, fontSize: 13 }}>{error}</div>
          )}
          <button
            type="submit"
            class="btn-primary"
            style={{ width: '100%', padding: '10px', fontSize: 15 }}
            disabled={loading}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        <div class="login-tips">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>测试账号（密码均为 123456）：</div>
          <div>
            <a onClick={() => quickLogin('clerk01', '123456')}>clerk01</a> 消防文员（朝阳）&nbsp;|&nbsp;
            <a onClick={() => quickLogin('clerk02', '123456')}>clerk02</a> 消防文员（海淀）
          </div>
          <div>
            <a onClick={() => quickLogin('supervisor01', '123456')}>supervisor01</a> 防火监督员（朝阳）&nbsp;|&nbsp;
            <a onClick={() => quickLogin('supervisor02', '123456')}>supervisor02</a> 防火监督员（海淀）
          </div>
          <div>
            <a onClick={() => quickLogin('chief01', '123456')}>chief01</a> 站点负责人（朝阳）&nbsp;|&nbsp;
            <a onClick={() => quickLogin('chief02', '123456')}>chief02</a> 站点负责人（海淀）
          </div>
        </div>
      </div>
    </div>
  );
}
