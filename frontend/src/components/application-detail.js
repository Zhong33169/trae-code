import { LitElement, html, css } from 'lit';
import { api, NODE_LABELS, STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, ROLE_LABELS } from '../api.js';

export class ApplicationDetail extends LitElement {
  static properties = {
    appId: { type: Number },
    app: { type: Object },
    loading: { type: Boolean },
    user: { type: Object },
    error: { type: String },
    processData: { type: Object },
    showProcessDialog: { type: Boolean },
    currentAction: { type: String }
  };

  static styles = css`
    .back { color: #1890ff; cursor: pointer; margin-bottom: 12px; display: inline-block; font-size: 13px; }
    .back:hover { text-decoration: underline; }
    .header-card {
      background: #fff; border-radius: 6px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
    }
    .app-title { font-size: 18px; font-weight: 600; }
    .app-sub { font-size: 13px; color: #666; margin-top: 4px; }
    .status-tag { display: inline-block; padding: 4px 12px; border-radius: 4px; color: #fff; font-size: 13px; }
    .timeout-badge { background: #fff1f0; color: #f5222d; padding: 3px 8px; border-radius: 3px; font-size: 12px; margin-left: 8px; }
    .node-hint { display: inline-block; background: #e6f7ff; color: #1890ff; padding: 3px 8px; border-radius: 3px; font-size: 12px; margin-left: 8px; }
    .pending-register-hint { display: inline-block; background: #fffbe6; color: #d48806; padding: 3px 8px; border-radius: 3px; font-size: 12px; margin-left: 8px; }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { background: #fff; border-radius: 6px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 16px; }
    .card h3 { margin: 0 0 16px; font-size: 15px; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0; }
    .info-row { display: flex; padding: 7px 0; font-size: 13px; }
    .info-label { width: 110px; color: #666; flex-shrink: 0; }
    .info-value { color: #262626; flex: 1; }
    .divider { border-top: 1px dashed #f0f0f0; margin: 10px 0; }

    .timeline { position: relative; padding-left: 4px; }
    .timeline-item { position: relative; padding: 0 0 18px 24px; border-left: 2px solid #f0f0f0; }
    .timeline-item:last-child { border-left-color: transparent; }
    .timeline-dot {
      position: absolute; left: -6px; top: 0; width: 10px; height: 10px;
      background: #1890ff; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 2px #1890ff;
    }
    .timeline-item.timeout .timeline-dot { background: #f5222d; box-shadow: 0 0 0 2px #f5222d; }
    .timeline-head { font-size: 13px; color: #262626; font-weight: 500; }
    .timeline-head .timeout-tag { background: #fff1f0; color: #f5222d; padding: 1px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px; }
    .timeline-sub { font-size: 12px; color: #999; margin-top: 3px; }
    .timeline-content { font-size: 13px; color: #595959; margin-top: 6px; }
    .timeline-status { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; background: #f0f0f0; color: #595959; }

    .actions-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .btn { padding: 8px 18px; border-radius: 4px; border: 1px solid transparent; cursor: pointer; font-size: 13px; }
    .btn-primary { background: #1890ff; color: #fff; }
    .btn-primary:hover { background: #40a9ff; }
    .btn-success { background: #52c41a; color: #fff; }
    .btn-success:hover { background: #73d13d; }
    .btn-default { background: #fff; border-color: #d9d9d9; color: #333; }
    .btn-default:hover { border-color: #1890ff; color: #1890ff; }
    .btn-danger { background: #fff; border-color: #ffa39e; color: #f5222d; }
    .btn-danger:hover { background: #fff1f0; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .timeout-panel {
      background: #fff1f0; border: 1px solid #ffa39e; border-radius: 4px;
      padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: #cf1322;
    }
    .timeout-panel b { color: #f5222d; }

    .modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 99; }
    .modal { background: #fff; padding: 24px; border-radius: 6px; width: 440px; }
    .modal h3 { margin: 0 0 16px; font-size: 16px; }
    .modal .field { margin-bottom: 14px; }
    .modal label { display: block; font-size: 13px; color: #595959; margin-bottom: 6px; }
    .modal textarea { width: 100%; padding: 8px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; font-family: inherit; resize: vertical; min-height: 80px; outline: none; box-sizing: border-box; }
    .modal textarea:focus { border-color: #1890ff; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    .empty { text-align: center; padding: 60px 0; color: #999; }

    .linked-status { display: inline-flex; gap: 12px; flex-wrap: wrap; }
    .linked-tag { padding: 3px 10px; border-radius: 3px; font-size: 12px; }
    .linked-tag.done { background: #f6ffed; color: #389e0d; border: 1px solid #b7eb8f; }
    .linked-tag.pending { background: #fffbe6; color: #d48806; border: 1px solid #ffe58f; }
  `;

