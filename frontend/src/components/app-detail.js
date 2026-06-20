import { LitElement, html, css } from 'lit';
import { fetchApplication, executeAction, fetchCorrections, fetchProcessRecords, fetchAuditLogs } from '../services/api.js';

class AppDetail extends LitElement {
  static properties = {
    appId: { type: Number },
    user: { type: Object },
    app: { type: Object },
    corrections: { type: Array },
    processRecords: { type: Array },
    auditLogs: { type: Array },
    activeTab: { type: String },
    loading: { type: Boolean },
    error: { type: String },
    actionOpinion: { type: String },
    materialsEdit: { type: Array },
    correctionMaterialsEdit: { type: Array },
  };

  static styles = css`
    :host { display: block; }
    .detail-page { background: white; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); padding: 24px; }
    .detail-back { display: flex; align-items: center; gap: 6px; cursor: pointer; color: #1a56db; font-size: 14px; margin-bottom: 20px; }
    .detail-back:hover { text-decoration: underline; }
    .detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .detail-title { font-size: 20px; font-weight: 700; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 24px; }
    .detail-section { background: #f9fafb; padding: 16px; border-radius: 8px; }
    .detail-section h3 { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    .detail-field { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .detail-field .label { color: #6b7280; }
    .detail-field .value { font-weight: 500; }
    .overdue-banner { background: #fee2e2; border: 1px solid #dc2626; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
    .overdue-banner h4 { color: #dc2626; font-size: 14px; margin-bottom: 4px; }
    .overdue-banner p { font-size: 13px; color: #374151; }
    .tab-bar { display: flex; gap: 0; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .tab-item { padding: 10px 20px; cursor: pointer; font-size: 14px; font-weight: 500; color: #6b7280; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; }
    .tab-item:hover { color: #374151; }
    .tab-item.active { color: #1a56db; border-bottom-color: #1a56db; }
    .materials-list { list-style: none; padding: 0; }
    .materials-list li { padding: 8px 0; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
    .materials-list li:last-child { border-bottom: none; }
    .mat-status { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
    .mat-submitted { background: #d1fae5; color: #059669; }
    .mat-pending { background: #fef3c7; color: #d97706; }
    .mat-toggle { cursor: pointer; padding: 3px 10px; border-radius: 4px; font-size: 12px; border: 1px solid #d1d5db; background: white; transition: all 0.15s; }
    .mat-toggle:hover { background: #f3f4f6; }
    .mat-toggle.active { background: #059669; color: white; border-color: #059669; }
    .action-panel { background: white; border: 2px solid #e8edff; border-radius: 12px; padding: 20px; margin-top: 20px; }
    .action-panel h3 { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #1a56db; }
    .action-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
    .btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary { background: #1a56db; color: white; }
    .btn-primary:hover { background: #1040a0; }
    .btn-success { background: #059669; color: white; }
    .btn-success:hover { opacity: 0.9; }
    .btn-warning { background: #d97706; color: white; }
    .btn-danger { background: #dc2626; color: white; }
    .btn-outline { background: white; border-color: #d1d5db; color: #374151; }
    .btn-outline:hover { background: #f9fafb; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .opinion-input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; resize: vertical; min-height: 60px; outline: none; margin-bottom: 12px; }
    .opinion-input:focus { border-color: #1a56db; }
    .timeline { position: relative; padding-left: 24px; }
    .timeline::before { content: ''; position: absolute; left: 8px; top: 0; bottom: 0; width: 2px; background: #e5e7eb; }
    .timeline-item { position: relative; padding-bottom: 16px; }
    .timeline-item::before { content: ''; position: absolute; left: -20px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: #1a56db; border: 2px solid white; }
    .timeline-item .time { font-size: 11px; color: #9ca3af; }
    .timeline-item .action-name { font-weight: 600; font-size: 13px; }
    .timeline-item .action-detail { font-size: 12px; color: #6b7280; }
    .error-banner { background: #fee2e2; color: #dc2626; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .status-草稿 { background: #f3f4f6; color: #4b5563; }
    .status-待审核 { background: #dbeafe; color: #1d4ed8; }
    .status-待补正 { background: #fef3c7; color: #d97706; }
    .status-审核中 { background: #e0e7ff; color: #4338ca; }
    .status-待复核归档 { background: #d1fae5; color: #065f46; }
    .status-复核归档中 { background: #ccfbf1; color: #0f766e; }
    .status-已办结 { background: #d1fae5; color: #059669; }
    .status-已逾期 { background: #fee2e2; color: #dc2626; }
    .status-已驳回 { background: #fce7f3; color: #be185d; }
    .audit-row { padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
    .audit-row:last-child { border-bottom: none; }
    .audit-time { color: #9ca3af; font-size: 11px; }
    .correction-card { background: #fef3c7; border: 1px solid #d97706; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .correction-card h4 { font-size: 13px; color: #d97706; margin-bottom: 8px; }
    .version-hint { font-size: 11px; color: #9ca3af; }
  `;

