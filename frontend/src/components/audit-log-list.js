import { LitElement, html, css } from 'lit'
import { auditApi, statusMap, roleMap, batchApi } from '../api/api.js'

export class AuditLogList extends LitElement {
  static properties = {
    logs: { type: Array },
    blockLogs: { type: Array },
    total: { type: Number },
    page: { type: Number },
    pageSize: { type: Number },
    loading: { type: Boolean },
    filterType: { type: String },
    batchFilter: { type: String },
    batchOptions: { type: Array },
    operatorFilter: { type: String },
  }

  static styles = css`
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #111827; }
    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 20px; margin-bottom: 16px; }
    .filter-bar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; flex-wrap: wrap; }
    .filter-bar select, .filter-bar input { min-width: 160px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
    .table th { background-color: #f9fafb; font-weight: 600; color: #374151; }
    .table tr:hover { background-color: #f9fafb; }
    .action-tag { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .action-create { background: #dbeafe; color: #1e40af; }
    .action-update { background: #e0e7ff; color: #3730a3; }
    .action-submit { background: #fef3c7; color: #92400e; }
    .action-audit_pass { background: #d1fae5; color: #065f46; }
    .action-return, .action-review_return { background: #fee2e2; color: #991b1b; }
    .action-usage_confirm { background: #dcfce7; color: #166534; }
    .action-review, .action-archive { background: #e5e7eb; color: #374151; }
    .action-block { background: #fecaca; color: #7f1d1d; }
    .reservation-link { color: #2563eb; cursor: pointer; }
    .reservation-link:hover { text-decoration: underline; }
    .empty { text-align: center; padding: 40px; color: #9ca3af; }
    .pagination { display: flex; justify-content: center; gap: 8px; margin-top: 20px; align-items: center; }
    .pagination button { padding: 6px 12px; min-width: 36px; border: 1px solid #d1d5db; background: white; border-radius: 4px; cursor: pointer; }
    .pagination button:hover:not(:disabled) { background: #f9fafb; }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination-info { color: #6b7280; font-size: 13px; }
    .status-change { font-size: 12px; color: #6b7280; }
    .status-arrow { color: #9ca3af; margin: 0 4px; }
    .remark-box { background: #f9fafb; padding: 6px 10px; border-radius: 4px; font-size: 12px; color: #4b5563; max-width: 320px; }
    .batch-tag { display: inline-block; padding: 2px 8px; background: #f3f4f6; color: #374151; border-radius: 4px; font-size: 12px; margin-right: 4px; }
    .item-result-list { margin-top: 6px; }
    .item-result-row { font-size: 11px; color: #6b7280; padding: 3px 6px; background: #fafafa; border-radius: 3px; margin-bottom: 2px; }
    .item-result-row.ok { color: #065f46; }
    .item-result-row.diff { color: #991b1b; background: #fff1f2; }
    .detail-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; padding: 8px 10px; margin-top: 6px; font-size: 12px; }
    .detail-box .d-item { padding: 2px 0; }
    .detail-box .d-label { font-weight: 600; color: #7f1d1d; }
    .tabs { display: flex; gap: 0; border-bottom: 2px solid #e5e7eb; margin-bottom: 16px; }
    .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-weight: 500; color: #6b7280; }
    .tab.active { color: #2563eb; border-bottom-color: #2563eb; }
  `

  constructor() {
    super()
    this.logs = []
    this.blockLogs = []
    this.total = 0
    this.page = 1
    this.pageSize = 20
    this.loading = true
    this.filterType = 'failures'
    this.batchFilter = ''
    this.batchOptions = []
    this.operatorFilter = ''
  }

  connectedCallback() {
    super.connectedCallback()
    this._loadBatches()
    this._loadData()
  }

  async _loadBatches() {
    try {
      const data = await batchApi.list()
      this.batchOptions = data.items || []
    } catch (e) {
      console.error(e)
    }
  }

