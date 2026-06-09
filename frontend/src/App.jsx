import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import RoleSwitcher from './components/RoleSwitcher'
import OrderList from './pages/OrderList'
import OrderDetail from './pages/OrderDetail'
import OrderCreate from './pages/OrderCreate'
import AuditLogPage from './pages/AuditLogPage'
import './App.css'

function App() {
  const { currentUser, currentRole, switchRole } = useAuth()

  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <div className="header-inner">
            <div className="logo">
              <span className="logo-icon">👓</span>
              <span className="logo-text">眼科诊所 · 配镜订单系统</span>
            </div>
            <nav className="nav">
              <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                订单管理
              </NavLink>
              <NavLink to="/audit" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                审计日志
              </NavLink>
            </nav>
            <div className="header-right">
              <RoleSwitcher currentRole={currentRole} onSwitch={switchRole} />
            </div>
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<OrderList currentRole={currentRole} currentUser={currentUser} />} />
            <Route path="/orders/new" element={<OrderCreate />} />
            <Route path="/orders/:id" element={<OrderDetail currentRole={currentRole} currentUser={currentUser} />} />
            <Route path="/audit" element={<AuditLogPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
