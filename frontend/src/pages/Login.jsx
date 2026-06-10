import React, { useState } from 'react'
import { useAuth } from '../App'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (user, pass) => {
    setUsername(user)
    setPassword(pass)
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">景区运营团队预约单系统</h1>
        <p className="login-subtitle">异常申诉复核管理平台</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-item">
            <label className="form-label">用户名</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>

          <div className="form-item">
            <label className="form-label">密码</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg login-btn"
            disabled={loading || !username || !password}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div className="login-tips">
          <strong>演示账号（密码均为 123456）：</strong>
          <ul>
            <li>
              <button
                type="button"
                className="link-btn"
                onClick={() => quickLogin('zhangsan', '123456')}
              >
                zhangsan - 票务专员（张三）
              </button>
            </li>
            <li>
              <button
                type="button"
                className="link-btn"
                onClick={() => quickLogin('lisi', '123456')}
              >
                lisi - 现场调度（李四）
              </button>
            </li>
            <li>
              <button
                type="button"
                className="link-btn"
                onClick={() => quickLogin('wangwu', '123456')}
              >
                wangwu - 景区经理（王五）
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
