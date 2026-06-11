import { LitElement, html, css } from 'lit'
import { reservationApi, statusMap, exceptionMap, roleMap } from '../api/api.js'

export class ReservationList extends LitElement {
  static properties = {
    userRole: { type: String },
    reservations: { type: Array },
    total: { type: Number },
    page: { type: Number },
    pageSize: { type: Number },
    loading: { type: Boolean },
    filterStatus: { type: String },
    filterException: { type: String },
    keyword: { type: String },
    statusOptions: { type: Array },
    exceptionOptions: { type: Array },
  }

  static styles = css`
    .filter-section {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
      align-items: center;
    }

    .filter-section select,
    .filter-section input {
      min-width: 160px;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
    }

    .actions {
      margin-left: auto;
      display: flex;
      gap: 8px;
    }

    .table-container {
      overflow-x: auto;
    }

    .status-tag {
      display: inline-block;
      padding: 3px 10px;
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

    .exception-tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      background: #fee2e2;
      color: #991b1b;
      margin-left: 6px;
    }

    .action-link {
      color: #2563eb;
      cursor: pointer;
      margin-right: 8px;
      font-size: 13px;
    }

    .action-link:hover {
      text-decoration: underline;
    }

    .action-link.danger {
      color: #dc2626;
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

    .empty {
      text-align: center;
      padding: 60px;
      color: #9ca3af;
    }

    .role-banner {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .role-banner h3 {
      margin-bottom: 4px;
      font-size: 16px;
    }

    .role-banner p {
      font-size: 13px;
      opacity: 0.9;
    }
  `

  constructor() {
    super()
    this.reservations = []
    this.total = 0
    this.page = 1
    this.pageSize = 10
    this.loading = false
    this.filterStatus = 'all'
    this.filterException = 'all'
    this.keyword = ''
    this.statusOptions = []
    this.exceptionOptions = []
  }

  connectedCallback() {
    super.connectedCallback()
    this._loadOptions()
    this._loadData()
  }

  updated(changedProps) {
    if (changedProps.has('userRole') && this.userRole) {
      this._applyRoleFilter()
    }
  }

  _applyRoleFilter() {
    if (this.userRole === 'auditor') {
      this.filterStatus = 'pending_audit'
    } else if (this.userRole === 'reviewer') {
      this.filterStatus = 'usage_confirmed'
    } else {
      this.filterStatus = 'all'
    }
    this.page = 1
    this._loadData()
  }

  async _loadOptions() {
    try {
      const [statusData, exceptionData] = await Promise.all([
        reservationApi.statuses(),
        reservationApi.exceptions(),
      ])
      this.statusOptions = statusData.items
      this.exceptionOptions = exceptionData.items
    } catch (e) {
      console.error('加载选项失败', e)
    }
  }

  async _loadData() {
    this.loading = true
    try {
      const params = {
        page: this.page,
        page_size: this.pageSize,
      }
      if (this.filterStatus && this.filterStatus !== 'all') {
        params.status = this.filterStatus
      }
      if (this.filterException && this.filterException !== 'all') {
        params.exception = this.filterException
      }
      if (this.keyword) {
        params.keyword = this.keyword
      }

      const data = await reservationApi.list(params)
      this.reservations = data.items
      this.total = data.total
    } catch (e) {
      console.error('加载列表失败', e)
      this.reservations = []
      this.total = 0
    } finally {
      this.loading = false
      this.requestUpdate()
    }
  }

  _onStatusChange(e) {
    this.filterStatus = e.target.value
    this.page = 1
    this._loadData()
  }

  _onExceptionChange(e) {
    this.filterException = e.target.value
    this.page = 1
    this._loadData()
  }

  _onKeywordChange(e) {
    this.keyword = e.target.value
  }

  _onSearch() {
    this.page = 1
    this._loadData()
  }

  _onKeyPress(e) {
    if (e.key === 'Enter') {
      this._onSearch()
    }
  }

  _viewDetail(id) {
    this.dispatchEvent(new CustomEvent('view-detail', { detail: { id } }))
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

  _getRoleBanner() {
    const banners = {
      registrar: {
        title: '会议预约登记工作台',
        desc: '负责会议预约单的录入、提交、补正和使用确认。请核对线下台账后再提交。',
      },
      auditor: {
        title: '会议预约审核工作台',
        desc: '负责审核会议预约单信息的完整性和准确性。有问题请退回补正，审核通过后进入使用环节。',
      },
      reviewer: {
        title: '复核归档工作台',
        desc: '负责会议预约单的最终复核和归档。核对使用确认结果与线下台账一致性，完成归档。',
      },
    }
    return banners[this.userRole] || banners.registrar
  }

  _canCreate() {
    return this.userRole === 'registrar'
  }

  render() {
    const banner = this._getRoleBanner()

    return html`
      <div class="role-banner">
        <h3>${banner.title}</h3>
        <p>${banner.desc}</p>
      </div>

      <div class="filter-section">
        <select .value=${this.filterStatus} @change=${this._onStatusChange}>
          ${this.statusOptions.map(opt => html`
            <option value=${opt.value}>${opt.label}</option>
          `)}
        </select>

        <select .value=${this.filterException} @change=${this._onExceptionChange}>
          ${this.exceptionOptions.map(opt => html`
            <option value=${opt.value}>${opt.label}</option>
          `)}
        </select>

        <input
          type="text"
          placeholder="搜索预约单号/标题"
          .value=${this.keyword}
          @input=${this._onKeywordChange}
          @keypress=${this._onKeyPress}
        />
        <button class="secondary" @click=${this._onSearch}>搜索</button>

        <div class="actions">
          ${this._canCreate() ? html`
            <button class="primary" @click=${() => this.dispatchEvent(new CustomEvent('create-new'))}>
              + 新建预约单
            </button>
          ` : ''}
        </div>
      </div>

      <div class="card">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>预约单号</th>
                <th>会议主题</th>
                <th>会议室</th>
                <th>会议时间</th>
                <th>状态</th>
                <th>异常</th>
                <th>批次号</th>
                <th>创建人</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${this.loading ? html`
                <tr><td colspan="9" class="empty">加载中...</td></tr>
              ` : this.reservations.length === 0 ? html`
                <tr><td colspan="9" class="empty">暂无数据</td></tr>
              ` : this.reservations.map(r => html`
                <tr>
                  <td>${r.reservation_no}</td>
                  <td>${r.title}</td>
                  <td>${r.meeting_room}</td>
                  <td>${r.meeting_date} ${r.start_time}-${r.end_time}</td>
                  <td>
                    <span class="status-tag status-${r.status}">
                      ${statusMap[r.status] || r.status}
                    </span>
                  </td>
                  <td>
                    ${r.exception_type ? html`
                      <span class="exception-tag" title=${r.exception_desc || ''}>
                        ${exceptionMap[r.exception_type] || r.exception_type}
                      </span>
                    ` : '-'}
                  </td>
                  <td>${r.batch_no}</td>
                  <td>${r.created_by || '-'}</td>
                  <td>
                    <span class="action-link" @click=${() => this._viewDetail(r.id)}>详情</span>
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <button ?disabled=${this.page <= 1} @click=${this._prevPage}>上一页</button>
          <span class="pagination-info">
            第 ${this.page} 页 / 共 ${Math.ceil(this.total / this.pageSize)} 页 (${this.total} 条)
          </span>
          <button ?disabled=${this.page * this.pageSize >= this.total} @click=${this._nextPage}>下一页</button>
        </div>
      </div>
    `
  }
}

customElements.define('reservation-list', ReservationList)
