import { useState, useEffect } from 'preact/hooks'
import OrderList from './pages/OrderList.jsx'
import OrderDetail from './pages/OrderDetail.jsx'
import { ROLE_MAP } from './utils/constants.js'

function useRoute() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (to) => {
    window.history.pushState({}, '', to)
    setPath(to)
  }

  return [path, navigate]
}

function matchRoute(path) {
  if (path === '/' || path === '') return { name: 'list', params: { defaultView: 'all' } }
  if (path === '/supplement') return { name: 'list', params: { defaultView: 'supplement' } }
  if (path === '/processing') return { name: 'list', params: { defaultView: 'processing' } }
  if (path === '/review') return { name: 'list', params: { defaultView: 'review' } }
  
  const detailMatch = path.match(/^\/order\/(\d+)$/)
  if (detailMatch) return { name: 'detail', params: { id: detailMatch[1] } }
  
  return { name: 'list', params: { defaultView: 'all' } }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [path, navigate] = useRoute()

  useEffect(() => {
    try {
      const saved = localStorage.getItem('currentUser')
      if (saved) {
        setCurrentUser(JSON.parse(saved))
      } else {
        const defaultUser = { id: 1, name: '李登记', role: 'registrar', username: 'registrar01' }
        localStorage.setItem('currentUser', JSON.stringify(defaultUser))
        setCurrentUser(defaultUser)
      }
    } catch (e) {
      const defaultUser = { id: 1, name: '李登记', role: 'registrar', username: 'registrar01' }
      setCurrentUser(defaultUser)
    }
  }, [])

  const switchRole = (role) => {
    const users = {
      registrar: { id: 1, name: '李登记', role: 'registrar', username: 'registrar01' },
      auditor: { id: 2, name: '王审核', role: 'auditor', username: 'auditor01' },
      reviewer: { id: 3, name: '张复核', role: 'reviewer', username: 'reviewer01' }
    }
    const user = users[role]
    try {
      localStorage.setItem('currentUser', JSON.stringify(user))
    } catch (e) {}
    setCurrentUser(user)
  }

  if (!currentUser) return null

  const route = matchRoute(path)

  const menuItems = [
    { key: 'orders', label: '会员服务单', path: '/' },
    { key: 'supplement', label: '附件补正队列', path: '/supplement' },
    { key: 'audit', label: '审核处理', path: '/processing' },
    { key: 'review', label: '复核归档', path: '/review' }
  ]

  const handleMenuClick = (itemPath) => {
    navigate(itemPath)
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">会员服务单管理</div>
        <nav className="sidebar-menu">
          {menuItems.map(item => (
            <div
              key={item.key}
              className={`menu-item ${path === item.path ? 'active' : ''}`}
              onClick={() => handleMenuClick(item.path)}
            >
              {item.label}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="header">
          <div className="header-title">会员服务单管理系统</div>
          <div className="header-right">
            <div className="role-selector">
              {Object.entries(ROLE_MAP).map(([key, val]) => (
                <button
                  key={key}
                  className={`role-btn ${currentUser.role === key ? 'active' : ''}`}
                  onClick={() => switchRole(key)}
                >
                  {val.label}
                </button>
              ))}
            </div>
            <div className="user-info">
              <div className="user-avatar">{currentUser.name.charAt(0)}</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500' }}>{currentUser.name}</div>
                <div style={{ fontSize: '11px', color: '#999' }}>{ROLE_MAP[currentUser.role]?.label}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="content">
          {route.name === 'list' && (
            <OrderList defaultView={route.params.defaultView} onNavigate={navigate} />
          )}
          {route.name === 'detail' && (
            <OrderDetail id={route.params.id} onNavigate={navigate} onBack={() => navigate('/')} />
          )}
        </main>
      </div>
    </div>
  )
}
