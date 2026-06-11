import { LitElement, html } from 'lit';
import {
  request, showToast, handoverStatusClass, formatDate, statusClass,
} from '../utils.js';

class HandoverPage extends LitElement {
  static properties = {
    user: { type: Object },
    list: { type: Array },
    loading: { type: Boolean },
    filterScope: { type: String },
    filterStatus: { type: String },
    showConfirmModal: { type: Boolean },
    currentHandover: { type: Object },
    confirmForm: { type: Object },
    accepted: { type: Boolean },
  };

  constructor() {
    super();
    this.list = [];
    this.loading = false;
    this.filterScope = 'all';
    this.filterStatus = '';
    this.showConfirmModal = false;
    this.currentHandover = null;
    this.confirmForm = { remark: '' };
    this.accepted = true;
  }

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const params = new URLSearchParams();
      if (this.filterScope !== 'all') params.append('scope', this.filterScope);
      if (this.filterStatus) params.append('status', this.filterStatus);
      const data = await request('/handovers?' + params.toString());
      if (data.code === 0) {
        this.list = data.data || [];
      } else {
        showToast(data.message || '加载失败', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      this.loading = false;
    }
  }

  openConfirm(h, accepted) {
    this.currentHandover = h;
    this.accepted = accepted;
    this.confirmForm = { remark: '' };
    this.showConfirmModal = true;
  }

