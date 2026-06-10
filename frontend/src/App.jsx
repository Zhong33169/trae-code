import { useNavigate, useLocation, A } from '@solidjs/router'
import { getUser, ROLE_LABELS, clearAuth } from './utils'
import { api } from './api'
import { createSignal, createEffect, onMount } from 'solid-js'

export default function App(props) {
  const nav = useNavigate()
  const loc = useLocation()
  const [user, setUserState] = createSignal(null)
  const [showRoleSwitch, setShowRoleSwitch] = createSignal(false)
  const [switchPwd, setSwitchPwd] = createSignal('')
  const [switchError, setSwitchError] = createSignal('')

  onMount(() => {
    setUserState(getUser())
  })

  const onLogout = () => {
    clearAuth()
    nav('/login')
  }

  const doSwitchRole = async (newRole) => {
    if (!switchPwd()) {
      setSwitchError('请输入登录密码以确认身份')
      return
    }
    try {
      const res = await api.login(user().username, switchPwd(), newRole)
      setUserState(res.user)
      localStorage.setItem('repair_user', JSON.stringify(res.user))
      localStorage.setItem('repair_token', res.access_token)
      setSwitchPwd('')
      setSwitchError('')
      setShowRoleSwitch(false)
      alert(`角色切换成功：${ROLE_LABELS[newRole]}`)
    } catch (e) {
      setSwitchError(e.message)
    }
  }

  const otherRoles = () => {
    if (!user()) return []
    return ['registrar', 'supervisor', 'reviewer'].filter(r => r !== user().role)
  }

  return (
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-logo">物业服务中心</div>
        <nav class="sidebar-nav">
          <A href="/tickets" class={loc.pathname.startsWith('/tickets') ? 'active' : ''}>
            <span>📋</span>报修工单
          </A>
          <A href="/audit" class={loc.pathname.startsWith('/audit') ? 'active' : ''}>
            <span>🔍</span>审计日志
          </A>
        </nav>
        <div class="sidebar-user">
          <div class="name">{user()?.full_name || '-'}</div>
          <div class="role">
            当前角色：{ROLE_LABELS[user()?.role] || '-'}
          </div>
          <button onClick={() => setShowRoleSwitch(true)}>切换角色</button>
          <button style="margin-top:6px" onClick={onLogout}>退出登录</button>
        </div>
      </aside>
      <div class="main-content">
        <header class="topbar">
          <h1>
            {loc.pathname.startsWith('/tickets/') ? '工单详情' :
             loc.pathname.startsWith('/tickets') ? '报修工单列表' :
             loc.pathname.startsWith('/audit') ? '审计日志查询' : '工作台'}
          </h1>
          <div class="role-switch">
            <span>当前登录：</span>
            <span class="current">{user()?.full_name}</span>
            <span style="margin:0 6px;color:#e4e7ed">|</span>
            <span class="current">{ROLE_LABELS[user()?.role] || '-'}</span>
            <button class="btn btn-sm" onClick={() => setShowRoleSwitch(true)}>切换角色</button>
          </div>
        </header>
        <div class="page-content">
          {props.children}
        </div>
      </div>

      {showRoleSwitch() && (
        <div class="modal-backdrop" onClick={() => { setShowRoleSwitch(false); setSwitchPwd(''); setSwitchError('') }}>
          <div class="modal-box" onClick={e => e.stopPropagation()}>
            <div class="modal-head">
              <h3>切换操作角色</h3>
              <button onClick={() => { setShowRoleSwitch(false); setSwitchPwd(''); setSwitchError('') }}>×</button>
            </div>
            <div class="modal-body">
              <div class="alert-box alert-info">
                <b>说明：</b>系统为每位用户分配三个角色账号（密码相同），切换角色需重新验证密码，用于审计追踪操作责任。
              </div>
              <div class="form-row full">
                <div class="form-item">
                  <label>切换到角色</label>
                  {otherRoles().length === 0 ? (
                    <div class="form-hint">暂无其他角色</div>
                  ) : (
                    otherRoles().map(r => (
                      <button
                        class="btn"
                        style={`margin:4px 6px 0 0;${r==='registrar'?'':''}`}
                        onClick={() => doSwitchRole(r)}
                      >
                        → {ROLE_LABELS[r]}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div class="form-row full">
                <div class="form-item">
                  <label class="req">当前账号密码（验证身份）</label>
                  <input type="password" value={switchPwd()} onInput={e => setSwitchPwd(e.target.value)} placeholder="请输入密码" />
                  <div class="form-hint">默认密码：123456</div>
                  {switchError() && <div class="form-error">{switchError()}</div>}
                </div>
              </div>
            </div>
            <div class="modal-foot">
              <button class="btn" onClick={() => { setShowRoleSwitch(false); setSwitchPwd(''); setSwitchError('') }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
