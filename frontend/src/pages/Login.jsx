import { createSignal, createEffect } from 'solid-js'
import { useNavigate, A } from '@solidjs/router'
import { api } from '../api'
import { ROLE_LABELS, setUser } from '../utils'

export default function Login() {
  const nav = useNavigate()
  const [username, setUsername] = createSignal('registrar01')
  const [password, setPassword] = createSignal('123456')
  const [role, setRole] = createSignal('registrar')
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')

  createEffect(() => {
    const u = localStorage.getItem('repair_user')
    if (u) nav('/tickets')
  })

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await api.login(username(), password(), role())
      setUser(res.user, res.access_token)
      nav('/tickets')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (u, r) => {
    setUsername(u); setRole(r)
  }

  return (
    <div class="login-page">
      <div class="login-box">
        <h2>物业服务中心</h2>
        <p class="subtitle">报修工单 · 附件缺失补正管理系统</p>
        <div class="demo-tip">
          <b>演示账号（密码均为 123456）：</b><br/>
          <button class="link-btn" onClick={() => quickLogin('registrar01','registrar')}>registrar01</button> - 报修登记员
          <span style="margin:0 6px">|</span>
          <button class="link-btn" onClick={() => quickLogin('supervisor01','supervisor')}>supervisor01</button> - 报修审核主管<br/>
          <button class="link-btn" onClick={() => quickLogin('reviewer01','reviewer')}>reviewer01</button> - 物业服务中心复核负责人
        </div>
        <form onSubmit={onSubmit}>
          <div class="form-item">
            <label class="req">操作角色</label>
            <select value={role()} onInput={e => setRole(e.target.value)}>
              <option value="registrar">报修登记员（发起登记、补正附件）</option>
              <option value="supervisor">报修审核主管（审核/派单/退回）</option>
              <option value="reviewer">物业服务中心复核负责人（复核归档）</option>
            </select>
          </div>
          <div class="form-item">
            <label class="req">用户名</label>
            <input value={username()} onInput={e => setUsername(e.target.value)} placeholder="输入用户名" />
          </div>
          <div class="form-item">
            <label class="req">密码</label>
            <input type="password" value={password()} onInput={e => setPassword(e.target.value)} placeholder="输入密码" />
          </div>
          {error() && <div class="form-error" style="margin-bottom:10px">{error()}</div>}
          <button type="submit" class="btn btn-primary" disabled={loading()}>
            {loading() ? '登录中...' : `以「${ROLE_LABELS[role()]}」身份登录`}
          </button>
        </form>
        <div style="margin-top:16px;font-size:12px;color:#909399;text-align:center">
          后端端口 8001 · 前端端口 3001 · SQLite 存储
        </div>
      </div>
    </div>
  )
}
