import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { SampleRecord, User } from '../types';
import { api } from '../api';

@customElement('manager-review-modal')
export class ManagerReviewModal extends LitElement {
  static styles = css``;

  @property({ type: Object }) record!: SampleRecord;
  @property({ type: Object }) currentUser: User | null = null;
  @state() decision: 'approve' | 'reject' = 'approve';
  @state() opinion = '';
  @state() errors: string[] = [];

  async submit() {
    if (!this.currentUser) return;
    const res = await api.managerReview(
      this.record.id, this.currentUser.name, this.currentUser.role, this.record.version, this.decision, this.opinion
    );
    if (!res.ok) {
      this.errors = (res.errors || []).map(e => e.message);
      return;
    }
    this.dispatchEvent(new CustomEvent('submitted'));
  }

  render() {
    return html`
      <div class="modal-mask" @click=${(e: Event) => { if ((e.target as HTMLElement).classList.contains('modal-mask')) this.dispatchEvent(new CustomEvent('close')); }}>
        <div class="modal">
          <div class="modal-header">
            生产经理复核 - ${this.record.record_no}
            <button class="modal-close" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row"><label>产品名称</label><input .value=${this.record.product_name} disabled /></div>
            <div class="form-row"><label>处理人</label><input .value=${this.currentUser?.name || ''} disabled /></div>
            <div class="form-row"><label>版本号</label><input .value=${'v' + this.record.version} disabled /></div>
            <div class="form-row"><label>复核决定</label>
              <select .value=${this.decision} @change=${(e: Event) => { this.decision = (e.target as HTMLSelectElement).value as any; }}>
                <option value="approve">复核通过</option>
                <option value="reject">驳回</option>
              </select>
            </div>
            <div class="form-row" style="align-items:flex-start"><label style="padding-top:6px">复核意见</label>
              <textarea .value=${this.opinion} @input=${(e: Event) => { this.opinion = (e.target as HTMLTextAreaElement).value; }} placeholder="请填写复核意见..."></textarea>
            </div>
            ${this.errors.length > 0 ? html`
              <div style="margin-top:12px; padding:10px; background:#fff1f0; border:1px solid #ffa39e; border-radius:6px;">
                ${this.errors.map(m => html`<div class="error-text">• ${m}</div>`)}
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>取消</button>
            <button class="btn ${this.decision === 'reject' ? 'btn-danger' : 'btn-success'}" @click=${this.submit}>
              提交复核
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
