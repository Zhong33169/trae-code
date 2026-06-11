import { LitElement, html, css } from 'lit';
import { api, STATUS_LABELS, STATUS_COLORS } from '../api.js';

export class TicketDetail extends LitElement {
  static properties = {
    ticket: { type: Object },
    currentUser: { type: Object },
    showSupplement: { type: Boolean },
    showPenForm: { type: Boolean },
    showHealthForm: { type: Boolean },
    showTreatmentForm: { type: Boolean },
    showEvidenceForm: { type: Boolean },
    supplementForm: { type: Object },
    penForm: { type: Object },
    healthForm: { type: Object },
    treatmentForm: { type: Object },
    evidenceForm: { type: Object },
  };

  static styles = css`
    :host { display: block; }
    .overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 500; display: flex; align-items: center; justify-content: center;
    }
    .modal {
      background: white; border-radius: 12px; width: 90%; max-width: 960px;
      max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 30px rgba(0,0,0,0.2);
    }
    .modal-header {
      padding: 16px 24px; border-bottom: 1px solid #ebeef5;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; background: white; border-radius: 12px 12px 0 0; z-index: 1;
    }
    .modal-header h2 { font-size: 16px; margin: 0; }
    .close-btn {
      background: none; border: none; font-size: 20px; cursor: pointer;
      color: #909399; padding: 4px 8px; border-radius: 4px;
    }
    .close-btn:hover { background: #f0f2f5; color: #303133; }
    .modal-body { padding: 20px 24px; }
    .section { margin-bottom: 24px; }
    .section-title {
      font-size: 14px; font-weight: 600; color: #303133;
      padding-bottom: 10px; border-bottom: 2px solid #1a5c2a;
      margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
    }
    .section-title .badge {
      background: #1a5c2a; color: white; padding: 1px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 400;
    }
    .add-btn {
      margin-left: auto; padding: 3px 12px; border-radius: 6px; border: 1px dashed #1a5c2a;
      background: transparent; color: #1a5c2a; cursor: pointer; font-size: 12px;
      transition: all 0.2s;
    }
    .add-btn:hover { background: #f0f9eb; }
    .add-btn.active { background: #1a5c2a; color: white; border-style: solid; }
    .info-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .info-item { font-size: 13px; }
    .info-item .label { color: #909399; margin-bottom: 2px; }
    .info-item .value { color: #303133; font-weight: 500; }
    .status-badge {
      display: inline-block; padding: 3px 12px; border-radius: 10px;
      font-size: 12px; font-weight: 500; color: white;
    }
    .timeline { position: relative; padding-left: 20px; }
    .timeline::before {
      content: ''; position: absolute; left: 6px; top: 0; bottom: 0;
      width: 2px; background: #dcdfe6;
    }
    .timeline-item {
      position: relative; padding-bottom: 16px; padding-left: 16px; font-size: 13px;
    }
    .timeline-item::before {
      content: ''; position: absolute; left: -18px; top: 4px;
      width: 10px; height: 10px; border-radius: 50%; background: #1a5c2a;
      border: 2px solid white; box-shadow: 0 0 0 2px #1a5c2a;
    }
    .timeline-item .time { color: #909399; font-size: 12px; }
    .timeline-item .action { color: #303133; font-weight: 500; }
    .timeline-item .operator { color: #606266; }
    .timeline-item .comment { color: #e6a23c; font-style: italic; }
    .timeline-item.timeline-success::before { background: #67c23a; box-shadow: 0 0 0 2px #67c23a; }
    .timeline-item.timeline-error::before { background: #f56c6c; box-shadow: 0 0 0 2px #f56c6c; }
    .supplement-item {
      background: #fdf6ec; border: 1px solid #faecd8; border-radius: 8px;
      padding: 12px; margin-bottom: 8px;
    }
    .supplement-item .field-name { font-weight: 600; color: #e6a23c; font-size: 13px; margin-bottom: 4px; }
    .supplement-item .change { font-size: 12px; color: #606266; display: flex; align-items: center; gap: 8px; }
    .supplement-item .old { text-decoration: line-through; color: #f56c6c; }
    .supplement-item .new { color: #67c23a; font-weight: 500; }
    .supplement-item .arrow { color: #909399; }
    .supplement-item .meta { font-size: 11px; color: #909399; margin-top: 4px; }
    .evidence-form {
      background: #f0f9eb; border: 1px solid #e1f3d8; border-radius: 8px;
      padding: 16px; margin-top: 12px;
    }
    .form-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    }
    .form-grid .full { grid-column: 1 / -1; }
    .form-row { margin-bottom: 0; }
    .form-row label { display: block; font-size: 12px; color: #606266; margin-bottom: 3px; font-weight: 500; }
    .form-row label .req { color: #f56c6c; }
    .form-row input, .form-row select, .form-row textarea {
      width: 100%; padding: 6px 10px; border: 1px solid #dcdfe6; border-radius: 6px;
      font-size: 12px; font-family: inherit;
    }
    .form-row textarea { min-height: 48px; resize: vertical; }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
    .btn {
      padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 500; transition: all 0.2s;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #1a5c2a; color: white; }
    .btn-primary:hover:not(:disabled) { background: #2d8a4e; }
    .btn-warning { background: #e6a23c; color: white; }
    .btn-danger { background: #f56c6c; color: white; }
    .btn-success { background: #67c23a; color: white; }
    .btn-plain { background: #f0f2f5; color: #606266; border: 1px solid #dcdfe6; }
    .btn-sm { padding: 5px 10px; font-size: 12px; }
    .action-bar {
      display: flex; gap: 8px; padding: 16px 24px; border-top: 1px solid #ebeef5;
      background: #fafafa; border-radius: 0 0 12px 12px;
      position: sticky; bottom: 0; flex-wrap: wrap;
    }
    .evidence-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .evidence-table th {
      background: #f8f9fa; padding: 8px 10px; text-align: left;
      font-weight: 600; color: #606266; border-bottom: 1px solid #ebeef5;
    }
    .evidence-table td { padding: 8px 10px; border-bottom: 1px solid #f0f2f5; }
    .health-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
    .health-healthy { background: #f0f9eb; color: #67c23a; }
    .health-mild { background: #fdf6ec; color: #e6a23c; }
    .health-sick { background: #fef0f0; color: #f56c6c; }
    .health-critical { background: #f56c6c; color: white; }
    .evidence-hint {
      font-size: 12px; color: #e6a23c; background: #fdf6ec;
      padding: 8px 12px; border-radius: 6px; margin-bottom: 12px;
      border: 1px solid #faecd8;
    }
  `;

