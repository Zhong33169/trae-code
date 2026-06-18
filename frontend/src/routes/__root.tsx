import { useState, useEffect } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
  useRouterState,
} from '@tanstack/react-router'
import { api } from '../lib/api.js'
import { ROLE_NAMES } from '../lib/constants.js'
import { UserContext } from '../lib/userContext.jsx'
import '../styles/app.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: '换表申请管理系统' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const [users, setUsers] = useState([])
  const [currentUserId, setCurrentUserIdState] = useState(null)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    const savedId = localStorage.getItem('currentUserId')
    api.getUsers().then(data => {
      setUsers(data)
      if (savedId && data.find(u => u.id === parseInt(savedId))) {
        setCurrentUserIdState(parseInt(savedId))
      } else if (data.length > 0) {
        setCurrentUserIdState(data[0].id)
        localStorage.setItem('currentUserId', data[0].id)
      }
    }).catch(err => {
      console.error('加载用户失败:', err)
    })
  }, [])

  const setCurrentUserId = (id) => {
    setCurrentUserIdState(id)
    localStorage.setItem('currentUserId', id)
  }

  const handleUserChange = (e) => {
    const id = parseInt(e.target.value)
    setCurrentUserId(id)
  }

  const currentUser = users.find(u => u.id === currentUserId) || null
  const isActive = (path) => pathname === path

  const contextValue = {
    currentUser,
    users,
    setCurrentUserId
  }

  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <UserContext.Provider value={contextValue}>
          <div className="container">
            <div className="header">
              <div>
                <h1 style={{ marginBottom: 4 }}>换表申请管理系统</h1>
                <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
                  <Link
                    to="/"
                    className="link"
                    style={{ fontWeight: isActive('/') ? 600 : 'normal', color: isActive('/') ? '#0f172a' : undefined }}
                  >
                    申请列表
                  </Link>
                  <Link
                    to="/audit"
                    className="link"
                    style={{ fontWeight: isActive('/audit') ? 600 : 'normal', color: isActive('/audit') ? '#0f172a' : undefined }}
                  >
                    审计日志
                  </Link>
                </div>
              </div>
              <div className="user-selector">
                <label>当前角色:</label>
                <select value={currentUserId || ''} onChange={handleUserChange}>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} - {ROLE_NAMES[u.role]}
                    </option>
                  ))}
                </select>
                {currentUser && (
                  <span className="role-badge">{ROLE_NAMES[currentUser.role]}</span>
                )}
              </div>
            </div>
            <Outlet />
          </div>
        </UserContext.Provider>
        <Scripts />
      </body>
    </html>
  )
}
