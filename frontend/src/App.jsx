import React from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">加载中...</div>
  return user ? <Dashboard /> : <Login />
}
