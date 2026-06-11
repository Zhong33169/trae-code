import React, { useEffect, useState } from 'react';
import { api, authStore } from '../utils/api';
import { ToastProvider, toast } from './Toast.jsx';
import { getRoleText } from '../utils/format';

export default function LayoutApp({ children, activeTab = 'list' }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = authStore.getUser();
    const t = authStore.getToken();
    if (!u || !t) {
      window.location.href = '/login';
      return;
    }
    setUser(u);
    setLoading(false);
  }, []);

  const logout = async () => {
    if (!confirm('确定要退出登录吗？')) return;
    try { await api.logout(); } catch (e) {}
    authStore.setToken(null);
    authStore.setUser(null);
    toast('已退出登录', 'success');
    setTimeout(() => { window.location.href = '/login'; }, 300);
  };

  if (loading) return null;
  if (!user) return null;

  const navs = [
    { key: 'list', label: '发车计划', href: '/' },
    { key: 'stats', label: '统计概览', href: '/statistics' },
    { key: 'logs', label: '操作记录', href: '/logs' }
  ];

  return (
    <ToastProvider>
      <div className="app-container">
        <div className="page-header">
          <div>
            <div className="page-title">城市公交公司 · 跨班组交接确认发车计划系统</div>
          </div>
          <div className="user-info">
            <span>{user.realName}</span>
            <span className="role-tag">{getRoleText(user.role)}</span>
            <button className="logout-btn" onClick={logout}>退出</button>
          </div>
        </div>
        <div className="nav-tabs">
          {navs.map(n => (
            <a key={n.key} href={n.href}
              className={`nav-tab ${activeTab === n.key ? 'active' : ''}`}>
              {n.label}
            </a>
          ))}
        </div>
        {children}
      </div>
    </ToastProvider>
  );
}
