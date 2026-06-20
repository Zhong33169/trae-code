import { LitElement, html, css } from 'lit';
import { api } from '../services/api.js';

const STATUS_LABELS = {
  draft: '草稿', pending_review: '待审核', reviewing: '审核中',
  pending_courseware: '待课件审核', courseware_reviewing: '课件审核中',
  pending_teaching: '待授课', teaching_completed: '授课完成',
  pending_evaluation: '待课后评价', evaluating: '评价中',
  pending_archive: '待归档', archived: '已归档',
  rejected: '已驳回', timeout_handling: '超时处理中',
};

class AppTimeoutRecords extends LitElement {
  static properties = {
    records: { type: Array },
    loading: { type: Boolean },
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
    .field .label { color: #888; display: inline-block; width: 80px; }
    .status-tag {
      display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;
    }
    .status-tag.pending { background: #fee2e2; color: #991b1b; }
    .status-tag.handled { background: #d1fae5; color: #065f46; }
    .refresh-btn {
      padding: 6px 14px; border: 1px solid #ddd; border-radius: 6px;
      background: white; color: #555; font-size: 13px; cursor: pointer; float: right;
    }
    .refresh-btn:hover { background: #f5f5f5; }
    .empty { text-align: center; padding: 40px; color: #999; }
  `;

  constructor() {
    super();
    this.records = [];
    this.loading = true;
  }

  async connectedCallback() {
    super.connectedCallback();
    await this._loadData();
  }

  async _loadData() {
    this.loading = true;
    try {
      this.records = await api.listTimeoutRecords();
    } catch (e) {
      console.error('加载超时记录失败:', e);
    }
    this.loading = false;
  }

  render() {
    if (this.loading) return html`<div style="text-align:center;padding:40px;color:#888;">加载中...</div>`;

    return html`
      <div class="card">
        <h2>超时记录
          <button class="refresh-btn" @click=${this._loadData}>刷新</button>
        </h2>
        ${this.records.length === 0 ? html`<div class="empty">暂无超时记录</div>` : html`
          ${this.records.map(r => html`
            <div class="timeout-item ${r.status === 'handled' ? 'handled' : ''}">
              <div class="field">
                <span class="label">排课单ID:</span>
                <a href="#" style="color:#667eea;text-decoration:none;" @click=${(e) => {
                  e.preventDefault();
                  this.dispatchEvent(new CustomEvent('navigate', {
                    detail: { route: 'detail', params: { id: r.form_id } },
                    bubbles: true, composed: true,
                  }));
                }}>${r.form_id}</a>
              </div>
              <div class="field"><span class="label">节点:</span>${r.node_label}</div>
              <div class="field"><span class="label">超时时间:</span>${r.timeout_at}</div>
              <div class="field"><span class="label">状态:</span><span class="status-tag ${r.status}">${r.status === 'pending' ? '待处理' : '已处理'}</span></div>
              ${r.reason ? html`<div class="field"><span class="label">原因:</span>${r.reason}</div>` : ''}
              ${r.follow_up ? html`<div class="field"><span class="label">后续处理:</span>${r.follow_up}</div>` : ''}
              ${r.handled_by_name ? html`<div class="field"><span class="label">处理人:</span>${r.handled_by_name}</div>` : ''}
              ${r.handled_at ? html`<div class="field"><span class="label">处理时间:</span>${r.handled_at}</div>` : ''}
            </div>
          `)}
        `}
      </div>
    `;
  }
}

customElements.define('app-timeout-records', AppTimeoutRecords);
