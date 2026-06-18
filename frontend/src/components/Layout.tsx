import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clearToken, roleLabels } from '../utils/api';
import type { User } from '../types';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}

export default function Layout({ user, onLogout, children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('user');
    onLogout();
    navigate('/login');
  };

  const menuItems = [
    { key: 'applications', label: '展商申请', path: '/applications' },
  ];

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div>
      <div className="sidebar">
        <div className="sidebar-logo">展商申请系统</div>
        <div className="sidebar-menu">
          {menuItems.map((item) => (
            <div
              key={item.key}
              className={`menu-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <div className="main-content">
        <div className="header">
          <div className="header-title">展商申请管理</div>
          <div className="header-right">
            <span className="role-badge">{roleLabels[user.role]}</span>
            <div className="user-info">
              <div className="user-avatar">{user.full_name.charAt(0)}</div>
              <span>{user.full_name}</span>
            </div>
            <button className="btn btn-default btn-sm" onClick={handleLogout}>
              退出
            </button>
          </div>
        </div>

        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
