import { useState } from 'preact/hooks'
import { User, api } from '../api/client'

interface Props {
  onLogin: (user: User) => void
}

function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.auth.login(username, password)
      onLogin(res.user)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="login-container">
      <div class="login-box">
        <h2 class="login-title">政策兑现单管理系统</h2>
        <p class="login-subtitle">请登录以继续</p>
        
        {error && <div class="alert alert-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              placeholder="请输入用户名"
              required
            />
          </div>
          
          <div class="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              placeholder="请输入密码"
              required
            />
          </div>
          
          <button
            type="submit"
            class="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            disabled={loading}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div class="tips">
          <div class="tips-title">演示账号（密码均为 123456）：</div>
          <ul>
            <li><b>registrar</b> - 政策兑现登记员（张三）</li>
            <li><b>reviewer</b> - 政策兑现审核主管（李四）</li>
            <li><b>approver</b> - 园区招商中心复核负责人（王五）</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Login