  constructor() {
    super();
    this.app = null;
    this.loading = true;
    this.error = '';
    this.showProcessDialog = false;
    this.processData = { remark: '', timeout_reason: '' };
  }

  getSubmitBlockReason(app) {
    if (!app) return '';
    if (!['salary_supervisor', 'hrbp_leader'].includes(app.current_node)) return '';
    const { needBudget, needSalary } = prerequisitesForType(app.type);
    if (needBudget && !app.budget_verified) return '此异动类型需要先完成【预算校验】';
    if (needSalary && !app.salary_processed) return '此异动类型需要先完成【调薪处理】';
    return '';
  }

  getRegisterBlockReason(app) {
    if (!app) return '';
    const { needBudget, needSalary } = prerequisitesForType(app.type);
    if (needBudget && !app.budget_verified) return '异动类型要求【预算校验】未完成';
    if (needSalary && !app.salary_processed) return '异动类型要求【调薪处理】未完成';
    return '';
  }

  getAllowedAction(action) {
    if (!this.app || !this.app.allowed_actions) return null;
    return this.app.allowed_actions.find(a => a.action === action) || null;
  }

  isActionAllowed(action) {
    const a = this.getAllowedAction(action);
    return a && a.allowed;
  }

  hasAnyAllowedAction() {
    if (!this.app || !this.app.allowed_actions) return false;
    return this.app.allowed_actions.some(a => a.allowed);
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  updated(changed) {
    if (changed.has('appId')) this.loadData();
  }

  async loadData() {
    if (!this.appId) return;
    this.loading = true;
    this.error = '';
    try {
      this.app = await api.getApplication(this.appId);
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  openDialog(action) {
    this.currentAction = action;
    this.processData = { remark: '', timeout_reason: this.app?.timeout_reason || '' };
    this.showProcessDialog = true;
  }

  async confirmProcess() {
    try {
      await api.processApplication(this.appId, {
        action: this.currentAction,
        remark: this.processData.remark,
        timeout_reason: this.processData.timeout_reason
      });
      this.showProcessDialog = false;
      await this.loadData();
    } catch (e) {
      alert(e.message);
    }
  }

  render() {
    if (this.loading) return html`<div class="empty">加载中...</div>`;
    if (this.error) return html`<div class="empty">${this.error}</div>`;
    if (!this.app) return html`<div class="empty">申请不存在</div>`;

    const app = this.app;
    const showTransfer = app.type !== 'salary_adjustment';
    const showSalary = app.type !== 'transfer';
    const { needBudget, needSalary } = prerequisitesForType(app.type);

    const submitBlockReason = this.getSubmitBlockReason(app);
    const registerBlockReason = this.getRegisterBlockReason(app);

    return html`
      <div class="back" @click=${() => this.dispatchEvent(new CustomEvent('back'))}>← 返回列表</div>

      ${app.is_timeout ? html`
        <div class="timeout-panel">
          ⚠️ <b>超时警告：</b>当前节点已超过 24 小时处理时限。处理节点：${NODE_LABELS[app.current_node] || app.current_node}。
          ${app.timeout_reason ? html`<br/>超时原因：${app.timeout_reason}` : html`请在推进时填写超时原因与补正动作。`}
        </div>
      ` : ''}

      ${app.status === 'approved' && this.user?.role === 'hr_specialist' && !app.registered ? html`
        <div style="background:${registerBlockReason ? '#fff1f0' : '#fffbe6'}; border:1px solid ${registerBlockReason ? '#ffa39e' : '#ffe58f'}; border-radius:4px; padding:10px 16px; margin-bottom:12px; font-size:13px; color:${registerBlockReason ? '#cf1322' : '#d48806'};">
          ${registerBlockReason ? html`⚠️ ${registerBlockReason}，暂不可进行异动登记` : html`📋 此申请已审核通过，请您进行异动登记以完成闭环`}
          ${needBudget ? html`· 预算校验：${app.budget_verified ? '✅ 已完成' : '❌ 未完成'}` : ''}
          ${needSalary ? html` · 调薪处理：${app.salary_processed ? '✅ 已完成' : '❌ 未完成'}` : ''}
        </div>
      ` : ''}

      <div class="header-card">
        <div>
          <div class="app-title">${app.application_no}
            <span class="status-tag" style="background:${STATUS_COLORS[app.status] || '#888'}">${STATUS_LABELS[app.status] || app.status}</span>
            ${app.is_timeout ? html`<span class="timeout-badge">已超时</span>` : ''}
            ${app.status === 'approved' && !app.registered ? html`<span class="pending-register-hint">待登记</span>` : ''}
            ${app.current_node && app.current_node !== 'completed' && !['synced', 'rejected'].includes(app.status) ? html`
              <span class="node-hint">当前处理：${NODE_LABELS[app.current_node]}</span>
            ` : ''}
            ${app.status === 'synced' ? html`<span class="node-hint" style="background:#f6ffed;color:#389e0d;">流程已闭环</span>` : ''}
          </div>
          <div class="app-sub">
            发起人：${app.creator?.real_name || '-'} (${app.creator ? ROLE_LABELS[app.creator.role] : ''})
            ·  创建时间：${this.formatDate(app.created_at)}
            ${app.node_deadline ? html` · 节点截止：${this.formatDate(app.node_deadline)}` : ''}
            ${app.updated_by ? html` · 最后操作人ID：${app.updated_by}` : ''}
          </div>
        </div>
        <div class="actions-bar">
          ${(app.allowed_actions || []).filter(a => a.action === 'verify_budget' || a.action === 'process_salary').map(a => html`
            <button class="btn btn-${a.button_type}" ?disabled=${!a.allowed} @click=${() => a.allowed && this.openDialog(a.action)} title=${a.allowed ? '点击执行' + a.label : a.reason}>
              ${a.allowed ? a.label : (a.reason || a.label)}
            </button>
          `)}
          ${(app.allowed_actions || []).filter(a => a.action === 'register').map(a => html`
            <button class="btn btn-${a.button_type}" ?disabled=${!a.allowed} @click=${() => a.allowed && this.openDialog(a.action)} title=${a.allowed ? '点击完成异动登记' : a.reason}>
              ${a.allowed ? a.label : (a.reason || a.label)}
            </button>
          `)}
          ${(app.allowed_actions || []).filter(a => a.action === 'submit').map(a => html`
            <button class="btn btn-${a.button_type}" ?disabled=${!a.allowed} @click=${() => a.allowed && this.openDialog(a.action)} title=${a.allowed ? '' : a.reason}>
              ${a.allowed ? a.label : a.reason}
            </button>
          `)}
          ${(app.allowed_actions || []).filter(a => a.action === 'reject' && a.allowed).map(a => html`
            <button class="btn btn-${a.button_type}" @click=${() => this.openDialog(a.action)}>
              ${a.label}
            </button>
          `)}
          ${!this.hasAnyAllowedAction() ? html`
            <span style="color:#999; font-size:13px;">
              ${['synced'].includes(app.status) ? '申请已同步，流程闭环' :
                ['rejected'].includes(app.status) ? '申请已驳回' :
                app.status === 'approved' && !app.registered && this.user?.role !== 'hr_specialist' ? '审核通过，等待人事专员登记' :
                '当前非您的处理节点'}
            </span>
          ` : ''}
          <button class="btn btn-default" @click=${() => this.loadData()}>刷新</button>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>基础信息</h3>
          <div class="info-row"><span class="info-label">员工</span><span class="info-value">${app.employee?.name || '-'} (${app.employee?.employee_no || '-'})</span></div>
          <div class="info-row"><span class="info-label">异动类型</span><span class="info-value">${TYPE_LABELS[app.type] || app.type}${app.type === 'transfer' ? '（仅调岗，无需处理调薪）' : app.type === 'salary_adjustment' ? '（仅调薪，需同时完成预算与调薪）' : '（调岗+调薪，需全部完成）'}</span></div>
          <div class="info-row"><span class="info-label">原部门/岗位</span><span class="info-value">${app.employee?.department || '-'} / ${app.employee?.position || '-'}</span></div>
          <div class="info-row"><span class="info-label">当前薪资</span><span class="info-value">${app.employee?.current_salary || 0} 元</span></div>
          <div class="divider"></div>
          <div class="info-row"><span class="info-label">推进依据</span><span class="info-value">${app.reason || '-'}</span></div>
        </div>

        <div class="card">
          <h3>异动明细</h3>
          ${showTransfer ? html`
            <div class="info-row"><span class="info-label">调岗前部门</span><span class="info-value">${app.from_department || '-'}</span></div>
            <div class="info-row"><span class="info-label">调岗后部门</span><span class="info-value">${app.to_department || '-'}</span></div>
            <div class="info-row"><span class="info-label">调岗前岗位</span><span class="info-value">${app.from_position || '-'}</span></div>
            <div class="info-row"><span class="info-label">调岗后岗位</span><span class="info-value">${app.to_position || '-'}</span></div>
            <div class="divider"></div>
          ` : ''}
          ${showSalary ? html`
            <div class="info-row"><span class="info-label">调岗前薪资</span><span class="info-value">${app.from_salary || 0} 元</span></div>
            <div class="info-row"><span class="info-label">调薪后薪资</span><span class="info-value">${app.to_salary || 0} 元</span></div>
            <div class="info-row"><span class="info-label">调薪幅度</span><span class="info-value">
              ${app.from_salary ? (((app.to_salary - app.from_salary) / app.from_salary * 100).toFixed(2) + '%') : '-'}
            </span></div>
            <div class="divider"></div>
          ` : ''}
          <div class="info-row"><span class="info-label">关联模块</span>
            <span class="info-value">
              <span class="linked-status">
                ${needBudget ? html`<span class="linked-tag ${app.budget_verified ? 'done' : 'pending'}">预算校验：${app.budget_verified ? '已完成' : '待处理'}</span>` : ''}
                ${needSalary ? html`<span class="linked-tag ${app.salary_processed ? 'done' : 'pending'}">调薪处理：${app.salary_processed ? '已完成' : '待处理'}</span>` : ''}
                <span class="linked-tag ${app.registered ? 'done' : 'pending'}">异动登记：${app.registered ? '已完成' : '待处理'}</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>处理轨迹</h3>
        <div class="timeline">
          ${(app.trails || []).length === 0 ? html`<div style="color:#999; padding:10px 0;">暂无处理记录</div>` : ''}
          ${(app.trails || []).map(t => html`
            <div class="timeline-item ${t.is_timeout ? 'timeout' : ''}">
              <div class="timeline-dot"></div>
              <div class="timeline-head">
                ${NODE_LABELS[t.node] || t.node}
                ${t.is_timeout ? html`<span class="timeout-tag">超时</span>` : ''}
                <span class="timeline-status" style="margin-left:8px;">${t.status}</span>
              </div>
              <div class="timeline-sub">
                ${t.handler_name || t.handler?.real_name || '系统'}
                ${t.handler?.role ? html` · ${ROLE_LABELS[t.handler.role] || ''}` : ''}
                · ${this.formatDate(t.created_at)}
              </div>
              <div class="timeline-content">
                <div>动作：${t.action}</div>
                ${t.remark ? html`<div>备注：${t.remark}</div>` : ''}
                ${t.timeout_reason ? html`<div style="color:#f5222d;">超时原因：${t.timeout_reason}</div>` : ''}
              </div>
            </div>
          `)}
        </div>
      </div>

      ${this.showProcessDialog ? this.renderDialog() : ''}
    `;
  }

  renderDialog() {
    const actionLabels = {
      submit: this.app?.current_node === 'hr_specialist' ? '提交审核' : this.app?.current_node === 'salary_supervisor' ? '提交确认' : '审核通过',
      reject: '驳回申请',
      verify_budget: '预算校验',
      process_salary: '调薪处理',
      register: '异动登记'
    };
    const title = actionLabels[this.currentAction] || '处理';

    return html`
      <div class="modal-mask" @click=${e => { if (e.target === e.currentTarget) this.showProcessDialog = false; }}>
        <div class="modal">
          <h3>${title}</h3>
          <div class="field">
            <label>处理备注</label>
            <textarea .value=${this.processData.remark} @input=${e => this.processData = { ...this.processData, remark: e.target.value }} placeholder="请输入备注说明（选填）"></textarea>
          </div>
          ${this.app?.is_timeout || this.currentAction === 'reject' ? html`
            <div class="field">
              <label>${this.currentAction === 'reject' ? '驳回原因' : '超时原因与补正动作'}</label>
              <textarea .value=${this.processData.timeout_reason} @input=${e => this.processData = { ...this.processData, timeout_reason: e.target.value }} placeholder="请填写原因，包含补正动作说明（必填）"></textarea>
            </div>
          ` : ''}
          <div class="modal-actions">
            <button class="btn btn-default" @click=${() => this.showProcessDialog = false}>取消</button>
            <button class="btn ${this.currentAction === 'reject' ? 'btn-danger' : this.currentAction === 'register' ? 'btn-success' : 'btn-primary'}" @click=${this.confirmProcess}>确认</button>
          </div>
        </div>
      </div>
    `;
  }

  formatDate(str) {
    if (!str) return '-';
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

customElements.define('application-detail', ApplicationDetail);