  constructor() {
    super();
    this.app = null;
    this.corrections = [];
    this.processRecords = [];
    this.auditLogs = [];
    this.activeTab = 'info';
    this.loading = false;
    this.error = '';
    this.actionOpinion = '';
    this.materialsEdit = [];
    this.correctionMaterialsEdit = [];
  }

  async updated(changed) {
    if (changed.has('appId') && this.appId) {
      await this._loadData();
    }
  }

  async _loadData() {
    this.loading = true;
    this.error = '';
    try {
      this.app = await fetchApplication(this.appId);
      this.materialsEdit = [...this.app.materials];
      this.correctionMaterialsEdit = this.app.materials.filter(m => m.category === 'correction');
      this.corrections = await fetchCorrections(this.appId);
      this.processRecords = await fetchProcessRecords(this.appId);
      this.auditLogs = await fetchAuditLogs(this.appId);
    } catch (e) {
      this.error = e.message;
    }
    this.loading = false;
  }

  async _executeAction(action) {
    if (!this.app) return;

    const needsOpinion = ['审核通过', '审核驳回', '要求补正', '复核归档', '复核退回', '补正提交'].includes(action);
    if (needsOpinion && !this.actionOpinion.trim()) {
      this.error = `执行「${action}」必须填写处理意见`;
      return;
    }

    this.loading = true;
    this.error = '';
    try {
      const materialsPayload = this.materialsEdit.map(m => ({
        id: m.id,
        name: m.name,
        is_required: m.is_required,
        is_submitted: m.is_submitted,
        remarks: m.remarks,
        category: m.category,
      }));
      const correctionPayload = this.correctionMaterialsEdit.map(m => ({
        id: m.id,
        name: m.name,
        is_required: m.is_required,
        is_submitted: m.is_submitted,
        remarks: m.remarks,
        category: m.category,
      }));

      await executeAction(
        this.appId,
        action,
        this.actionOpinion,
        materialsPayload,
        correctionPayload,
        this.app.version,
      );
      this.actionOpinion = '';
      await this._loadData();
      this.dispatchEvent(new CustomEvent('refresh'));
    } catch (e) {
      this.error = e.message;
    }
    this.loading = false;
  }

  _toggleMaterial(index, isCorrection = false) {
    if (isCorrection) {
      const updated = [...this.correctionMaterialsEdit];
      updated[index] = { ...updated[index], is_submitted: !updated[index].is_submitted };
      this.correctionMaterialsEdit = updated;
      const mainIdx = this.materialsEdit.findIndex(m => m.id === updated[index].id);
      if (mainIdx >= 0) {
        const mainUpdated = [...this.materialsEdit];
        mainUpdated[mainIdx] = { ...mainUpdated[mainIdx], is_submitted: updated[index].is_submitted };
        this.materialsEdit = mainUpdated;
      }
    } else {
      const updated = [...this.materialsEdit];
      updated[index] = { ...updated[index], is_submitted: !updated[index].is_submitted };
      this.materialsEdit = updated;
    }
  }

