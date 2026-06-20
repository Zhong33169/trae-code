import { LitElement, html, css } from 'lit';

const ROLE_LABELS = {
  clerk: '讲师排课登记员',
  supervisor: '讲师排课审核主管',
  manager: '企业培训公司复核负责人',
};

class AppLayout extends LitElement {
  static properties = {
    user: { type: Object },
    activeNav: { type: String },
  };

  static styles = css`
    :host { display: block; min-height: 100vh; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar {
      width: 240px;
      background: #1e293b;
      color: white;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .sidebar-header h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .sidebar-header .role {
      font-size: 12px;
      color: #94a3b8;
    }
    .nav { flex: 1; padding: 12px 0; }
    .nav-item {
      display: flex;
      align-items: center;
      padding: 10px 20px;
      color: #cbd5e1;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
      gap: 10px;
    }
    .nav-item:hover { background: rgba(255,255,255,0.08); color: white; }
    .nav-item.active { background: rgba(102,126,234,0.3); color: white; border-right: 3px solid #667eea; }
    .nav-icon { font-size: 18px; width: 24px; text-align: center; }
    .main { flex: 1; display: flex; flex-direction: column; }
    .header {
      height: 56px;
      background: white;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
    }
    .header-user { display: flex; align-items: center; gap: 12px; }
    .header-user .name { font-size: 14px; font-weight: 500; color: #333; }
    .header-user .role-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      background: #eef2ff;
      color: #667eea;
    }
    .logout-btn {
      padding: 6px 14px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
      color: #666;
      font-size: 13px;
      cursor: pointer;
    }
    .logout-btn:hover { background: #f5f5f5; }
    .content { flex: 1; padding: 24px; overflow-y: auto; }
  `;

  constructor() {
    super();
    this.activeNav = 'list';
  }

  _nav(route) {
    this.activeNav = route;
    this.dispatchEvent(new CustomEvent('navigate', { detail: { route }, bubbles: true, composed: true }));
  }

  render() {
    const roleLabel = ROLE_LABELS[this.user?.role] || '';
    return html`
      <div class="layout">
        <div class="sidebar">
          <div class="sidebar-header">
            <h2>讲师排课单</h2>
            <div class="role">${roleLabel}</div>
          </div>
          <div class="nav">
            <div class="nav-item ${this.activeNav === 'list' ? 'active' : ''}" @click=${() => this._nav('list')}>
              <span class="nav-icon">📋</span> 排课单列表
            </div>
            <div class="nav-item ${this.activeNav === 'create' ? 'active' : ''}" @click=${() => this._nav('create')}>
              <span class="nav-icon">➕</span> 新建排课单
            </div>
            <div class="nav-item ${this.activeNav === 'statistics' ? 'active' : ''}" @click=${() => this._nav('statistics')}>
              <span class="nav-icon">📊</span> 统计概览
            </div>
            <div class="nav-item ${this.activeNav === 'timeout-records' ? 'active' : ''}" @click=${() => this._nav('timeout-records')}>
              <span class="nav-icon">⏰</span> 超时记录
            </div>
          </div>
        </div>
        <div class="main">
          <div class="header">
            <div></div>
            <div class="header-user">
              <span class="name">${this.user?.display_name || ''}</span>
              <span class="role-badge">${roleLabel}</span>
              <button class="logout-btn" @click=${() => this.dispatchEvent(new CustomEvent('logout', { bubbles: true, composed: true }))}>退出</button>
            </div>
          </div>
          <div class="content">
            <slot></slot>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('app-layout', AppLayout);
