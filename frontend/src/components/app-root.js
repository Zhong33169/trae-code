import { LitElement, html, css } from 'lit';
import { api, STATUS_LABELS, ROLE_LABELS, STATUS_COLORS } from '../api.js';

export class AppRoot extends LitElement {
  static properties = {
    currentUser: { type: Object },
    tickets: { type: Array },
    selectedTicket: { type: Object },
    filterStatus: { type: String },
    filterRole: { type: String },
    loading: { type: Boolean },
    error: { type: String },
    showDetail: { type: Boolean },
    showCreate: { type: Boolean },
    selectedIds: { type: Array },
    sideEvidence: { type: Object },
    batchResult: { type: Object },
  };

  static styles = css`
    :host { display: block; min-height: 100vh; }
    .layout { display: flex; flex-direction: column; min-height: 100vh; }
    
    .header {
      background: linear-gradient(135deg, #1a5c2a 0%, #2d8a4e 100%);
      color: white; padding: 12px 24px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      position: sticky; top: 0; z-index: 100;
    }
    .header h1 { font-size: 18px; font-weight: 600; }
    .header-right { display: flex; align-items: center; gap: 16px; }
    
    .role-switcher { display: flex; gap: 8px; }
    .role-btn {
      padding: 6px 14px; border-radius: 6px; border: 1.5px solid rgba(255,255,255,0.4);
      background: transparent; color: white; cursor: pointer; font-size: 13px;
      transition: all 0.2s;
    }
    .role-btn:hover { background: rgba(255,255,255,0.15); }
    .role-btn.active { background: rgba(255,255,255,0.25); border-color: white; font-weight: 600; }
    
    .user-badge {
      background: rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 6px;
      font-size: 13px; display: flex; align-items: center; gap: 6px;
    }
    .user-badge .role-tag {
      background: rgba(255,255,255,0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px;
    }

    .main-content { flex: 1; display: flex; padding: 16px; gap: 16px; }
    
    .ticket-panel { flex: 1; min-width: 0; }
    .evidence-panel {
      width: 340px; background: white; border-radius: 10px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden;
      flex-shrink: 0; display: flex; flex-direction: column;
    }
    .evidence-panel-header {
      background: #f8f9fa; padding: 12px 16px; font-weight: 600;
      font-size: 14px; border-bottom: 1px solid #ebeef5;
    }
    .evidence-panel-body { flex: 1; overflow-y: auto; padding: 12px 16px; }
    .evidence-empty { color: #909399; text-align: center; padding: 40px 0; font-size: 14px; }
    
    .toolbar {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .filter-select {
      padding: 8px 12px; border: 1px solid #dcdfe6; border-radius: 6px;
      font-size: 13px; background: white; cursor: pointer; min-width: 120px;
    }
    .btn {
      padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 500; transition: all 0.2s;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #1a5c2a; color: white; }
    .btn-primary:hover:not(:disabled) { background: #2d8a4e; }
    .btn-warning { background: #e6a23c; color: white; }
    .btn-warning:hover:not(:disabled) { background: #d4942e; }
    .btn-danger { background: #f56c6c; color: white; }
    .btn-danger:hover:not(:disabled) { background: #e05050; }
    .btn-success { background: #67c23a; color: white; }
    .btn-success:hover:not(:disabled) { background: #5ab830; }
    .btn-plain { background: #f0f2f5; color: #606266; border: 1px solid #dcdfe6; }
    .btn-plain:hover:not(:disabled) { background: #e8eaed; }
    .btn-sm { padding: 5px 10px; font-size: 12px; }
    
    .batch-bar {
      display: flex; align-items: center; gap: 12px; padding: 10px 16px;
      background: #ecf5ff; border-radius: 8px; margin-bottom: 12px;
      border: 1px solid #d9ecff;
    }
    .batch-bar .count { font-size: 13px; color: #409eff; font-weight: 500; }
    
    .batch-result {
      background: #fff; border: 1px solid #e4e7ed; border-radius: 8px;
      margin-bottom: 12px; overflow: hidden;
    }
    .batch-result-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px; background: #f5f7fa; border-bottom: 1px solid #e4e7ed;
      gap: 16px;
    }
    .batch-result-header .batch-title { font-size: 13px; color: #303133; font-weight: 500; }
    .batch-result-header .batch-no { color: #1a5c2a; font-weight: 600; margin: 0 6px; }
    .batch-result-header .batch-action { color: #909399; font-weight: 400; }
    .batch-result-header .batch-stats { display: flex; gap: 14px; font-size: 12px; }
    .batch-result-header .stat-total { color: #606266; }
    .batch-result-header .stat-success { color: #67c23a; font-weight: 500; }
    .batch-result-header .stat-error { color: #f56c6c; font-weight: 500; }
    .batch-result-header .batch-time { color: #909399; }
    .batch-result-header .btn-close {
      background: none; border: none; cursor: pointer; color: #909399;
      font-size: 16px; padding: 0 4px;
    }
    .batch-result-header .btn-close:hover { color: #f56c6c; }
    .batch-section { padding: 8px 16px; }
    .batch-section-title { font-size: 12px; font-weight: 500; margin-bottom: 6px; color: #606266; }
    .batch-items { display: flex; flex-direction: column; gap: 4px; }
    .batch-item {
      display: flex; align-items: center; gap: 10px; padding: 6px 10px;
      border-radius: 4px; font-size: 12px; cursor: pointer;
      transition: background 0.2s;
    }
    .batch-item:hover { background: #f5f7fa; }
    .batch-item-success { background: #f0f9f3; border: 1px solid #c7e9d0; }
    .batch-item-error { background: #fef0f0; border: 1px solid #fbc4c4; }
    .batch-item .ticket-no { font-weight: 600; color: #303133; min-width: 130px; }
    .batch-item .arrow { color: #909399; }
    .batch-item .version { color: #909399; font-size: 11px; }
    .batch-item .error-reason { color: #f56c6c; flex: 1; min-width: 0; }
    
    .ticket-list { display: flex; flex-direction: column; gap: 8px; }
    
    .ticket-card {
      background: white; border-radius: 8px; padding: 14px 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); cursor: pointer;
      border: 2px solid transparent; transition: all 0.2s;
      display: flex; align-items: center; gap: 16px;
    }
    .ticket-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); border-color: #1a5c2a33; }
    .ticket-card.selected { border-color: #1a5c2a; background: #f0f9f3; }
    
    .ticket-checkbox { flex-shrink: 0; }
    .ticket-checkbox input { width: 16px; height: 16px; cursor: pointer; accent-color: #1a5c2a; }
    
    .ticket-info { flex: 1; min-width: 0; }
    .ticket-top { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .ticket-no { font-weight: 600; font-size: 14px; color: #303133; }
    .status-badge {
      padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 500;
      color: white; white-space: nowrap;
    }
    .supplement-badge {
      background: #fdf6ec; color: #e6a23c; padding: 2px 8px;
      border-radius: 4px; font-size: 11px;
    }
    .version-badge { color: #909399; font-size: 11px; }
    .ticket-meta { display: flex; gap: 16px; font-size: 12px; color: #909399; flex-wrap: wrap; }
    .ticket-meta span { display: flex; align-items: center; gap: 4px; }
    
    .ticket-actions { display: flex; gap: 6px; flex-shrink: 0; }
    
    .evidence-section { margin-bottom: 16px; }
    .evidence-section-title {
      font-size: 13px; font-weight: 600; color: #606266;
      padding-bottom: 8px; border-bottom: 1px solid #ebeef5; margin-bottom: 8px;
      display: flex; align-items: center; gap: 6px;
    }
    .evidence-section-title .icon { font-size: 14px; }
    .evidence-item {
      padding: 8px 10px; background: #f8f9fa; border-radius: 6px;
      margin-bottom: 6px; font-size: 12px; line-height: 1.6;
    }
    .evidence-item .label { color: #909399; }
    .evidence-item .value { color: #303133; font-weight: 500; }
    
    .stats-bar {
      display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .stat-card {
      background: white; padding: 12px 20px; border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex;
      flex-direction: column; gap: 4px; min-width: 100px;
    }
    .stat-card .label { font-size: 12px; color: #909399; }
    .stat-card .number { font-size: 22px; font-weight: 700; color: #303133; }
    
    .loading-overlay {
      position: fixed; inset: 0; background: rgba(255,255,255,0.7);
      display: flex; align-items: center; justify-content: center;
      z-index: 200; font-size: 16px; color: #1a5c2a;
    }
    
    .toast {
      position: fixed; top: 20px; right: 20px; z-index: 300;
      padding: 12px 20px; border-radius: 8px; font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s;
      max-width: 400px;
    }
    .toast-error { background: #fef0f0; color: #f56c6c; border: 1px solid #fde2e2; }
    .toast-success { background: #f0f9eb; color: #67c23a; border: 1px solid #e1f3d8; }
    .toast-warning { background: #fdf6ec; color: #e6a23c; border: 1px solid #faecd8; }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  `;

