import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Role } from '../types'

const menusByRole: Record<Role, Array<{ path: string; label: string; icon: string }>> = {
  registrar: [
    { path: '/dashboard', label: '工作台', icon: '📊' },
    { path: '/applications', label: '租约申请', icon: '📝' },
    { path: '/applications/new', label: '新建申请', icon: '➕' },
    { path: '/stats', label: '统计分析', icon: '📈' },
  ],
  auditor: [
    { path: '/dashboard', label: '工作台', icon: '📊' },
    { path: '/applications', label: '租约审核', icon: '✅' },
    { path: '/stats', label: '统计分析', icon: '📈' },
  ],
  reviewer: [
    { path: '/dashboard', label: '工作台', icon: '📊' },
    { path: '/applications', label: '复核归档', icon: '📁' },
    { path: '/stats', label: '统计分析', icon: '📈' },
  ],
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const menus = menusByRole[user.role] || []

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span style={{ fontSize: '22px' }}>🏢</span>
          <span>长租公寓租约管理</span>
        </div>
        <nav className="sidebar-menu">
          {menus.map(m => (
            <NavLink
              key={m.path}
              to={m.path}
              className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-name">👤 {user.realName}</div>
          <div className="sidebar-user-role">{user.roleName}</div>
          <button className="btn btn-sm btn-block" onClick={handleLogout}>退出登录</button>
        </div>
      </aside>

      <div className="main-content">
        <div className="topbar">
          <div className="topbar-title">
            {menus.find(m => location.pathname.startsWith(m.path))?.label || '工作台'}
          </div>
          <div className="topbar-actions">
            <span className="badge badge-info">{user.roleName}</span>
            <span className="badge badge-blue">{user.username}</span>
          </div>
        </div>
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
