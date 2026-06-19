import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { SampleRecord, User } from '../types';
import { api } from '../api';

@customElement('appeal-modal')
export class AppealModal extends LitElement {
  static styles = css``;

  @property({ type: Object }) record!: SampleRecord;
  @property({ type: Object }) currentUser: User | null = null;
  @state() reason = '';
  @state() errors: string[] = [];

  get isResubmit() {
    return this.record.status === 'appeal_rejected';
  }

  async submit() {
    if (!this.currentUser || !this.reason.trim()) {
      this.errors = ['申诉理由不能为空'];
      return;
    }
    let res;
    if (this.isResubmit) {
      res = await api.resubmitAppeal(this.record.id, this.currentUser.name, this.currentUser.role, this.record.version, this.reason);
    } else {
      res = await api.submitAppeal(this.record.id, this.currentUser.name, this.currentUser.role, this.record.version, this.reason);
    }
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
            ${this.isResubmit ? '再次提交异常申诉' : '提交异常申诉'} - ${this.record.record_no}
            <button class="modal-close" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row"><label>产品名称</label><input .value=${this.record.product_name} disabled /></div>
            <div class="form-row"><label>当前状态</label><input .value=${this.record.status} disabled /></div>
            <div class="form-row"><label>提交人</label><input .value=${this.currentUser?.name || ''} disabled /></div>
            <div class="form-row"><label>版本号</label><input .value=${'v' + this.record.version} disabled /></div>
            <div class="form-row" style="align-items:flex-start"><label style="padding-top:6px">申诉理由</label>
              <textarea .value=${this.reason} @input=${(e: Event) => { this.reason = (e.target as HTMLTextAreaElement).value; }} placeholder="请详细说明申诉理由，包括异常原因、已采取的纠正措施、附随证据清单等..."></textarea>
            </div>
            <div class="hint muted small" style="margin:-6px 0 8px 122px">申诉受理后将流转至品控主管复核</div>
            ${this.errors.length > 0 ? html`
              <div style="margin-top:12px; padding:10px; background:#fff1f0; border:1px solid #ffa39e; border-radius:6px;">
                ${this.errors.map(m => html`<div class="error-text">• ${m}</div>`)}
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>取消</button>
            <button class="btn btn-warning" @click=${this.submit}>${this.isResubmit ? '再次提交申诉' : '提交申诉'}</button>
          </div>
        </div>
      </div>
    `;
  }
}
