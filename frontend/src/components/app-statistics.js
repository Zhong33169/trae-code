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

class AppStatistics extends LitElement {
  static properties = {
    statistics: { type: Object },
    loading: { type: Boolean },
  };

  static styles = css`
    :host { display: block; }
    .card {
      background: white; border-radius: 10px; padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 16px;
    }
    h2 { font-size: 18px; margin-bottom: 20px; color: #333; }
    .overview {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;
      margin-bottom: 24px;
    }
    .stat-item {
      text-align: center; padding: 20px; border-radius: 10px; background: #f8fafc;
    }
    .stat-item .value { font-size: 36px; font-weight: 700; }
    .stat-item .label { font-size: 13px; color: #888; margin-top: 4px; }
    .stat-item.total .value { color: #667eea; }
    .stat-item.pending .value { color: #dd6b20; }
    .stat-item.timeout .value { color: #e53e3e; }
    .stat-item.archived .value { color: #38a169; }
    .status-chart {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;
    }
    .status-bar-item {
      display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; background: #f8fafc;
    }
    .bar-label { font-size: 13px; color: #555; width: 80px; flex-shrink: 0; }
    .bar-track { flex: 1; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 10px; transition: width 0.5s; }
    .bar-count { font-size: 13px; font-weight: 600; width: 30px; text-align: right; color: #333; }
    .refresh-btn {
      padding: 6px 14px; border: 1px solid #ddd; border-radius: 6px;
      background: white; color: #555; font-size: 13px; cursor: pointer; float: right;
    }
    .refresh-btn:hover { background: #f5f5f5; }
  `;

  constructor() {
    super();
    this.statistics = null;
    this.loading = true;
  }

  async connectedCallback() {
    super.connectedCallback();
    await this._loadData();
  }

  async _loadData() {
    this.loading = true;
    try {
      this.statistics = await api.getStatistics();
    } catch (e) {
      console.error('加载统计数据失败:', e);
    }
    this.loading = false;
  }

  render() {
    if (this.loading) return html`<div style="text-align:center;padding:40px;color:#888;">加载中...</div>`;
    if (!this.statistics) return html`<div style="text-align:center;padding:40px;color:#c33;">加载失败</div>`;

    const s = this.statistics;
    const maxCount = Math.max(...Object.values(s.by_status || {}), 1);

    const colors = {
      draft: '#94a3b8', pending_review: '#f59e0b', reviewing: '#3b82f6',
      pending_courseware: '#f59e0b', courseware_reviewing: '#3b82f6',
      pending_teaching: '#f59e0b', teaching_completed: '#10b981',
      pending_evaluation: '#f59e0b', evaluating: '#3b82f6',
      pending_archive: '#f59e0b', archived: '#6366f1',
      rejected: '#ef4444', timeout_handling: '#ef4444',
    };

    return html`
      <div class="card">
        <h2>统计概览
          <button class="refresh-btn" @click=${this._loadData}>刷新</button>
        </h2>
        <div class="overview">
          <div class="stat-item total">
            <div class="value">${s.total}</div>
            <div class="label">排课单总数</div>
          </div>
          <div class="stat-item pending">
            <div class="value">${s.pending_count}</div>
            <div class="label">待处理</div>
          </div>
          <div class="stat-item timeout">
            <div class="value">${s.timeout_count}</div>
            <div class="label">超时待处理</div>
          </div>
          <div class="stat-item archived">
            <div class="value">${s.by_status?.archived || 0}</div>
            <div class="label">已归档</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size:15px;margin-bottom:16px;color:#333;">状态分布</h3>
        <div class="status-chart">
          ${(s.by_status ? Object.entries(s.by_status) : []).map(([status, count]) => html`
            <div class="status-bar-item">
              <span class="bar-label">${STATUS_LABELS[status] || status}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width:${(count / maxCount) * 100}%;background:${colors[status] || '#667eea'};"></div>
              </div>
              <span class="bar-count">${count}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}

customElements.define('app-statistics', AppStatistics);
