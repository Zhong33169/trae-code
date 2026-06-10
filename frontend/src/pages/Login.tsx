import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Loading } from '../components/Common'

export default function Login() {
  const [username, setUsername] = useState('registrar1')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const accountExamples = [
    { role: '租约登记员', user: 'registrar1', desc: '发起、补正租约申请' },
    { role: '租约审核主管', user: 'auditor1', desc: '审核、房态确认、入住交接' },
    { role: '复核负责人', user: 'reviewer1', desc: '入住交接、复核归档' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) {
      showToast('请输入用户名和密码', 'warning')
      return
    }
    setLoading(true)
    try {
      await login(username, password)
      showToast('登录成功', 'success')
      navigate('/dashboard')
    } catch (err: any) {
      showToast(err.message || '登录失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  function quickLogin(user: string) {
    setUsername(user)
    setPassword('123456')
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🏢</div>
          <h1 className="login-title">长租公寓租约申请系统</h1>
          <p className="login-subtitle">节点超时追踪 · 流程全程可追溯</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label required">账号</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入账号"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label required">密码</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              disabled={loading}
              onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block mt-16"
            disabled={loading}
          >
            {loading && <Loading size="sm" />}
            {loading ? ' 登录中...' : '登 录'}
          </button>
        </form>

        <div className="mt-24">
          <div className="form-label" style={{ marginBottom: '10px' }}>快速登录（默认密码 123456）</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            {accountExamples.map(a => (
              <button
                key={a.user}
                type="button"
                className={`btn btn-sm ${username === a.user ? 'btn-primary' : ''}`}
                onClick={() => quickLogin(a.user)}
                style={{ justifyContent: 'space-between' }}
              >
                <span><strong>{a.role}</strong>：{a.user}</span>
                <span style={{ fontSize: '11px', opacity: 0.7 }}>{a.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
