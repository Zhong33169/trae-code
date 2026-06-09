import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleNames = {
  registrar: '课程服务登记员',
  reviewer: '课程服务审核主管',
  finalizer: 'K12培训机构复核负责人'
};

function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <div className="header">
        <h1>📋 K12培训课程服务单系统</h1>
        <div className="header-right">
          <div className="user-info">
            <span className="role-badge">{roleNames[user?.role] || user?.role}</span>
            <span>{user?.name}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>退出登录</button>
        </div>
      </div>
      <div className="content">
        <Outlet />
      </div>
    </div>
  );
}

export default Layout;
