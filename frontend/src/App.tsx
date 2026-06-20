import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'preact/hooks'
import Login from './pages/Login'
import OrderList from './pages/OrderList'
import OrderDetail from './pages/OrderDetail'
import AuditLogs from './pages/AuditLogs'
import Layout from './components/Layout'
import { User, api } from './api/client'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('policy_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        localStorage.removeItem('policy_user')
      }
    }
    setLoading(false)
  }, [])

  const handleLogin = (userData: User) => {
    setUser(userData)
    localStorage.setItem('policy_user', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('policy_user')
  }

  const handleSwitchRole = async (userId: number) => {
    try {
      const res = await api.auth.switchRole(userId)
      setUser(res.user)
      localStorage.setItem('policy_user', JSON.stringify(res.user))
    } catch (e: any) {
      alert(e.message)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>
  }

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <Layout user={user} onLogout={handleLogout} onSwitchRole={handleSwitchRole}>
      <Routes>
        <Route path="/" element={<OrderList user={user} />} />
        <Route path="/orders/:id" element={<OrderDetail user={user} />} />
        <Route path="/audit" element={<AuditLogs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
