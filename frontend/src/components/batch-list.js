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
    .section-badge { display: inline-block; padding: 2px 8px; font-size: 12px; border-radius: 4px; margin-left: 6px; font-weight: normal; }
    .badge-online { background: #dbeafe; color: #1e40af; }
    .badge-offline { background: #fef3c7; color: #92400e; }
    .badge-diff { background: #fee2e2; color: #991b1b; }
    .badge-ok { background: #d1fae5; color: #065f46; }
    .reconcile-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0; }
    .reconcile-summary .summary-card { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; text-align: center; }
    .summary-card .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .summary-card .value { font-size: 18px; font-weight: 600; color: #111827; }
    .summary-card.ok .value { color: #059669; }
    .summary-card.diff .value { color: #dc2626; }
    .diff-box { background: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #ef4444; border-radius: 4px; padding: 10px 14px; margin: 8px 0; font-size: 12px; }
    .diff-box .d-title { font-weight: 600; color: #991b1b; margin-bottom: 4px; }
    .diff-box .d-row { color: #6b7280; display: flex; gap: 16px; font-size: 12px; }
    .diff-box .d-row span.online { color: #1e40af; }
    .diff-box .d-row span.offline { color: #92400e; }
    .rec-tag { display:inline-block; padding:2px 6px; border-radius:3px; font-size:11px; margin-right:4px; }
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
          <div class="modal" style="max-width: 900px;">
            <div class="modal-header">
              <div class="modal-title">批次详情 - ${this.selectedBatch?.batch_no}</div>
              <div class="close-btn" @click=${this._closeDetail}>×</div>
            </div>

            ${this.selectedBatch?.warning ? html`
              <div style="background: ${this.selectedBatch.blocked ? '#fee2e2' : '#fef3c7'}; padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: ${this.selectedBatch.blocked ? '#991b1b' : '#92400e'}; border: 1px solid ${this.selectedBatch.blocked ? '#fca5a5' : '#fcd34d'};">
                ${this.selectedBatch.blocked ? '🚫 阻断：' : '⚠️ '}${this.selectedBatch.warning}
              </div>
            ` : ''}

            <div style="margin-bottom: 12px; font-size: 13px; color: #6b7280;">
              批次状态：${this._getStatusLabel(this.selectedBatch?.batch_status)}
              <span class="section-badge ${this.selectedBatch?.check_status === 'checked' ? 'badge-ok' : (this.selectedBatch?.check_status === 'blocked' ? 'badge-diff' : 'badge-offline')}">
                ${this.selectedBatch?.check_status === 'checked' ? '已核对' : (this.selectedBatch?.check_status === 'has_diff' ? '有差异' : (this.selectedBatch?.check_status === 'blocked' ? '已阻断' : '未核对'))}
              </span>
            </div>

            ${this.selectedBatch?.reconcile ? this._renderReconcile(this.selectedBatch.reconcile) : ''}

            <div style="font-size: 14px; font-weight: 600; margin: 16px 0 8px; color: #374151;">
              逐单线上线下对比
            </div>
            <table class="table">
              <thead>
                <tr>
                  <th>预约单 / 标题</th>
                  <th>线上状态 <span class="section-badge badge-online">线上</span></th>
                  <th>线下状态 <span class="section-badge badge-offline">线下</span></th>
                  <th>线上附件</th>
                  <th>核对结果</th>
                </tr>
              </thead>
              <tbody>
                ${this.batchReservations.map(r => {
                  const rec = this.selectedBatch?.reconcile?.item_results?.find(x => x.reservation_no === r.reservation_no)
                  const isDiff = rec && !rec.is_consistent
                  return html`
                    <tr style="${isDiff ? 'background:#fff1f2;' : ''}">
                      <td>
                        <div style="font-weight:500;">${r.reservation_no}</div>
                        <div style="font-size:12px; color:#6b7280;">${r.title}</div>
                        <div style="font-size:11px; color:#9ca3af; margin-top:2px;">${r.meeting_room} ${r.meeting_date}</div>
                        ${isDiff ? html`
                          <div style="margin-top:6px;">
                            ${rec.status_diffs?.map(d => html`<div class="diff-box" style="margin:2px 0;"><div class="d-row"><span class="online">线上：${d.online_value}</span><span class="offline">线下：${d.offline_value}</span></div><div style="color:#991b1b; margin-top:2px;">${d.message}</div></div>`)}
                            ${rec.attachment_diffs?.map(d => html`<div class="diff-box" style="margin:2px 0;"><div class="d-title">附件：${d.message}</div><div class="d-row"><span class="online">线上：${d.online_value}</span><span class="offline">线下：${d.offline_value}</span></div></div>`)}
                          </div>
                        ` : ''}
                      </td>
                      <td><span class="status-tag status-${r.status}">${statusMap[r.status] || r.status}</span></td>
                      <td>${r.offline_status ? html`<span class="status-tag" style="background:#fef3c7; color:#92400e;">${statusMap[r.offline_status] || r.offline_status}</span>` : html`<span style="color:#9ca3af;">未填写</span>`}</td>
                      <td>
                        <div style="font-size:12px;">${r.attachment_names || '（无）'}</div>
                        <div style="font-size:11px; color:#92400e; margin-top:2px;">线下附件：${Array.isArray(r.offline_attachment_list) && r.offline_attachment_list.length ? r.offline_attachment_list.join('、') : (r.offline_attachment_count || 0) + '份'}</div>
                      </td>
                      <td>
                        ${rec ? html`
                          <span class="status-tag" style="background:${rec.is_consistent ? '#d1fae5; color:#065f46;' : '#fee2e2; color:#991b1b;'}">
                            ${rec.is_consistent ? '✓ 一致' : '✗ 差异'}
                          </span>
                        ` : html`<span style="color:#9ca3af;">-</span>`}
                      </td>
                    </tr>
                  `
                })}
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

  _renderReconcile(rec) {
    if (!rec) return ''
    return html`
      <div style="background:#fafafa; border:1px solid #e5e7eb; border-radius:6px; padding:12px 16px;">
        <div style="font-size:13px; font-weight:600; color:${rec.is_consistent ? '#065f46' : (rec.is_blocked ? '#991b1b' : '#92400e')}; margin-bottom:8px;">
          ${rec.is_consistent ? '✓ 线上线下一致' : (rec.is_blocked ? '🚫 核对阻断' : '⚠️ 存在差异')}
          - ${rec.message}
        </div>
        <div class="reconcile-summary">
          <div class="summary-card"><div class="label">线上数量</div><div class="value">${rec.total_online}</div></div>
          <div class="summary-card"><div class="label">线下数量</div><div class="value">${rec.total_offline}</div></div>
          <div class="summary-card ${rec.diff_count === 0 ? 'ok' : 'diff'}"><div class="label">差异项</div><div class="value">${rec.diff_count}</div></div>
          <div class="summary-card ${rec.is_consistent ? 'ok' : 'diff'}"><div class="label">核对</div><div class="value">${rec.is_consistent ? '通过' : '未通过'}</div></div>
        </div>
        ${rec.diffs?.length ? html`
          <div>
            ${rec.diffs.map(d => html`
              <div class="diff-box">
                <div class="d-title">${d.field} - ${d.message || ''}</div>
                ${d.online_value !== undefined ? html`<div class="d-row"><span class="online">线上：${Array.isArray(d.online_value) ? d.online_value.map(s => statusMap[s] || s).join('、') : (d.online_value ?? '-')}</span><span class="offline">线下：${d.offline_value ?? '-'}</span></div>` : ''}
              </div>
            `)}
          </div>
        ` : ''}
      </div>
    `
  }
}

customElements.define('batch-list', BatchList)
