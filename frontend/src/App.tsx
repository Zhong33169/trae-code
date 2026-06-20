import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'preact/hooks'
import Login from './pages/Login'
import OrderList from './pages/OrderList'
import OrderDetail from './pages/OrderDetail'
import AuditLogs from './pages/AuditLogs'
import Layout from './components/Layout'
import { User, api, getCurrentUser, setCurrentUser, clearCurrentUser } from './api/client'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(getCurrentUser())
    setLoading(false)
  }, [])

  const handleLogin = (userData: User) => {
    setCurrentUser(userData)
    setUser(userData)
  }

  const handleLogout = () => {
    clearCurrentUser()
    setUser(null)
  }

  const handleSwitchRole = async (userId: number) => {
    try {
      const res = await api.auth.switchRole(userId)
      setCurrentUser(res.user)
      setUser(res.user)
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
