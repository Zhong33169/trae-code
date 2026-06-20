import { ComponentChildren } from 'preact'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'preact/hooks'
import { User, api } from '../api/client'

interface Props {
  user: User
  onLogout: () => void
  onSwitchRole: (userId: number) => void
  children: ComponentChildren
}

function Layout({ user, onLogout, onSwitchRole, children }: Props) {
  const [allUsers, setAllUsers] = useState<User[]>([])

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const res = await api.auth.getUsers()
      setAllUsers(res.users)
    } catch (e: any) {
      console.error(e.message)
    }
  }

  const handleRoleChange = (e: Event) => {
    const target = e.target as HTMLSelectElement
    const userId = parseInt(target.value)
    if (userId && userId !== user.id) {
      onSwitchRole(userId)
    }
  }

  return (
    <div>
      <header class="header">
        <div class="container header-content">
          <h1>🏛️ 政策兑现单管理系统</h1>
          <div class="user-info">
            <span class="role-badge">{user.roleLabel}</span>
            <span>👤 {user.name}</span>
            <div class="role-switcher">
              <select value={user.id} onChange={handleRoleChange}>
                <option value="">切换角色</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.roleLabel} - {u.name}
                  </option>
                ))}
              </select>
            </div>
            <Link to="/audit" style={{ color: 'white', textDecoration: 'none', fontSize: '14px' }}>审计日志</Link>
            <button class="btn btn-default" onClick={onLogout} style={{ padding: '4px 12px', fontSize: '13px' }}>
              退出
            </button>
          </div>
        </div>
      </header>
      <main class="main">
        <div class="container">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Layout
