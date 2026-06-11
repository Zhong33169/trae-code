import { LitElement, html } from 'lit';
import { request, showToast, formatDate } from '../utils.js';

class StatisticsPage extends LitElement {
  static properties = {
    stats: { type: Object },
    recentLogs: { type: Array },
    loading: { type: Boolean },
    topApps: { type: Array },
  };

  constructor() {
    super();
    this.stats = {
      total: 0, draft: 0, pendingAudit: 0, needCorrection: 0, pendingReview: 0, archived: 0,
      todayCreated: 0, todayDone: 0,
      handovers: { pending: 0, accepted: 0, rejected: 0, total: 0 },
      byRole: {},
    };
    this.recentLogs = [];
    this.topApps = [];
    this.loading = false;
  }

  createRenderRoot() { return this; }

  connectedCallback() { super.connectedCallback(); this.loadAll(); }

  async loadAll() {
    this.loading = true;
    try {
      const [statsData, appsData] = await Promise.all([
        request('/statistics'),
        request('/applications?page=1&pageSize=10'),
      ]);
      if (statsData.code === 0) this.stats = statsData.data;
      if (appsData.code === 0) this.topApps = appsData.data.list || [];
    } catch (e) { showToast(e.message, 'error'); }
    finally { this.loading = false; }
  }

  getArchivedRate() {
    if (!this.stats.total) return 0;
    return Math.round((this.stats.archived / this.stats.total) * 100);
  }

  getInProcess() {
    return (this.stats.pendingAudit || 0) + (this.stats.needCorrection || 0) + (this.stats.pendingReview || 0);
  }

  goApp(id) { location.hash = '#/applications/' + id; }

  statusBarColor(status) {
    const map = {
      '草稿': '#8c8c8c',
      '待审核': '#1890ff',
      '需补正': '#fa8c16',
      '待复核': '#722ed1',
      '已归档': '#52c41a',
      '开户登记员': '#1890ff',
      '开户审核主管': '#722ed1',
      '水务营业厅复核负责人': '#52c41a',
    };
    return map[status] || '#1890ff';
  }

