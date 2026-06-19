import { LitElement, html, css } from 'lit';
import { api, NODE_LABELS, STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, ROLE_LABELS,
  canPerformAction, actionPermissionError, prerequisitesForType } from '../api.js';

export class ApplicationList extends LitElement {
  static properties = {
    applications: { type: Array },
    filtered: { type: Array },
    loading: { type: Boolean },
    status: { type: String },
    search: { type: String },
    selected: { type: Object },
    user: { type: Object },
    showBatch: { type: Boolean },
    batchResult: { type: Object }
  };

  static styles = css`
    .card { background: #fff; border-radius: 6px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .toolbar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
    .toolbar input, .toolbar select {
      padding: 7px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; outline: none; min-width: 160px;
    }
    .toolbar input:focus, .toolbar select:focus { border-color: #1890ff; }
    .toolbar .spacer { flex: 1; }
    .btn {
      padding: 7px 16px; border-radius: 4px; border: 1px solid transparent; cursor: pointer;
      font-size: 13px; transition: all 0.2s;
    }
    .btn-primary { background: #1890ff; color: #fff; }
    .btn-primary:hover { background: #40a9ff; }
    .btn-default { background: #fff; border-color: #d9d9d9; color: #333; }
    .btn-default:hover { border-color: #1890ff; color: #1890ff; }
    .btn-danger { background: #fff; border-color: #ffa39e; color: #f5222d; }
    .btn-danger:hover { background: #fff1f0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid #f0f0f0; }
    th { background: #fafafa; font-weight: 600; color: #262626; }
    tr:hover td { background: #fafcff; }
    .status-tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; color: #fff; }
    .timeout-tag { display: inline-block; padding: 2px 6px; border-radius: 3px; background: #fff1f0; color: #f5222d; font-size: 11px; margin-left: 6px; }
    .link { color: #1890ff; cursor: pointer; }
    .link:hover { text-decoration: underline; }
    .empty { text-align: center; padding: 60px 0; color: #999; }
    .check-wrap { display: inline-flex; align-items: center; gap: 8px; }
    .batch-bar {
      display: flex; gap: 12px; align-items: center; padding: 10px 16px;
      background: #e6f7ff; border-radius: 4px; margin-bottom: 12px; font-size: 13px;
    }
    .batch-bar .count { color: #1890ff; font-weight: 600; }
    .checkbox { width: 16px; height: 16px; min-width: 16px; cursor: pointer; }
    .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 99; }
    .modal { background: #fff; padding: 24px; border-radius: 6px; width: 420px; box-shadow: 0 6px 24px rgba(0,0,0,0.15); }
    .modal h3 { margin: 0 0 16px; font-size: 16px; }
    .modal .field { margin-bottom: 14px; }
    .modal label { display: block; font-size: 13px; color: #595959; margin-bottom: 6px; }
    .modal select, .modal textarea {
      width: 100%; padding: 8px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; outline: none; font-family: inherit;
    }
    .modal textarea { resize: vertical; min-height: 70px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
    .result-tip { padding: 10px; border-radius: 4px; background: #f6ffed; color: #389e0d; font-size: 13px; margin-bottom: 12px; }
  `;

