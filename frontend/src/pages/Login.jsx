import { useState } from 'preact/hooks'
import { api, setAuth } from '../utils/api.js'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.login(username.trim(), password)
      setAuth(res.token, res.user)
      onLogin(res.user, res.token)
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>幼儿园晨检记录系统</h1>
        <p className="subtitle">节点超时追踪 · 角色权限管理</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-item">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onInput={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>
          <div className="form-item">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onInput={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        <div className="account-hints">
          <div>测试账号：</div>
          <div>晨检登记员：registrar1 / 123456</div>
          <div>晨检审核主管：auditor1 / 123456</div>
          <div>幼儿园复核负责人：reviewer1 / 123456</div>
        </div>
      </div>
    </div>
  )
}