  _canPerformAction(action) {
    if (!this.user || !this.app) return false;
    const roleActions = {
      '登记员': ['发起申请', '提交审核', '补正提交'],
      '审核主管': ['开始审核', '审核通过', '审核驳回', '要求补正'],
      '复核负责人': ['开始复核', '复核归档', '复核退回'],
    };
    return (roleActions[this.user.role] || []).includes(action);
  }

  _getAvailableActions() {
    if (!this.user || !this.app) return [];
    const roleActions = {
      '登记员': ['提交审核', '补正提交'],
      '审核主管': ['开始审核', '审核通过', '审核驳回', '要求补正'],
      '复核负责人': ['开始复核', '复核归档', '复核退回'],
    };
    return (roleActions[this.user.role] || []).filter(a => {
      if (this.app.status === '已办结') return false;
      if (this.app.status === '已驳回') return a === '发起申请';
      return true;
    });
  }

  render() {
    if (this.loading && !this.app) return html`<div style="padding:40px;text-align:center"><div class="loading-spinner" style="display:inline-block;width:24px;height:24px;border:3px solid #e5e7eb;border-top-color:#1a56db;border-radius:50%;animation:spin 0.6s linear infinite"></div></div>`;
    if (!this.app) return html`<div style="padding:40px;text-align:center;color:#9ca3af">请选择过户申请</div>`;

    return html`
      <div class="detail-page">
        <div class="detail-back" @click=${() => this.dispatchEvent(new CustomEvent('back'))}>← 返回列表</div>

        ${this.error ? html`<div class="error-banner">${this.error}</div>` : ''}

        <div class="detail-header">
          <div>
            <div class="detail-title">${this.app.application_no}</div>
            <span class="status-badge status-${this.app.status}">${this.app.status}</span>
            <span class="version-hint"> · 版本 v${this.app.version}</span>
          </div>
        </div>

        ${(this.app.overdue_reason || this.app.is_overdue_flag) ? html`
          <div class="overdue-banner">
            <h4>⚠ 逾期预警</h4>
            <p><strong>原因：</strong>${this.app.overdue_reason || '超过处理时限'}</p>
            ${this.app.overdue_action ? html`<p><strong>后续动作：</strong>${this.app.overdue_action}</p>` : ''}
          </div>
        ` : ''}

        <div class="tab-bar">
          <div class="tab-item ${this.activeTab === 'info' ? 'active' : ''}" @click=${() => { this.activeTab = 'info'; }}>基本信息</div>
          <div class="tab-item ${this.activeTab === 'materials' ? 'active' : ''}" @click=${() => { this.activeTab = 'materials'; }}>过户材料</div>
          <div class="tab-item ${this.activeTab === 'corrections' ? 'active' : ''}" @click=${() => { this.activeTab = 'corrections'; }}>补正记录</div>
          <div class="tab-item ${this.activeTab === 'process' ? 'active' : ''}" @click=${() => { this.activeTab = 'process'; }}>处理记录</div>
          <div class="tab-item ${this.activeTab === 'audit' ? 'active' : ''}" @click=${() => { this.activeTab = 'audit'; }}>审计日志</div>
        </div>

        ${this.activeTab === 'info' ? this._renderInfo() : ''}
        ${this.activeTab === 'materials' ? this._renderMaterials() : ''}
        ${this.activeTab === 'corrections' ? this._renderCorrections() : ''}
        ${this.activeTab === 'process' ? this._renderProcess() : ''}
        ${this.activeTab === 'audit' ? this._renderAudit() : ''}

        ${this._getAvailableActions().length > 0 ? this._renderActionPanel() : ''}
      </div>
    `;
  }

