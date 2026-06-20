import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import TicketList from './pages/TicketList'
import TicketDetail from './pages/TicketDetail'
import ImportPage from './pages/ImportPage'
import CreateTicket from './pages/CreateTicket'
import './index.css'

const Header = () => {
  const { currentUser, switchRole } = useAuth()

  const roleLabels = {
    registrar: '投诉登记员',
    auditor: '投诉审核主管',
    reviewer: '复核负责人',
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
            >
              {label}
            </button>
          ))}
        </div>
        {currentUser && (
          <div className="user-info">
            <div className="avatar">{currentUser.name?.charAt(0) || 'U'}</div>
            <span>{currentUser.name}</span>
          </div>
        )}
      </div>
    </header>
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
  return (
    <div className="app">
      <Header />
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<TicketList />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/create" element={<CreateTicket />} />
          <Route path="/import" element={<ImportPage />} />
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
