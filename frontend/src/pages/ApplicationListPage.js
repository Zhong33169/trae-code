import { LitElement, html } from 'lit';
import {
  request, showToast, statusClass, formatDate,
  canSubmitApplication, canAuditApplication, canReviewApplication, canEditApplication,
} from '../utils.js';

class ApplicationListPage extends LitElement {
  static properties = {
    user: { type: Object },
    list: { type: Array },
    total: { type: Number },
    page: { type: Number },
    pageSize: { type: Number },
    loading: { type: Boolean },
    filterStatus: { type: String },
    filterKeyword: { type: String },
    onlyMine: { type: Boolean },
    statistics: { type: Object },
  };

  constructor() {
    super();
    this.list = [];
    this.total = 0;
    this.page = 1;
    this.pageSize = 10;
    this.loading = false;
    this.filterStatus = '';
    this.filterKeyword = '';
    this.onlyMine = false;
    this.statistics = { total: 0, draft: 0, pendingAudit: 0, needCorrection: 0, pendingReview: 0, archived: 0 };
  }

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const params = new URLSearchParams({
        page: this.page,
        pageSize: this.pageSize,
      });
      if (this.filterStatus) params.append('status', this.filterStatus);
      if (this.filterKeyword) params.append('keyword', this.filterKeyword);
      if (this.onlyMine) params.append('onlyMine', '1');
      const listData = await request('/applications?' + params.toString());
      if (listData.code === 0) {
        this.list = listData.data.list || [];
        this.total = listData.data.total || 0;
      } else {
        showToast(listData.message || '加载列表失败', 'error');
      }
      const statsData = await request('/statistics');
      if (statsData.code === 0) {
        this.statistics = statsData.data;
      }
    } catch (e) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      this.loading = false;
    }
  }

  changePage(p) {
    this.page = p;
    this.loadData();
  }

  applyFilter() {
    this.page = 1;
    this.loadData();
  }

  goDetail(id) { location.hash = '#/applications/' + id; }
  goNew() { location.hash = '#/applications/new'; }

  renderQuickActions(app) {
    const btns = [];
    if (canEditApplication(app, this.user)) {
      btns.push(html`<button class="btn btn-sm" @click="${() => this.goDetail(app.id)}">编辑</button>`);
    }
    if (canSubmitApplication(app, this.user)) {
      btns.push(html`<button class="btn btn-sm btn-primary" @click="${() => this.quickSubmit(app)}">提交审核</button>`);
    }
    if (canAuditApplication(app, this.user)) {
      btns.push(html`<button class="btn btn-sm btn-success" @click="${() => this.goDetail(app.id)}">审核办理</button>`);
    }
    if (canReviewApplication(app, this.user)) {
      btns.push(html`<button class="btn btn-sm btn-warning" @click="${() => this.goDetail(app.id)}">复核归档</button>`);
    }
    if (btns.length === 0) {
      btns.push(html`<button class="btn btn-sm" @click="${() => this.goDetail(app.id)}">查看详情</button>`);
    }
    return btns;
  }

  async quickSubmit(app) {
    if (!confirm('确定提交申请【' + app.applicationNo + '】进入审核流程？')) return;
    try {
      const data = await request('/applications/' + app.id + '/submit', { method: 'POST', body: { remark: '列表页快捷提交' } });
      if (data.code === 0) {
        showToast(data.message, 'success');
        this.loadData();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  renderStats() {
    const s = this.statistics;
    return html`
      <div class="stats-grid" style="grid-template-columns:repeat(5,1fr); margin-bottom:18px;">
        <div class="stat-card total">
          <div class="stat-label">全部申请</div>
          <div class="stat-value">${s.total || 0}</div>
        </div>
        <div class="stat-card pending-audit">
          <div class="stat-label">待审核</div>
          <div class="stat-value">${s.pendingAudit || 0}</div>
        </div>
        <div class="stat-card need-correction">
          <div class="stat-label">需补正</div>
          <div class="stat-value">${s.needCorrection || 0}</div>
        </div>
        <div class="stat-card pending-review">
          <div class="stat-label">待复核</div>
          <div class="stat-value">${s.pendingReview || 0}</div>
        </div>
        <div class="stat-card archived">
          <div class="stat-label">已归档</div>
          <div class="stat-value">${s.archived || 0}</div>
        </div>
      </div>
    `;
  }

  render() {
    const totalPages = Math.max(1, Math.ceil(this.total / this.pageSize));
    return html`
      <div class="page-wrap">
        ${this.renderStats()}
        <div class="card">
          <div class="card-title">
            <span>开户申请列表</span>
            <span>
              ${this.user && this.user.role === 'register'
                ? html`<button class="btn btn-primary" @click="${this.goNew}">+ 新建申请</button>`
                : ''}
            </span>
          </div>

          <div class="toolbar">
            <div class="filters">
              <input
                type="text"
                placeholder="搜索申请人/编号/电话"
                style="width:220px;"
                .value="${this.filterKeyword}"
                @input="${(e) => (this.filterKeyword = e.target.value)}"
                @keydown="${(e) => e.key === 'Enter' && this.applyFilter()}"
              />
              <select
                .value="${this.filterStatus}"
                @change="${(e) => { this.filterStatus = e.target.value; this.applyFilter(); }}"
              >
                <option value="">全部状态</option>
                <option value="DRAFT">草稿</option>
                <option value="PENDING_AUDIT">待审核</option>
                <option value="NEED_CORRECTION">需补正</option>
                <option value="PENDING_REVIEW">待复核</option>
                <option value="ARCHIVED">已归档</option>
              </select>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                <input
                  type="checkbox"
                  .checked="${this.onlyMine}"
                  @change="${(e) => { this.onlyMine = e.target.checked; this.applyFilter(); }}"
                /> 只看与我相关
              </label>
              <button class="btn" @click="${this.applyFilter}">查询</button>
              <button
                class="btn"
                @click="${() => {
                  this.filterKeyword = ''; this.filterStatus = ''; this.onlyMine = false; this.page = 1;
                  this.requestUpdate(); this.loadData();
                }}"
              >重置</button>
            </div>
            <div style="color:#999;font-size:13px;">
              共 <strong style="color:#1890ff;">${this.total}</strong> 条记录
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width:160px;">申请编号</th>
                <th>申请人</th>
                <th>联系电话</th>
                <th>用水类型</th>
                <th style="width:110px;">当前状态</th>
                <th style="width:180px;">当前处理人 / 责任人</th>
                <th style="width:160px;">待办与补正进度</th>
                <th style="width:200px;">最新拒绝/补正原因</th>
                <th style="width:150px;">创建时间</th>
                <th style="width:160px;">操作</th>
              </tr>
            </thead>
            <tbody>
              ${this.loading
                ? html`<tr><td colspan="10" class="empty">加载中...</td></tr>`
                : this.list.length === 0
                  ? html`<tr><td colspan="10" class="empty">暂无数据，请调整筛选条件或新建申请</td></tr>`
                  : this.list.map((app) => html`
                    <tr style="cursor:pointer;" @click="${() => this.goDetail(app.id)}">
                      <td style="font-family:monospace;color:#1890ff;">${app.applicationNo}</td>
                      <td>${app.applicantName}</td>
                      <td>${app.applicantPhone}</td>
                      <td>${app.waterUsageType}</td>
                      <td>
                        <span class="tag ${statusClass(app.status)}">${app.statusDisplay}</span>
                      </td>
                      <td>
                        <div style="font-weight:500;">${app.currentHandlerName}</div>
                        <div style="color:#999;font-size:11px;">${app.currentHandlerRole}</div>
                      </td>
                      <td>
                        ${app.totalTodoCount > 0 ? html`
                          <div class="todo-progress-cell">
                            <div class="progress-bar-wrap">
                              <div class="progress-bar" style="width:${app.correctionProgress}%;"></div>
                            </div>
                            <div class="progress-text">
                              ${app.todoSummaryText}
                            </div>
                            ${app.status === 'NEED_CORRECTION' ? html`
                              <div style="color:#d46b08;font-size:11px;">补正完成度 ${app.correctionProgress}%</div>
                            ` : ''}
                          </div>
                        ` : html`
                          <span style="color:#999;font-size:12px;">暂无待办</span>
                        `}
                      </td>
                      <td>
                        ${app.latestRejectReason ? html`
                          <div class="reason-cell" title="${app.latestRejectReason}">
                            ⚠ ${app.latestRejectReason}
                          </div>
                        ` : html`
                          <span style="color:#bbb;font-size:12px;">—</span>
                        `}
                      </td>
                      <td>${formatDate(app.createdAt)}</td>
                      <td @click="${(e) => e.stopPropagation()}">
                        ${this.renderQuickActions(app)}
                      </td>
                    </tr>
                  `)}
            </tbody>
          </table>

          ${this.total > 0 ? html`
            <div class="pagination">
              <span>第 ${this.page} / ${totalPages} 页</span>
              <button ?disabled="${this.page === 1}" @click="${() => this.changePage(1)}">首页</button>
              <button ?disabled="${this.page === 1}" @click="${() => this.changePage(this.page - 1)}">上一页</button>
              ${Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p;
                if (totalPages <= 5) p = i + 1;
                else if (this.page <= 3) p = i + 1;
                else if (this.page >= totalPages - 2) p = totalPages - 4 + i;
                else p = this.page - 2 + i;
                return html`<button class="${p === this.page ? 'active' : ''}" @click="${() => this.changePage(p)}">${p}</button>`;
              })}
              <button ?disabled="${this.page === totalPages}" @click="${() => this.changePage(this.page + 1)}">下一页</button>
              <button ?disabled="${this.page === totalPages}" @click="${() => this.changePage(totalPages)}">末页</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}
customElements.define('application-list-page', ApplicationListPage);
