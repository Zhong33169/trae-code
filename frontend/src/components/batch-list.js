import { LitElement, html, css } from 'lit'
import { batchApi, statusMap } from '../api/api.js'

export class BatchList extends LitElement {
  static properties = {
    userRole: { type: String },
    batches: { type: Array },
    loading: { type: Boolean },
    selectedBatch: { type: Object },
    batchReservations: { type: Array },
    showDetail: { type: Boolean },
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
      margin-bottom: 16px;
    }

    .batch-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 16px;
      margin-bottom: 12px;
      cursor: pointer;
      border-left: 4px solid #e5e7eb;
      transition: all 0.2s;
    }

    .batch-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .batch-card.mismatch {
      border-left-color: #f59e0b;
      background: #fffbeb;
    }

    .batch-card.returned {
      border-left-color: #dc2626;
    }

    .batch-card.completed {
      border-left-color: #16a34a;
    }

    .batch-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .batch-no {
      font-weight: 600;
      font-size: 15px;
      color: #111827;
    }

    .batch-status {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    .status-processing { background: #dbeafe; color: #1e40af; }
    .status-completed { background: #d1fae5; color: #065f46; }
    .status-returned { background: #fee2e2; color: #991b1b; }

    .batch-info {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #6b7280;
    }

    .batch-warning {
      margin-top: 8px;
      padding: 8px 12px;
      background: #fef3c7;
      border-radius: 4px;
      font-size: 12px;
      color: #92400e;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 700px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 600;
    }

    .close-btn {
      cursor: pointer;
      font-size: 20px;
      color: #9ca3af;
    }

    .close-btn:hover {
      color: #374151;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
    }

    .table th,
    .table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }

    .table th {
      background-color: #f9fafb;
      font-weight: 600;
      color: #374151;
    }

    .status-tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-draft { background: #f3f4f6; color: #4b5563; }
    .status-pending_audit { background: #fef3c7; color: #92400e; }
    .status-approved { background: #dbeafe; color: #1e40af; }
    .status-usage_confirmed { background: #d1fae5; color: #065f46; }
    .status-archived { background: #e5e7eb; color: #374151; }
    .status-returned { background: #fee2e2; color: #991b1b; }
    .status-overdue { background: #fecaca; color: #7f1d1d; }

    .empty {
      text-align: center;
      padding: 40px;
      color: #9ca3af;
    }

    .batch-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      text-align: center;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
    }

    .stat-label {
      font-size: 13px;
      color: #6b7280;
      margin-top: 4px;
    }
  `

  constructor() {
    super()
    this.batches = []
    this.loading = true
    this.selectedBatch = null
    this.batchReservations = []
    this.showDetail = false
  }

  connectedCallback() {
    super.connectedCallback()
    this._loadBatches()
  }

  async _loadBatches() {
    this.loading = true
    try {
      const data = await batchApi.list()
      this.batches = data.items
    } catch (e) {
      console.error('加载批次列表失败', e)
    } finally {
      this.loading = false
      this.requestUpdate()
    }
  }

  async _viewBatch(batchNo) {
    try {
      const data = await batchApi.get(batchNo)
      this.selectedBatch = data
      this.batchReservations = data.items
      this.showDetail = true
      this.requestUpdate()
    } catch (e) {
      console.error('加载批次详情失败', e)
    }
  }

  _closeDetail() {
    this.showDetail = false
    this.selectedBatch = null
    this.batchReservations = []
    this.requestUpdate()
  }

  _getStatusLabel(status) {
    const labels = {
      processing: '处理中',
      completed: '已完成',
      returned: '已退回',
    }
    return labels[status] || status
  }

  render() {
    const stats = this._getStats()

    return html`
      <h1 class="page-title">批次管理</h1>

      <div class="batch-summary">
        <div class="stat-card">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">总批次数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #2563eb;">${stats.processing}</div>
          <div class="stat-label">处理中</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #16a34a;">${stats.completed}</div>
          <div class="stat-label">已完成</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #f59e0b;">${stats.mismatch}</div>
          <div class="stat-label">状态不一致</div>
        </div>
      </div>

      ${this.loading ? html`
        <div class="card">加载中...</div>
      ` : this.batches.length === 0 ? html`
        <div class="card empty">暂无批次数据</div>
      ` : html`
        ${this.batches.map(batch => html`
          <div class="batch-card ${batch.status_mismatch ? 'mismatch' : ''} ${batch.status}"
               @click=${() => this._viewBatch(batch.batch_no)}>
            <div class="batch-header">
              <span class="batch-no">${batch.batch_no}</span>
              <span class="batch-status status-${batch.status}">
                ${this._getStatusLabel(batch.status)}
              </span>
            </div>
            <div class="batch-info">
              <span>预约单数：${batch.reservation_count}</span>
              <span>创建人：${batch.created_by || '-'}</span>
              <span>创建时间：${this._formatTime(batch.created_at)}</span>
            </div>
            ${batch.status_mismatch ? html`
              <div class="batch-warning">
                ⚠️ ${batch.mismatch_warning}
                （状态：${batch.statuses?.map(s => statusMap[s] || s).join('、')}）
              </div>
            ` : ''}
            ${batch.remark ? html`
              <div class="batch-warning" style="background: #f0f9ff; color: #0369a1;">
                📝 ${batch.remark}
              </div>
            ` : ''}
          </div>
        `)}
      `}

      ${this.showDetail ? html`
        <div class="modal-overlay" @click=${(e) => { if (e.target === e.currentTarget) this._closeDetail() }}>
          <div class="modal">
            <div class="modal-header">
              <div class="modal-title">批次详情 - ${this.selectedBatch?.batch_no}</div>
              <div class="close-btn" @click=${this._closeDetail}>×</div>
            </div>

            ${this.selectedBatch?.warning ? html`
              <div style="background: #fef3c7; padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: #92400e;">
                ⚠️ ${this.selectedBatch.warning}
              </div>
            ` : ''}

            <div style="margin-bottom: 12px; font-size: 13px; color: #6b7280;">
              批次状态：${this._getStatusLabel(this.selectedBatch?.batch_status)} |
              共 ${this.selectedBatch?.total} 条预约单
            </div>

            <table class="table">
              <thead>
                <tr>
                  <th>预约单号</th>
                  <th>会议主题</th>
                  <th>会议室</th>
                  <th>日期</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                ${this.batchReservations.map(r => html`
                  <tr>
                    <td>${r.reservation_no}</td>
                    <td>${r.title}</td>
                    <td>${r.meeting_room}</td>
                    <td>${r.meeting_date}</td>
                    <td>
                      <span class="status-tag status-${r.status}">
                        ${statusMap[r.status] || r.status}
                      </span>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `
  }

  _getStats() {
    const stats = {
      total: this.batches.length,
      processing: 0,
      completed: 0,
      mismatch: 0,
    }
    this.batches.forEach(b => {
      if (b.status === 'processing') stats.processing++
      if (b.status === 'completed') stats.completed++
      if (b.status_mismatch) stats.mismatch++
    })
    return stats
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
}

customElements.define('batch-list', BatchList)
