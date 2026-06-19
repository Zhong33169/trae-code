import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type {
  SampleRecord,
  SampleEvidence,
  SampleAppeal,
  OperationLog,
  TemperatureRecord,
  User,
} from '../types';
import { STATUS_LABELS, ROLE_LABELS } from '../types';

@customElement('sample-detail')
export class SampleDetail extends LitElement {
  static styles = css`
    .section + .section { margin-top: 16px; }
    .ev-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
    }
    .ev-item {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      background: #fafafa;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ev-icon { font-size: 18px; }
    .appeal-card {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
      background: #fafafa;
    }
    .appeal-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .appeal-body { font-size: 13px; }
    .appeal-body p { margin: 4px 0; }
    .appeal-body strong { color: var(--text); }
    .temp-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px dashed var(--border);
      font-size: 13px;
    }
    .temp-row:last-child { border-bottom: none; }
    .action-bar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }
    .title-wrap { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .title-wrap h3 { margin: 0; font-size: 17px; }
    .record-no { font-family: monospace; color: var(--text-secondary); font-size: 12px; }
    .content-grid {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 16px;
    }
    @media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }
  `;

  @property({ type: Object }) record!: SampleRecord;
  @property({ type: Array }) evidences: SampleEvidence[] = [];
  @property({ type: Array }) appeals: SampleAppeal[] = [];
  @property({ type: Array }) logs: OperationLog[] = [];
  @property({ type: Array }) temperatures: TemperatureRecord[] = [];
  @property({ type: Object }) currentUser: User | null = null;

  emitAction(name: string) {
    this.dispatchEvent(new CustomEvent('action', { detail: name }));
  }

  renderActions() {
    if (!this.currentUser) return '';
    const { status, current_handler, current_role } = this.record;
    const isHandler = this.currentUser.name === current_handler && this.currentUser.role === current_role;

    const actions: { label: string; action: string; cls: string; show: boolean }[] = [
      { label: '提交审核', action: 'submit', cls: 'btn-primary',
        show: isHandler && (status === 'draft' || status === 'evidence_missing') },
      { label: '品控审核', action: 'qc-review', cls: 'btn-success',
        show: isHandler && status === 'pending_review' },
      { label: '生产经理复核', action: 'manager-review', cls: 'btn-primary',
        show: isHandler && status === 'qc_approved' },
      { label: '提交申诉', action: 'appeal', cls: 'btn-warning',
        show: this.currentUser.role === 'clerk' && ['qc_rejected', 'manager_rejected', 'evidence_missing', 'appeal_rejected'].includes(status) },
      { label: '申诉受理/驳回', action: 'appeal-review', cls: 'btn-warning',
        show: isHandler && status === 'appeal_submitted' },
    ];

    return html`
      <div class="action-bar">
        ${actions.filter(a => a.show).map(a => html`
          <button class="btn ${a.cls}" @click=${() => this.emitAction(a.action)}>${a.label}</button>
        `)}
      </div>
    `;
  }

  renderTemperatures() {
    if (this.temperatures.length === 0) return html`<div class="muted small">暂无温度记录</div>`;
    return html`
      ${this.temperatures.map(t => html`
        <div class="temp-row">
          <div>
            <span style="font-family: monospace">${t.measure_time}</span>
            <span class="tag" style="margin-left:6px">${t.location}</span>
            ${t.is_abnormal ? html`<span class="badge badge-red" style="margin-left:6px">异常</span>` : ''}
          </div>
          <div>
            <strong style="color: ${t.is_abnormal ? 'var(--danger)' : 'var(--text)'}">${t.temperature.toFixed(1)}℃</strong>
            <span class="muted small" style="margin-left:8px">${t.recorder}</span>
          </div>
        </div>
        ${t.remark ? html`<div class="small muted" style="padding:0 0 6px 0">备注：${t.remark}</div>` : ''}
      `)}
    `;
  }