  constructor() {
    super();
    this.applications = [];
    this.filtered = [];
    this.loading = true;
    this.status = '';
    this.search = '';
    this.selected = {};
    this.showBatch = false;
    this.batchResult = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  willUpdate(changed) {
    if (changed.has('applications') || changed.has('status') || changed.has('search')) {
      this.applyFilter();
    }
  }

  applyFilter() {
    this.filtered = this.applications.filter(app => {
      if (this.status && app.status !== this.status) return false;
      if (this.search) {
        const s = this.search.toLowerCase();
        return app.application_no.toLowerCase().includes(s) ||
          (app.employee?.name || '').toLowerCase().includes(s) ||
          (app.reason || '').toLowerCase().includes(s);
      }
      return true;
    });
  }

  async loadData() {
    this.loading = true;
    try {
      this.applications = await api.listApplications();
    } catch (e) {
      alert(e.message);
    } finally {
      this.loading = false;
    }
  }

  get selectedCount() {
    return Object.values(this.selected).filter(Boolean).length;
  }

  get selectedIds() {
    return this.applications.filter(a => this.selected[a.id]).map(a => a.id);
  }

  toggleAll() {
    const allSelected = this.filtered.every(a => this.selected[a.id]);
    const next = {};
    if (allSelected) {
      Object.keys(this.selected).forEach(k => { if (!this.filtered.find(f => f.id == k)) next[k] = true; });
    } else {
      Object.assign(next, this.selected);
      this.filtered.forEach(a => { next[a.id] = true; });
    }
    this.selected = next;
  }

  toggleOne(id) {
    const next = { ...this.selected };
    next[id] = !next[id];
    this.selected = next;
  }

  canBatchAction(action) {
    if (!this.user || this.selectedCount === 0) return false;
    const role = this.user.role;
    return this.selectedIds.every(id => {
      const app = this.applications.find(a => a.id === id);
      if (!app) return false;
      if (!canPerformAction(app.type, app.status, app.current_node, role, action)) return false;
      if ((action === 'submit' && ['salary_supervisor', 'hrbp_leader'].includes(app.current_node)) || action === 'register') {
        const { needBudget, needSalary } = prerequisitesForType(app.type);
        if (needBudget && !app.budget_verified) return false;
        if (needSalary && !app.salary_processed) return false;
      }
      if (action === 'register' && app.registered) return false;
      if (action === 'verify_budget' && app.budget_verified) return false;
      if (action === 'process_salary' && app.salary_processed) return false;
      return true;
    });
  }

  openBatchDialog() {
    this.batchResult = null;
    this.showBatch = true;
    this._batchAction = 'submit';
    this._batchRemark = '';
    this._batchTimeout = '';
  }

  async confirmBatch() {
    if (!this._batchAction) return;
    try {
      const result = await api.batchProcess({
        ids: this.selectedIds,
        action: this._batchAction,
        remark: this._batchRemark,
        timeout_reason: this._batchTimeout
      });
      this.batchResult = result;
      this.selected = {};
      this.showBatch = false;
      this.loadData();
    } catch (e) {
      alert(e.message);
    }
  }

  render() {
    const statusOptions = [
      { value: '', label: '全部状态' },
      { value: 'pending_review', label: STATUS_LABELS.pending_review },
      { value: 'budget_checking', label: STATUS_LABELS.budget_checking },
      { value: 'pending_confirm', label: STATUS_LABELS.pending_confirm },
      { value: 'approved', label: STATUS_LABELS.approved },
      { value: 'synced', label: STATUS_LABELS.synced },
      { value: 'rejected', label: STATUS_LABELS.rejected },
    ];

    const allChecked = this.filtered.length > 0 && this.filtered.every(a => this.selected[a.id]);

    return html`
      <div class="card">
        ${this.batchResult ? html`<div class="result-tip">批量操作结果：成功 ${this.batchResult.success_count} 条，失败 ${this.batchResult.fail_count} 条</div>` : ''}
        ${this.selectedCount > 0 ? html`
          <div class="batch-bar">
            <span>已选择 <span class="count">${this.selectedCount}</span> 项</span>
            ${this.canBatchAction('submit') ? html`<button class="btn btn-primary" @click=${() => { this._batchAction = 'submit'; this.showBatch = true; }}>批量提交</button>` : ''}
            ${this.canBatchAction('register') ? html`<button class="btn btn-success" @click=${() => { this._batchAction = 'register'; this.showBatch = true; }}>批量异动登记</button>` : ''}
            ${this.canBatchAction('verify_budget') ? html`<button class="btn btn-default" @click=${() => { this._batchAction = 'verify_budget'; this.showBatch = true; }}>批量预算校验</button>` : ''}
            ${this.canBatchAction('process_salary') ? html`<button class="btn btn-default" @click=${() => { this._batchAction = 'process_salary'; this.showBatch = true; }}>批量调薪处理</button>` : ''}
            <button class="btn btn-default" @click=${() => this.selected = {}}>取消选择</button>
          </div>
        ` : ''}

        <div class="toolbar">
          <input placeholder="搜索申请编号 / 员工 / 原因" .value=${this.search} @input=${e => this.search = e.target.value} />
          <select .value=${this.status} @change=${e => this.status = e.target.value}>
            ${statusOptions.map(o => html`<option value=${o.value}>${o.label}</option>`)}
          </select>
          <div class="spacer"></div>
          <button class="btn btn-default" @click=${() => this.loadData()}>刷新</button>
          ${this.user?.role === 'hr_specialist' ? html`<button class="btn btn-primary" @click=${() => this.dispatchEvent(new CustomEvent('navigate', { detail: '/create' }))}>+ 发起申请</button>` : ''}
        </div>

        ${this.loading ? html`<div class="empty">加载中...</div>` :
          this.filtered.length === 0 ? html`<div class="empty">暂无数据</div>` : html`
          <table>
            <thead>
              <tr>
                <th style="width:36px"><input type="checkbox" class="checkbox" .checked=${allChecked} @change=${this.toggleAll} /></th>
                <th>申请编号</th>
                <th>员工</th>
                <th>类型</th>
                <th>异动信息</th>
                <th>当前状态</th>
                <th>当前节点</th>
                <th>超时</th>
                <th>发起人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${this.filtered.map(app => html`
                <tr>
                  <td><input type="checkbox" class="checkbox" .checked=${!!this.selected[app.id]} @change=${() => this.toggleOne(app.id)} /></td>
                  <td><span class="link" @click=${() => this.dispatchEvent(new CustomEvent('navigate', { detail: '/detail/' + app.id }))}>${app.application_no}</span></td>
                  <td>${app.employee?.name || '-'} (${app.employee?.employee_no || '-'})</td>
                  <td>${TYPE_LABELS[app.type] || app.type}</td>
                  <td>
                    ${app.type !== 'salary_adjustment' ? html`${app.from_department || '-'} → ${app.to_department || '-'}<br/>` : ''}
                    ${app.type !== 'transfer' ? html`${app.from_salary || 0} → ${app.to_salary || 0}` : ''}
                  </td>
                  <td><span class="status-tag" style="background:${STATUS_COLORS[app.status] || '#888'}">${STATUS_LABELS[app.status] || app.status}</span></td>
                  <td>${NODE_LABELS[app.current_node] || app.current_node}</td>
                  <td>${app.is_timeout ? html`<span class="timeout-tag">已超时</span>` : '正常'}</td>
                  <td>${app.creator?.real_name || '-'}</td>
                  <td>${this.formatDate(app.created_at)}</td>
                  <td><span class="link" @click=${() => this.dispatchEvent(new CustomEvent('navigate', { detail: '/detail/' + app.id }))}>详情</span></td>
                </tr>
              `)}
            </tbody>
          </table>
        `}
      </div>

      ${this.showBatch ? this.renderBatchModal() : ''}
    `;
  }

  renderBatchModal() {
    const actions = [];
    if (this.user?.role === 'hr_specialist') {
      actions.push({ value: 'submit', label: '提交审核' });
      actions.push({ value: 'register', label: '异动登记' });
    }
    if (this.user?.role === 'salary_supervisor') {
      actions.push({ value: 'submit', label: '提交审核' });
      actions.push({ value: 'verify_budget', label: '预算校验' });
      actions.push({ value: 'process_salary', label: '调薪处理' });
    }
    if (this.user?.role === 'hrbp_leader') {
      actions.push({ value: 'submit', label: '审核通过' });
    }

    const ruleTip = this.getBatchRuleTip();

    return html`
      <div class="modal-mask" @click=${e => { if (e.target === e.currentTarget) this.showBatch = false; }}>
        <div class="modal">
          <h3>批量操作 (${this.selectedCount} 项)</h3>
          ${ruleTip ? html`<div style="background:#fffbe6; border:1px solid #ffe58f; border-radius:4px; padding:8px 12px; font-size:12px; color:#d48806; margin-bottom:12px;">${ruleTip}</div>` : ''}
          <div class="field">
            <label>操作类型</label>
            <select .value=${this._batchAction} @change=${e => this._batchAction = e.target.value}>
              ${actions.map(a => html`<option value=${a.value}>${a.label}</option>`)}
            </select>
          </div>
          <div class="field">
            <label>备注</label>
            <textarea .value=${this._batchRemark || ''} @input=${e => this._batchRemark = e.target.value} placeholder="选填"></textarea>
          </div>
          <div class="field">
            <label>异常原因 / 补正动作</label>
            <textarea .value=${this._batchTimeout || ''} @input=${e => this._batchTimeout = e.target.value} placeholder="选填；若存在超时节点、或推进原因需说明，请填写异常原因与补正动作，将记录到审计轨迹"></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn btn-default" @click=${() => this.showBatch = false}>取消</button>
            <button class="btn btn-primary" @click=${this.confirmBatch}>确认</button>
          </div>
        </div>
      </div>
    `;
  }

  getBatchRuleTip() {
    const role = this.user?.role;
    const action = this._batchAction;
    if (action === 'submit' && ['salary_supervisor', 'hrbp_leader'].includes(role)) {
      return '前置规则：调岗类需先完成预算校验；调薪/调岗调薪类需同时完成预算校验 + 调薪处理；否则对应项将在结果中标记为失败。';
    }
    if (action === 'register' && role === 'hr_specialist') {
      return '前置规则：异动登记前需按异动类型完成对应模块（预算校验/调薪处理），否则对应项将标记为失败。';
    }
    return '';
  }

  formatDate(str) {
    if (!str) return '-';
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

customElements.define('application-list', ApplicationList);
