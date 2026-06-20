import { useState, useEffect, createContext, useContext } from 'react'
import { authApi } from '../api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      loadSession()
    } else {
      setLoading(false)
      setCurrentUser(null)
      setSession(null)
    }

    const handleUnauthorized = () => {
      localStorage.removeItem('token')
      setCurrentUser(null)
      setSession(null)
      setAuthError('登录已过期，请重新登录')
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  const loadSession = async () => {
    setLoading(true)
    setAuthError(null)
    try {
      const sess = await authApi.getSession()
      if (sess?.user) {
        setCurrentUser(sess.user)
        setSession(sess)
      } else {
        localStorage.removeItem('token')
        setCurrentUser(null)
        setSession(null)
      }
    } catch (e) {
      localStorage.removeItem('token')
      setCurrentUser(null)
      setSession(null)
      setAuthError(e?.message || '会话验证失败，请重新登录')
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    setLoading(true)
    setAuthError(null)
    try {
      const result = await authApi.login(username, password)
      if (result?.token) {
        localStorage.setItem('token', result.token)
        const sess = await authApi.getSession()
        setCurrentUser(sess?.user || result.user)
        setSession(sess)
        setRefreshKey(k => k + 1)
        return { success: true }
      }
    } catch (e) {
      setAuthError(e?.message || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
    return { success: false, error: authError }
  }

  const switchRole = async (role) => {
    const roleAccounts = {
      registrar: { username: 'registrar1', password: '123456' },
      auditor: { username: 'auditor1', password: '123456' },
      reviewer: { username: 'reviewer1', password: '123456' },
    }
    const account = roleAccounts[role]
    if (!account) return

    setLoading(true)
    setAuthError(null)
    try {
      const result = await authApi.login(account.username, account.password)
      if (result?.token) {
        localStorage.setItem('token', result.token)
        const sess = await authApi.getSession()
        setCurrentUser(sess?.user || result.user)
        setSession(sess)
        setRefreshKey(k => k + 1)
        return
      }
    } catch (e) {
      setAuthError(e?.message || '角色切换失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (e) {
    } finally {
      localStorage.removeItem('token')
      setCurrentUser(null)
      setSession(null)
      setAuthError(null)
      setRefreshKey(k => k + 1)
    }
  }

  const clearAuthError = () => {
    setAuthError(null)
  }

  return (
    <AuthContext.Provider value={{
      currentUser,
      session,
      loading,
      refreshKey,
      authError,
      login,
      switchRole,
      logout,
      loadSession,
      clearAuthError,
    }}>
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
