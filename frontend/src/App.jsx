import { useNavigate, useLocation, A } from '@solidjs/router'
import { getUser, ROLE_LABELS, clearAuth } from './utils'
import { api } from './api'
import { createSignal, createEffect, onMount, createContext, useContext } from 'solid-js'

export const UserContext = createContext()

export default function App(props) {
  const nav = useNavigate()
  const loc = useLocation()
  const [user, setUserState] = createSignal(null)
  const [showRoleSwitch, setShowRoleSwitch] = createSignal(false)
  const [switchPwd, setSwitchPwd] = createSignal('')
  const [switchError, setSwitchError] = createSignal('')
  const [roleUsers, setRoleUsers] = createSignal({ registrar: [], supervisor: [], reviewer: [] })
  const [loadingUsers, setLoadingUsers] = createSignal(false)
  const [selectedTargetUser, setSelectedTargetUser] = createSignal(null)
  const [selectedTargetRole, setSelectedTargetRole] = createSignal('')

  onMount(() => {
    setUserState(getUser())
  })

  createEffect(() => {
    if (showRoleSwitch() && user()) {
      loadRoleUsers()
    }
  })

  const loadRoleUsers = async () => {
    setLoadingUsers(true)
    try {
      const data = await api.listAllUsers()
      setRoleUsers(data || { registrar: [], supervisor: [], reviewer: [] })
    } catch (e) {
      setSwitchError(e.message)
    } finally {
      setLoadingUsers(false)
    }
  }

  const onLogout = () => {
    clearAuth()
    nav('/login')
  }

  const selectRoleAndUser = (role, username) => {
    setSelectedTargetRole(role)
    setSelectedTargetUser(username)
  }

  const doSwitchRole = async () => {
    if (!selectedTargetRole() || !selectedTargetUser()) {
      setSwitchError('请先选择要切换的目标账号')
      return
    }
    if (!switchPwd()) {
      setSwitchError('请输入目标账号的登录密码')
      return
    }
    try {
      const res = await api.login(selectedTargetUser(), switchPwd(), selectedTargetRole())
      setUserState(res.user)
      localStorage.setItem('repair_user', JSON.stringify(res.user))
      localStorage.setItem('repair_token', res.access_token)
      setSwitchPwd('')
      setSwitchError('')
      setShowRoleSwitch(false)
      setSelectedTargetRole('')
      setSelectedTargetUser(null)
      alert(`已切换到账号：${res.user.full_name}（${ROLE_LABELS[res.user.role]}）`)
      nav('/tickets')
    } catch (e) {
      setSwitchError(e.message)
    }
  }

  const otherRoles = () => {
    if (!user()) return []
    return ['registrar', 'supervisor', 'reviewer'].filter(r => r !== user().role)
  }

  return (
    <UserContext.Provider value={{ user, setUserState }}>
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
        <div class="modal-backdrop" onClick={() => { setShowRoleSwitch(false); setSwitchPwd(''); setSwitchError(''); setSelectedTargetRole(''); setSelectedTargetUser(null) }}>
          <div class="modal-box" style="width:560px" onClick={e => e.stopPropagation()}>
            <div class="modal-head">
              <h3>切换操作账号（跨角色办理）</h3>
              <button onClick={() => { setShowRoleSwitch(false); setSwitchPwd(''); setSwitchError(''); setSelectedTargetRole(''); setSelectedTargetUser(null) }}>×</button>
            </div>
            <div class="modal-body">
              <div class="alert-box alert-info">
                <b>说明：</b>每个角色使用独立账号登录，用于审计追踪操作责任。切换后权限视图将立即刷新。
              </div>
              <div class="form-row full">
                <div class="form-item">
                  <label class="req">选择目标角色账号</label>
                  {loadingUsers() && <div class="form-hint">正在加载用户列表...</div>}
                  {!loadingUsers() && (
                    <div style="display:flex;flex-direction:column;gap:10px">
                      {['registrar', 'supervisor', 'reviewer'].map(role => (
                        <div key={role} style={`border:2px solid ${selectedTargetRole()===role ? '#409eff' : '#ebeef5'};border-radius:6px;padding:8px 10px`}>
                          <div style="font-weight:600;margin-bottom:6px;color:#303133">
                            {ROLE_LABELS[role]}
                            {user()?.role === role && <span class="tag tag-success" style="margin-left:6px">当前登录</span>}
                          </div>
                          <div style="display:flex;flex-wrap:wrap;gap:6px">
                            {(roleUsers()[role] || []).map(u => (
                              <button
                                key={u.username}
                                class={`btn btn-sm ${selectedTargetUser()===u.username && user()?.role!==role ? 'btn-primary' : ''}`}
                                disabled={user()?.role === role}
                                onClick={() => selectRoleAndUser(role, u.username)}
                              >
                                {u.full_name}
                                <span style="color:#909399;margin-left:4px">（{u.username}）</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div class="form-row full">
                <div class="form-item">
                  <label class="req">目标账号密码</label>
                  <input type="password" value={switchPwd()} onInput={e => setSwitchPwd(e.target.value)} placeholder="请输入目标账号的登录密码" />
                  <div class="form-hint">默认所有账号密码均为：123456</div>
                  {switchError() && <div class="form-error">{switchError()}</div>}
                </div>
              </div>
            </div>
            <div class="modal-foot">
              <button class="btn" onClick={() => { setShowRoleSwitch(false); setSwitchPwd(''); setSwitchError(''); setSelectedTargetRole(''); setSelectedTargetUser(null) }}>取消</button>
              <button class="btn btn-primary" disabled={!selectedTargetUser() || !switchPwd()} onClick={doSwitchRole}>确认切换并重新登录</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </UserContext.Provider>
  )
}
