import { LitElement, html, css } from 'lit';
import { setCurrentUser, getCurrentUser, login, fetchUsers, fetchApplications, fetchDashboard, fetchQueue, triggerOverdueCheck, createApplication, batchAction } from '../services/api.js';

class AppRoot extends LitElement {
  static properties = {
    user: { type: Object },
    users: { type: Array },
    page: { type: String },
    applications: { type: Array },
    dashboard: { type: Object },
    queueStats: { type: Object },
    selectedAppId: { type: Number },
    filterRole: { type: String },
    filterStatus: { type: String },
    filterKeyword: { type: String },
    loading: { type: Boolean },
    error: { type: String },
    selectedIds: { type: Array },
    showCreateDialog: { type: Boolean },
    batchResult: { type: Object },
  };

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }
    .layout {
      display: flex;
      min-height: 100vh;
    }
    .sidebar {
      width: 240px;
      background: var(--gray-900, #111827);
      color: white;
      padding: 0;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }
    .sidebar-header {
      padding: 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .sidebar-header h1 {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.4;
    }
    .sidebar-header small {
      font-size: 12px;
      opacity: 0.6;
    }
    .user-section {
      padding: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .user-label {
      font-size: 11px;
      opacity: 0.5;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .user-select {
      width: 100%;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.1);
      color: white;
      font-size: 13px;
      cursor: pointer;
    }
    .user-select option { background: #1f2937; }
    .nav-list {
      list-style: none;
      padding: 8px;
      flex: 1;
    }
    .nav-item {
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: background 0.15s;
      margin-bottom: 2px;
    }
    .nav-item:hover { background: rgba(255,255,255,0.1); }
    .nav-item.active { background: var(--primary, #1a56db); }
    .nav-badge {
      margin-left: auto;
      background: rgba(255,255,255,0.2);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      min-width: 20px;
      text-align: center;
    }
    .nav-item.active .nav-badge { background: rgba(255,255,255,0.3); }
    .main-content {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      background: #f0f2f5;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .page-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--gray-900, #111827);
    }
    .toolbar {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search-input {
      padding: 8px 14px;
      border: 1px solid var(--gray-300, #d1d5db);
      border-radius: var(--radius, 8px);
      font-size: 13px;
      width: 240px;
      outline: none;
      transition: border-color 0.15s;
    }
    .search-input:focus { border-color: var(--primary, #1a56db); }
    .filter-select {
      padding: 8px 12px;
      border: 1px solid var(--gray-300, #d1d5db);
      border-radius: var(--radius, 8px);
      font-size: 13px;
      outline: none;
      background: white;
      cursor: pointer;
    }
    .btn {
      padding: 8px 16px;
      border-radius: var(--radius, 8px);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-primary { background: var(--primary, #1a56db); color: white; }
    .btn-primary:hover { background: var(--primary-dark, #1040a0); }
    .btn-success { background: var(--success, #059669); color: white; }
    .btn-success:hover { opacity: 0.9; }
    .btn-warning { background: var(--warning, #d97706); color: white; }
    .btn-danger { background: var(--danger, #dc2626); color: white; }
    .btn-outline {
      background: white;
      border-color: var(--gray-300, #d1d5db);
      color: var(--gray-700, #374151);
    }
    .btn-outline:hover { background: var(--gray-50, #f9fafb); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-sm { padding: 5px 10px; font-size: 12px; }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
    }
    .stat-card .stat-label {
      font-size: 12px;
      color: var(--gray-500, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-card .stat-value {
      font-size: 28px;
      font-weight: 700;
      margin-top: 4px;
    }
    .stat-card .stat-sub {
      font-size: 12px;
      color: var(--gray-500, #6b7280);
      margin-top: 4px;
    }
    .table-container {
      background: white;
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: var(--gray-50, #f9fafb);
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-500, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--gray-200, #e5e7eb);
    }
    td {
      padding: 12px 16px;
      font-size: 13px;
      border-bottom: 1px solid var(--gray-100, #f3f4f6);
      vertical-align: top;
    }
    tr:hover td { background: var(--gray-50, #f9fafb); }
    tr.overdue td { background: var(--danger-light, #fee2e2); }
    tr.overdue:hover td { background: #fdd; }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .status-草稿 { background: var(--gray-100); color: var(--gray-600); }
    .status-待审核 { background: #dbeafe; color: #1d4ed8; }
    .status-待补正 { background: var(--warning-light); color: var(--warning); }
    .status-审核中 { background: #e0e7ff; color: #4338ca; }
    .status-待复核归档 { background: #d1fae5; color: #065f46; }
    .status-复核归档中 { background: #ccfbf1; color: #0f766e; }
    .status-已办结 { background: var(--success-light); color: var(--success); }
    .status-已逾期 { background: var(--danger-light); color: var(--danger); }
    .status-已驳回 { background: #fce7f3; color: #be185d; }
    .overdue-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      background: var(--danger-light);
      color: var(--danger);
      margin-left: 6px;
    }
    .deadline-text {
      font-size: 12px;
      color: var(--gray-500);
    }
    .deadline-text.urgent { color: var(--danger); font-weight: 600; }
    .last-action {
      font-size: 12px;
      color: var(--gray-600);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .checkbox-cell { width: 40px; }
    .checkbox-cell input { cursor: pointer; }
    .action-link {
      color: var(--primary);
      cursor: pointer;
      font-weight: 500;
    }
    .action-link:hover { text-decoration: underline; }
    .error-banner {
      background: var(--danger-light);
      color: var(--danger);
      padding: 12px 16px;
      border-radius: var(--radius);
      margin-bottom: 16px;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--gray-400);
    }
    .empty-state svg { margin-bottom: 12px; }
    .empty-state p { font-size: 14px; }
    .batch-bar {
      position: sticky;
      bottom: 0;
      background: var(--gray-800);
      color: white;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      margin-top: -8px;
    }
    .batch-bar .count { font-weight: 600; }
    .login-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #1a56db 0%, #1040a0 100%);
    }
    .login-card {
      background: white;
      padding: 40px;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      width: 400px;
      text-align: center;
    }
    .login-card h2 {
      margin-bottom: 8px;
      font-size: 22px;
    }
    .login-card p {
      color: var(--gray-500);
      font-size: 14px;
      margin-bottom: 24px;
    }
    .role-cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }
    .role-card {
      padding: 16px;
      border: 2px solid var(--gray-200);
      border-radius: var(--radius);
      cursor: pointer;
      transition: all 0.15s;
      text-align: left;
    }
    .role-card:hover { border-color: var(--primary); background: var(--primary-light); }
    .role-card .role-name { font-weight: 600; font-size: 15px; }
    .role-card .role-desc { font-size: 12px; color: var(--gray-500); margin-top: 4px; }
    .detail-page { background: white; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); padding: 24px; }
    .detail-back { display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--primary); font-size: 14px; margin-bottom: 20px; }
    .detail-back:hover { text-decoration: underline; }
    .detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .detail-title { font-size: 20px; font-weight: 700; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px; }
    .detail-section { background: var(--gray-50); padding: 16px; border-radius: var(--radius); }
    .detail-section h3 { font-size: 14px; font-weight: 600; color: var(--gray-700); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--gray-200); }
    .detail-field { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .detail-field .label { color: var(--gray-500); }
    .detail-field .value { font-weight: 500; }
    .overdue-banner { background: var(--danger-light); border: 1px solid var(--danger); padding: 12px 16px; border-radius: var(--radius); margin-bottom: 16px; }
    .overdue-banner h4 { color: var(--danger); font-size: 14px; margin-bottom: 4px; }
    .overdue-banner p { font-size: 13px; color: var(--gray-700); }
    .materials-list { list-style: none; }
    .materials-list li { padding: 8px 0; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .materials-list li:last-child { border-bottom: none; }
    .mat-status { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
    .mat-submitted { background: var(--success-light); color: var(--success); }
    .mat-pending { background: var(--warning-light); color: var(--warning); }
    .action-panel { background: white; border: 2px solid var(--primary-light); border-radius: var(--radius-lg); padding: 20px; margin-top: 20px; }
    .action-panel h3 { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: var(--primary); }
    .action-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
    .opinion-input { width: 100%; padding: 10px 14px; border: 1px solid var(--gray-300); border-radius: var(--radius); font-size: 13px; resize: vertical; min-height: 60px; outline: none; margin-bottom: 12px; }
    .opinion-input:focus { border-color: var(--primary); }
    .timeline { position: relative; padding-left: 24px; }
    .timeline::before { content: ''; position: absolute; left: 8px; top: 0; bottom: 0; width: 2px; background: var(--gray-200); }
    .timeline-item { position: relative; padding-bottom: 16px; }
    .timeline-item::before { content: ''; position: absolute; left: -20px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--primary); border: 2px solid white; }
    .timeline-item .time { font-size: 11px; color: var(--gray-400); }
    .timeline-item .action-name { font-weight: 600; font-size: 13px; }
    .timeline-item .action-detail { font-size: 12px; color: var(--gray-600); }
    .tab-bar { display: flex; gap: 0; margin-bottom: 20px; border-bottom: 2px solid var(--gray-200); }
    .tab-item { padding: 10px 20px; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--gray-500); border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; }
    .tab-item:hover { color: var(--gray-700); }
    .tab-item.active { color: var(--primary); border-bottom-color: var(--primary); }
    .dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .dialog { background: white; padding: 24px; border-radius: var(--radius-lg); width: 500px; max-height: 80vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
    .dialog h3 { margin-bottom: 16px; font-size: 18px; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 13px; font-weight: 500; color: var(--gray-700); margin-bottom: 4px; }
    .form-group input, .form-group select { width: 100%; padding: 8px 12px; border: 1px solid var(--gray-300); border-radius: var(--radius); font-size: 13px; outline: none; }
    .form-group input:focus, .form-group select:focus { border-color: var(--primary); }
    .dialog-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    .loading-spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  constructor() {
    super();
    this.user = null;
    this.users = [];
    this.page = 'dashboard';
    this.applications = [];
    this.dashboard = null;
    this.queueStats = null;
    this.selectedAppId = null;
    this.filterRole = '';
    this.filterStatus = '';
    this.filterKeyword = '';
    this.loading = false;
    this.error = '';
    this.selectedIds = [];
    this.showCreateDialog = false;
  }

  async firstUpdated() {
    try {
      this.users = await fetchUsers();
    } catch (e) {
      this.error = '加载用户列表失败';
    }
  }

  async _onUserSelect(e) {
    const username = e.target.value;
    if (!username) {
      this.user = null;
      setCurrentUser(null);
      return;
    }
    try {
      this.user = await login(username);
      setCurrentUser(this.user);
      this.page = 'dashboard';
      this.error = '';
      await this._loadDashboard();
    } catch (e) {
      this.error = e.message;
    }
  }

  async _loadDashboard() {
    this.loading = true;
    try {
      this.dashboard = await fetchDashboard();
      if (this.user) {
        this.queueStats = await fetchQueue(this.user.role);
      }
    } catch (e) {
      this.error = e.message;
    }
    this.loading = false;
  }

  async _loadApplications() {
    this.loading = true;
    try {
      this.applications = await fetchApplications({
        role: this.filterRole || undefined,
        status: this.filterStatus || undefined,
        keyword: this.filterKeyword || undefined,
      });
    } catch (e) {
      this.error = e.message;
    }
    this.loading = false;
  }

  async _navigate(page) {
    this.page = page;
    this.error = '';
    this.selectedIds = [];
    if (page === 'dashboard') {
      await this._loadDashboard();
    } else if (page === 'list') {
      if (this.user && !this.filterRole) {
        this.filterRole = this.user.role;
      }
      await this._loadApplications();
    }
  }

  async _onFilterChange() {
    await this._loadApplications();
  }

  async _onSearchInput(e) {
    this.filterKeyword = e.target.value;
    await this._loadApplications();
  }

  _toggleSelect(id) {
    const idx = this.selectedIds.indexOf(id);
    if (idx >= 0) {
      this.selectedIds = this.selectedIds.filter(i => i !== id);
    } else {
      this.selectedIds = [...this.selectedIds, id];
    }
  }

  _toggleSelectAll() {
    if (this.selectedIds.length === this.applications.length) {
      this.selectedIds = [];
    } else {
      this.selectedIds = this.applications.map(a => a.id);
    }
  }

  async _onOverdueCheck() {
    try {
      const result = await triggerOverdueCheck();
      this.error = '';
      await this._loadApplications();
      alert(`逾期检测完成：检查 ${result.checked} 条，更新 ${result.updated} 条`);
    } catch (e) {
      this.error = e.message;
    }
  }

  _formatDeadline(deadline) {
    if (!deadline) return '-';
    return deadline;
  }

  _isUrgent(deadline) {
    if (!deadline) return false;
    const diff = new Date(deadline) - new Date();
    return diff < 6 * 60 * 60 * 1000;
  }

  render() {
    if (!this.user) {
      return this._renderLogin();
    }
    return html`
      <div class="layout">
        ${this._renderSidebar()}
        <div class="main-content">
          ${this.error ? html`<div class="error-banner"><span>${this.error}</span><span style="cursor:pointer" @click=${() => { this.error = ''; }}>✕</span></div>` : ''}
          ${this.page === 'dashboard' ? this._renderDashboard() : ''}
          ${this.page === 'list' ? this._renderList() : ''}
          ${this.page === 'detail' ? this._renderDetail() : ''}
          ${this.showCreateDialog ? this._renderCreateDialog() : ''}
        </div>
      </div>
    `;
  }

  _renderLogin() {
    return html`
      <div class="login-page">
        <div class="login-card">
          <h2>二手车过户登记管理系统</h2>
          <p>请选择岗位登录系统</p>
          ${this.error ? html`<div class="error-banner">${this.error}</div>` : ''}
          <div class="role-cards">
            ${this.users.map(u => html`
              <div class="role-card" @click=${async () => {
                try {
                  this.user = await login(u.username);
                  setCurrentUser(this.user);
                  this.page = 'dashboard';
                  this.error = '';
                  await this._loadDashboard();
                } catch (e) { this.error = e.message; }
              }}>
                <div class="role-name">${u.display_name}</div>
                <div class="role-desc">${u.role} — ${this._getRoleDesc(u.role)}</div>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  _getRoleDesc(role) {
    const map = {
      '登记员': '发起/补正过户申请',
      '审核主管': '审核过户申请',
      '复核负责人': '复核归档过户申请',
    };
    return map[role] || '';
  }

  _renderSidebar() {
    const queueCount = this.queueStats ? this.queueStats.total : 0;
    const overdueCount = this.dashboard ? this.dashboard.overdue_count : 0;
    return html`
      <div class="sidebar">
        <div class="sidebar-header">
          <h1>过户登记管理</h1>
          <small>二手车交易平台</small>
        </div>
        <div class="user-section">
          <div class="user-label">当前岗位</div>
          <select class="user-select" .value=${this.user?.username || ''} @change=${this._onUserSelect}>
            <option value="">切换岗位...</option>
            ${this.users.map(u => html`<option value=${u.username} ?selected=${this.user?.username === u.username}>${u.display_name} (${u.role})</option>`)}
          </select>
        </div>
        <ul class="nav-list">
          <li class="nav-item ${this.page === 'dashboard' ? 'active' : ''}" @click=${() => this._navigate('dashboard')}>
            📊 仪表盘
          </li>
          <li class="nav-item ${this.page === 'list' ? 'active' : ''}" @click=${() => this._navigate('list')}>
            📋 待办队列
            ${queueCount > 0 ? html`<span class="nav-badge">${queueCount}</span>` : ''}
          </li>
          <li class="nav-item" @click=${this._onOverdueCheck}>
            ⏰ 逾期检测
            ${overdueCount > 0 ? html`<span class="nav-badge" style="background:var(--danger-light);color:var(--danger)">${overdueCount}</span>` : ''}
          </li>
        </ul>
      </div>
    `;
  }

  _renderDashboard() {
    if (!this.dashboard) return html`<div class="loading-spinner"></div>`;
    const d = this.dashboard;
    return html`
      <div class="page-header">
        <h2 class="page-title">仪表盘 — ${this.user.display_name} (${this.user.role})</h2>
      </div>
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">总申请数</div>
          <div class="stat-value">${d.total}</div>
        </div>
        <div class="stat-card" style="border-left: 3px solid var(--danger)">
          <div class="stat-label">逾期数</div>
          <div class="stat-value" style="color: var(--danger)">${d.overdue_count}</div>
        </div>
        <div class="stat-card" style="border-left: 3px solid var(--success)">
          <div class="stat-label">已办结</div>
          <div class="stat-value" style="color: var(--success)">${d.by_status['已办结'] || 0}</div>
        </div>
        <div class="stat-card" style="border-left: 3px solid var(--primary)">
          <div class="stat-label">我的队列</div>
          <div class="stat-value" style="color: var(--primary)">${this.queueStats ? this.queueStats.total : 0}</div>
          ${this.queueStats ? html`<div class="stat-sub">${Object.entries(this.queueStats.statuses).filter(([,v]) => v > 0).map(([k,v]) => `${k}:${v}`).join(' · ')}</div>` : ''}
        </div>
      </div>
      <div class="stats-row">
        ${Object.entries(d.by_status).map(([status, count]) => html`
          <div class="stat-card" style="border-left: 3px solid ${this._statusColor(status)}">
            <div class="stat-label">${status}</div>
            <div class="stat-value" style="font-size:22px;color:${this._statusColor(status)}">${count}</div>
          </div>
        `)}
      </div>
    `;
  }

  _statusColor(status) {
    const map = {
      '草稿': '#6b7280', '待审核': '#1d4ed8', '待补正': '#d97706',
      '审核中': '#4338ca', '待复核归档': '#065f46', '复核归档中': '#0f766e',
      '已办结': '#059669', '已逾期': '#dc2626', '已驳回': '#be185d',
    };
    return map[status] || '#6b7280';
  }

  _renderBatchResult() {
    if (!this.batchResult) return '';
    const br = this.batchResult;
    return html`
      <div style="background:white;border-radius:8px;padding:16px;margin-bottom:16px;border-left:4px solid ${br.failed.length > 0 ? 'var(--danger)' : 'var(--success)'};box-shadow:var(--shadow-sm)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="font-weight:600;font-size:15px;color:var(--gray-900)">批量「${br.action}」结果</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:4px">${br.timestamp}</div>
          </div>
          <button class="btn btn-outline btn-sm" @click=${() => { this.batchResult = null; }}>关闭</button>
        </div>
        <div style="display:flex;gap:24px;margin-bottom:12px">
          <div>
            <span style="font-size:12px;color:var(--gray-500)">成功</span>
            <div style="font-size:24px;font-weight:700;color:var(--success)">${br.succeeded.length}</div>
          </div>
          <div>
            <span style="font-size:12px;color:var(--gray-500)">失败</span>
            <div style="font-size:24px;font-weight:700;color:var(--danger)">${br.failed.length}</div>
          </div>
        </div>
        ${br.failed.length > 0 ? html`
          <div style="border-top:1px solid var(--gray-200);padding-top:12px">
            <div style="font-size:13px;font-weight:600;color:var(--gray-700);margin-bottom:8px">失败分类：</div>
            ${Object.entries(br.categories).filter(([_, items]) => items.length > 0).map(([cat, items]) => html`
              <div style="margin-bottom:8px">
                <div style="font-size:12px;font-weight:500;color:var(--danger);margin-bottom:4px">
                  ${cat} (${items.length} 条)
                </div>
                <div style="font-size:12px;color:var(--gray-600);padding-left:12px">
                  ${items.map((r, i) => html`
                    <div>#${r.id}: ${r.error}</div>
                  `)}
                </div>
              </div>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderList() {
    return html`
      ${this.batchResult ? this._renderBatchResult() : ''}
      <div class="page-header">
        <h2 class="page-title">待办队列</h2>
        ${this.user?.role === '登记员' ? html`
          <button class="btn btn-primary" @click=${() => { this.showCreateDialog = true; }}>+ 发起申请</button>
        ` : ''}
      </div>
      <div class="toolbar">
        <select class="filter-select" .value=${this.filterRole} @change=${async (e) => { this.filterRole = e.target.value; await this._onFilterChange(); }}>
          <option value="">全部角色</option>
          <option value="登记员" ?selected=${this.filterRole === '登记员'}>登记员队列</option>
          <option value="审核主管" ?selected=${this.filterRole === '审核主管'}>审核主管队列</option>
          <option value="复核负责人" ?selected=${this.filterRole === '复核负责人'}>复核负责人队列</option>
        </select>
        <select class="filter-select" .value=${this.filterStatus} @change=${async (e) => { this.filterStatus = e.target.value; await this._onFilterChange(); }}>
          <option value="">全部状态</option>
          <option value="草稿">草稿</option>
          <option value="待审核">待审核</option>
          <option value="待补正">待补正</option>
          <option value="审核中">审核中</option>
          <option value="待复核归档">待复核归档</option>
          <option value="复核归档中">复核归档中</option>
          <option value="已办结">已办结</option>
          <option value="已逾期">已逾期</option>
          <option value="已驳回">已驳回</option>
        </select>
        <input class="search-input" placeholder="搜索编号/姓名/车牌..." .value=${this.filterKeyword} @input=${this._onSearchInput} />
      </div>
      ${this.loading ? html`<div class="loading-spinner"></div>` : ''}
      ${!this.loading && this.applications.length === 0 ? html`
        <div class="empty-state">
          <p>暂无过户申请</p>
        </div>
      ` : ''}
      ${this.applications.length > 0 ? html`
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th class="checkbox-cell"><input type="checkbox" ?checked=${this.selectedIds.length === this.applications.length && this.applications.length > 0} @change=${this._toggleSelectAll} /></th>
                <th>申请编号</th>
                <th>卖方/买方</th>
                <th>车牌/车型</th>
                <th>状态</th>
                <th>责任人</th>
                <th>截止时间</th>
                <th>异常原因</th>
                <th>最近处理</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${this.applications.map(app => html`
                <tr class="${app.is_overdue ? 'overdue' : ''}">
                  <td class="checkbox-cell"><input type="checkbox" ?checked=${this.selectedIds.includes(app.id)} @change=${() => this._toggleSelect(app.id)} /></td>
                  <td><span class="action-link" @click=${() => { this.selectedAppId = app.id; this.page = 'detail'; }}>${app.application_no}</span></td>
                  <td>
                    <div style="font-size:13px">${app.seller_name}</div>
                    <div style="font-size:12px;color:var(--gray-500)">→ ${app.buyer_name}</div>
                  </td>
                  <td>
                    <div style="font-size:13px">${app.vehicle_plate}</div>
                    <div style="font-size:12px;color:var(--gray-500)">${app.vehicle_brand}</div>
                  </td>
                  <td>
                    <span class="status-badge status-${app.status}">${app.status}</span>
                    ${app.is_overdue ? html`<span class="overdue-tag">逾期</span>` : ''}
                  </td>
                  <td style="font-size:13px">${app.assignee_name || '-'}</td>
                  <td>
                    <span class="deadline-text ${this._isUrgent(app.deadline_at) ? 'urgent' : ''}">${this._formatDeadline(app.deadline_at)}</span>
                  </td>
                  <td style="font-size:12px;color:var(--danger);max-width:150px;overflow:hidden;text-overflow:ellipsis">${app.overdue_reason || '-'}</td>
                  <td>
                    <div class="last-action">${app.last_action || '-'}</div>
                    ${app.last_action_result ? html`<div style="font-size:11px;color:var(--gray-400);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${app.last_action_result}</div>` : ''}
                  </td>
                  <td><button class="btn btn-outline btn-sm" @click=${() => { this.selectedAppId = app.id; this.page = 'detail'; }}>详情</button></td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      ` : ''}
      ${this.selectedIds.length > 0 ? this._renderBatchBar() : ''}
    `;
  }

  _renderBatchBar() {
    return html`
      <div class="batch-bar">
        <span class="count">已选 ${this.selectedIds.length} 项</span>
        ${this._getAvailableActions().map(action => html`
          <button class="btn btn-sm ${this._actionBtnClass(action)}" @click=${() => this._batchAction(action)}>${action}</button>
        `)}
        <button class="btn btn-sm btn-outline" style="margin-left:auto;color:white;border-color:rgba(255,255,255,0.3)" @click=${() => { this.selectedIds = []; }}>取消</button>
      </div>
    `;
  }

  _getAvailableActions() {
    if (!this.user) return [];
    const roleActions = {
      '登记员': ['提交审核', '补正提交'],
      '审核主管': ['开始审核', '审核通过', '审核驳回', '要求补正'],
      '复核负责人': ['开始复核', '复核归档', '复核退回'],
    };
    return roleActions[this.user.role] || [];
  }

  async _batchAction(action) {
    const opinion = prompt(`批量执行「${action}」，请输入处理意见：`);
    if (opinion === null) return;
    try {
      const selectedApps = this.applications.filter(a => this.selectedIds.includes(a.id));
      const result = await batchAction(selectedApps, action, opinion);
      
      const succeeded = result.results.filter(r => r.success);
      const failed = result.results.filter(r => !r.success);
      
      const categories = {
        '并发冲突': [],
        '材料缺失': [],
        '逾期拦截': [],
        '顺序错误': [],
        '其他错误': [],
      };
      
      for (const r of failed) {
        if (r.error.includes('版本冲突') || r.error.includes('并发冲突')) {
          categories['并发冲突'].push(r);
        } else if (r.error.includes('材料缺失')) {
          categories['材料缺失'].push(r);
        } else if (r.error.includes('逾期')) {
          categories['逾期拦截'].push(r);
        } else if (r.error.includes('顺序') || r.error.includes('越权')) {
          categories['顺序错误'].push(r);
        } else {
          categories['其他错误'].push(r);
        }
      }
      
      this.batchResult = {
        action,
        succeeded,
        failed,
        categories,
        timestamp: new Date().toLocaleString(),
      };
      
      this.selectedIds = [];
      await this._loadApplications();
      await this._loadDashboard();
      if (this.page === 'detail' && this.selectedAppId) {
        this.dispatchEvent(new CustomEvent('refresh', { bubbles: true, composed: true }));
      }
      this.requestUpdate();
    } catch (e) {
      this.error = e.message;
    }
  }

  _actionBtnClass(action) {
    if (['审核通过', '复核归档', '补正提交', '提交审核'].includes(action)) return 'btn-success';
    if (['审核驳回', '复核退回'].includes(action)) return 'btn-danger';
    if (['要求补正'].includes(action)) return 'btn-warning';
    return 'btn-primary';
  }

  _renderDetail() {
    return html`<app-detail .appId=${this.selectedAppId} .user=${this.user} @back=${() => this._navigate('list')} @refresh=${async () => { await this._loadDashboard(); this.page = 'list'; await this._navigate('list'); }}></app-detail>`;
  }

  _renderCreateDialog() {
    return html`
      <div class="dialog-overlay" @click=${(e) => { if (e.target === e.currentTarget) this.showCreateDialog = false; }}>
        <div class="dialog">
          <h3>发起过户申请</h3>
          <div class="form-group"><label>卖方姓名</label><input id="create-seller-name" /></div>
          <div class="form-group"><label>卖方身份证号</label><input id="create-seller-id" /></div>
          <div class="form-group"><label>买方姓名</label><input id="create-buyer-name" /></div>
          <div class="form-group"><label>买方身份证号</label><input id="create-buyer-id" /></div>
          <div class="form-group"><label>车牌号</label><input id="create-plate" /></div>
          <div class="form-group"><label>车架号</label><input id="create-vin" /></div>
          <div class="form-group"><label>品牌型号</label><input id="create-brand" /></div>
          <div class="dialog-actions">
            <button class="btn btn-outline" @click=${() => { this.showCreateDialog = false; }}>取消</button>
            <button class="btn btn-primary" @click=${this._onCreate}>提交</button>
          </div>
        </div>
      </div>
    `;
  }

  async _onCreate() {
    const data = {
      seller_name: this.shadowRoot.getElementById('create-seller-name').value,
      seller_id_no: this.shadowRoot.getElementById('create-seller-id').value,
      buyer_name: this.shadowRoot.getElementById('create-buyer-name').value,
      buyer_id_no: this.shadowRoot.getElementById('create-buyer-id').value,
      vehicle_plate: this.shadowRoot.getElementById('create-plate').value,
      vehicle_vin: this.shadowRoot.getElementById('create-vin').value,
      vehicle_brand: this.shadowRoot.getElementById('create-brand').value,
    };
    if (!data.seller_name || !data.buyer_name || !data.vehicle_plate) {
      this.error = '请填写卖方姓名、买方姓名和车牌号';
      return;
    }
    try {
      const app = await createApplication(data);
      this.showCreateDialog = false;
      this.selectedAppId = app.id;
      await this._loadDashboard();
      await this._loadApplications();
      this.page = 'detail';
      this.requestUpdate();
    } catch (e) {
      this.error = e.message;
    }
  }
}

customElements.define('app-root', AppRoot);
