import React, { useState } from 'react';
import { api, authStore } from '../utils/api';
import { ToastProvider, toast } from './Toast.jsx';

export default function LoginApp() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast('请输入用户名和密码', 'error');
      return;
    }
    setLoading(true);
    const r = await api.login(username.trim(), password);
    setLoading(false);
    if (r.ok && r.data.code === 0) {
      authStore.setToken(r.data.data.token);
      authStore.setUser(r.data.data.user);
      toast('登录成功', 'success');
      setTimeout(() => { window.location.href = '/'; }, 500);
    } else {
      toast(r.data.message || '登录失败', 'error');
    }
  };

  return (
    <ToastProvider>
      <form onSubmit={submit}>
        <div className="form-item">
          <label className="form-label required">用户名</label>
          <input className="form-input" value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="请输入用户名" autoComplete="username" />
        </div>
        <div className="form-item">
          <label className="form-label required">密码</label>
          <input className="form-input" type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="请输入密码" autoComplete="current-password" />
        </div>
        <button type="submit" className="btn btn-primary"
          style={{ width: '100%', padding: '10px', fontSize: '15px' }}
          disabled={loading}>
          {loading ? '登录中...' : '登 录'}
        </button>
      </form>
    </ToastProvider>
  );
}