  renderEvidences() {
    const typeIcon: Record<string, string> = { photo: '🖼️', temperature: '🌡️', document: '📄', video: '🎥', other: '📎' };
    if (this.evidences.length === 0) return html`<div class="muted small">暂无证据文件</div>`;
    return html`
      <div class="ev-grid">
        ${this.evidences.map(e => html`
          <div class="ev-item">
            <span class="ev-icon">${typeIcon[e.type] || '📎'}</span>
            <div style="overflow:hidden; flex:1">
              <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${e.name}</div>
              <div class="muted small">${new Date(e.uploaded_at).toLocaleDateString()}</div>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  renderAppeals() {
    if (this.appeals.length === 0) return html`<div class="muted small">暂无申诉记录</div>`;
    const statusCls: Record<string, string> = { submitted: 'badge-purple', accepted: 'badge-green', rejected: 'badge-orange', resubmitted: 'badge-blue' };
    const statusLabel: Record<string, string> = { submitted: '待受理', accepted: '已受理', rejected: '已驳回', resubmitted: '再次提交' };
    return html`
      ${this.appeals.map(a => html`
        <div class="appeal-card">
          <div class="appeal-head">
            <span class="badge ${statusCls[a.status]}">${statusLabel[a.status]}</span>
            <span class="small muted">${a.submitter} · v${a.version}</span>
            <span class="small muted">${new Date(a.submitted_at).toLocaleString()}</span>
            ${a.previous_status ? html`<span class="tag">原状态：${STATUS_LABELS[a.previous_status as keyof typeof STATUS_LABELS]?.label || a.previous_status}</span>` : ''}
          </div>
          <div class="appeal-body">
            <p><strong>申诉理由：</strong>${a.reason}</p>
            ${a.review_opinion ? html`<p><strong>复核意见：</strong>${a.review_opinion}</p>` : ''}
            ${a.reject_reason ? html`<p style="color: var(--danger)"><strong>驳回原因：</strong>${a.reject_reason}</p>` : ''}
            ${a.reviewed_at ? html`<p class="muted small">处理时间：${new Date(a.reviewed_at).toLocaleString()}</p>` : ''}
          </div>
        </div>
      `)}
    `;
  }

  renderLogs() {
    const actionCls: Record<string, string> = {
      '建单': '', '提交审核': '', '品控审核通过': 'success', '品控驳回': 'danger',
      '要求补正证据': 'warn', '生产经理复核通过': 'success', '生产经理复核驳回': 'danger',
      '提交异常申诉': 'warn', '申诉受理通过': 'success', '申诉驳回': 'danger',
      '再次提交申诉': '', '超时标记': 'danger',
      '提交失败': 'danger', '推进失败': 'danger', '复核失败': 'danger',
      '申诉失败': 'danger', '申诉复核失败': 'danger', '再次申诉失败': 'danger',
    };
    return html`
      <div class="timeline">
        ${this.logs.map(l => html`
          <div class="timeline-item ${actionCls[l.action] || ''}">
            <div class="timeline-time">${new Date(l.created_at).toLocaleString()} · ${l.operator} <span class="tag">${ROLE_LABELS[l.operator_role]}</span></div>
            <div class="timeline-action">
              ${l.action}
              ${l.from_status ? html`<span class="muted small" style="margin-left:6px">${STATUS_LABELS[l.from_status as keyof typeof STATUS_LABELS]?.label || l.from_status} →</span>` : ''}
              <span class="badge ${STATUS_LABELS[l.to_status as keyof typeof STATUS_LABELS]?.cls || 'badge-gray'}" style="margin-left:4px">${STATUS_LABELS[l.to_status as keyof typeof STATUS_LABELS]?.label || l.to_status}</span>
            </div>
            ${l.remark ? html`<div class="timeline-remark">${l.remark}</div>` : ''}
          </div>
        `)}
      </div>
    `;
  }

  render() {
    const infoItems = [
      { label: '记录编号', value: this.record.record_no },
      { label: '批次号', value: this.record.batch_no },
      { label: '产品名称', value: this.record.product_name },
      { label: '生产线', value: this.record.production_line },
      { label: '留样时间', value: this.record.sample_time },
      { label: '留样温度', value: `${this.record.sample_temperature.toFixed(1)}℃` },
      { label: '存放位置', value: this.record.storage_location },
      { label: '登记员', value: this.record.operator },
      { label: '当前处理人', value: `${this.record.current_handler}（${ROLE_LABELS[this.record.current_role]}）` },
      { label: '证据数', value: `${this.record.evidence_count} 项` },
      { label: '处理时限', value: this.record.deadline || '-' },
      { label: '版本号', value: `v${this.record.version}` },
    ];

    return html`
      <div class="modal-mask" @click=${(e: Event) => { if ((e.target as HTMLElement).classList.contains('modal-mask')) this.dispatchEvent(new CustomEvent('close')); }}>
        <div class="modal wide">
          <div class="modal-header">
            <div class="header-row" style="flex:1; margin:0">
              <div class="title-wrap">
                <h3>留样记录详情</h3>
                <span class="badge ${STATUS_LABELS[this.record.status].cls}">${STATUS_LABELS[this.record.status].label}</span>
              </div>
              <span class="record-no">${this.record.record_no} · v${this.record.version}</span>
            </div>
            <button class="modal-close" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>✕</button>
          </div>
          <div class="modal-body">
            <div class="action-bar mb-12">${this.renderActions()}</div>

            <div class="section card">
              <div class="section-title">📋 基本信息</div>
              <dl class="info-grid">
                ${infoItems.map(i => html`<dt>${i.label}</dt><dd>${i.value}</dd>`)}
              </dl>
            </div>

            <div class="content-grid">
              <div class="section card">
                <div class="section-title">🌡️ 温度记录</div>
                ${this.renderTemperatures()}
              </div>
              <div class="section card">
                <div class="section-title">📎 证据材料 <span class="small muted">(${this.evidences.length})</span></div>
                ${this.renderEvidences()}
              </div>
            </div>

            <div class="section card">
              <div class="section-title">📝 异常申诉复核 <span class="small muted">(${this.appeals.length})</span></div>
              ${this.renderAppeals()}
            </div>

            <div class="section card">
              <div class="section-title">🔄 操作记录</div>
              ${this.renderLogs()}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>关闭</button>
          </div>
        </div>
      </div>
    `;
  }
}
