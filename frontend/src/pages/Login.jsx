import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const DEMO_ACCOUNTS = [
  { username: 'clerk01', password: 'clerk123', role: '资料员', name: '张资料' },
  { username: 'foreman01', password: 'foreman123', role: '施工负责人', name: '李施工' },
  { username: 'manager01', password: 'manager123', role: '项目经理', name: '王经理' }
]

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err.data?.message || err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = async (acc) => {
    setError('')
    setLoading(true)
    try {
      await login(acc.username, acc.password)
    } catch (err) {
      setError(err.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">建筑施工项目部</h1>
        <h2 className="login-subtitle">分包进场单移动补录校验系统</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <label>
            <span>账号</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
              autoComplete="username"
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </label>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <div className="demo-section">
          <div className="demo-title">演示账号（点击快速登录）：</div>
          <div className="demo-accounts">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                className="demo-btn"
                onClick={() => quickLogin(acc)}
              >
                <span className="demo-name">{acc.name}</span>
                <span className="demo-role">{acc.role}</span>
                <span className="demo-cred">{acc.username} / {acc.password}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
