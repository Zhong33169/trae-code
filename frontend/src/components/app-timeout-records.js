import { LitElement, html, css } from 'lit';
import { api } from '../services/api.js';

class AppTimeoutRecords extends LitElement {
  static properties = {
    user: { type: Object },
    records: { type: Array },
    loading: { type: Boolean },
    showHandleDialog: { type: Boolean },
    activeRecord: { type: Object },
    handleReason: { type: String },
    handleFollowUp: { type: String },
    error: { type: String },
    success: { type: String },
  };

  static styles = css`
    :host { display: block; }
    h2 { font-size: 18px; margin-bottom: 20px; color: #333; }
    .card {
      background: white; border-radius: 10px; padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 16px;
    }
    .timeout-item {
      border: 1px solid #fecaca; border-radius: 8px; padding: 14px;
      margin-bottom: 10px; background: #fef2f2;
    }
    .timeout-item.handled { background: #f0fdf4; border-color: #bbf7d0; }
    .field { font-size: 13px; margin-bottom: 6px; }
    .field .label { color: #888; display: inline-block; width: 90px; }
    .status-tag {
      display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;
    }
    .status-tag.pending { background: #fee2e2; color: #991b1b; }
    .status-tag.handled { background: #d1fae5; color: #065f46; }
    .form-status-tag {
      display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;
      background: #e0e7ff; color: #3730a3; margin-left: 4px;
    }
    .btn {
      padding: 4px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; border: none;
    }
    .btn-danger { background: #e53e3e; color: white; }
    .btn-danger:hover { background: #c53030; }
    .btn-outline { background: white; color: #555; border: 1px solid #ddd; }
    .btn-outline:hover { background: #f5f5f5; }
    .btn-warning { background: #ed8936; color: white; }
    .btn-warning:hover { background: #dd6b20; }
    .refresh-btn {
      padding: 6px 14px; border: 1px solid #ddd; border-radius: 6px;
      background: white; color: #555; font-size: 13px; cursor: pointer; float: right;
    }
    .refresh-btn:hover { background: #f5f5f5; }
    .empty { text-align: center; padding: 40px; color: #999; }
    .error-msg { background: #fee2e2; color: #991b1b; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 13px; }
    .success-msg { background: #d1fae5; color: #065f46; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 13px; }
    .dialog-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .dialog {
      background: white; border-radius: 12px; padding: 24px; width: 420px; max-width: 90vw;
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
    }
    .dialog h3 { margin: 0 0 16px; font-size: 16px; color: #333; }
    .dialog .form-group { margin-bottom: 14px; }
    .dialog label { display: block; font-size: 13px; color: #555; margin-bottom: 4px; font-weight: 500; }
    .dialog textarea {
      width: 100%; min-height: 60px; border: 1px solid #ddd; border-radius: 6px;
      padding: 8px; font-size: 13px; box-sizing: border-box; resize: vertical;
    }
    .dialog textarea:focus { outline: none; border-color: #667eea; }
    .btn-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
    .actions-bar { display: flex; gap: 6px; margin-top: 8px; }
    .link { color: #667eea; text-decoration: none; cursor: pointer; }
    .link:hover { text-decoration: underline; }
  `;

  constructor() {
    super();
    this.records = [];
    this.loading = true;
    this.showHandleDialog = false;
    this.activeRecord = null;
    this.handleReason = '';
    this.handleFollowUp = '';
    this.error = '';
    this.success = '';
  }

  async connectedCallback() {
    super.connectedCallback();
    this._onFormUpdated = async () => { await this._loadData(); };
    window.addEventListener('form-updated', this._onFormUpdated);
    await this._loadData();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('form-updated', this._onFormUpdated);
  }

  async _loadData() {
    this.loading = true;
    this.error = '';
    this.success = '';
    try {
      this.records = await api.listTimeoutRecords();
    } catch (e) {
      this.error = e.message;
    }
    this.loading = false;
  }

  _openHandleDialog(record) {
    this.activeRecord = record;
    this.handleReason = '';
    this.handleFollowUp = '';
    this.error = '';
    this.showHandleDialog = true;
  }