  _renderInfo() {
    const app = this.app;
    return html`
      <div class="detail-grid">
        <div class="detail-section">
          <h3>卖方信息</h3>
          <div class="detail-field"><span class="label">姓名</span><span class="value">${app.seller_name}</span></div>
          <div class="detail-field"><span class="label">身份证号</span><span class="value">${app.seller_id_no}</span></div>
        </div>
        <div class="detail-section">
          <h3>买方信息</h3>
          <div class="detail-field"><span class="label">姓名</span><span class="value">${app.buyer_name}</span></div>
          <div class="detail-field"><span class="label">身份证号</span><span class="value">${app.buyer_id_no}</span></div>
        </div>
        <div class="detail-section">
          <h3>车辆信息</h3>
          <div class="detail-field"><span class="label">车牌号</span><span class="value">${app.vehicle_plate}</span></div>
          <div class="detail-field"><span class="label">车架号</span><span class="value">${app.vehicle_vin}</span></div>
          <div class="detail-field"><span class="label">品牌型号</span><span class="value">${app.vehicle_brand}</span></div>
        </div>
        <div class="detail-section">
          <h3>流程状态</h3>
          <div class="detail-field"><span class="label">当前状态</span><span class="value"><span class="status-badge status-${app.status}">${app.status}</span></span></div>
          <div class="detail-field"><span class="label">当前责任人</span><span class="value">${app.assignee_name || '-'}</span></div>
          <div class="detail-field"><span class="label">截止时间</span><span class="value" style="${this._isDeadlineUrgent(app.deadline_at) ? 'color:#dc2626;font-weight:600' : ''}">${app.deadline_at || '无'}</span></div>
          <div class="detail-field"><span class="label">创建时间</span><span class="value">${app.created_at}</span></div>
          <div class="detail-field"><span class="label">最后更新</span><span class="value">${app.updated_at}</span></div>
          ${app.last_action ? html`<div class="detail-field"><span class="label">最近操作</span><span class="value">${app.last_action}: ${app.last_action_result || '无意见'}</span></div>` : ''}
        </div>
      </div>
    `;
  }

  _isDeadlineUrgent(deadline) {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  }

  _renderMaterials() {
    const transferMats = this.materialsEdit.filter(m => m.category === 'transfer');
    const correctionMats = this.materialsEdit.filter(m => m.category === 'correction');
    const canEdit = this.user?.role === '登记员' && ['草稿', '待补正'].includes(this.app?.status);

    return html`
      <div class="detail-section" style="margin-bottom:16px">
        <h3>过户资料 (${transferMats.length}项)</h3>
        <ul class="materials-list">
          ${transferMats.map((m, i) => html`
            <li>
              <span>${m.name} ${m.is_required ? html`<span style="color:#dc2626">*</span>` : ''}</span>
              ${canEdit ? html`
                <button class="mat-toggle ${m.is_submitted ? 'active' : ''}" @click=${() => this._toggleMaterial(this.materialsEdit.indexOf(m))}>
                  ${m.is_submitted ? '已提交' : '未提交'}
                </button>
              ` : html`
                <span class="mat-status ${m.is_submitted ? 'mat-submitted' : 'mat-pending'}">${m.is_submitted ? '已提交' : '未提交'}</span>
              `}
            </li>
          `)}
        </ul>
        ${transferMats.some(m => m.is_required && !m.is_submitted) ? html`
          <div style="margin-top:12px;padding:8px 12px;background:#fef3c7;border-radius:6px;font-size:12px;color:#d97706">
            ⚠ 必交材料未提交将无法推进过户申请
          </div>
        ` : ''}
      </div>
      ${correctionMats.length > 0 ? html`
        <div class="detail-section">
          <h3>补正材料 (${correctionMats.length}项)</h3>
          <ul class="materials-list">
            ${correctionMats.map((m, i) => html`
              <li>
                <span>${m.name} <span style="color:#dc2626">*</span></span>
                ${canEdit ? html`
                  <button class="mat-toggle ${m.is_submitted ? 'active' : ''}" @click=${() => this._toggleMaterial(this.materialsEdit.indexOf(m), true)}>
                    ${m.is_submitted ? '已提交' : '未提交'}
                  </button>
                ` : html`
                  <span class="mat-status ${m.is_submitted ? 'mat-submitted' : 'mat-pending'}">${m.is_submitted ? '已提交' : '未提交'}</span>
                `}
              </li>
            `)}
          </ul>
        </div>
      ` : ''}
    `;
  }

