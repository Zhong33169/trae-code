import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const simulateLogin = useCallback(async (username, password) => {
    setLoading(true)
    try {
      const result = await authApi.login(username, password)
      if (result?.token) {
        localStorage.setItem('token', result.token)
        setCurrentUser(result.user)
      }
    } catch (e) {
      console.error('登录失败', e)
      setCurrentUser({
        id: 1,
        username: 'registrar1',
        role: 'registrar',
        name: '张登记员',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      loadUser()
    } else {
      simulateLogin('registrar1', '123456')
    }

    const handleUnauthorized = () => {
      simulateLogin('registrar1', '123456')
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [simulateLogin])

  const loadUser = async () => {
    try {
      const user = await authApi.getCurrentUser()
      setCurrentUser(user)
      setLoading(false)
    } catch (e) {
      localStorage.removeItem('token')
      await simulateLogin('registrar1', '123456')
    }
  }

  const switchRole = async (role) => {
    const roleUsers = {
      registrar: { id: 1, username: 'registrar1', role: 'registrar', name: '张登记员' },
      auditor: { id: 2, username: 'auditor1', role: 'auditor', name: '李审核主管' },
      reviewer: { id: 3, username: 'reviewer1', role: 'reviewer', name: '王复核负责人' },
    }
    const user = roleUsers[role]
    if (user) {
      try {
        const result = await authApi.login(user.username, '123456')
        if (result?.token) {
          localStorage.setItem('token', result.token)
          setCurrentUser(result.user)
          setRefreshKey(k => k + 1)
          return
        }
      } catch (e) {
        console.warn('角色切换API失败，使用本地模拟', e)
      }
      setCurrentUser(user)
      setRefreshKey(k => k + 1)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setCurrentUser(null)
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, refreshKey, switchRole, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
