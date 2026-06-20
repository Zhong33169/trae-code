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

const CW_STATUS = { pending: '待审核', reviewing: '审核中', approved: '已通过', rejected: '已驳回' };
const EVAL_STATUS = { pending: '待评价', evaluating: '评价中', completed: '已完成' };

class AppFormList extends LitElement {
  static properties = {
    user: { type: Object },
    forms: { type: Array },
    statistics: { type: Object },
    filterStatus: { type: String },
    filterKeyword: { type: String },
    showTimeoutOnly: { type: Boolean },
    selectedIds: { type: Array },
    loading: { type: Boolean },
  };

  static styles = css`
    :host { display: block; }
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: white;
      border-radius: 10px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .stat-card .value { font-size: 28px; font-weight: 700; color: #333; }
    .stat-card .label { font-size: 12px; color: #888; margin-top: 4px; }
    .stat-card.timeout .value { color: #e53e3e; }
    .stat-card.pending .value { color: #dd6b20; }
    .stat-card.total .value { color: #667eea; }
    .stat-card.archived .value { color: #38a169; }
    .toolbar {
      background: white;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .toolbar select, .toolbar input {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 13px;
    }
    .toolbar input { flex: 1; min-width: 200px; }
    .toolbar label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #555;
      cursor: pointer;
    }
    .batch-bar {
      background: #eef2ff;
      border-radius: 8px;
      padding: 10px 16px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
    }
    .batch-bar button {
      padding: 6px 14px;
      border-radius: 6px;
      border: none;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-approve { background: #38a169; color: white; }
    .btn-reject { background: #e53e3e; color: white; }
    .btn-clear { background: #eee; color: #555; }
    .table-wrapper {
      background: white;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background: #f8fafc;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: #555;
      border-bottom: 2px solid #e5e7eb;
      white-space: nowrap;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    tr:hover td { background: #f8fafc; }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }
    .status-badge.s-draft { background: #f1f5f9; color: #64748b; }
    .status-badge.s-pending_review, .status-badge.s-pending_courseware, .status-badge.s-pending_teaching,
    .status-badge.s-pending_evaluation, .status-badge.s-pending_archive { background: #fef3c7; color: #92400e; }
    .status-badge.s-reviewing, .status-badge.s-courseware_reviewing, .status-badge.s-evaluating { background: #dbeafe; color: #1e40af; }
    .status-badge.s-teaching_completed { background: #d1fae5; color: #065f46; }
    .status-badge.s-archived { background: #e0e7ff; color: #3730a3; }
    .status-badge.s-rejected { background: #fee2e2; color: #991b1b; }
    .status-badge.s-timeout_handling { background: #fee2e2; color: #991b1b; }
    .timeout-mark {
      display: inline-block;
      background: #e53e3e;
      color: white;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      margin-left: 4px;
      animation: blink 2s infinite;
    }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
    .remaining { font-size: 11px; color: #dd6b20; }
    .remaining.timeout { color: #e53e3e; font-weight: 600; }
    a.link {
      color: #667eea;
      text-decoration: none;
      cursor: pointer;
    }
    a.link:hover { text-decoration: underline; }
    .empty {
      text-align: center;
      padding: 40px;
      color: #999;
    }
    .checkbox { width: 16px; height: 16px; cursor: pointer; }
  `;

  constructor() {
    super();
    this.forms = [];
    this.statistics = null;
    this.filterStatus = '';
    this.filterKeyword = '';
    this.showTimeoutOnly = false;
    this.selectedIds = [];
    this.loading = true;
  }

  async connectedCallback() {
    super.connectedCallback();
    await this._loadData();
  }

  async _loadData() {
    this.loading = true;
    try {
      const [forms, stats] = await Promise.all([
        api.listForms({ status: this.filterStatus || undefined, keyword: this.filterKeyword || undefined, timeout_only: this.showTimeoutOnly }),
        api.getStatistics(),
      ]);
      this.forms = forms;
      this.statistics = stats;
    } catch (e) {
      console.error('加载数据失败:', e);
    }
    this.loading = false;
  }

  async _onFilterChange() {
    this.selectedIds = [];
    await this._loadData();
  }