  _renderCorrections() {
    if (this.corrections.length === 0) {
      return html`<div style="text-align:center;padding:40px;color:#9ca3af">暂无补正记录</div>`;
    }
    return html`
      ${this.corrections.map(c => html`
        <div class="correction-card">
          <h4>${c.correction_no} — ${c.status}</h4>
          <div class="detail-field"><span class="label">补正原因</span><span class="value">${c.reason}</span></div>
          <div class="detail-field"><span class="label">审核意见</span><span class="value">${c.review_opinion || '-'}</span></div>
          <div class="detail-field"><span class="label">需补材料</span><span class="value">${c.required_materials}</span></div>
          <div class="detail-field"><span class="label">补正截止</span><span class="value" style="${new Date(c.deadline_at) < new Date() ? 'color:#dc2626;font-weight:600' : ''}">${c.deadline_at}</span></div>
          ${c.submitted_at ? html`<div class="detail-field"><span class="label">提交时间</span><span class="value">${c.submitted_at}</span></div>` : ''}
        </div>
      `)}
    `;
  }

  _renderProcess() {
    if (this.processRecords.length === 0) {
      return html`<div style="text-align:center;padding:40px;color:#9ca3af">暂无处理记录</div>`;
    }
    return html`
      <div class="timeline">
        ${this.processRecords.map(r => html`
          <div class="timeline-item">
            <div class="time">${r.created_at}</div>
            <div class="action-name">${r.action}</div>
            <div class="action-detail">
              ${r.operator_name} (${r.operator_role})
              ${r.from_status ? ` · ${r.from_status} → ${r.to_status}` : ''}
            </div>
            ${r.opinion ? html`<div class="action-detail" style="margin-top:4px">意见: ${r.opinion}</div>` : ''}
            ${r.materials_snapshot ? html`<div class="action-detail" style="margin-top:2px;font-size:11px;color:#9ca3af">材料快照: ${r.materials_snapshot}</div>` : ''}
          </div>
        `)}
      </div>
    `;
  }

  _renderAudit() {
    if (this.auditLogs.length === 0) {
      return html`<div style="text-align:center;padding:40px;color:#9ca3af">暂无审计日志</div>`;
    }
    return html`
      ${this.auditLogs.map(log => html`
        <div class="audit-row">
          <div class="audit-time">${log.created_at}</div>
          <div><strong>${log.action}</strong> — ${log.actor_name} (${log.actor_role})</div>
          ${log.detail ? html`<div style="color:#6b7280;font-size:11px;margin-top:2px">${log.detail}</div>` : ''}
          ${log.ip_address ? html`<div style="color:#9ca3af;font-size:10px">IP: ${log.ip_address}</div>` : ''}
        </div>
      `)}
    `;
  }

  _renderActionPanel() {
    const actions = this._getAvailableActions();
    return html`
      <div class="action-panel">
        <h3>处理操作 (当前: ${this.user.display_name} / ${this.user.role})</h3>
        <div class="action-buttons">
          ${actions.map(a => html`
            <button class="btn ${this._actionBtnClass(a)}" ?disabled=${this.loading} @click=${() => this._executeAction(a)}>${a}</button>
          `)}
        </div>
        <textarea class="opinion-input" placeholder="请输入处理意见..." .value=${this.actionOpinion} @input=${(e) => { this.actionOpinion = e.target.value; }}></textarea>
        <div style="font-size:11px;color:#9ca3af">
          提示：部分操作（审核通过/驳回/要求补正/复核归档/复核退回/补正提交）必须填写处理意见；提交审核/补正提交前需确保必交材料已提交；版本号 v${this.app.version} 用于并发控制
        </div>
      </div>
    `;
  }

  _actionBtnClass(action) {
    if (['审核通过', '复核归档', '补正提交', '提交审核', '开始审核', '开始复核'].includes(action)) return 'btn-success';
    if (['审核驳回', '复核退回'].includes(action)) return 'btn-danger';
    if (['要求补正'].includes(action)) return 'btn-warning';
    return 'btn-primary';
  }
}

customElements.define('app-detail', AppDetail);
