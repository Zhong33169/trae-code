import { LitElement, html, css } from 'lit';
import { api, ROLE_LABELS } from '../api.js';

export class LogsPage extends LitElement {
  static properties = {
    logs: { type: Array },
    loading: { type: Boolean },
    error: { type: String }
  };

  static styles = css`
    .card { background: #fff; border-radius: 6px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    h3 { margin: 0 0 16px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
    th { background: #fafafa; font-weight: 600; color: #262626; }
    .empty { text-align: center; padding: 60px 0; color: #999; }
    .action-tag {
      display: inline-block; padding: 2px 8px; border-radius: 3px;
      background: #e6f7ff; color: #1890ff; font-size: 12px;
    }
    .user-tag { color: #666; }
    .role-tag { font-size: 12px; color: #888; }
  `;

  constructor() {
    super();
    this.logs = [];
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
      this.logs = await api.listOperationLogs();
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.loading) return html`<div class="empty">加载中...</div>`;
    if (this.error) return html`<div class="empty">${this.error}</div>`;

    return html`
      <div class="card">
        <h3>操作日志</h3>
        ${this.logs.length === 0 ? html`<div class="empty">暂无日志</div>` : html`
          <table>
            <thead>
              <tr>
                <th style="width:160px;">时间</th>
                <th style="width:120px;">操作人</th>
                <th style="width:130px;">动作</th>
                <th style="width:110px;">目标类型</th>
                <th style="width:80px;">目标ID</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              ${this.logs.map(l => html`
                <tr>
                  <td>${this.formatDate(l.created_at)}</td>
                  <td>
                    <span class="user-tag">${l.user?.real_name || '-'}</span>
                    <span class="role-tag">${l.user?.role ? ' · ' + ROLE_LABELS[l.user.role] : ''}</span>
                  </td>
                  <td><span class="action-tag">${l.action}</span></td>
                  <td>${l.target_type || '-'}</td>
                  <td>${l.target_id || '-'}</td>
                  <td>${l.detail || '-'}</td>
                </tr>
              `)}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  formatDate(str) {
    if (!str) return '-';
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
}

customElements.define('logs-page', LogsPage);