  async doConfirm() {
    if (!this.accepted && !this.confirmForm.remark) {
      showToast('拒绝接收必须填写原因', 'warning');
      return;
    }
    try {
      const data = await request('/handovers/' + this.currentHandover.id + '/confirm', {
        method: 'POST',
        body: { accepted: this.accepted, remark: this.confirmForm.remark },
      });
      if (data.code === 0) {
        showToast(data.message, this.accepted ? 'success' : 'info');
        this.showConfirmModal = false;
        this.loadData();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  goApp(id) { location.hash = '#/applications/' + id; }

  renderScopeButton(label, scope) {
    return html`
      <button
        class="btn ${this.filterScope === scope ? 'btn-primary' : ''}"
        @click="${() => { this.filterScope = scope; this.loadData(); }}"
      >${label}</button>
    `;
  }

  renderActionButtons(h) {
    const isMyIncoming = h.toUserId === this.user.id && h.status === 'PENDING';
    const btns = [];
    if (isMyIncoming) {
      btns.push(html`
        <button class="btn btn-sm btn-success" @click="${() => this.openConfirm(h, true)}">确认接收</button>
        <button class="btn btn-sm btn-danger" @click="${() => this.openConfirm(h, false)}">拒绝</button>
      `);
    }
    btns.push(html`<button class="btn btn-sm" @click="${() => this.goApp(h.applicationId)}">查看申请</button>`);
    return btns;
  }

  getPendingIncoming() {
    return this.list.filter(h => h.toUserId === this.user.id && h.status === 'PENDING').length;
  }

  render() {
    const pendingIncoming = this.getPendingIncoming();
    return html`
      <div class="page-wrap">
        <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);">
          <div class="stat-card total">
            <div class="stat-label">交接总数</div>
            <div class="stat-value">${this.list.length}</div>
          </div>
          <div class="stat-card pending-audit">
            <div class="stat-label">待接收（我）</div>
            <div class="stat-value">${pendingIncoming}</div>
          </div>
          <div class="stat-card archived">
            <div class="stat-label">已接收</div>
            <div class="stat-value">${this.list.filter(h => h.status === 'ACCEPTED').length}</div>
          </div>
          <div class="stat-card need-correction">
            <div class="stat-label">已拒绝</div>
            <div class="stat-value">${this.list.filter(h => h.status === 'REJECTED').length}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">
            <span>班组交接管理 ${pendingIncoming > 0 ? html`<span class="tag tag-handover-pending" style="margin-left:10px;">${pendingIncoming} 条待接收</span>` : ''}</span>
          </div>

          <div class="toolbar">
            <div class="filters">
              ${this.renderScopeButton('全部', 'all')}
              ${this.renderScopeButton('发给我的', 'incoming')}
              ${this.renderScopeButton('我发出的', 'outgoing')}
              ${this.renderScopeButton('与我相关', 'mine')}
              <select
                .value="${this.filterStatus}"
                @change="${(e) => { this.filterStatus = e.target.value; this.loadData(); }}"
                style="margin-left:12px;"
              >
                <option value="">全部状态</option>
                <option value="PENDING">待接收</option>
                <option value="ACCEPTED">已接收</option>
                <option value="REJECTED">已拒绝</option>
              </select>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>交接ID</th>
                <th>关联申请</th>
                <th>交出方</th>
                <th>交接方向</th>
                <th>接收方</th>
                <th style="width:100px;">交接状态</th>
                <th style="width:100px;">申请状态</th>
                <th>当前处理人</th>
                <th>交接说明</th>
                <th style="width:150px;">发起/确认时间</th>
                <th style="width:160px;">操作</th>
              </tr>
            </thead>
            <tbody>
              ${this.loading
                ? html`<tr><td colspan="11" class="empty">加载中...</td></tr>`
                : this.list.length === 0
                  ? html`<tr><td colspan="11" class="empty">暂无交接记录，可在申请详情页发起交接</td></tr>`
                  : this.list.map((h) => html`
                    <tr>
                      <td style="font-family:monospace;color:#1890ff;">#${h.id}</td>
                      <td @click="${() => this.goApp(h.applicationId)}" style="cursor:pointer;">
                        <div style="font-family:monospace;color:#1890ff;">${h.applicationNo}</div>
                        <div style="color:#666;font-size:12px;">${h.applicantName}</div>
                      </td>
                      <td>
                        <div><strong>${h.fromUserName}</strong></div>
                        <div style="color:#999;font-size:11px;">${h.fromUserRole} · ${h.fromShift}</div>
                      </td>
                      <td style="text-align:center;color:#1890ff;font-weight:bold;">→</td>
                      <td>
                        <div><strong>${h.toUserName}</strong></div>
                        <div style="color:#999;font-size:11px;">${h.toUserRole} · ${h.toShift}</div>
                      </td>
                      <td>
                        <span class="tag ${handoverStatusClass(h.status)}">${h.statusDisplay}</span>
                      </td>
                      <td>
                        <span class="tag ${statusClass(h.appStatus)}">${h.appStatusDisplay}</span>
                      </td>
                      <td>
                        <div><strong>${h.currentHandlerName}</strong></div>
                        <div style="color:#999;font-size:11px;">${h.currentHandlerRole}</div>
                      </td>
                      <td style="max-width:260px;vertical-align:top;">
                        <div style="color:#555;line-height:1.5;">${h.handoverRemark}</div>
                        ${h.acceptRemark ? html`
                          <div style="margin-top:4px;color:#888;font-size:11px;padding-top:4px;border-top:1px dashed #eee;">
                            ${h.status === 'ACCEPTED' ? '接收' : '拒绝'}备注：${h.acceptRemark}
                          </div>
                        ` : ''}
                      </td>
                      <td>
                        <div>${formatDate(h.createdAt)}</div>
                        ${h.confirmedAt ? html`<div style="color:#999;font-size:11px;margin-top:2px;">确认：${formatDate(h.confirmedAt)}</div>` : ''}
                      </td>
                      <td @click="${(e) => e.stopPropagation()}">
                        ${this.renderActionButtons(h)}
                      </td>
                    </tr>
                  `)}
            </tbody>
          </table>
        </div>
      </div>

      ${this.showConfirmModal ? html`
        <div class="modal-mask" @click="${(e) => e.target === e.currentTarget && (this.showConfirmModal = false)}">
          <div class="modal-box">
            <div class="modal-header">
              <span>${this.accepted ? '📥 确认接收交接' : '❌ 拒绝接收交接'}</span>
              <button class="modal-close" @click="${() => (this.showConfirmModal = false)}">×</button>
            </div>
            <div class="modal-body">
              ${this.currentHandover ? html`
                <div class="handover-meta">
                  <div>
                    <span class="from">交出方：${this.currentHandover.fromUserName}（${this.currentHandover.fromUserRole} · ${this.currentHandover.fromShift}）</span>
                  </div>
                  <div>
                    <span class="to">接收方：${this.currentHandover.toUserName}（${this.currentHandover.toUserRole} · ${this.currentHandover.toShift}）</span>
                  </div>
                  <div style="grid-column:span 2;">
                    <strong>关联申请：</strong>${this.currentHandover.applicationNo} - ${this.currentHandover.applicantName}
                  </div>
                </div>
                <div class="remark-box"><strong>交接说明：</strong>${this.currentHandover.handoverRemark}</div>
                ${!this.accepted ? html`
                  <div class="form-item">
                    <label class="required">拒绝原因</label>
                    <textarea
                      placeholder="请说明拒绝接收此申请交接的原因..."
                      .value="${this.confirmForm.remark}"
                      @input="${(e) => (this.confirmForm = { remark: e.target.value })}"
                    ></textarea>
                  </div>
                ` : html`
                  <div class="form-item">
                    <label>备注说明（可选）</label>
                    <textarea
                      placeholder="可补充备注信息..."
                      .value="${this.confirmForm.remark}"
                      @input="${(e) => (this.confirmForm = { remark: e.target.value })}"
                    ></textarea>
                  </div>
                `}
                <div class="reject-box" style="${this.accepted ? 'background:#f6ffed;border-color:#b7eb8f;color:#389e0d;border-left-color:#52c41a;' : ''}">
                  ${this.accepted
                    ? '✅ 确认接收后，该申请的当前处理人将变更为您，您需负责后续处理。'
                    : '⚠️ 拒绝接收后，申请处理人不变，仍由交出方继续负责。'}
                </div>
              ` : ''}
            </div>
            <div class="modal-footer">
              <button class="btn" @click="${() => (this.showConfirmModal = false)}">取消</button>
              <button
                class="btn ${this.accepted ? 'btn-success' : 'btn-danger'}"
                @click="${this.doConfirm}"
              >确认${this.accepted ? '接收' : '拒绝'}</button>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }
}
customElements.define('handover-page', HandoverPage);
