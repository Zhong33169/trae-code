import { LitElement, html, css } from 'lit'
import { auditApi, statusMap, roleMap } from '../api/api.js'

export class AuditLogList extends LitElement {
  static properties = {
    logs: { type: Array },
    total: { type: Number },
    page: { type: Number },
    pageSize: { type: Number },
    loading: { type: Boolean },
    filterType: { type: String },
  }

  static styles = css`
    .page-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #111827;
    }

    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 20px;
    }

    .filter-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      align-items: center;
    }

    .filter-bar select {
      min-width: 160px;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
    }

    .table th,
    .table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }

    .table th {
      background-color: #f9fafb;
      font-weight: 600;
      color: #374151;
    }

    .table tr:hover {
      background-color: #f9fafb;
    }

    .action-tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .action-create { background: #dbeafe; color: #1e40af; }
    .action-update { background: #e0e7ff; color: #3730a3; }
    .action-submit { background: #fef3c7; color: #92400e; }
    .action-audit_pass { background: #d1fae5; color: #065f46; }
    .action-return, .action-review_return { background: #fee2e2; color: #991b1b; }
    .action-usage_confirm { background: #dcfce7; color: #166534; }
    .action-review, .action-archive { background: #e5e7eb; color: #374151; }

    .reservation-link {
      color: #2563eb;
      cursor: pointer;
    }

    .reservation-link:hover {
      text-decoration: underline;
    }

    .empty {
      text-align: center;
      padding: 40px;
      color: #9ca3af;
    }

    .pagination {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 20px;
      align-items: center;
    }

    .pagination button {
      padding: 6px 12px;
      min-width: 36px;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 4px;
      cursor: pointer;
    }

    .pagination button:hover:not(:disabled) {
      background: #f9fafb;
    }

    .pagination button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pagination-info {
      color: #6b7280;
      font-size: 13px;
    }

    .status-change {
      font-size: 12px;
      color: #6b7280;
    }

    .status-arrow {
      color: #9ca3af;
      margin: 0 4px;
    }

    .remark-box {
      background: #f9fafb;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      color: #4b5563;
      max-width: 300px;
    }
  `

  constructor() {
    super()
    this.logs = []
    this.total = 0
    this.page = 1
    this.pageSize = 20
    this.loading = true
    this.filterType = 'failures'
  }

  connectedCallback() {
    super.connectedCallback()
    this._loadData()
  }

  async _loadData() {
    this.loading = true
    try {
      let data
      if (this.filterType === 'failures') {
        data = await auditApi.failures({ page: this.page, page_size: this.pageSize })
      } else {
        data = await auditApi.list({ page: this.page, page_size: this.pageSize })
      }
      this.logs = data.items
      this.total = data.total || data.items?.length || 0
    } catch (e) {
      console.error('加载审计日志失败', e)
      this.logs = []
      this.total = 0
    } finally {
      this.loading = false
      this.requestUpdate()
    }
  }

  _onFilterChange(e) {
    this.filterType = e.target.value
    this.page = 1
    this._loadData()
  }

  _prevPage() {
    if (this.page > 1) {
      this.page--
      this._loadData()
    }
  }

  _nextPage() {
    if (this.page * this.pageSize < this.total) {
      this.page++
      this._loadData()
    }
  }

  _getActionName(action) {
    const names = {
      create: '创建',
      update: '更新',
      submit: '提交审核',
      audit_pass: '审核通过',
      return: '退回',
      usage_confirm: '使用确认',
      review: '复核通过',
      archive: '归档',
      review_return: '复核退回',
    }
    return names[action] || action
  }

  _getActionClass(action) {
    if (action.includes('return') || action.includes('reject')) return 'action-return'
    if (action === 'create') return 'action-create'
    if (action === 'update') return 'action-update'
    if (action === 'submit') return 'action-submit'
    if (action === 'audit_pass') return 'action-audit_pass'
    if (action === 'usage_confirm') return 'action-usage_confirm'
    if (action === 'review' || action === 'archive') return 'action-review'
    return ''
  }

  _formatTime(time) {
    if (!time) return '-'
    const d = new Date(time)
    if (isNaN(d.getTime())) return time
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  render() {
    return html`
      <h1 class="page-title">审计日志</h1>

      <div class="card">
        <div class="filter-bar">
          <select .value=${this.filterType} @change=${this._onFilterChange}>
            <option value="failures">失败/退回记录</option>
            <option value="all">全部操作记录</option>
          </select>
          <span style="color: #6b7280; font-size: 13px;">
            共 ${this.total} 条记录
          </span>
        </div>

        ${this.loading ? html`
          <div class="empty">加载中...</div>
        ` : this.logs.length === 0 ? html`
          <div class="empty">暂无记录</div>
        ` : html`
          <table class="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作</th>
                <th>操作人</th>
                <th>预约单</th>
                <th>状态变更</th>
                <th>备注/原因</th>
              </tr>
            </thead>
            <tbody>
              ${this.logs.map(log => html`
                <tr>
                  <td>${this._formatTime(log.created_at)}</td>
                  <td>
                    <span class="action-tag ${this._getActionClass(log.action)}">
                      ${this._getActionName(log.action)}
                    </span>
                  </td>
                  <td>
                    <div>${log.operator}</div>
                    <div style="font-size: 11px; color: #9ca3af;">
                      ${roleMap[log.operator_role] || log.operator_role}
                    </div>
                  </td>
                  <td>
                    ${log.reservation_no ? html`
                      <div class="reservation-link">${log.reservation_no}</div>
                      <div style="font-size: 11px; color: #6b7280;">${log.reservation_title}</div>
                    ` : '-'}
                  </td>
                  <td>
                    ${log.status_from && log.status_to ? html`
                      <div class="status-change">
                        <span>${statusMap[log.status_from] || log.status_from}</span>
                        <span class="status-arrow">→</span>
                        <span>${statusMap[log.status_to] || log.status_to}</span>
                      </div>
                    ` : '-'}
                  </td>
                  <td>
                    ${log.remark ? html`
                      <div class="remark-box">${log.remark}</div>
                    ` : '-'}
                  </td>
                </tr>
              `)}
            </tbody>
          </table>

          <div class="pagination">
            <button ?disabled=${this.page <= 1} @click=${this._prevPage}>上一页</button>
            <span class="pagination-info">
              第 ${this.page} 页 / 共 ${Math.ceil(this.total / this.pageSize)} 页
            </span>
            <button ?disabled=${this.page * this.pageSize >= this.total} @click=${this._nextPage}>下一页</button>
          </div>
        `}
      </div>
    `
  }
}

customElements.define('audit-log-list', AuditLogList)
