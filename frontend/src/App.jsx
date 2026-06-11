import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ApplicationList from './pages/ApplicationList'
import ApplicationDetail from './pages/ApplicationDetail'
import AuditLogs from './pages/AuditLogs'
import { useState, useEffect } from 'react'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      setUser(JSON.parse(userStr))
    }
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={setUser} />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout user={user} setUser={setUser} />
        </PrivateRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard user={user} />} />
        <Route path="applications" element={<ApplicationList user={user} />} />
        <Route path="applications/:id" element={<ApplicationDetail user={user} />} />
        <Route path="audit" element={<AuditLogs user={user} />} />
      </Route>
    </Routes>
  )
}

export default App
