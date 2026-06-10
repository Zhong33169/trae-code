import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Role } from '../types'
import { authApi } from '../api'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  hasRole: (...roles: Role[]) => boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  useEffect(() => {
    if (token && !user) {
      refreshUser().catch(() => {
        logout()
      })
    }
  }, [token])

  async function refreshUser() {
    const u = await authApi.getCurrentUser()
    setUser(u)
    localStorage.setItem('user', JSON.stringify(u))
  }

  async function login(username: string, password: string) {
    const res = await authApi.login({ username, password })
    const newToken = res.token
    setToken(newToken)
    localStorage.setItem('token', newToken)
    setUser(res.user)
    localStorage.setItem('user', JSON.stringify(res.user))
  }

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    try {
      authApi.logout()
    } catch {}
  }

  const isAuthenticated = !!token && !!user

  function hasRole(...roles: Role[]): boolean {
    if (!user) return false
    return roles.includes(user.role)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, hasRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
