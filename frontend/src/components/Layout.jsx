import { route } from 'preact-router'

export default function Layout({ user, children, onLogout }) {
  const currentPath = location.pathname

  const menuItems = [
    { path: '/', label: '待办队列', icon: '📋', show: true },
    { path: '/records', label: '晨检记录', icon: '📝', show: true },
    { path: '/children', label: '幼儿档案', icon: '👶', show: true },
    { path: '/stats', label: '统计概览', icon: '📊', show: true },
    { path: '/logs', label: '操作记录', icon: '📜', show: true },
  ]

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">🏫 晨检记录系统</div>
        <div className="user-info">
          <div className="name">{user.name}</div>
          <div className="role">{user.roleName}</div>
        </div>
        <nav>
          {menuItems.filter(item => item.show).map(item => (
            <a
              key={item.path}
              href={item.path}
              className={currentPath === item.path ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault()
                route(item.path)
              }}
            >
              {item.icon}  {item.label}
            </a>
          ))}
        </nav>
        <div className="logout">
          <button onClick={onLogout}>退出登录</button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