  constructor() {
    super();
    this.currentUser = null;
    this.tickets = [];
    this.selectedTicket = null;
    this.filterStatus = '';
    this.filterRole = '';
    this.loading = false;
    this.error = '';
    this.showDetail = false;
    this.showCreate = false;
    this.selectedIds = [];
    this.sideEvidence = null;
    this.batchResult = null;
    this._toastTimer = null;
  }

  async firstUpdated() {
    this.loading = true;
    try {
      const res = await api.getUsers();
      if (res.data && res.data.length > 0) {
        this.currentUser = res.data[0];
      }
      await this._loadTickets();
    } catch (e) {
      this._showToast(e.message, 'error');
    }
    this.loading = false;
  }

  async _loadTickets() {
    try {
      const params = {};
      if (this.filterStatus) params.status = this.filterStatus;
      if (this.filterRole) params.role = this.filterRole;
      const res = await api.getTickets(params);
      this.tickets = res.data || [];
    } catch (e) {
      this._showToast(e.message, 'error');
    }
  }

  async _switchUser(user) {
    this.currentUser = user;
    this.selectedTicket = null;
    this.showDetail = false;
    this.selectedIds = [];
    this.sideEvidence = null;
    await this._loadTickets();
  }

  async _onFilterChange() {
    this.filterStatus = this.shadowRoot.getElementById('filterStatus')?.value || '';
    this.filterRole = this.shadowRoot.getElementById('filterRole')?.value || '';
    await this._loadTickets();
  }

