import { LitElement, html, css } from 'lit';
import { api, STATUS_LABELS, STATUS_COLORS } from '../api.js';

export class TicketDetail extends LitElement {
  static properties = {
    ticket: { type: Object },
    currentUser: { type: Object },
    showSupplement: { type: Boolean },
    supplementForm: { type: Object },
  };

  static styles = css`
    :host { display: block; }
    .overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 500; display: flex; align-items: center; justify-content: center;
    }
    .modal {
      background: white; border-radius: 12px; width: 90%; max-width: 900px;
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
    
    .supplement-item {
      background: #fdf6ec; border: 1px solid #faecd8; border-radius: 8px;
      padding: 12px; margin-bottom: 8px;
    }
    .supplement-item .field-name {
      font-weight: 600; color: #e6a23c; font-size: 13px; margin-bottom: 4px;
    }
    .supplement-item .change {
      font-size: 12px; color: #606266; display: flex; align-items: center; gap: 8px;
    }
    .supplement-item .old { text-decoration: line-through; color: #f56c6c; }
    .supplement-item .new { color: #67c23a; font-weight: 500; }
    .supplement-item .arrow { color: #909399; }
    .supplement-item .meta { font-size: 11px; color: #909399; margin-top: 4px; }
    
    .supplement-form {
      background: #f0f9eb; border: 1px solid #e1f3d8; border-radius: 8px;
      padding: 16px; margin-top: 12px;
    }
    .form-row { margin-bottom: 12px; }
    .form-row label { display: block; font-size: 13px; color: #606266; margin-bottom: 4px; font-weight: 500; }
    .form-row input, .form-row select, .form-row textarea {
      width: 100%; padding: 8px 12px; border: 1px solid #dcdfe6; border-radius: 6px;
      font-size: 13px; font-family: inherit;
    }
    .form-row textarea { min-height: 60px; resize: vertical; }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; }
    
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
      position: sticky; bottom: 0;
    }
    
    .evidence-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .evidence-table th {
      background: #f8f9fa; padding: 8px 10px; text-align: left;
      font-weight: 600; color: #606266; border-bottom: 1px solid #ebeef5;
    }
    .evidence-table td { padding: 8px 10px; border-bottom: 1px solid #f0f2f5; }
    
    .health-tag {
      padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;
    }
    .health-healthy { background: #f0f9eb; color: #67c23a; }
    .health-mild { background: #fdf6ec; color: #e6a23c; }
    .health-sick { background: #fef0f0; color: #f56c6c; }
    .health-critical { background: #f56c6c; color: white; }
  `;

  constructor() {
    super();
    this.showSupplement = false;
    this.supplementForm = { supplement_type: 'correction', field_name: '', old_value: '', new_value: '', reason: '' };
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

  _canSupplement() {
    if (!this.currentUser || !this.ticket) return false;
    return this.currentUser.role === 'registrar' && ['draft', 'returned'].includes(this.ticket.status);
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
      await api.supplementTicket(this.ticket.id, {
        ...f,
        user_id: this.currentUser.id,
        version: this.ticket.version,
      });
      this.showSupplement = false;
      this.supplementForm = { supplement_type: 'correction', field_name: '', old_value: '', new_value: '', reason: '' };
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: '补录成功', type: 'success' } }));
      this.dispatchEvent(new CustomEvent('refresh'));
    } catch (e) {
      this.dispatchEvent(new CustomEvent('toast', { detail: { msg: e.message, type: 'error' } }));
    }
  }

  render() {
    if (!this.ticket) return '';
    const t = this.ticket;
    return html`
      <div class="overlay" @click=${(e) => { if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('close')); }}>
        <div class="modal">
          <div class="modal-header">
            <h2>📋 ${t.ticket_no} - 巡检单详情</h2>
            <button class="close-btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>✕</button>
          </div>
          <div class="modal-body">
            ${this._renderBasicInfo(t)}
            ${this._renderSupplements(t)}
            ${this._renderPenInspections(t)}
            ${this._renderHealthReports(t)}
            ${this._renderTreatmentTrackings(t)}
            ${this._renderEvidences(t)}
            ${this._renderWorkflowLogs(t)}
          </div>
          <div class="action-bar">
            ${this._canSupplement() ? html`
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
          <div class="info-item"><div class="label">证据数</div><div class="value">${t.evidence_count}条</div></div>
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
            <div class="meta">
              原因: ${s.reason} | 操作人: ${s.operator_name || '-'} | 时间: ${s.operated_at} | 版本: v${s.version_after}
            </div>
          </div>
        `)}
      </div>
    `;
  }

  _renderPenInspections(t) {
    const items = t.pen_inspections || [];
    if (items.length === 0) return '';
    return html`
      <div class="section">
        <div class="section-title">🏠 栏舍巡检 <span class="badge">${items.length}</span></div>
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
      </div>
    `;
  }

  _renderHealthReports(t) {
    const items = t.health_reports || [];
    if (items.length === 0) return '';
    return html`
      <div class="section">
        <div class="section-title">💚 健康上报 <span class="badge">${items.length}</span></div>
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
      </div>
    `;
  }

  _renderTreatmentTrackings(t) {
    const items = t.treatment_trackings || [];
    if (items.length === 0) return '';
    return html`
      <div class="section">
        <div class="section-title">💊 治疗跟踪 <span class="badge">${items.length}</span></div>
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
      </div>
    `;
  }

  _renderEvidences(t) {
    const items = t.evidences || [];
    if (items.length === 0) return '';
    return html`
      <div class="section">
        <div class="section-title">📎 证据附件 <span class="badge">${items.length}</span></div>
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

  _renderSupplementForm() {
    return html`
      <div class="supplement-form" style="padding: 16px 24px; border-top: 1px solid #ebeef5;">
        <div style="font-weight:600;margin-bottom:12px;font-size:14px;">📝 补录表单 (当前版本: v${this.ticket.version})</div>
        <div class="form-row">
          <label>补录类型</label>
          <select @change=${(e) => { this.supplementForm.supplement_type = e.target.value; }}>
            <option value="correction" ?selected=${this.supplementForm.supplement_type === 'correction'}>补正</option>
            <option value="addition" ?selected=${this.supplementForm.supplement_type === 'addition'}>补充</option>
          </select>
        </div>
        <div class="form-row">
          <label>字段名称 *</label>
          <input type="text" placeholder="如: temperature, pen_area, animal_count"
            .value=${this.supplementForm.field_name}
            @input=${(e) => { this.supplementForm.field_name = e.target.value; }} />
        </div>
        <div class="form-row">
          <label>原值</label>
          <input type="text" placeholder="修改前的值"
            .value=${this.supplementForm.old_value}
            @input=${(e) => { this.supplementForm.old_value = e.target.value; }} />
        </div>
        <div class="form-row">
          <label>新值 *</label>
          <input type="text" placeholder="修改后的值"
            .value=${this.supplementForm.new_value}
            @input=${(e) => { this.supplementForm.new_value = e.target.value; }} />
        </div>
        <div class="form-row">
          <label>补录原因 *</label>
          <textarea placeholder="请详细说明补录原因（不少于2个字符）"
            .value=${this.supplementForm.reason}
            @input=${(e) => { this.supplementForm.reason = e.target.value; }}></textarea>
        </div>
        <div class="form-actions">
          <button class="btn btn-plain" @click=${() => { this.showSupplement = false; }}>取消</button>
          <button class="btn btn-primary" @click=${this._submitSupplement}>提交补录</button>
        </div>
      </div>
    `;
  }
}

customElements.define('ticket-detail', TicketDetail);