  constructor() {
    super();
    this.showSupplement = false;
    this.showPenForm = false;
    this.showHealthForm = false;
    this.showTreatmentForm = false;
    this.showEvidenceForm = false;
    this.supplementForm = { supplement_type: 'correction', field_name: '', old_value: '', new_value: '', reason: '' };
    this.penForm = { pen_area: '', cleanliness: 'clean', ventilation: 'good', temperature: '', humidity: '', notes: '' };
    this.healthForm = { animal_id: '', animal_tag: '', health_status: 'healthy', symptoms: '', diagnosis: '', reporter_name: '' };
    this.treatmentForm = { health_report_id: '', treatment_type: 'medication', medication: '', dosage: '', administered_by: '', next_check_date: '' };
    this.evidenceForm = { evidence_type: 'document', description: '', reference_id: '' };
  }

  _canAddEvidence() {
    if (!this.currentUser || !this.ticket) return false;
    return this.currentUser.role === 'registrar' && ['draft', 'returned'].includes(this.ticket.status);
  }

  _canSupplement() {
    return this._canAddEvidence();
  }

  _getAvailableActions() {
    if (!this.currentUser || !this.ticket) return [];
    const role = this.currentUser.role;
    const status = this.ticket.status;
    const actions = [];
    if (role === 'registrar') {
      if (status === 'draft') actions.push({ action: 'submit', label: '提交审核', cls: 'btn-primary' });
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

  async _doAction(action) {
    this.dispatchEvent(new CustomEvent('action', { detail: { action } }));
  }

  async _submitSupplement() {
    const f = this.supplementForm;
    if (!f.field_name || !f.new_value || !f.reason) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '补录字段、新值和原因均为必填', type: 'warning' } }));
      return;
    }
    try {
      await api.supplementTicket(this.ticket.id, { ...f, user_id: this.currentUser.id, version: this.ticket.version });
      this.showSupplement = false;
      this.supplementForm = { supplement_type: 'correction', field_name: '', old_value: '', new_value: '', reason: '' };
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '补录成功', type: 'success' } }));
      this._refresh();
    } catch (e) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: e.message, type: 'error' } }));
    }
  }

  async _submitPenInspection() {
    const f = this.penForm;
    if (!f.pen_area) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '栏舍区域必填', type: 'warning' } }));
      return;
    }
    try {
      await api.addPenInspection(this.ticket.id, {
        ...f,
        ticket_id: this.ticket.id,
        user_id: this.currentUser.id,
        temperature: f.temperature ? parseFloat(f.temperature) : null,
        humidity: f.humidity ? parseFloat(f.humidity) : null,
      });
      this.showPenForm = false;
      this.penForm = { pen_area: '', cleanliness: 'clean', ventilation: 'good', temperature: '', humidity: '', notes: '' };
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '栏舍巡检录入成功', type: 'success' } }));
      this._refresh();
    } catch (e) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: e.message, type: 'error' } }));
    }
  }

  async _submitHealthReport() {
    const f = this.healthForm;
    if (!f.animal_id || !f.animal_tag || !f.reporter_name) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '动物编号、标签、上报人必填', type: 'warning' } }));
      return;
    }
    try {
      await api.addHealthReport(this.ticket.id, {
        ...f,
        ticket_id: this.ticket.id,
        user_id: this.currentUser.id,
      });
      this.showHealthForm = false;
      this.healthForm = { animal_id: '', animal_tag: '', health_status: 'healthy', symptoms: '', diagnosis: '', reporter_name: '' };
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '健康上报录入成功', type: 'success' } }));
      this._refresh();
    } catch (e) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: e.message, type: 'error' } }));
    }
  }

  async _submitTreatmentTracking() {
    const f = this.treatmentForm;
    if (!f.health_report_id || !f.administered_by) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '关联健康报告和执行人必填', type: 'warning' } }));
      return;
    }
    try {
      await api.addTreatmentTracking(this.ticket.id, {
        ...f,
        ticket_id: this.ticket.id,
        user_id: this.currentUser.id,
        health_report_id: parseInt(f.health_report_id),
      });
      this.showTreatmentForm = false;
      this.treatmentForm = { health_report_id: '', treatment_type: 'medication', medication: '', dosage: '', administered_by: '', next_check_date: '' };
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '治疗跟踪录入成功', type: 'success' } }));
      this._refresh();
    } catch (e) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: e.message, type: 'error' } }));
    }
  }

  async _submitEvidence() {
    const f = this.evidenceForm;
    if (!f.description) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '证据描述必填', type: 'warning' } }));
      return;
    }
    try {
      await api.addEvidence(this.ticket.id, {
        ...f,
        user_id: this.currentUser.id,
        reference_id: f.reference_id ? parseInt(f.reference_id) : null,
      });
      this.showEvidenceForm = false;
      this.evidenceForm = { evidence_type: 'document', description: '', reference_id: '' };
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '证据附件添加成功', type: 'success' } }));
      this._refresh();
    } catch (e) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: e.message, type: 'error' } }));
    }
  }

  async _refresh() {
    this.dispatchEvent(new CustomEvent('refresh'));
  }

  render() {
    if (!this.ticket) return '';
    const t = this.ticket;
    const canAdd = this._canAddEvidence();
    return html`
      <div class="overlay" @click=${(e) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('close')); }}>
        <div class="modal">
          <div class="modal-header">
            <h2>📋 ${t.ticket_no} - 巡检单详情</h2>
            <button class="close-btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>✕</button>
          </div>
          <div class="modal-body">
            ${t.status === 'draft' && t.evidence_count < 2 ? html`
              <div class="evidence-hint">
                ⚠️ 当前证据仅 ${t.evidence_count} 条，提交审核至少需要 2 条证据。请先录入栏舍巡检、健康上报或治疗跟踪。
              </div>
            ` : ''}
            ${this._renderBasicInfo(t)}
            ${this._renderSupplements(t)}
            ${this._renderPenInspections(t, canAdd)}
            ${this._renderHealthReports(t, canAdd)}
            ${this._renderTreatmentTrackings(t, canAdd)}
            ${this._renderEvidences(t, canAdd)}
            ${this._renderWorkflowLogs(t)}
            ${this._renderBatchHistories(t)}
          </div>
          <div class="action-bar">
            ${canAdd ? html`
              <button class="btn btn-warning" @click=${() => { this.showSupplement = !this.showSupplement; }}>
                ${this.showSupplement ? '取消补录' : '📝 补录'}
              </button>
            ` : ''}
            ${this._getAvailableActions().map(a => html`
              <button class="btn ${a.cls}" @click=${() => this._doAction(a.action)}>${a.label}</button>
            `)}
            <button class="btn btn-plain" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>关闭</button>
          </div>
          ${this.showSupplement ? this._renderSupplementForm() : ''}
        </div>
      </div>
    `;
  }

  _renderBasicInfo(t) {
    return html`
      <div class="section">
        <div class="section-title">基本信息</div>
        <div class="info-grid">
          <div class="info-item"><div class="label">单号</div><div class="value">${t.ticket_no}</div></div>
          <div class="info-item"><div class="label">状态</div><div class="value"><span class="status-badge" style="background:${STATUS_COLORS[t.status]}">${STATUS_LABELS[t.status]}</span></div></div>
          <div class="info-item"><div class="label">版本</div><div class="value">v${t.version}</div></div>
          <div class="info-item"><div class="label">栏舍</div><div class="value">${t.pen_id}</div></div>
          <div class="info-item"><div class="label">动物类型</div><div class="value">${t.animal_type}</div></div>
          <div class="info-item"><div class="label">数量</div><div class="value">${t.animal_count}头</div></div>
          <div class="info-item"><div class="label">巡检员</div><div class="value">${t.inspector_name}</div></div>
          <div class="info-item"><div class="label">巡检日期</div><div class="value">${t.inspection_date}</div></div>
          <div class="info-item"><div class="label">创建人</div><div class="value">${t.creator_name || '-'}</div></div>
          <div class="info-item"><div class="label">创建时间</div><div class="value">${t.created_at}</div></div>
          <div class="info-item"><div class="label">更新时间</div><div class="value">${t.updated_at}</div></div>
          <div class="info-item"><div class="label">证据数</div><div class="value" style="color:${(t.evidence_count || 0) < 2 ? '#f56c6c' : '#67c23a'};font-weight:700">${t.evidence_count || 0}条</div></div>
        </div>
      </div>
    `;
  }

  _renderSupplements(t) {
    const supplements = t.supplement_records || [];
    if (supplements.length === 0) return '';
    return html`
      <div class="section">
        <div class="section-title">📝 补录记录 <span class="badge">${supplements.length}</span></div>
        ${supplements.map(s => html`
          <div class="supplement-item">
            <div class="field-name">${s.supplement_type === 'correction' ? '补正' : '补录'} - ${s.field_name}</div>
            <div class="change">
              <span class="old">${s.old_value || '(空)'}</span>
              <span class="arrow">→</span>
              <span class="new">${s.new_value}</span>
            </div>
            <div class="meta">原因: ${s.reason} | 操作人: ${s.operator_name || '-'} | 时间: ${s.operated_at} | 版本: v${s.version_after}</div>
          </div>
        `)}
      </div>
    `;
  }

  _renderPenInspections(t, canAdd) {
    const items = t.pen_inspections || [];
    return html`
      <div class="section">
        <div class="section-title">
          🏠 栏舍巡检 <span class="badge">${items.length}</span>
          ${canAdd ? html`<button class="add-btn ${this.showPenForm ? 'active' : ''}" @click=${() => { this.showPenForm = !this.showPenForm; }}>+ 录入</button>` : ''}
        </div>
        ${items.length > 0 ? html`
          <table class="evidence-table">
            <tr><th>区域</th><th>清洁度</th><th>通风</th><th>温度</th><th>湿度</th><th>备注</th></tr>
            ${items.map(p => html`
              <tr>
                <td>${p.pen_area}</td>
                <td>${{clean:'清洁',acceptable:'可接受',dirty:'脏污'}[p.cleanliness]}</td>
                <td>${{good:'良好',fair:'一般',poor:'差'}[p.ventilation]}</td>
                <td>${p.temperature ? p.temperature + '℃' : '-'}</td>
                <td>${p.humidity ? p.humidity + '%' : '-'}</td>
                <td>${p.notes || '-'}</td>
              </tr>
            `)}
          </table>
        ` : html`<div style="color:#909399;font-size:13px;padding:8px 0;">暂无栏舍巡检记录</div>`}
        ${this.showPenForm ? this._renderPenForm() : ''}
      </div>
    `;
  }

  _renderHealthReports(t, canAdd) {
    const items = t.health_reports || [];
    return html`
      <div class="section">
        <div class="section-title">
          💚 健康上报 <span class="badge">${items.length}</span>
          ${canAdd ? html`<button class="add-btn ${this.showHealthForm ? 'active' : ''}" @click=${() => { this.showHealthForm = !this.showHealthForm; }}>+ 录入</button>` : ''}
        </div>
        ${items.length > 0 ? html`
          <table class="evidence-table">
            <tr><th>动物编号</th><th>标签</th><th>健康状态</th><th>症状</th><th>诊断</th><th>上报人</th></tr>
            ${items.map(h => html`
              <tr>
                <td>${h.animal_id}</td>
                <td>${h.animal_tag}</td>
                <td><span class="health-tag health-${h.health_status}">${{healthy:'健康',mild:'轻微异常',sick:'患病',critical:'危重'}[h.health_status]}</span></td>
                <td>${h.symptoms || '-'}</td>
                <td>${h.diagnosis || '-'}</td>
                <td>${h.reporter_name}</td>
              </tr>
            `)}
          </table>
        ` : html`<div style="color:#909399;font-size:13px;padding:8px 0;">暂无健康上报记录</div>`}
        ${this.showHealthForm ? this._renderHealthForm() : ''}
      </div>
    `;
  }

  _renderTreatmentTrackings(t, canAdd) {
    const items = t.treatment_trackings || [];
    const healthReports = t.health_reports || [];
    return html`
      <div class="section">
        <div class="section-title">
          💊 治疗跟踪 <span class="badge">${items.length}</span>
          ${canAdd && healthReports.length > 0 ? html`<button class="add-btn ${this.showTreatmentForm ? 'active' : ''}" @click=${() => { this.showTreatmentForm = !this.showTreatmentForm; }}>+ 录入</button>` : ''}
        </div>
        ${items.length > 0 ? html`
          <table class="evidence-table">
            <tr><th>类型</th><th>药物</th><th>剂量</th><th>执行人</th><th>执行时间</th><th>下次检查</th></tr>
            ${items.map(tr => html`
              <tr>
                <td>${tr.treatment_type}</td>
                <td>${tr.medication || '-'}</td>
                <td>${tr.dosage || '-'}</td>
                <td>${tr.administered_by}</td>
                <td>${tr.administered_at}</td>
                <td>${tr.next_check_date || '-'}</td>
              </tr>
            `)}
          </table>
        ` : html`<div style="color:#909399;font-size:13px;padding:8px 0;">暂无治疗跟踪记录${healthReports.length === 0 ? '（需先录入健康上报）' : ''}</div>`}
        ${this.showTreatmentForm ? this._renderTreatmentForm(healthReports) : ''}
      </div>
    `;
  }

  _renderEvidences(t, canAdd) {
    const items = t.evidences || [];
    return html`
      <div class="section">
        <div class="section-title">
          📎 证据附件 <span class="badge">${items.length}</span>
          ${canAdd ? html`<button class="add-btn ${this.showEvidenceForm ? 'active' : ''}" @click=${() => { this.showEvidenceForm = !this.showEvidenceForm; }}>+ 录入</button>` : ''}
        </div>
        ${items.length > 0 ? html`
          <table class="evidence-table">
            <tr><th>类型</th><th>描述</th><th>上传人</th><th>上传时间</th></tr>
            ${items.map(e => html`
              <tr>
                <td>${{pen_inspection:'栏舍巡检',health_report:'健康上报',treatment_tracking:'治疗跟踪',photo:'照片',document:'文档'}[e.evidence_type] || e.evidence_type}</td>
                <td>${e.description || '-'}</td>
                <td>${e.uploader_name || '-'}</td>
                <td>${e.uploaded_at}</td>
              </tr>
            `)}
          </table>
        ` : html`<div style="color:#909399;font-size:13px;padding:8px 0;">暂无证据附件</div>`}
        ${this.showEvidenceForm ? this._renderEvidenceForm() : ''}
      </div>
    `;
  }

  _renderWorkflowLogs(t) {
    const logs = t.workflow_logs || [];
    if (logs.length === 0) return '';
    return html`
      <div class="section">
        <div class="section-title">📜 流转记录 <span class="badge">${logs.length}</span></div>
        <div class="timeline">
          ${logs.map(l => html`
            <div class="timeline-item">
              <div class="time">${l.operated_at}</div>
              <div class="action">${l.action}</div>
              <div class="operator">${l.operator_name || '-'}: ${STATUS_LABELS[l.from_status] || l.from_status} → ${STATUS_LABELS[l.to_status] || l.to_status}</div>
              ${l.comment ? html`<div class="comment">"${l.comment}"</div>` : ''}
            </div>
          `)}
        </div>
      </div>
    `;
  }

  _renderBatchHistories(t) {
    const bh = t.batch_histories || [];
    if (bh.length === 0) return '';
    return html`
      <div class="section">
        <div class="section-title">🔢 批量操作历史 <span class="badge">${bh.length}</span></div>
        <div class="timeline">
          ${bh.map(b => html`
            <div class="timeline-item ${b.success ? 'timeline-success' : 'timeline-error'}">
              <div class="time">${b.batch_operated_at}</div>
              <div class="action">
                ${b.success ? '✅' : '❌'} [${b.batch_no}] ${b.batch_action}
              </div>
              <div class="operator">
                操作人: ${b.operator_name || '-'}
                ${b.old_status ? html` | ${STATUS_LABELS[b.old_status] || b.old_status}` : ''}
                ${b.new_status ? html` → ${STATUS_LABELS[b.new_status] || b.new_status}` : ''}
              </div>
              ${b.error_reason ? html`<div class="comment" style="color:#f56c6c">❌ 失败原因: ${b.error_reason}</div>` : ''}
            </div>
          `)}
        </div>
      </div>
    `;
  }

  _renderPenForm() {
    return html`
      <div class="evidence-form">
        <div style="font-weight:600;margin-bottom:10px;font-size:13px;">🏠 录入栏舍巡检</div>
        <div class="form-grid">
          <div class="form-row"><label>区域 <span class="req">*</span></label><input type="text" placeholder="如: A1-1号栏" .value=${this.penForm.pen_area} @input=${(e) => { this.penForm = { ...this.penForm, pen_area: e.target.value }; }} /></div>
          <div class="form-row"><label>清洁度</label><select .value=${this.penForm.cleanliness} @change=${(e) => { this.penForm = { ...this.penForm, cleanliness: e.target.value }; }}><option value="clean">清洁</option><option value="acceptable">可接受</option><option value="dirty">脏污</option></select></div>
          <div class="form-row"><label>通风</label><select .value=${this.penForm.ventilation} @change=${(e) => { this.penForm = { ...this.penForm, ventilation: e.target.value }; }}><option value="good">良好</option><option value="fair">一般</option><option value="poor">差</option></select></div>
          <div class="form-row"><label>温度(℃)</label><input type="number" step="0.1" placeholder="22.5" .value=${this.penForm.temperature} @input=${(e) => { this.penForm = { ...this.penForm, temperature: e.target.value }; }} /></div>
          <div class="form-row"><label>湿度(%)</label><input type="number" step="0.1" placeholder="65" .value=${this.penForm.humidity} @input=${(e) => { this.penForm = { ...this.penForm, humidity: e.target.value }; }} /></div>
          <div class="form-row"><label>备注</label><input type="text" placeholder="可选" .value=${this.penForm.notes} @input=${(e) => { this.penForm = { ...this.penForm, notes: e.target.value }; }} /></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-plain btn-sm" @click=${() => { this.showPenForm = false; }}>取消</button>
          <button class="btn btn-primary btn-sm" @click=${this._submitPenInspection}>确认录入</button>
        </div>
      </div>
    `;
  }

  _renderHealthForm() {
    return html`
      <div class="evidence-form">
        <div style="font-weight:600;margin-bottom:10px;font-size:13px;">💚 录入健康上报</div>
        <div class="form-grid">
          <div class="form-row"><label>动物编号 <span class="req">*</span></label><input type="text" placeholder="如: A1-P001" .value=${this.healthForm.animal_id} @input=${(e) => { this.healthForm = { ...this.healthForm, animal_id: e.target.value }; }} /></div>
          <div class="form-row"><label>动物标签 <span class="req">*</span></label><input type="text" placeholder="如: 猪-001" .value=${this.healthForm.animal_tag} @input=${(e) => { this.healthForm = { ...this.healthForm, animal_tag: e.target.value }; }} /></div>
          <div class="form-row"><label>健康状态</label><select .value=${this.healthForm.health_status} @change=${(e) => { this.healthForm = { ...this.healthForm, health_status: e.target.value }; }}><option value="healthy">健康</option><option value="mild">轻微异常</option><option value="sick">患病</option><option value="critical">危重</option></select></div>
          <div class="form-row"><label>上报人 <span class="req">*</span></label><input type="text" placeholder="上报人姓名" .value=${this.healthForm.reporter_name} @input=${(e) => { this.healthForm = { ...this.healthForm, reporter_name: e.target.value }; }} /></div>
          <div class="form-row"><label>症状</label><input type="text" placeholder="如: 食欲下降、咳嗽" .value=${this.healthForm.symptoms} @input=${(e) => { this.healthForm = { ...this.healthForm, symptoms: e.target.value }; }} /></div>
          <div class="form-row"><label>诊断</label><input type="text" placeholder="如: 消化不良" .value=${this.healthForm.diagnosis} @input=${(e) => { this.healthForm = { ...this.healthForm, diagnosis: e.target.value }; }} /></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-plain btn-sm" @click=${() => { this.showHealthForm = false; }}>取消</button>
          <button class="btn btn-primary btn-sm" @click=${this._submitHealthReport}>确认录入</button>
        </div>
      </div>
    `;
  }

  _renderTreatmentForm(healthReports) {
    return html`
      <div class="evidence-form">
        <div style="font-weight:600;margin-bottom:10px;font-size:13px;">💊 录入治疗跟踪</div>
        <div class="form-grid">
          <div class="form-row full"><label>关联健康报告 <span class="req">*</span></label>
            <select .value=${this.treatmentForm.health_report_id} @change=${(e) => { this.treatmentForm = { ...this.treatmentForm, health_report_id: e.target.value }; }}>
              <option value="">请选择</option>
              ${healthReports.map(h => html`<option value="${h.id}">${h.animal_tag} - ${{healthy:'健康',mild:'轻微异常',sick:'患病',critical:'危重'}[h.health_status]}${h.symptoms ? ' (' + h.symptoms + ')' : ''}</option>`)}
            </select>
          </div>
          <div class="form-row"><label>治疗类型</label><select .value=${this.treatmentForm.treatment_type} @change=${(e) => { this.treatmentForm = { ...this.treatmentForm, treatment_type: e.target.value }; }}><option value="medication">用药</option><option value="topical">外用</option><option value="quarantine">隔离</option><option value="surgery">手术</option><option value="other">其他</option></select></div>
          <div class="form-row"><label>药物</label><input type="text" placeholder="如: 氟苯尼考" .value=${this.treatmentForm.medication} @input=${(e) => { this.treatmentForm = { ...this.treatmentForm, medication: e.target.value }; }} /></div>
          <div class="form-row"><label>剂量</label><input type="text" placeholder="如: 0.1ml/kg" .value=${this.treatmentForm.dosage} @input=${(e) => { this.treatmentForm = { ...this.treatmentForm, dosage: e.target.value }; }} /></div>
          <div class="form-row"><label>执行人 <span class="req">*</span></label><input type="text" placeholder="如: 兽医赵" .value=${this.treatmentForm.administered_by} @input=${(e) => { this.treatmentForm = { ...this.treatmentForm, administered_by: e.target.value }; }} /></div>
          <div class="form-row"><label>下次检查日期</label><input type="date" .value=${this.treatmentForm.next_check_date} @input=${(e) => { this.treatmentForm = { ...this.treatmentForm, next_check_date: e.target.value }; }} /></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-plain btn-sm" @click=${() => { this.showTreatmentForm = false; }}>取消</button>
          <button class="btn btn-primary btn-sm" @click=${this._submitTreatmentTracking}>确认录入</button>
        </div>
      </div>
    `;
  }

  _renderEvidenceForm() {
    return html`
      <div class="evidence-form">
        <div style="font-weight:600;margin-bottom:10px;font-size:13px;">📎 添加证据附件</div>
        <div class="form-grid">
          <div class="form-row"><label>类型</label><select .value=${this.evidenceForm.evidence_type} @change=${(e) => { this.evidenceForm = { ...this.evidenceForm, evidence_type: e.target.value }; }}><option value="document">文档</option><option value="photo">照片</option><option value="pen_inspection">栏舍巡检</option><option value="health_report">健康上报</option><option value="treatment_tracking">治疗跟踪</option></select></div>
          <div class="form-row"><label>关联ID</label><input type="number" placeholder="可选" .value=${this.evidenceForm.reference_id} @input=${(e) => { this.evidenceForm = { ...this.evidenceForm, reference_id: e.target.value }; }} /></div>
          <div class="form-row full"><label>描述 <span class="req">*</span></label><input type="text" placeholder="证据描述" .value=${this.evidenceForm.description} @input=${(e) => { this.evidenceForm = { ...this.evidenceForm, description: e.target.value }; }} /></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-plain btn-sm" @click=${() => { this.showEvidenceForm = false; }}>取消</button>
          <button class="btn btn-primary btn-sm" @click=${this._submitEvidence}>确认添加</button>
        </div>
      </div>
    `;
  }

  _renderSupplementForm() {
    return html`
      <div class="evidence-form" style="padding: 16px 24px; border-top: 1px solid #ebeef5; background: #fdf6ec; border-color: #faecd8;">
        <div style="font-weight:600;margin-bottom:10px;font-size:13px;">📝 补录表单 (当前版本: v${this.ticket.version})</div>
        <div class="form-grid">
          <div class="form-row"><label>补录类型</label><select @change=${(e) => { this.supplementForm = { ...this.supplementForm, supplement_type: e.target.value }; }}><option value="correction" ?selected=${this.supplementForm.supplement_type === 'correction'}>补正</option><option value="addition" ?selected=${this.supplementForm.supplement_type === 'addition'}>补充</option></select></div>
          <div class="form-row"><label>字段名称 <span class="req">*</span></label><input type="text" placeholder="如: temperature, pen_area" .value=${this.supplementForm.field_name} @input=${(e) => { this.supplementForm = { ...this.supplementForm, field_name: e.target.value }; }} /></div>
          <div class="form-row"><label>原值</label><input type="text" placeholder="修改前的值" .value=${this.supplementForm.old_value} @input=${(e) => { this.supplementForm = { ...this.supplementForm, old_value: e.target.value }; }} /></div>
          <div class="form-row"><label>新值 <span class="req">*</span></label><input type="text" placeholder="修改后的值" .value=${this.supplementForm.new_value} @input=${(e) => { this.supplementForm = { ...this.supplementForm, new_value: e.target.value }; }} /></div>
          <div class="form-row full"><label>补录原因 <span class="req">*</span></label><input type="text" placeholder="请说明补录原因（不少于2个字符）" .value=${this.supplementForm.reason} @input=${(e) => { this.supplementForm = { ...this.supplementForm, reason: e.target.value }; }} /></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-plain btn-sm" @click=${() => { this.showSupplement = false; }}>取消</button>
          <button class="btn btn-primary btn-sm" @click=${this._submitSupplement}>提交补录</button>
        </div>
      </div>
    `;
  }
}

customElements.define('ticket-detail', TicketDetail);
