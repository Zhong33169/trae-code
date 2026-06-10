import { useState, useEffect } from 'react';
import { getCurrentUser, clearAuth } from '../lib/api';
import { ROLE_LABELS } from '../lib/types';

interface HeaderProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

export default function Header({ activePage, onNavigate }: HeaderProps) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/login';
  };

  if (!user) return null;

  const roleColor: Record<string, string> = {
    admission: '#10b981',
    academic: '#3b82f6',
    admin: '#8b5cf6',
  };

  const navItems = [
    { key: 'dashboard', label: '工作台', icon: '📊' },
    { key: 'enrollments', label: '报名单列表', icon: '📋' },
  ];

  if (user.role === 'admin') {
    navItems.push({ key: 'audit', label: '审计日志', icon: '🔍' });
  }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo">
          <span className="logo-icon">🎓</span>
          <span className="logo-text">职技报名管理系统</span>
        </div>
        
        <nav className="nav-menu">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activePage === item.key ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="user-info">
          <div className="user-avatar" style={{ background: roleColor[user.role] }}>
            {user.name?.charAt(0)}
          </div>
          <div className="user-detail">
            <div className="user-name">{user.name}</div>
            <div className="user-role" style={{ color: roleColor[user.role] }}>
              {ROLE_LABELS[user.role]}
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            退出
          </button>
        </div>
      </div>

      <style>{`
        .app-header {
          background: white;
          border-bottom: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
          height: 64px;
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 18px;
          color: #1f2937;
        }
        .logo-icon { font-size: 24px; }
        .nav-menu {
          display: flex;
          gap: 4px;
          flex: 1;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: none;
          background: none;
          border-radius: 8px;
          cursor: pointer;
          color: #6b7280;
          font-size: 14px;
          transition: all 0.2s;
        }
        .nav-item:hover {
          background: #f3f4f6;
          color: #374151;
        }
        .nav-item.active {
          background: #eff6ff;
          color: #3b82f6;
          font-weight: 500;
        }
        .nav-icon { font-size: 16px; }
        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
        }
        .user-detail {
          text-align: right;
        }
        .user-name {
          font-size: 14px;
          font-weight: 500;
          color: #1f2937;
        }
        .user-role {
          font-size: 12px;
        }
        .logout-btn {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          color: #6b7280;
        }
        .logout-btn:hover {
          background: #f9fafb;
          color: #374151;
        }
      `}</style>
    </header>
  );
}
