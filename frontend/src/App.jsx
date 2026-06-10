import { useState, useEffect } from 'preact/hooks'
import { Router, route } from 'preact-router'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Records from './pages/Records.jsx'
import RecordDetail from './pages/RecordDetail.jsx'
import Children from './pages/Children.jsx'
import Stats from './pages/Stats.jsx'
import Logs from './pages/Logs.jsx'
import { getCurrentUser, clearAuth } from './utils/api.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getCurrentUser()
    setUser(u)
    setLoading(false)
  }, [])

  const handleLogout = () => {
    clearAuth()
    setUser(null)
    route('/login')
  }

  if (loading) return null

  if (!user) {
    return (
      <Router>
        <Login path="/login" onLogin={(u, token) => {
          setUser(u)
          route('/')
        }} />
        <Login default onLogin={(u, token) => {
          setUser(u)
          route('/')
        }} />
      </Router>
    )
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Router>
        <Dashboard path="/" user={user} />
        <Records path="/records" user={user} />
        <RecordDetail path="/records/:id" user={user} />
        <Children path="/children" user={user} />
        <Stats path="/stats" user={user} />
        <Logs path="/logs" user={user} />
      </Router>
    </Layout>
  )
}