  _toggleSelect(id) {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter(i => i !== id);
    } else {
      this.selectedIds = [...this.selectedIds, id];
    }
    this.requestUpdate();
  }

  _toggleSelectAll() {
    if (this.selectedIds.length === this.forms.length && this.forms.length > 0) {
      this.selectedIds = [];
    } else {
      this.selectedIds = this.forms.map(f => f.id);
    }
    this.requestUpdate();
  }

  async _batchAction(action) {
    if (this.selectedIds.length === 0) return;
    if (!confirm(`确定要批量${action === 'submit' ? '通过' : '驳回'} ${this.selectedIds.length} 条排课单吗？`)) return;
    try {
      const result = await api.batchAction({ form_ids: this.selectedIds, action });
      this.selectedIds = [];
      await this._loadData();
      if (result.errors && result.errors.length > 0) {
        alert(`部分操作失败: ${result.errors.map(e => e.detail).join('; ')}`);
      }
    } catch (e) {
      alert(`批量操作失败: ${e.message}`);
    }
  }

  _openDetail(id) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { route: 'detail', params: { id } },
      bubbles: true, composed: true,
    }));
  }

  render() {
    if (this.loading) return html`<div style="text-align:center;padding:40px;color:#888;">加载中...</div>`;

    return html`
      ${this._renderStats()}
      <div class="toolbar">
        <select @change=${(e) => { this.filterStatus = e.target.value; this._onFilterChange(); }}>
          <option value="">全部状态</option>
          ${Object.entries(STATUS_LABELS).map(([k, v]) => html`<option value=${k} ?selected=${this.filterStatus === k}>${v}</option>`)}
        </select>
        <input type="text" placeholder="搜索排课单号、标题、讲师、课程..." .value=${this.filterKeyword}
          @input=${(e) => { this.filterKeyword = e.target.value; }}
          @keydown=${(e) => e.key === 'Enter' && this._onFilterChange()} />
        <label>
          <input type="checkbox" ?checked=${this.showTimeoutOnly}
            @change=${(e) => { this.showTimeoutOnly = e.target.checked; this._onFilterChange(); }} />
          只看超时
        </label>
        <button style="padding:8px 14px;border:1px solid #ddd;border-radius:6px;background:white;cursor:pointer;font-size:13px;"
          @click=${() => this._onFilterChange()}>搜索</button>
      </div>

      ${this.selectedIds.length > 0 ? html`
        <div class="batch-bar">
          <span>已选择 ${this.selectedIds.length} 项</span>
          <button class="btn-approve" @click=${() => this._batchAction('submit')}>批量通过</button>
          <button class="btn-reject" @click=${() => this._batchAction('reject')}>批量驳回</button>
          <button class="btn-clear" @click=${() => { this.selectedIds = []; this.requestUpdate(); }}>取消选择</button>
        </div>
      ` : ''}

      <div class="table-wrapper">
        ${this.forms.length === 0 ? html`<div class="empty">暂无排课单数据</div>` : html`
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" class="checkbox" ?checked=${this.selectedIds.length === this.forms.length && this.forms.length > 0}
                  @change=${() => this._toggleSelectAll()} /></th>
                <th>排课单号</th>
                <th>标题</th>
                <th>讲师</th>
                <th>课程</th>
                <th>状态</th>
                <th>课件审核</th>
                <th>课后评价</th>
                <th>创建时间</th>
                <th>节点时限</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${this.forms.map(f => html`
                <tr>
                  <td><input type="checkbox" class="checkbox" ?checked=${this.selectedIds.includes(f.id)}
                    @change=${() => this._toggleSelect(f.id)} /></td>
                  <td><a class="link" @click=${() => this._openDetail(f.id)}>${f.form_no}</a></td>
                  <td>${f.title}</td>
                  <td>${f.instructor_name}</td>
                  <td>${f.course_name}</td>
                  <td>
                    <span class="status-badge s-${f.status}">${f.status_label}</span>
                    ${f.is_timeout ? html`<span class="timeout-mark">超时</span>` : ''}
                  </td>
                  <td>${CW_STATUS[f.courseware_status] || f.courseware_status}</td>
                  <td>${EVAL_STATUS[f.evaluation_status] || f.evaluation_status}</td>
                  <td>${f.created_at?.substring(0, 16)}</td>
                  <td>
                    ${f.timeout_remaining_hours !== null && f.timeout_remaining_hours !== undefined
                      ? html`<span class="remaining ${f.is_timeout ? 'timeout' : ''}">${f.is_timeout ? '已超时' : f.timeout_remaining_hours + 'h'}</span>`
                      : '-'}
                  </td>
                  <td><a class="link" @click=${() => this._openDetail(f.id)}>查看</a></td>
                </tr>
              `)}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  _renderStats() {
    if (!this.statistics) return '';
    const s = this.statistics;
    return html`
      <div class="stats-bar">
        <div class="stat-card total">
          <div class="value">${s.total}</div>
          <div class="label">排课单总数</div>
        </div>
        <div class="stat-card pending">
          <div class="value">${s.pending_count}</div>
          <div class="label">待处理</div>
        </div>
        <div class="stat-card timeout">
          <div class="value">${s.timeout_count}</div>
          <div class="label">超时待处理</div>
        </div>
        <div class="stat-card archived">
          <div class="value">${s.by_status?.archived || 0}</div>
          <div class="label">已归档</div>
        </div>
      </div>
    `;
  }
}

customElements.define('app-form-list', AppFormList);