  async _doHandle() {
    if (!this.handleReason.trim() || !this.handleFollowUp.trim()) {
      this.error = '请填写超时原因和后续处理记录';
      return;
    }
    try {
      await api.handleTimeout(this.activeRecord.form_id, {
        reason: this.handleReason,
        follow_up: this.handleFollowUp,
      });
      this.showHandleDialog = false;
      this.activeRecord = null;
      this.handleReason = '';
      this.handleFollowUp = '';
      await this._loadData();
      this.success = '超时处理成功';
      window.dispatchEvent(new CustomEvent('form-updated'));
    } catch (e) {
      this.error = e.message;
    }
  }

  render() {
    if (this.loading) return html`<div style="text-align:center;padding:40px;color:#888;">加载中...</div>`;

    return html`
      <div class="card">
        <h2>超时记录
          <button class="refresh-btn" @click=${this._loadData}>刷新</button>
        </h2>
        ${this.error && !this.showHandleDialog ? html`<div class="error-msg">${this.error}</div>` : ''}
        ${this.success ? html`<div class="success-msg">${this.success}</div>` : ''}
        ${this.records.length === 0 ? html`<div class="empty">暂无超时记录</div>` : html`
          ${this.records.map(r => html`
            <div class="timeout-item ${r.status === 'handled' ? 'handled' : ''}">
              <div class="field">
                <span class="label">排课单:</span>
                ${r.form_no ? html`
                  <a class="link" @click=${() => {
                    this.dispatchEvent(new CustomEvent('navigate', {
                      detail: { route: 'detail', params: { id: r.form_id } },
                      bubbles: true, composed: true,
                    }));
                  }}>${r.form_no}</a>
                  <span style="color:#666;margin-left:4px;">${r.form_title || ''}</span>
                ` : html`ID: ${r.form_id}`}
              </div>
              <div class="field">
                <span class="label">排课单状态:</span>
                ${r.form_status_label ? html`<span class="form-status-tag">${r.form_status_label}</span>` : '-'}
              </div>
              <div class="field"><span class="label">超时节点:</span>${r.node_label}</div>
              <div class="field"><span class="label">超时时间:</span>${r.timeout_at}</div>
              <div class="field">
                <span class="label">处理状态:</span>
                <span class="status-tag ${r.status}">${r.status === 'pending' ? '待处理' : '已处理'}</span>
              </div>
              ${r.reason ? html`<div class="field"><span class="label">原因:</span>${r.reason}</div>` : ''}
              ${r.follow_up ? html`<div class="field"><span class="label">后续处理:</span>${r.follow_up}</div>` : ''}
              ${r.handled_by_name ? html`<div class="field"><span class="label">处理人:</span>${r.handled_by_name}</div>` : ''}
              ${r.handled_at ? html`<div class="field"><span class="label">处理时间:</span>${r.handled_at}</div>` : ''}

              ${r.status === 'pending' && r.has_pending_timeout && r.submit_actions?.some(a => a.action === 'timeout_handle') ? html`
                <div class="actions-bar">
                  <button class="btn btn-danger" @click=${() => this._openHandleDialog(r)}>
                    超时处理
                  </button>
                </div>
              ` : ''}
            </div>
          `)}
        `}
      </div>

      ${this.showHandleDialog ? html`
        <div class="dialog-overlay" @click=${(e) => { if (e.target === e.currentTarget) this.showHandleDialog = false; }}>
          <div class="dialog">
            <h3>超时处理 - ${this.activeRecord?.form_no || ''}</h3>
            ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}
            <div class="form-group">
              <label>超时原因 <span style="color:#e53e3e;">*</span></label>
              <textarea .value=${this.handleReason} @input=${(e) => this.handleReason = e.target.value} placeholder="请填写超时原因"></textarea>
            </div>
            <div class="form-group">
              <label>后续处理记录 <span style="color:#e53e3e;">*</span></label>
              <textarea .value=${this.handleFollowUp} @input=${(e) => this.handleFollowUp = e.target.value} placeholder="请填写后续处理措施"></textarea>
            </div>
            <div class="btn-row">
              <button class="btn btn-outline" @click=${() => { this.showHandleDialog = false; }}>取消</button>
              <button class="btn btn-warning" @click=${this._doHandle}>提交处理</button>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }
}

customElements.define('app-timeout-records', AppTimeoutRecords);
