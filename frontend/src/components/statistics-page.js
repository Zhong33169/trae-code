import { LitElement, html, css } from 'lit';
import { api, STATUS_LABELS } from '../api.js';

export class StatisticsPage extends LitElement {
  static properties = {
    stats: { type: Object },
    loading: { type: Boolean },
    error: { type: String }
  };

  static styles = css`
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card {
      background: #fff; border-radius: 6px; padding: 20px 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: relative; overflow: hidden;
    }
    .stat-card .num { font-size: 30px; font-weight: 600; color: #262626; line-height: 1; }
    .stat-card .label { font-size: 13px; color: #666; margin-top: 8px; }
    .stat-card .icon {
      position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
      font-size: 44px; opacity: 0.12;
    }
    .s-total { border-left: 4px solid #1890ff; }
    .s-pending { border-left: 4px solid #fa8c16; }
    .s-approve { border-left: 4px solid #52c41a; }
    .s-timeout { border-left: 4px solid #f5222d; }

    .detail-card { background: #fff; border-radius: 6px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    h3 { margin: 0 0 16px; font-size: 15px; }
    .bar-list { display: flex; flex-direction: column; gap: 12px; }
    .bar-item { display: flex; align-items: center; font-size: 13px; }
    .bar-label { width: 100px; color: #595959; flex-shrink: 0; }
    .bar-track { flex: 1; height: 20px; background: #f0f0f0; border-radius: 3px; overflow: hidden; position: relative; }
    .bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }
    .bar-value { width: 60px; text-align: right; color: #262626; font-weight: 500; padding-left: 12px; }
    .empty { text-align: center; padding: 60px 0; color: #999; }
  `;

  constructor() {
    super();
    this.stats = null;
    this.loading = true;
    this.error = '';
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      this.stats = await api.getStatistics();
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.loading) return html`<div class="empty">加载中...</div>`;
    if (this.error) return html`<div class="empty">${this.error}</div>`;
    if (!this.stats) return html`<div class="empty">暂无数据</div>`;

    const s = this.stats;
    const total = s.total || 1;
    const bars = [
      { key: 'pending_review', label: STATUS_LABELS.pending_review, val: s.pending_review, color: '#fa8c16' },
      { key: 'budget_checking', label: STATUS_LABELS.budget_checking, val: s.budget_checking, color: '#1890ff' },
      { key: 'pending_confirm', label: STATUS_LABELS.pending_confirm, val: s.pending_confirm, color: '#722ed1' },
      { key: 'approved', label: STATUS_LABELS.approved, val: s.approved, color: '#52c41a' },
      { key: 'synced', label: STATUS_LABELS.synced, val: s.synced, color: '#13c2c2' },
      { key: 'rejected', label: STATUS_LABELS.rejected, val: s.rejected, color: '#f5222d' },
    ];
    const inProgress = (s.pending_review || 0) + (s.budget_checking || 0) + (s.pending_confirm || 0);

    return html`
      <div class="stats-grid">
        <div class="stat-card s-total">
          <div class="num">${s.total || 0}</div>
          <div class="label">全部申请</div>
          <div class="icon">📋</div>
        </div>
        <div class="stat-card s-pending">
          <div class="num">${inProgress}</div>
          <div class="label">进行中</div>
          <div class="icon">⏳</div>
        </div>
        <div class="stat-card s-approve">
          <div class="num">${(s.approved || 0) + (s.synced || 0)}</div>
          <div class="label">已完成</div>
          <div class="icon">✅</div>
        </div>
        <div class="stat-card s-timeout">
          <div class="num">${s.timeout_count || 0}</div>
          <div class="label">超时数量</div>
          <div class="icon">⚠️</div>
        </div>
      </div>

      <div class="detail-card">
        <h3>状态分布</h3>
        <div class="bar-list">
          ${bars.map(b => html`
            <div class="bar-item">
              <span class="bar-label">${b.label}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width:${(b.val / total * 100).toFixed(1)}%; background:${b.color}"></div>
              </div>
              <span class="bar-value">${b.val} (${(b.val / total * 100).toFixed(1)}%)</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}

customElements.define('statistics-page', StatisticsPage);
