import React, { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { api } from './api'
import Header from './components/Header'
import Login from './pages/Login'
import Queue from './pages/Queue'
import OrderDetail from './pages/OrderDetail'
import AllOrders from './pages/AllOrders'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function AppContent() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const data = await api.getMe()
      setUser({ ...data.user, role_name: data.role_name })
    } catch (err) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    const data = await api.login(username, password)
    setUser({ ...data.user, role_name: data.role_name })
    navigate('/queue')
  }

  const logout = async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      navigate('/login')
    }
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser: checkAuth }}>
      <div className="app">
        {user && <Header />}
        <main className="main-content">
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/queue" />} />
            <Route path="/queue" element={user ? <Queue /> : <Navigate to="/login" />} />
            <Route path="/orders" element={user ? <AllOrders /> : <Navigate to="/login" />} />
            <Route path="/orders/:id" element={user ? <OrderDetail /> : <Navigate to="/login" />} />
            <Route path="/" element={<Navigate to={user ? "/queue" : "/login"} />} />
          </Routes>
        </main>
      </div>
    </AuthContext.Provider>
  )
}

export default function App() {
  return <AppContent />
}
