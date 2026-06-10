import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../App'
import { getAppConfig } from '../api'

export default function Header() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const config = getAppConfig()

  const isActive = (path) => location.pathname.startsWith(path)

  return (
    <header className="header">
      <div className="header-title">
        <span>🏞️</span>
        <span>景区运营团队预约单系统</span>
        <span style={{
          fontSize: '11px',
          background: 'rgba(255,255,255,0.15)',
          padding: '2px 8px',
          borderRadius: '3px',
          marginLeft: '8px'
        }}>
          前端 :{config.frontendPort} → 后端 {config.apiBaseUrl.replace(/^https?:\/\//, '')}
        </span>
      </div>

      <nav className="header-nav">
        <Link to="/queue" className={isActive('/queue') ? 'active' : ''}>
          我的队列
        </Link>
        <Link to="/orders" className={isActive('/orders') && !isActive('/queue') ? 'active' : ''}>
          全部预约单
        </Link>
      </nav>

      <div className="header-user">
        <div className="header-user-info">
          <div className="name">{user?.name}</div>
          <div className="role">{user?.role_name}</div>
        </div>
        <button className="btn btn-sm btn-default" onClick={logout}>
          退出
        </button>
      </div>
    </header>
  )
}