  async _loadData() {
    this.loading = true
    try {
      const params = { page: this.page, page_size: this.pageSize }
      if (this.batchFilter) params.batch_no = this.batchFilter

      if (this.filterType === 'blocks') {
        const data = await auditApi.blocks(params)
        this.blockLogs = data.items
        this.total = data.items?.length || 0
      } else if (this.filterType === 'failures') {
        const data = await auditApi.failures(params)
        this.logs = data.items
        this.total = data.total || data.items?.length || 0
      } else {
        const data = await auditApi.list(params)
        this.logs = data.items
        this.total = data.items?.length || 0
      }
    } catch (e) {
      console.error('加载审计日志失败', e)
      this.logs = []
      this.blockLogs = []
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

  _onBatchFilter(e) {
    this.batchFilter = e.target.value
    this.page = 1
    this._loadData()
  }

  _prevPage() { if (this.page > 1) { this.page--; this._loadData() } }
  _nextPage() { if (this.page * this.pageSize < this.total) { this.page++; this._loadData() } }

  _getActionName(action) {
    const names = {
      create: '创建', update: '更新', submit: '提交审核', audit_pass: '审核通过',
      return: '退回', usage_confirm: '使用确认', review: '复核通过', archive: '归档',
      review_return: '复核退回', batch_reconcile: '批次核对', reconcile: '离线台账核对',
    }
    return names[action] || action
  }

  _getBlockTypeName(type) {
    const map = {
      duplicate_batch: '重复批次阻断', batch_mismatch: '批次不一致阻断',
      permission_denied: '权限不足', missing_fields: '材料缺失',
      missing_reason: '原因缺失', missing_result: '结果缺失', status_mismatch: '状态不一致',
    }
    return map[type] || type
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
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  render() {
    return html`
      <h1 class="page-title">审计追溯中心</h1>

      <div class="card">
        <div class="tabs">
          <div class="tab ${this.filterType === 'failures' ? 'active' : ''}" @click=${() => this._onFilterChange({ target: { value: 'failures' } })}>
            失败 / 退回记录
          </div>
          <div class="tab ${this.filterType === 'blocks' ? 'active' : ''}" @click=${() => this._onFilterChange({ target: { value: 'blocks' } })}>
            🚫 阻断记录
          </div>
          <div class="tab ${this.filterType === 'all' ? 'active' : ''}" @click=${() => this._onFilterChange({ target: { value: 'all' } })}>
            全部操作
          </div>
        </div>

        <div class="filter-bar">
          <select .value=${this.batchFilter} @change=${this._onBatchFilter}>
            <option value="">全部批次</option>
            ${this.batchOptions.map(b => html`<option value=${b.batch_no}>${b.batch_no} (${b.reservation_count}单)</option>`)}
          </select>
          <span style="color: #6b7280; font-size: 13px;">共 ${this.total} 条记录</span>
        </div>

        ${this.loading ? html`<div class="empty">加载中...</div>`
          : (this.filterType === 'blocks' ? this._renderBlockLogs()
            : (this.logs.length === 0 ? html`<div class="empty">暂无记录</div>` : this._renderAuditLogs()))}

        ${this.filterType !== 'blocks' ? html`
          <div class="pagination">
            <button ?disabled=${this.page <= 1} @click=${this._prevPage}>上一页</button>
            <span class="pagination-info">第 ${this.page} 页 / 共 ${Math.ceil(this.total / this.pageSize) || 1} 页</span>
            <button ?disabled=${this.page * this.pageSize >= this.total} @click=${this._nextPage}>下一页</button>
          </div>
        ` : ''}
      </div>
    `
  }

  _renderAuditLogs() {
    return html`
      <table class="table">
        <thead>
          <tr>
            <th>时间</th><th>操作</th><th>操作人</th><th>批次 / 预约单</th><th>状态变更</th><th>备注 / 原因 / 逐单结果</th>
          </tr>
        </thead>
        <tbody>
          ${this.logs.map(log => html`
            <tr>
              <td>${this._formatTime(log.created_at)}</td>
              <td><span class="action-tag ${this._getActionClass(log.action)}">${this._getActionName(log.action)}</span></td>
              <td>
                <div>${log.operator || '-'}</div>
                <div style="font-size: 11px; color: #9ca3af;">${roleMap[log.operator_role] || log.operator_role || '-'}</div>
              </td>
              <td>
                ${log.batch_no ? html`<div><span class="batch-tag">${log.batch_no}</span></div>` : ''}
                ${log.reservation_no ? html`
                  <div class="reservation-link" @click=${() => this.dispatchEvent(new CustomEvent('view-reservation', { detail: { id: log.reservation_id } }))}>
                    ${log.reservation_no}
                  </div>
                  <div style="font-size: 11px; color: #6b7280;">${log.reservation_title || ''}</div>
                ` : ''}
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
                ${log.remark ? html`<div class="remark-box">${log.remark}</div>` : '-'}
                ${log.detail?.block_reasons?.length ? html`
                  <div class="detail-box" style="margin-top:6px;">
                    <div style="font-weight:600; margin-bottom: 4px; color:#7f1d1d;">阻断原因：</div>
                    ${log.detail.block_reasons.map(br => html`
                      <div class="d-item">• ${br}</div>
                    `)}
                  </div>
                ` : ''}
                ${log.detail?.diffs?.length ? html`
                  <div class="detail-box" style="margin-top:6px;">
                    <div style="font-weight:600; margin-bottom: 4px;">差异明细：</div>
                    ${log.detail.diffs.map(d => html`
                      <div class="d-item">
                        <span class="d-label">${d.field}：</span>${d.message || ''}
                        ${d.online_value !== undefined ? html`
                          <div style="padding-left: 12px; font-size: 11px; color:#6b7280;">
                            线上：${Array.isArray(d.online_value) ? d.online_value.join('、') : d.online_value}
                            ${d.offline_value !== undefined && d.offline_value !== null ? html` / 线下：${d.offline_value}` : ''}
                          </div>
                        ` : ''}
                      </div>
                    `)}
                  </div>
                ` : ''}
                ${(log.detail?.item_results?.length || log.item_results?.length) ? html`
                  <div class="item-result-list" style="margin-top:6px;">
                    <div style="font-size: 11px; color:#9ca3af; margin-bottom: 4px;">逐单结果：</div>
                    ${(log.detail?.item_results || log.item_results || []).map(item => html`
                      <div class="item-result-row ${item.is_consistent ? 'ok' : 'diff'}">
                        ${item.reservation_no}: ${item.is_consistent ? '✓ 一致' : '✗ 差异'}
                        ${item.status_diffs?.length ? html`<span style="margin-left:8px;">状态不匹配</span>` : ''}
                        ${item.attachment_diffs?.length ? html`<span style="margin-left:8px;">附件不匹配</span>` : ''}
                      </div>
                    `)}
                  </div>
                ` : ''}
                ${log.detail?.batch_no || log.detail?.reservation_no || log.detail?.operator_role ? html`
                  <div style="margin-top:6px; padding:6px 8px; background:#f9fafb; border-radius:4px; font-size:11px; color:#6b7280;">
                    ${log.detail.batch_no ? html`批次：${log.detail.batch_no}` : ''}
                    ${log.detail.reservation_no ? html` 预约单：${log.detail.reservation_no}` : ''}
                    ${log.detail.operator_role ? html` 操作角色：${roleMap[log.detail.operator_role] || log.detail.operator_role}` : ''}
                  </div>
                ` : ''}
              </td>
            </tr>
          `)}
        </tbody>
      </table>
    `
  }

  _renderBlockLogs() {
    if (!this.blockLogs?.length) return html`<div class="empty">暂无阻断记录</div>`
    return html`
      <table class="table">
        <thead>
          <tr>
            <th>时间</th><th>阻断类型</th><th>操作人</th><th>批次 / 预约单</th><th>阻断原因 / 差异详情 / 逐单结果</th>
          </tr>
        </thead>
        <tbody>
          ${this.blockLogs.map(log => html`
            <tr style="background: #fff7ed;">
              <td>${this._formatTime(log.created_at)}</td>
              <td><span class="action-tag action-block">${this._getBlockTypeName(log.block_type)}</span></td>
              <td>
                <div>${log.operator || '-'}</div>
                <div style="font-size: 11px; color: #9ca3af;">${roleMap[log.operator_role] || log.operator_role || '-'}</div>
              </td>
              <td>
                ${log.batch_no ? html`<div><span class="batch-tag">${log.batch_no}</span></div>` : ''}
                ${log.reservation_no ? html`
                  <div class="reservation-link">${log.reservation_no}</div>
                  <div style="font-size: 11px; color: #6b7280;">${log.reservation_title || ''}</div>
                ` : ''}
              </td>
              <td>
                <div class="remark-box" style="background:#fff1f2; color:#7f1d1d; border:1px solid #fecdd3;">
                  <b>原因：</b>${log.reason}
                </div>
                ${log.detail?.block_reasons?.length ? html`
                  <div class="detail-box">
                    <div style="font-weight:600; margin-bottom: 4px; color:#7f1d1d;">阻断原因：</div>
                    ${log.detail.block_reasons.map(br => html`
                      <div class="d-item">• ${br}</div>
                    `)}
                  </div>
                ` : ''}
                ${log.detail?.diffs?.length ? html`
                  <div class="detail-box">
                    <div style="font-weight:600; margin-bottom: 4px;">差异明细：</div>
                    ${log.detail.diffs.map(d => html`
                      <div class="d-item">
                        <span class="d-label">${d.field}：</span>${d.message || ''}
                        ${d.online_value !== undefined ? html`
                          <div style="padding-left: 12px; font-size: 11px; color:#6b7280;">
                            线上：${Array.isArray(d.online_value) ? d.online_value.join('、') : d.online_value}
                            ${d.offline_value !== undefined && d.offline_value !== null ? html` / 线下：${d.offline_value}` : ''}
                          </div>
                        ` : ''}
                      </div>
                    `)}
                  </div>
                ` : ''}
                ${(log.detail?.item_results?.length || log.item_results?.length) ? html`
                  <div class="item-result-list">
                    <div style="font-size: 11px; color:#9ca3af; margin: 6px 0 4px;">逐单核对：</div>
                    ${(log.detail?.item_results || log.item_results || []).map(item => html`
                      <div class="item-result-row ${item.is_consistent ? 'ok' : 'diff'}">
                        ${item.reservation_no}: ${item.is_consistent ? '✓ 一致' : '✗ 差异'}
                        ${item.status_diffs?.length ? html`<span style="margin-left:8px;">状态</span>` : ''}
                        ${item.attachment_diffs?.length ? html`<span style="margin-left:8px;">附件</span>` : ''}
                      </div>
                    `)}
                  </div>
                ` : ''}
                ${log.detail?.batch_no || log.detail?.reservation_no || log.detail?.operator_role ? html`
                  <div style="margin-top:6px; padding:6px 8px; background:#fff1f2; border-radius:4px; font-size:11px; color:#991b1b;">
                    ${log.detail.batch_no ? html`批次：${log.detail.batch_no}` : ''}
                    ${log.detail.reservation_no ? html` 预约单：${log.detail.reservation_no}` : ''}
                    ${log.detail.operator_role ? html` 操作角色：${roleMap[log.detail.operator_role] || log.detail.operator_role}` : ''}
                  </div>
                ` : ''}
              </td>
            </tr>
          `)}
        </tbody>
      </table>
    `
  }
}

customElements.define('audit-log-list', AuditLogList)
