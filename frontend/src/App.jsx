import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import TicketList from './pages/TicketList'
import TicketDetail from './pages/TicketDetail'
import ImportPage from './pages/ImportPage'
import CreateTicket from './pages/CreateTicket'
import './index.css'

const Header = () => {
  const { currentUser, session, switchRole, logout, authError, clearAuthError } = useAuth()

  const roleLabels = {
    registrar: '投诉登记员',
    auditor: '投诉审核主管',
    reviewer: '复核负责人',
  }

  const roleHints = {
    registrar: '可创建工单、补正重提、上传/删除附件',
    auditor: '可开始办理、提交复核、退回补正、上传附件',
    reviewer: '可复核归档、复核退回',
  }

  return (
    <header className="header">
      <h1>📋 投诉工单管理系统</h1>
      <div className="header-right">
        <div className="role-switcher">
          {Object.entries(roleLabels).map(([role, label]) => (
            <button
              key={role}
              className={currentUser?.role === role ? 'active' : ''}
              onClick={() => switchRole(role)}
              title={roleHints[role]}
            >
              {label}
            </button>
          ))}
        </div>
        {currentUser && (
          <div className="user-info">
            <div className="avatar">{currentUser.name?.charAt(0) || 'U'}</div>
            <div>
              <span>{currentUser.name}</span>
              <div style={{ fontSize: 11, color: '#aaa' }}>
                {session?.role_label || roleHints[currentUser.role]}
              </div>
            </div>
            <button className="logout-btn" onClick={logout} title="退出登录">
              退出
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

const GlobalErrorBar = () => {
  const { authError, clearAuthError } = useAuth()
  if (!authError) return null
  return (
    <div className="global-error-bar">
      <span>⚠️ {authError}</span>
      <button onClick={clearAuthError} className="close-btn">×</button>
    </div>
  )
}

const UnauthorizedView = () => {
  const { login, loading, authError } = useAuth()
  const [username, setUsername] = useState('registrar1')
  const [password, setPassword] = useState('123456')

  const handleSubmit = (e) => {
    e.preventDefault()
    login(username, password)
  }

  return (
    <div className="unauthorized-view">
      <div className="login-card">
        <h2>🔐 投诉工单管理系统</h2>
        <p className="login-subtitle">请登录以访问系统</p>
        {authError && (
          <div className="login-error">
            {authError}
          </div>
        )}
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
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        <div className="login-hints">
          <p>测试账号：</p>
          <p>投诉登记员：registrar1 / 123456</p>
          <p>投诉审核主管：auditor1 / 123456</p>
          <p>复核负责人：reviewer1 / 123456</p>
        </div>
      </div>
    </div>
  )
}

const Nav = () => {
  const { currentUser } = useAuth()

  return (
    <nav className="nav">
      <NavLink to="/" end>
        工单列表
      </NavLink>
      {currentUser?.role === 'registrar' && (
        <NavLink to="/create">
          新建工单
        </NavLink>
      )}
      <NavLink to="/import">
          离线台账回填
        </NavLink>
    </nav>
  )
}

const AppContent = () => {
  const { loading, currentUser, refreshKey } = useAuth()

  if (loading) {
    return (
      <div className="app">
        <header className="header">
          <h1>📋 投诉工单管理系统</h1>
        </header>
        <main className="main">
          <div className="empty">正在验证会话，请稍候...</div>
        </main>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="app">
        <GlobalErrorBar />
        <UnauthorizedView />
      </div>
    )
  }

  return (
    <div className="app">
      <GlobalErrorBar />
      <Header />
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<TicketList key={refreshKey} />} />
          <Route path="/tickets/:id" element={<TicketDetail key={refreshKey} />} />
          <Route path="/create" element={<CreateTicket key={refreshKey} />} />
          <Route path="/import" element={<ImportPage key={refreshKey} />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