  render() {
    const s = this.stats;
    const archivedRate = this.getArchivedRate();
    const inProcess = this.getInProcess();
    const maxByRole = Math.max(1, ...Object.values(s.byRole || {}));

    return html`
      <div class="page-wrap">
        <div class="stats-grid">
          <div class="stat-card total">
            <div class="stat-label">📋 申请总数</div>
            <div class="stat-value">${s.total}</div>
            <div style="color:#999;font-size:12px;margin-top:4px;">今日新增 <strong style="color:#13c2c2;">+${s.todayCreated || 0}</strong></div>
          </div>
          <div class="stat-card pending-audit">
            <div class="stat-label">⏳ 处理中</div>
            <div class="stat-value">${inProcess}</div>
            <div style="color:#999;font-size:12px;margin-top:4px;">
              待审核 ${s.pendingAudit} · 待复核 ${s.pendingReview}
            </div>
          </div>
          <div class="stat-card need-correction">
            <div class="stat-label">✏️ 需补正</div>
            <div class="stat-value">${s.needCorrection}</div>
            <div style="color:#999;font-size:12px;margin-top:4px;">等待登记员补正资料</div>
          </div>
          <div class="stat-card archived">
            <div class="stat-label">✅ 已归档</div>
            <div class="stat-value">${s.archived}</div>
            <div style="color:#999;font-size:12px;margin-top:4px;">今日归档 <strong style="color:#52c41a;">+${s.todayDone || 0}</strong></div>
          </div>
          <div class="stat-card today">
            <div class="stat-label">📈 归档率</div>
            <div class="stat-value">${archivedRate}%</div>
            <div style="width:100%;height:6px;background:#f0f0f0;border-radius:3px;margin-top:8px;overflow:hidden;">
              <div style="width:${archivedRate}%;height:100%;background:linear-gradient(90deg,#13c2c2,#52c41a);border-radius:3px;"></div>
            </div>
          </div>
          <div class="stat-card" style="border-top:3px solid #f5222d;">
            <div class="stat-label">🤝 待交接接收</div>
            <div class="stat-value" style="color:#f5222d;">${s.handovers?.pending || 0}</div>
            <div style="color:#999;font-size:12px;margin-top:4px;">
              已交接 ${s.handovers?.accepted || 0} · 共 ${s.handovers?.total || 0} 次
            </div>
          </div>
        </div>

        <div class="charts-row">
          <div class="card">
            <div class="card-title"><span>📊 状态分布</span></div>
            <div class="role-stats">
              ${[
                ['草稿', s.draft, 'tag-draft'],
                ['待审核', s.pendingAudit, 'tag-pending-audit'],
                ['需补正', s.needCorrection, 'tag-need-correction'],
                ['待复核', s.pendingReview, 'tag-pending-review'],
                ['已归档', s.archived, 'tag-archived'],
              ].map(([name, count, tagCls]) => {
                const pct = s.total ? Math.round((count / s.total) * 100) : 0;
                return html`
                  <div class="role-stat-item">
                    <div class="role-stat-name">
                      <span class="tag ${tagCls}" style="margin-right:8px;">${name}</span>
                      <strong>${count}</strong>
                    </div>
                    <div class="role-stat-bar">
                      <div class="role-stat-fill"
                        style="width:${pct}%;background:${this.statusBarColor(name)};min-width:${count > 0 ? '36px' : '0'};">
                        ${count > 0 ? count + ' 件' : ''}
                      </div>
                    </div>
                    <div style="width:60px;text-align:right;color:#999;font-size:13px;">${pct}%</div>
                  </div>
                `;
              })}
              <div style="padding:12px 0 0;border-top:1px dashed #eee;">
                <strong>📊 交接统计</strong>
                <div style="display:flex;gap:24px;margin-top:10px;color:#666;font-size:13px;">
                  <div>交接总数：<strong style="color:#1890ff;">${s.handovers?.total || 0}</strong> 次</div>
                  <div>已接收：<strong style="color:#52c41a;">${s.handovers?.accepted || 0}</strong> 次</div>
                  <div>待接收：<strong style="color:#f5222d;">${s.handovers?.pending || 0}</strong> 次</div>
                  <div>已拒绝：<strong style="color:#8c8c8c;">${s.handovers?.rejected || 0}</strong> 次</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title"><span>👥 待办按岗位分布（不含已归档）</span></div>
            <div class="role-stats">
              ${Object.keys(s.byRole || {}).length === 0
                ? html`<div class="empty">暂无待办数据</div>`
                : Object.entries(s.byRole || {}).map(([name, count]) => {
                  const pct = maxByRole ? Math.round((count / maxByRole) * 100) : 0;
                  return html`
                    <div class="role-stat-item">
                      <div class="role-stat-name">
                        <span class="badge-info" style="margin-right:8px;">${name}</span>
                        <strong>${count}</strong> 件待办
                      </div>
                      <div class="role-stat-bar">
                        <div class="role-stat-fill"
                          style="width:${pct}%;background:${this.statusBarColor(name)};"
                        >${count > 0 ? count + ' 件' : ''}</div>
                      </div>
                    </div>
                  `;
                })
              }
              <div style="margin-top:16px;padding:14px;background:#fafafa;border-radius:6px;">
                <div style="font-weight:600;margin-bottom:8px;">💡 工作提示</div>
                <ul style="padding-left:20px;color:#666;font-size:13px;line-height:1.8;">
                  ${s.pendingAudit > 0 ? html`<li>有 <strong style="color:#1890ff;">${s.pendingAudit}</strong> 条申请待审核主管处理</li>` : ''}
                  ${s.needCorrection > 0 ? html`<li>有 <strong style="color:#fa8c16;">${s.needCorrection}</strong> 条申请被退回待补正</li>` : ''}
                  ${s.pendingReview > 0 ? html`<li>有 <strong style="color:#722ed1;">${s.pendingReview}</strong> 条申请待复核归档</li>` : ''}
                  ${(s.handovers?.pending || 0) > 0 ? html`<li>有 <strong style="color:#f5222d;">${s.handovers?.pending}</strong> 条交接单待确认接收</li>` : ''}
                  ${s.pendingAudit + s.needCorrection + s.pendingReview + (s.handovers?.pending || 0) === 0
                    ? html`<li style="color:#52c41a;">✅ 当前无待办事项，工作处理及时！</li>`
                    : ''
                  }
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">
            <span>📋 最近开户申请 TOP 10</span>
            <span>
              <a href="#/applications" style="font-size:13px;font-weight:normal;">查看全部 →</a>
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:160px;">申请编号</th>
                <th>申请人</th>
                <th>联系电话</th>
                <th>用水类型</th>
                <th>登记人</th>
                <th style="width:120px;">当前状态</th>
                <th>当前处理人</th>
                <th style="width:150px;">创建时间</th>
                <th style="width:100px;">操作</th>
              </tr>
            </thead>
            <tbody>
              ${this.topApps.length === 0
                ? html`<tr><td colspan="9" class="empty">暂无数据</td></tr>`
                : this.topApps.map((a) => html`
                  <tr>
                    <td style="font-family:monospace;color:#1890ff;">${a.applicationNo}</td>
                    <td>${a.applicantName}</td>
                    <td>${a.applicantPhone}</td>
                    <td>${a.waterUsageType}</td>
                    <td>${a.registerName}</td>
                    <td>
                      <span class="tag ${a.status === 'DRAFT' ? 'tag-draft' :
                        a.status === 'PENDING_AUDIT' ? 'tag-pending-audit' :
                        a.status === 'NEED_CORRECTION' ? 'tag-need-correction' :
                        a.status === 'PENDING_REVIEW' ? 'tag-pending-review' : 'tag-archived'}">
                        ${a.statusDisplay}
                      </span>
                    </td>
                    <td>
                      ${a.currentHandlerName}
                      <div style="color:#999;font-size:11px;">${a.currentHandlerRole}</div>
                    </td>
                    <td>${formatDate(a.createdAt)}</td>
                    <td>
                      <button class="btn btn-sm" @click="${() => this.goApp(a.id)}">查看</button>
                    </td>
                  </tr>
                `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
customElements.define('statistics-page', StatisticsPage);