  async _selectTicket(ticket) {
    try {
      const res = await api.getTicketDetail(ticket.id);
      this.selectedTicket = res.data;
      this.sideEvidence = {
        pen_inspections: res.data.pen_inspections || [],
        health_reports: res.data.health_reports || [],
        treatment_trackings: res.data.treatment_trackings || [],
      };
      this.showDetail = true;
    } catch (e) {
      this._showToast(e.message, 'error');
    }
  }

  _toggleSelect(id) {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter(i => i !== id);
    } else {
      this.selectedIds = [...this.selectedIds, id];
    }
    this.requestUpdate();
  }

  async _batchAction(action) {
    if (this.selectedIds.length === 0) return;
    if (!this.currentUser) return;
    this.loading = true;
    try {
      const versions = {};
      this.tickets.forEach(t => {
        if (this.selectedIds.includes(t.id)) versions[String(t.id)] = t.version;
      });
      const res = await api.batchAction({
        ticket_ids: this.selectedIds,
        action,
        user_id: this.currentUser.id,
        comment: '',
        versions,
      });
      const success = res.data.success || [];
      const errors = res.data.errors || [];
      this.batchResult = {
        batch_no: res.data.batch_no,
        batch_id: res.data.batch_id,
        action,
        total: this.selectedIds.length,
        success,
        errors,
        timestamp: new Date().toLocaleString('zh-CN'),
      };
      const wasSelected = this.selectedTicket ? [...this.selectedIds] : [];
      this.selectedIds = [];
      await this._loadTickets();
      if (this.selectedTicket) {
        const successIds = success.map(s => s.ticket_id);
        const errorIds = errors.map(e => e.ticket_id);
        const affectedIds = [...successIds, ...errorIds];
        if (this.selectedTicket && affectedIds.includes(this.selectedTicket.id)) {
          await this._selectTicket(this.selectedTicket);
        }
      }
      this.requestUpdate();
    } catch (e) {
      this._showToast(e.message, 'error');
    }
    this.loading = false;
  }

  async _singleAction(ticket, action) {
    if (!this.currentUser) return;
    this.loading = true;
    try {
      const res = await api.ticketAction(ticket.id, {
        action,
        user_id: this.currentUser.id,
        version: ticket.version,
        comment: '',
      });
      this._showToast(`操作成功: ${STATUS_LABELS[res.data.status]}`, 'success');
      await this._selectTicket(ticket);
      await this._loadTickets();
    } catch (e) {
      this._showToast(e.message, 'error');
    }
    this.loading = false;
  }

  _closeDetail() {
    this.showDetail = false;
    this.selectedTicket = null;
  }

  _showToast(msg, type = 'error') {
    this.error = msg;
    this._toastType = type;
    this.requestUpdate();
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.error = '';
      this.requestUpdate();
    }, 4000);
  }

  _getAvailableActions(ticket) {
    if (!this.currentUser) return [];
    const role = this.currentUser.role;
    const status = ticket.status;
    const actions = [];
    if (role === 'registrar') {
      if (status === 'draft') actions.push({ action: 'submit', label: '提交', cls: 'btn-primary' });
      if (status === 'returned') actions.push({ action: 'resubmit', label: '补正提交', cls: 'btn-warning' });
    } else if (role === 'supervisor') {
      if (status === 'submitted') actions.push({ action: 'review', label: '开始审核', cls: 'btn-primary' });
      if (status === 'under_review') {
        actions.push({ action: 'approve_review', label: '审核通过', cls: 'btn-success' });
        actions.push({ action: 'reject', label: '驳回', cls: 'btn-danger' });
        actions.push({ action: 'return', label: '退回补正', cls: 'btn-warning' });
      }
    } else if (role === 'reviewer') {
      if (status === 'reviewed') {
        actions.push({ action: 'archive', label: '复核归档', cls: 'btn-success' });
        actions.push({ action: 'return', label: '退回', cls: 'btn-warning' });
      }
    }
    return actions;
  }

  _renderHeader() {
    return html`
      <div class="header">
        <h1>🐄 畜牧养殖场-移动补录校验养殖巡检单系统</h1>
        <div class="header-right">
          <div class="role-switcher">
            ${this._renderRoleButtons()}
          </div>
          ${this.currentUser ? html`
            <div class="user-badge">
              ${this.currentUser.display_name}
              <span class="role-tag">${ROLE_LABELS[this.currentUser.role]}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _renderRoleButtons() {
    const users = [
      { username: 'zhangsan', label: '登记员' },
      { username: 'lisi', label: '审核主管' },
      { username: 'wangwu', label: '复核负责人' },
    ];
    return users.map(u => html`
      <button class="role-btn ${this.currentUser?.username === u.username ? 'active' : ''}"
        @click=${async () => {
          try {
            const res = await api.login(u.username);
            this._switchUser(res.data);
          } catch (e) {
            this._showToast(e.message, 'error');
          }
        }}>
        ${u.label}
      </button>
    `);
  }

  _renderToolbar() {
    const batchActions = this._getBatchActions();
    return html`
      <div class="toolbar">
        <select id="filterStatus" class="filter-select" @change=${this._onFilterChange}>
          <option value="">全部状态</option>
          ${Object.entries(STATUS_LABELS).map(([k, v]) => html`
            <option value="${k}" ?selected=${this.filterStatus === k}>${v}</option>
          `)}
        </select>
        <select id="filterRole" class="filter-select" @change=${this._onFilterChange}>
          <option value="">全部角色</option>
          <option value="registrar" ?selected=${this.filterRole === 'registrar'}>待登记员处理</option>
          <option value="supervisor" ?selected=${this.filterRole === 'supervisor'}>待审核主管处理</option>
          <option value="reviewer" ?selected=${this.filterRole === 'reviewer'}>待复核负责人处理</option>
        </select>
        <button class="btn btn-primary" @click=${() => { this.showCreate = true; }}>
          + 新建巡检单
        </button>
        <button class="btn btn-plain" @click=${() => this._loadTickets()}>
          🔄 刷新
        </button>
      </div>
      ${this.selectedIds.length > 0 ? html`
        <div class="batch-bar">
          <span class="count">已选择 ${this.selectedIds.length} 条</span>
          ${batchActions.map(a => html`
            <button class="btn ${a.cls} btn-sm" @click=${() => this._batchAction(a.action)}>${a.label}</button>
          `)}
          <button class="btn btn-plain btn-sm" @click=${() => { this.selectedIds = []; this.requestUpdate(); }}>取消选择</button>
        </div>
      ` : ''}
    `;
  }

  _getBatchActions() {
    if (!this.currentUser) return [];
    const role = this.currentUser.role;
    if (role === 'registrar') return [{ action: 'submit', label: '批量提交', cls: 'btn-primary' }];
    if (role === 'supervisor') return [
      { action: 'review', label: '批量开始审核', cls: 'btn-primary' },
      { action: 'approve_review', label: '批量审核通过', cls: 'btn-success' },
      { action: 'return', label: '批量退回补正', cls: 'btn-warning' },
      { action: 'reject', label: '批量驳回', cls: 'btn-danger' },
    ];
    if (role === 'reviewer') return [
      { action: 'archive', label: '批量归档', cls: 'btn-success' },
      { action: 'return', label: '批量退回', cls: 'btn-warning' },
    ];
    return [];
  }

  _renderBatchResult() {
    if (!this.batchResult) return '';
    const r = this.batchResult;
    const successCount = r.success?.length || 0;
    const errorCount = r.errors?.length || 0;
    const total = r.total || 0;
    return html`
      <div class="batch-result">
        <div class="batch-result-header">
          <div class="batch-title">
            📦 批次 <span class="batch-no">${r.batch_no}</span>
            <span class="batch-action">${this._actionLabel(r.action)}</span>
          </div>
          <div class="batch-stats">
            <span class="stat-total">共 ${total} 条</span>
            <span class="stat-success">✅ 成功 ${successCount}</span>
            <span class="stat-error">❌ 失败 ${errorCount}</span>
            <span class="batch-time">${r.timestamp}</span>
          </div>
          <button class="btn-close" @click=${() => { this.batchResult = null; this.requestUpdate(); }}>✕</button>
        </div>
        ${successCount > 0 ? html`
          <div class="batch-section">
            <div class="batch-section-title">✅ 成功 (${successCount})</div>
            <div class="batch-items">
              ${r.success.map(s => html`
                <div class="batch-item batch-item-success" @click=${() => this._selectTicket({ id: s.ticket_id })}>
                  <span class="ticket-no">${s.ticket_no}</span>
                  <span class="arrow">→</span>
                  <span class="status-badge" style="background:${STATUS_COLORS[s.new_status]}">${STATUS_LABELS[s.new_status]}</span>
                  <span class="version">v${s.new_version}</span>
                </div>
              `)}
            </div>
          </div>
        ` : ''}
        ${errorCount > 0 ? html`
          <div class="batch-section">
            <div class="batch-section-title">❌ 失败 (${errorCount})</div>
            <div class="batch-items">
              ${r.errors.map(e => html`
                <div class="batch-item batch-item-error" @click=${() => this._selectTicket({ id: e.ticket_id })}>
                  <span class="ticket-no">${e.ticket_no || e.ticket_id}</span>
                  <span class="error-reason">${e.reason}</span>
                </div>
              `)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _actionLabel(action) {
    const map = {
      submit: '提交', resubmit: '补正提交', review: '开始审核',
      approve_review: '审核通过', reject: '驳回', return: '退回',
      archive: '归档'
    };
    return map[action] || action;
  }

  _renderTicketList() {
    if (this.tickets.length === 0) {
      return html`<div style="text-align:center;padding:60px 0;color:#909399;font-size:14px;">暂无巡检单数据</div>`;
    }
    return html`
      <div class="ticket-list">
        ${this.tickets.map(t => html`
          <div class="ticket-card ${this.selectedTicket?.id === t.id ? 'selected' : ''}"
            @click=${(e) => {
              if (e.target.type !== 'checkbox') this._selectTicket(t);
            }}>
            <div class="ticket-checkbox" @click=${(e) => e.stopPropagation()}>
              <input type="checkbox" ?checked=${this.selectedIds.includes(t.id)}
                @change=${() => this._toggleSelect(t.id)} />
            </div>
            <div class="ticket-info">
              <div class="ticket-top">
                <span class="ticket-no">${t.ticket_no}</span>
                <span class="status-badge" style="background:${STATUS_COLORS[t.status]}">${STATUS_LABELS[t.status]}</span>
                ${t.supplement_count > 0 ? html`<span class="supplement-badge">补录${t.supplement_count}次</span>` : ''}
                <span class="version-badge">v${t.version}</span>
              </div>
              <div class="ticket-meta">
                <span>🏠 ${t.pen_id}</span>
                <span>🐾 ${t.animal_type} ${t.animal_count}头</span>
                <span>👤 ${t.inspector_name}</span>
                <span>📅 ${t.inspection_date}</span>
                <span>📎 证据${t.evidence_count}条</span>
              </div>
            </div>
            <div class="ticket-actions">
              ${this._getAvailableActions(t).map(a => html`
                <button class="btn ${a.cls} btn-sm" @click=${(e) => { e.stopPropagation(); this._singleAction(t, a.action); }}>${a.label}</button>
              `)}
            </div>
          </div>
        `)}
      </div>
    `;
  }

  _renderEvidencePanel() {
    if (!this.sideEvidence) {
      return html`
        <div class="evidence-panel">
          <div class="evidence-panel-header">📎 关键证据</div>
          <div class="evidence-panel-body">
            <div class="evidence-empty">选择一条巡检单查看证据</div>
          </div>
        </div>
      `;
    }
    const e = this.sideEvidence;
    return html`
      <div class="evidence-panel">
        <div class="evidence-panel-header">📎 关键证据</div>
        <div class="evidence-panel-body">
          ${e.pen_inspections.length > 0 ? html`
            <div class="evidence-section">
              <div class="evidence-section-title"><span class="icon">🏠</span> 栏舍巡检 (${e.pen_inspections.length})</div>
              ${e.pen_inspections.map(p => html`
                <div class="evidence-item">
                  <span class="label">区域:</span> <span class="value">${p.pen_area}</span>
                  | <span class="label">清洁:</span> <span class="value">${p.cleanliness === 'clean' ? '清洁' : p.cleanliness === 'acceptable' ? '可接受' : '脏污'}</span>
                  | <span class="label">通风:</span> <span class="value">${p.ventilation === 'good' ? '良好' : p.ventilation === 'fair' ? '一般' : '差'}</span>
                  ${p.temperature ? html`| <span class="label">温度:</span> <span class="value">${p.temperature}℃</span>` : ''}
                  ${p.humidity ? html`| <span class="label">湿度:</span> <span class="value">${p.humidity}%</span>` : ''}
                  ${p.notes ? html`<br/><span class="label">备注:</span> ${p.notes}` : ''}
                </div>
              `)}
            </div>
          ` : ''}
          ${e.health_reports.length > 0 ? html`
            <div class="evidence-section">
              <div class="evidence-section-title"><span class="icon">💚</span> 健康上报 (${e.health_reports.length})</div>
              ${e.health_reports.map(h => html`
                <div class="evidence-item">
                  <span class="label">标签:</span> <span class="value">${h.animal_tag}</span>
                  | <span class="label">状态:</span> <span class="value" style="color:${h.health_status === 'healthy' ? '#67c23a' : h.health_status === 'critical' ? '#f56c6c' : '#e6a23c'}">${{healthy:'健康',mild:'轻微异常',sick:'患病',critical:'危重'}[h.health_status]}</span>
                  ${h.symptoms ? html`<br/><span class="label">症状:</span> ${h.symptoms}` : ''}
                  ${h.diagnosis ? html`<br/><span class="label">诊断:</span> ${h.diagnosis}` : ''}
                </div>
              `)}
            </div>
          ` : ''}
          ${e.treatment_trackings.length > 0 ? html`
            <div class="evidence-section">
              <div class="evidence-section-title"><span class="icon">💊</span> 治疗跟踪 (${e.treatment_trackings.length})</div>
              ${e.treatment_trackings.map(t => html`
                <div class="evidence-item">
                  <span class="label">类型:</span> <span class="value">${t.treatment_type}</span>
                  ${t.medication ? html`| <span class="label">药物:</span> <span class="value">${t.medication}</span>` : ''}
                  ${t.dosage ? html`| <span class="label">剂量:</span> <span class="value">${t.dosage}</span>` : ''}
                  <br/><span class="label">执行:</span> <span class="value">${t.administered_by}</span>
                  | <span class="label">时间:</span> ${t.administered_at}
                  ${t.next_check_date ? html`<br/><span class="label">下次检查:</span> ${t.next_check_date}` : ''}
                </div>
              `)}
            </div>
          ` : ''}
          ${e.pen_inspections.length === 0 && e.health_reports.length === 0 && e.treatment_trackings.length === 0 ? html`
            <div class="evidence-empty">暂无证据</div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _renderDetail() {
    if (!this.showDetail || !this.selectedTicket) return '';
    const t = this.selectedTicket;
    return html`
      <ticket-detail
        .ticket=${t}
        .currentUser=${this.currentUser}
        @close=${this._closeDetail}
        @action=${(e) => this._singleAction(t, e.detail.action)}
        @refresh=${() => { this._selectTicket(t); this._loadTickets(); }}
        @toast=${(e) => this._showToast(e.detail.msg, e.detail.type)}
      ></ticket-detail>
    `;
  }

  _renderCreate() {
    if (!this.showCreate) return '';
    return html`
      <ticket-create
        .currentUser=${this.currentUser}
        @close=${() => { this.showCreate = false; }}
        @created=${() => { this.showCreate = false; this._loadTickets(); }}
        @toast=${(e) => this._showToast(e.detail.msg, e.detail.type)}
      ></ticket-create>
    `;
  }

  _renderToast() {
    if (!this.error) return '';
    return html`<div class="toast toast-${this._toastType || 'error'}">${this.error}</div>`;
  }

  render() {
    return html`
      <div class="layout">
        ${this._renderHeader()}
        <div class="main-content">
          <div class="ticket-panel">
            ${this._renderToolbar()}
            ${this._renderBatchResult()}
            ${this._renderTicketList()}
          </div>
          ${this._renderEvidencePanel()}
        </div>
        ${this._renderDetail()}
        ${this._renderCreate()}
        ${this.loading ? html`<div class="loading-overlay">加载中...</div>` : ''}
        ${this._renderToast()}
      </div>
    `;
  }
}

customElements.define('app-root', AppRoot);
