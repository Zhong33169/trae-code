import { useState, useEffect, createContext, useContext } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      loadUser()
    } else {
      simulateLogin('registrar1', '123456')
    }
  }, [])

  const loadUser = async () => {
    try {
      const user = await authApi.getCurrentUser()
      setCurrentUser(user)
    } catch (e) {
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  const simulateLogin = async (username, password) => {
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
          return
        }
      } catch (e) {
        console.warn('角色切换API失败，使用本地模拟', e)
      }
      setCurrentUser(user)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setCurrentUser(null)
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, switchRole, logout, simulateLogin }}>
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
