import { LitElement, html, css } from 'lit'
import { roleMap } from '../api/api.js'

export class MeetingApp extends LitElement {
  static properties = {
    currentView: { type: String },
    currentUser: { type: Object },
    selectedId: { type: Number },
  }

  static styles = css`
    .app {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      background: #1e3a8a;
      color: white;
      padding: 0 24px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .logo {
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      background: #3b82f6;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #3b82f6;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
    }

    .role-badge {
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
    }

    .nav-tabs {
      background: white;
      padding: 0 24px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      gap: 4px;
    }

    .nav-tab {
      padding: 12px 20px;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      font-weight: 500;
      color: #6b7280;
      transition: all 0.2s;
    }

    .nav-tab:hover {
      color: #2563eb;
    }

    .nav-tab.active {
      color: #2563eb;
      border-bottom-color: #2563eb;
    }

    .content {
      flex: 1;
      padding: 24px;
    }

    .role-switcher {
      position: relative;
    }

    .role-switch-btn {
      background: rgba(255, 255, 255, 0.15);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .role-switch-btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .role-dropdown {
      position: absolute;
      right: 0;
      top: 100%;
      margin-top: 4px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px 0;
      min-width: 200px;
      z-index: 100;
    }

    .role-option {
      padding: 10px 16px;
      cursor: pointer;
      color: #374151;
      font-size: 13px;
    }

    .role-option:hover {
      background: #f3f4f6;
    }

    .role-option.active {
      background: #eff6ff;
      color: #2563eb;
      font-weight: 500;
    }

    .role-option .role-name {
      font-weight: 500;
    }

    .role-option .role-desc {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 2px;
    }
  `

  constructor() {
    super()
    this.currentView = 'list'
    this.selectedId = null
    this.showRoleDropdown = false
    this._loadUser()
  }

  _loadUser() {
    const saved = localStorage.getItem('currentUser')
    if (saved) {
      this.currentUser = JSON.parse(saved)
    } else {
      this.currentUser = {
        username: 'registrar',
        name: '张登记',
        role: 'registrar',
        department: '行政后勤中心-预约登记组',
      }
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser))
    }
  }

  _switchRole(role) {
    const users = {
      registrar: { username: 'registrar', name: '张登记', role: 'registrar', department: '行政后勤中心-预约登记组' },
      auditor: { username: 'auditor', name: '李审核', role: 'auditor', department: '行政后勤中心-审核组' },
      reviewer: { username: 'reviewer', name: '王复核', role: 'reviewer', department: '行政后勤中心-复核归档组' },
    }
    this.currentUser = users[role]
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser))
    this.showRoleDropdown = false
    this.currentView = 'list'
    this.selectedId = null
    this.requestUpdate()
    this.dispatchEvent(new CustomEvent('role-changed', { detail: this.currentUser }))
  }

  _toggleRoleDropdown() {
    this.showRoleDropdown = !this.showRoleDropdown
    this.requestUpdate()
  }

  _navigate(view, id = null) {
    this.currentView = view
    this.selectedId = id
    this.requestUpdate()
  }

  _getNavTabs() {
    const role = this.currentUser?.role
    if (role === 'registrar') {
      return [
        { key: 'list', label: '会议预约单' },
        { key: 'create', label: '新建预约' },
        { key: 'batches', label: '批次管理' },
      ]
    } else if (role === 'auditor') {
      return [
        { key: 'list', label: '待审核列表' },
        { key: 'batches', label: '批次管理' },
      ]
    } else {
      return [
        { key: 'list', label: '待复核列表' },
        { key: 'batches', label: '批次管理' },
        { key: 'audit', label: '审计日志' },
      ]
    }
  }

  render() {
    return html`
      <div class="app">
        <div class="header">
          <div class="logo">
            <div class="logo-icon">📋</div>
            <span>行政后勤中心 - 会议预约单管理系统</span>
          </div>
          <div class="header-right">
            <div class="user-info">
              <div class="user-avatar">${this.currentUser?.name?.charAt(0) || '用'}</div>
              <div>
                <div>${this.currentUser?.name || '未知用户'}</div>
                <div class="role-badge">${roleMap[this.currentUser?.role] || '未知角色'}</div>
              </div>
            </div>
            <div class="role-switcher">
              <button class="role-switch-btn" @click=${this._toggleRoleDropdown}>
                切换角色 ▾
              </button>
              ${this.showRoleDropdown ? html`
                <div class="role-dropdown">
                  <div class="role-option ${this.currentUser?.role === 'registrar' ? 'active' : ''}"
                       @click=${() => this._switchRole('registrar')}>
                    <div class="role-name">张登记</div>
                    <div class="role-desc">会议预约登记员 - 发起/补正预约</div>
                  </div>
                  <div class="role-option ${this.currentUser?.role === 'auditor' ? 'active' : ''}"
                       @click=${() => this._switchRole('auditor')}>
                    <div class="role-name">李审核</div>
                    <div class="role-desc">会议预约审核主管 - 审核办理</div>
                  </div>
                  <div class="role-option ${this.currentUser?.role === 'reviewer' ? 'active' : ''}"
                       @click=${() => this._switchRole('reviewer')}>
                    <div class="role-name">王复核</div>
                    <div class="role-desc">行政后勤中心复核负责人 - 复核归档</div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="nav-tabs">
          ${this._getNavTabs().map(tab => html`
            <div class="nav-tab ${this.currentView === tab.key ? 'active' : ''}"
                 @click=${() => this._navigate(tab.key)}>
              ${tab.label}
            </div>
          `)}
        </div>

        <div class="content">
          ${this._renderContent()}
        </div>
      </div>
    `
  }

  _renderContent() {
    switch (this.currentView) {
      case 'list':
        return html`
          <reservation-list
            .userRole=${this.currentUser?.role}
            @view-detail=${(e) => this._navigate('detail', e.detail.id)}
            @create-new=${() => this._navigate('create')}
          ></reservation-list>
        `
      case 'detail':
        return html`
          <reservation-detail
            .reservationId=${this.selectedId}
            .userRole=${this.currentUser?.role}
            .userName=${this.currentUser?.name}
            @back=${() => this._navigate('list')}
            @updated=${() => this.requestUpdate()}
          ></reservation-detail>
        `
      case 'create':
        return html`
          <reservation-form
            .userRole=${this.currentUser?.role}
            @back=${() => this._navigate('list')}
            @created=${(e) => this._navigate('detail', e.detail.id)}
          ></reservation-form>
        `
      case 'batches':
        return html`
          <batch-list .userRole=${this.currentUser?.role}></batch-list>
        `
      case 'audit':
        return html`
          <audit-log-list></audit-log-list>
        `
      default:
        return html`<div>未知页面</div>`
    }
  }
}

customElements.define('meeting-app', MeetingApp)
