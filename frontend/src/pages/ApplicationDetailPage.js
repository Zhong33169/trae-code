import { LitElement, html } from 'lit';
import {
  request, showToast, statusClass, formatDate, handoverStatusClass,
  canEditApplication, canSubmitApplication, canAuditApplication,
  canReviewApplication, canHandoverApplication, roleDisplayName,
  processingRecordTypeClass, processingRecordStatusClass,
  canAddProcessingRecord, canUpdateProcessingRecord,
} from '../utils.js';

class ApplicationDetailPage extends LitElement {
  static properties = {
    appId: { type: Number },
    user: { type: Object },
    app: { type: Object },
    logs: { type: Array },
    handovers: { type: Array },
    processingRecords: { type: Array },
    users: { type: Array },
    loading: { type: Boolean },
    showEditModal: { type: Boolean },
    showHandoverModal: { type: Boolean },
    showAuditModal: { type: Boolean },
    showReviewModal: { type: Boolean },
    showRecordModal: { type: Boolean },
    showUpdateRecordModal: { type: Boolean },
    editForm: { type: Object },
    handoverForm: { type: Object },
    auditForm: { type: Object },
    reviewForm: { type: Object },
    recordForm: { type: Object },
    updateRecordForm: { type: Object },
    currentRecord: { type: Object },
    auditApproved: { type: Boolean },
    reviewApproved: { type: Boolean },
  };

  constructor() {
    super();
    this.app = null;
    this.logs = [];
    this.handovers = [];
    this.processingRecords = [];
    this.users = [];
    this.loading = false;
    this.showEditModal = false;
    this.showHandoverModal = false;
    this.showAuditModal = false;
    this.showReviewModal = false;
    this.showRecordModal = false;
    this.showUpdateRecordModal = false;
    this.editForm = {};
    this.handoverForm = { toUserId: null, toShift: '白班', remark: '' };
    this.auditForm = { reason: '', remark: '' };
    this.reviewForm = { reason: '', remark: '' };
    this.recordForm = { recordType: 'TODO', content: '', rejectReason: '' };
    this.updateRecordForm = { status: 'PROCESSING', content: '', rejectReason: '' };
    this.currentRecord = null;
    this.auditApproved = true;
    this.reviewApproved = true;
  }

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this.loadAll();
  }

  async loadAll() {
    this.loading = true;
    try {
      const [appData, logsData, usersData, handoversData, recordsData] = await Promise.all([
        request('/applications/' + this.appId),
        request('/logs/' + this.appId),
        request('/users'),
        request('/handovers'),
        request('/processing-records/application/' + this.appId),
      ]);
      if (appData.code === 0) {
        this.app = appData.data;
      } else {
        showToast(appData.message || '加载失败', 'error');
      }
      if (logsData.code === 0) this.logs = logsData.data || [];
      if (usersData.code === 0) this.users = usersData.data || [];
      if (handoversData.code === 0) this.handovers = (handoversData.data || []).filter(h => h.applicationId === this.appId);
      if (recordsData.code === 0) this.processingRecords = recordsData.data || [];
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      this.loading = false;
    }
  }

  getStatusHeaderClass() {
    const map = {
      DRAFT: 's-draft',
      PENDING_AUDIT: 's-pending-audit',
      NEED_CORRECTION: 's-need-correction',
      PENDING_REVIEW: 's-pending-review',
      ARCHIVED: 's-archived',
    };
    return map[this.app?.status] || '';
  }

  getStatusDescription() {
    const s = this.app?.status;
    const descs = {
      DRAFT: '申请处于草稿状态，由登记员保存，尚未提交审核。补充完整资料后可提交审核。',
      PENDING_AUDIT: '申请已提交，等待开户审核主管审核资料完整性和合规性。',
      NEED_CORRECTION: '审核未通过，请根据退回原因补正资料后重新提交。',
      PENDING_REVIEW: '审核通过，等待水务营业厅复核负责人最终复核归档。',
      ARCHIVED: '✅ 申请已完成全流程审批，已归档，开户成功。',
    };
    return descs[s] || '';
  }

  async openEdit() {
    this.editForm = {
      applicantName: this.app.applicantName,
      applicantIdCard: this.app.applicantIdCard,
      applicantPhone: this.app.applicantPhone,
      applicantAddress: this.app.applicantAddress,
      waterUsageType: this.app.waterUsageType,
      propertyType: this.app.propertyType,
      idCardFrontImg: this.app.idCardFrontImg || '',
      idCardBackImg: this.app.idCardBackImg || '',
      propertyCertificate: this.app.propertyCertificate || '',
      remark: this.app.status === 'NEED_CORRECTION' ? '针对退回意见已补正相关资料' : '',
    };
    this.showEditModal = true;
  }

  async saveEdit() {
    try {
      const data = await request('/applications/' + this.appId, {
        method: 'PUT', body: this.editForm,
      });
      if (data.code === 0) {
        showToast(data.message, 'success');
        this.showEditModal = false;
        this.loadAll();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
  }

  async submitApplication() {
    const missing = [];
    ['idCardFrontImg', 'idCardBackImg', 'propertyCertificate'].forEach(k => {
      if (!this.app[k]) missing.push(k);
    });
    if (missing.length > 0) {
      showToast('提交审核需要先补全证明材料，请先编辑补充', 'warning');
      return;
    }
    if (!confirm('确认提交申请【' + this.app.applicationNo + '】进入审核流程？')) return;
    try {
      const data = await request('/applications/' + this.appId + '/submit', {
        method: 'POST', body: { remark: '从详情页提交审核' },
      });
      if (data.code === 0) {
        showToast(data.message, 'success');
        this.loadAll();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
  }

  getEligibleHandovers() {
    if (!this.app) return [];
    let targetRole = '';
    switch (this.app.status) {
      case 'DRAFT':
      case 'NEED_CORRECTION':
        targetRole = 'register'; break;
      case 'PENDING_AUDIT':
        targetRole = 'auditor'; break;
      case 'PENDING_REVIEW':
        targetRole = 'reviewer'; break;
      default: return [];
    }
    return this.users.filter(u => u.role === targetRole && u.id !== this.user.id);
  }

  openHandover() {
    const candidates = this.getEligibleHandovers();
    if (candidates.length === 0) {
      showToast('暂无符合岗位要求的接收人', 'warning');
      return;
    }
    this.handoverForm = {
      applicationId: this.appId,
      toUserId: candidates[0].id,
      toShift: candidates[0].shift || '白班',
      remark: '',
    };
    this.showHandoverModal = true;
  }

  onHandoverUserChange(id) {
    const u = this.users.find(x => x.id === parseInt(id));
    this.handoverForm = {
      ...this.handoverForm,
      toUserId: parseInt(id),
      toShift: u?.shift || '白班',
    };
  }

  async confirmHandover() {
    if (!this.handoverForm.toUserId) {
      showToast('请选择接收人', 'warning'); return;
    }
    if (!this.handoverForm.remark) {
      showToast('请填写交接说明（当前进度、注意事项）', 'warning'); return;
    }
    try {
      const data = await request('/handovers', {
        method: 'POST', body: this.handoverForm,
      });
      if (data.code === 0) {
        showToast(data.message, 'success');
        this.showHandoverModal = false;
        this.loadAll();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
  }

  openAudit(approved) {
    this.auditApproved = approved;
    this.auditForm = { reason: '', remark: '' };
    this.showAuditModal = true;
  }

  async confirmAudit() {
    if (!this.auditApproved && !this.auditForm.reason) {
      showToast('退回必须填写退回原因', 'warning'); return;
    }
    try {
      const data = await request('/applications/' + this.appId + '/audit?approved=' + (this.auditApproved ? '1' : '0'), {
        method: 'POST', body: this.auditForm,
      });
      if (data.code === 0) {
        showToast(data.message, this.auditApproved ? 'success' : 'info');
        this.showAuditModal = false;
        this.loadAll();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
  }

  openReview(approved) {
    this.reviewApproved = approved;
    this.reviewForm = { reason: '', remark: '' };
    this.showReviewModal = true;
  }

  async confirmReview() {
    if (!this.reviewApproved && !this.reviewForm.reason) {
      showToast('退回必须填写退回原因', 'warning'); return;
    }
    try {
      const data = await request('/applications/' + this.appId + '/review?approved=' + (this.reviewApproved ? '1' : '0'), {
        method: 'POST', body: this.reviewForm,
      });
      if (data.code === 0) {
        showToast(data.message, this.reviewApproved ? 'success' : 'info');
        this.showReviewModal = false;
        this.loadAll();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
  }

  getPendingTodos() {
    return this.processingRecords.filter(r =>
      r.status === 'PENDING' || r.status === 'PROCESSING'
    );
  }

  getRejectRecords() {
    return this.processingRecords.filter(r => r.rejectReason);
  }

  openAddRecord(type = 'TODO') {
    const defaultContent = this.app.status === 'NEED_CORRECTION' && type === 'CORRECTION'
      ? '已补正资料，准备重新提交审核'
      : '';
    this.recordForm = {
      recordType: type,
      content: defaultContent,
      rejectReason: this.app.rejectReason || '',
    };
    this.showRecordModal = true;
  }

  async saveRecord() {
    if (!this.recordForm.content) {
      showToast('请填写处理内容', 'warning'); return;
    }
    if (this.recordForm.recordType === 'CORRECTION' && this.app.status !== 'NEED_CORRECTION') {
      showToast('当前申请状态不允许添加补正记录', 'warning'); return;
    }
    try {
      const data = await request('/processing-records', {
        method: 'POST',
        body: {
          applicationId: this.appId,
          recordType: this.recordForm.recordType,
          content: this.recordForm.content,
          rejectReason: this.recordForm.rejectReason,
        },
      });
      if (data.code === 0) {
        showToast(data.message, 'success');
        this.showRecordModal = false;
        this.loadAll();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
  }

  openUpdateRecord(record) {
    this.currentRecord = record;
    this.updateRecordForm = {
      status: record.status === 'PENDING' ? 'PROCESSING' : 'COMPLETED',
      content: record.content,
      rejectReason: record.rejectReason || '',
    };
    this.showUpdateRecordModal = true;
  }

  async saveUpdateRecord() {
    if (!this.currentRecord) return;
    try {
      const data = await request('/processing-records/' + this.currentRecord.id, {
        method: 'PUT',
        body: this.updateRecordForm,
      });
      if (data.code === 0) {
        showToast(data.message, 'success');
        this.showUpdateRecordModal = false;
        this.loadAll();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) { showToast(e.message, 'error'); }
  }

  renderDetailItem(label, value, highlight = false) {
    return html`
      <div class="detail-item">
        <div class="label">${label}</div>
        <div class="value">
          ${highlight ? html`<span class="highlight">${value || '-'}</span>` : (value || '-')}
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading && !this.app) {
      return html`<div class="page-wrap"><div class="card"><div class="empty">加载中...</div></div></div>`;
    }
    if (!this.app) {
      return html`<div class="page-wrap"><div class="card"><div class="empty">申请不存在</div></div></div>`;
    }

    const a = this.app;

    return html`
      <div class="page-wrap">
        <div class="card">
          <div class="card-title">
            <span>开户申请详情
              <span class="highlight" style="margin-left:12px;">${a.applicationNo}</span>
            </span>
            <span>
              <button class="btn" onclick="history.back()">← 返回列表</button>
            </span>
          </div>

          <div class="status-header ${this.getStatusHeaderClass()}">
            <div class="status-info">
              <div class="big-status">
                <span class="tag ${statusClass(a.status)}" style="font-size:16px;padding:6px 20px;">${a.statusDisplay}</span>
                <span class="text">${this.getStatusDescription()}</span>
              </div>
            </div>
            <div class="handler-info">
              <div>当前处理人：<strong>${a.currentHandlerName}</strong>
                <span class="badge-info" style="margin-left:6px;">${a.currentHandlerRole}</span>
              </div>
              <div>
                ${a.registerId ? '登记人：' + a.registerName : ''}
                ${a.auditorName ? ' · 审核人：' + a.auditorName : ''}
                ${a.reviewerName ? ' · 复核人：' + a.reviewerName : ''}
              </div>
              <div style="color:#999;font-size:12px;">
                创建：${formatDate(a.createdAt)}
                ${a.submittedAt ? ' · 提交：' + formatDate(a.submittedAt) : ''}
                ${a.reviewedAt ? ' · 归档：' + formatDate(a.reviewedAt) : ''}
              </div>
            </div>
          </div>

          ${a.rejectReason ? html`
            <div class="reject-box">
              <strong>⚠ 退回原因：</strong>${a.rejectReason}
              ${a.status === 'NEED_CORRECTION' ? html`（请根据此原因补正资料后重新提交审核）` : ''}
            </div>
          ` : ''}

          ${a.totalTodoCount > 0 ? html`
            <div class="progress-section">
              <div class="progress-header">
                <span>📊 处理进度概览</span>
                <span class="progress-percent">完成度 ${a.correctionProgress}%</span>
              </div>
              <div class="progress-bar-wrap" style="height:10px;">
                <div class="progress-bar" style="width:${a.correctionProgress}%;height:100%;"></div>
              </div>
              <div class="progress-stats">
                <span class="stat-item pending">
                  <span class="dot"></span>待处理 ${a.pendingTodoCount}
                </span>
                <span class="stat-item processing">
                  <span class="dot"></span>处理中 ${a.processingTodoCount}
                </span>
                <span class="stat-item completed">
                  <span class="dot"></span>已完成 ${a.completedTodoCount}
                </span>
                <span class="stat-item total">
                  <span class="dot"></span>总计 ${a.totalTodoCount}
                </span>
              </div>
            </div>
          ` : ''}

          ${this.getPendingTodos().length > 0 ? html`
            <div class="todo-alert">
              <div class="todo-title">
                <span>📋 待办提醒（${this.getPendingTodos().length} 项）</span>
                ${canAddProcessingRecord(this.app, this.user) ? html`
                  <div style="display:flex;gap:8px;">
                    ${this.app.status === 'NEED_CORRECTION' ? html`
                      <button class="btn btn-sm btn-warning" @click="${() => this.openAddRecord('CORRECTION')}">➕ 补正处理</button>
                    ` : ''}
                    <button class="btn btn-sm" @click="${() => this.openAddRecord('TODO')}">➕ 添加待办</button>
                    <button class="btn btn-sm" @click="${() => this.openAddRecord('REMARK')}">📝 添加备注</button>
                  </div>
                ` : ''}
              </div>
              <div class="todo-list">
                ${this.getPendingTodos().map(t => html`
                  <div class="todo-item ${t.status === 'PENDING' ? 'pending' : 'processing'}">
                    <div class="todo-status">
                      <span class="tag ${processingRecordTypeClass(t.recordType)}" style="margin-right:8px;">${t.recordTypeDisplay}</span>
                      <span class="tag ${processingRecordStatusClass(t.status)}">${t.statusDisplay}</span>
                    </div>
                    <div class="todo-content">
                      <div class="todo-text">${t.content}</div>
                      ${t.rejectReason ? html`
                        <div class="todo-reason"><strong>补正原因：</strong>${t.rejectReason}</div>
                      ` : ''}
                      <div class="todo-meta">
                        责任人：${t.handlerName}（${t.handlerRole} · ${t.handlerShift}）
                        · 创建：${formatDate(t.createdAt)}
                        ${t.updatedAt && t.updatedAt !== t.createdAt ? html`· 更新：${formatDate(t.updatedAt)}` : ''}
                      </div>
                    </div>
                    ${canUpdateProcessingRecord(t, this.user) ? html`
                      <div class="todo-actions">
                        <button class="btn btn-sm btn-primary" @click="${() => this.openUpdateRecord(t)}">更新</button>
                      </div>
                    ` : ''}
                  </div>
                `)}
              </div>
            </div>
          ` : ''}

          ${this.handovers.length > 0 ? html`
            <div class="section-title">班组交接记录（${this.handovers.length} 次）</div>
            ${this.handovers.map(h => html`
              <div class="handover-flow" style="border:1px solid ${
                  h.status === 'ACCEPTED' ? '#b7eb8f' :
                  h.status === 'REJECTED' ? '#ffa39e' : '#91d5ff'
                }; background:${
                  h.status === 'ACCEPTED' ? '#f6ffed' :
                  h.status === 'REJECTED' ? '#fff1f0' : '#e6f7ff'
                };">
                <div class="handover-person">
                  <div class="name">${h.fromUserName}</div>
                  <div class="role">${h.fromUserRole}</div>
                  <div class="shift">${h.fromShift}</div>
                </div>
                <div class="handover-arrow">
                  <span style="color:${
                    h.status === 'ACCEPTED' ? '#52c41a' :
                    h.status === 'REJECTED' ? '#f5222d' : '#1890ff'
                  };">→</span>
                  <span class="label">
                    <span class="tag ${handoverStatusClass(h.status)}" style="margin:0;">${h.statusDisplay}</span>
                  </span>
                </div>
                <div class="handover-person">
                  <div class="name">${h.toUserName}</div>
                  <div class="role">${h.toUserRole}</div>
                  <div class="shift">${h.toShift}</div>
                </div>
                <div style="flex:1;padding-left:16px;font-size:12px;color:#666;">
                  <div style="margin-bottom:4px;">
                    <span>交接状态：<span class="tag ${handoverStatusClass(h.status)}" style="margin:0;">${h.statusDisplay}</span></span>
                    <span style="margin-left:12px;">申请状态：<span class="tag ${statusClass(h.appStatus)}" style="margin:0;">${h.appStatusDisplay}</span></span>
                  </div>
                  <div><strong>交接说明：</strong>${h.handoverRemark}</div>
                  ${h.acceptRemark ? html`
                    <div style="margin-top:4px;">
                      <strong>${h.status === 'ACCEPTED' ? '接收' : '拒绝'}备注：</strong>${h.acceptRemark}
                    </div>
                  ` : ''}
                  ${h.status === 'ACCEPTED' ? html`
                    <div style="margin-top:4px;color:#52c41a;font-weight:500;">
                      ✅ 确认接收，当前处理人已变更为：${h.toUserName}（${h.toUserRole} · ${h.toShift}）
                    </div>
                  ` : ''}
                  ${h.status === 'REJECTED' ? html`
                    <div style="margin-top:4px;color:#f5222d;font-weight:500;">
                      ❌ 已拒绝接收，处理人保持为：${h.fromUserName}（${h.fromUserRole} · ${h.fromShift}）
                    </div>
                  ` : ''}
                  ${h.status === 'PENDING' ? html`
                    <div style="margin-top:4px;color:#1890ff;font-weight:500;">
                      ⏳ 等待 ${h.toUserName}（${h.toUserRole} · ${h.toShift}）确认接收...
                    </div>
                  ` : ''}
                  <div style="color:#999;margin-top:4px;">
                    发起：${formatDate(h.createdAt)}
                    ${h.confirmedAt ? ' · 确认：' + formatDate(h.confirmedAt) : ''}
                  </div>
                </div>
              </div>
            `)}
          ` : ''}

          <div class="section-title">申请人信息</div>
          <div class="detail-grid">
            ${this.renderDetailItem('申请人姓名', a.applicantName)}
            ${this.renderDetailItem('身份证号码', a.applicantIdCard)}
            ${this.renderDetailItem('联系电话', a.applicantPhone)}
            ${this.renderDetailItem('用水类型', a.waterUsageType)}
            ${this.renderDetailItem('房屋性质', a.propertyType)}
            <div class="detail-item" style="grid-column: span 2;">
              <div class="label">用水地址</div>
              <div class="value">${a.applicantAddress}</div>
            </div>
          </div>

          <div class="section-title">证明材料</div>
          <div class="detail-grid">
            <div class="detail-item" style="grid-column: span 2;">
              <div class="label">身份证正面</div>
              <div class="value">
                ${a.idCardFrontImg ? html`
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:120px;height:80px;background:#f5f5f5;border:1px dashed #ddd;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;">
                      📷 证件照预览
                    </div>
                    <code style="background:#f5f5f5;padding:4px 8px;border-radius:3px;color:#666;">${a.idCardFrontImg}</code>
                  </div>
                ` : '<span style="color:#f5222d;">未上传</span>'}
              </div>
            </div>
            <div class="detail-item" style="grid-column: span 2;">
              <div class="label">身份证反面</div>
              <div class="value">
                ${a.idCardBackImg ? html`<code style="background:#f5f5f5;padding:4px 8px;border-radius:3px;color:#666;">${a.idCardBackImg}</code>`
                  : '<span style="color:#f5222d;">未上传</span>'}
              </div>
            </div>
            <div class="detail-item" style="grid-column: span 2;">
              <div class="label">房产证明</div>
              <div class="value">
                ${a.propertyCertificate ? html`<code style="background:#f5f5f5;padding:4px 8px;border-radius:3px;color:#666;">${a.propertyCertificate}</code>`
                  : '<span style="color:#f5222d;">未上传</span>'}
              </div>
            </div>
          </div>

          <div class="section-title">流程操作</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${canEditApplication(a, this.user) ? html`
              <button class="btn" @click="${this.openEdit}">✏️ 修改资料</button>
            ` : ''}
            ${canSubmitApplication(a, this.user) ? html`
              <button class="btn btn-primary" @click="${this.submitApplication}">📤 提交审核</button>
            ` : ''}
            ${canAuditApplication(a, this.user) ? html`
              <button class="btn btn-success" @click="${() => this.openAudit(true)}">✅ 审核通过</button>
              <button class="btn btn-danger" @click="${() => this.openAudit(false)}">❌ 审核退回</button>
            ` : ''}
            ${canReviewApplication(a, this.user) ? html`
              <button class="btn btn-warning" @click="${() => this.openReview(true)}">📁 复核通过并归档</button>
              <button class="btn btn-danger" @click="${() => this.openReview(false)}">↩️ 复核退回</button>
            ` : ''}
            ${canHandoverApplication(a, this.user) ? html`
              <button class="btn" @click="${this.openHandover}">🤝 发起交接</button>
            ` : ''}
            ${!canEditApplication(a, this.user) && !canSubmitApplication(a, this.user) &&
              !canAuditApplication(a, this.user) && !canReviewApplication(a, this.user) &&
              !canHandoverApplication(a, this.user) ? html`
              <div style="color:#999;padding:8px 12px;background:#fafafa;border-radius:4px;">
                您不是此申请的当前处理人，无操作权限。
              </div>
            ` : ''}
          </div>
        </div>

        ${this.processingRecords.length > 0 ? html`
          <div class="card">
            <div class="card-title">
              <span>处理记录与补正追踪</span>
              <span style="font-size:12px;color:#999;">共 ${this.processingRecords.length} 条记录</span>
              ${canAddProcessingRecord(this.app, this.user) ? html`
                <div style="display:flex;gap:8px;">
                  ${this.app.status === 'NEED_CORRECTION' ? html`
                    <button class="btn btn-sm btn-warning" @click="${() => this.openAddRecord('CORRECTION')}">➕ 补正处理</button>
                  ` : ''}
                  <button class="btn btn-sm" @click="${() => this.openAddRecord('TODO')}">➕ 添加待办</button>
                  <button class="btn btn-sm" @click="${() => this.openAddRecord('REMARK')}">📝 添加备注</button>
                </div>
              ` : ''}
            </div>
            <div class="record-list">
              ${this.processingRecords.map(r => html`
                <div class="record-item ${r.status}">
                  <div class="record-header">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span class="tag ${processingRecordTypeClass(r.recordType)}">${r.recordTypeDisplay}</span>
                      <span class="tag ${processingRecordStatusClass(r.status)}">${r.statusDisplay}</span>
                    </div>
                    <div style="color:#999;font-size:12px;">
                      ${formatDate(r.createdAt)}
                      ${r.completedAt ? html` · 完成：${formatDate(r.completedAt)}` : ''}
                    </div>
                  </div>
                  <div class="record-content">${r.content}</div>
                  ${r.rejectReason ? html`
                    <div class="record-reason"><strong>补正/拒绝原因：</strong>${r.rejectReason}</div>
                  ` : ''}
                  <div class="record-footer">
                    <span>责任人：${r.handlerName}（${r.handlerRole} · ${r.handlerShift}）</span>
                    ${canUpdateProcessingRecord(r, this.user) ? html`
                      <button class="btn btn-sm btn-primary" @click="${() => this.openUpdateRecord(r)}">更新状态</button>
                    ` : ''}
                  </div>
                </div>
              `)}
            </div>
          </div>
        ` : canAddProcessingRecord(this.app, this.user) ? html`
          <div class="card">
            <div class="card-title">
              <span>处理记录与补正追踪</span>
              <div style="display:flex;gap:8px;">
                ${this.app.status === 'NEED_CORRECTION' ? html`
                  <button class="btn btn-sm btn-warning" @click="${() => this.openAddRecord('CORRECTION')}">➕ 补正处理</button>
                ` : ''}
                <button class="btn btn-sm" @click="${() => this.openAddRecord('TODO')}">➕ 添加待办</button>
                <button class="btn btn-sm" @click="${() => this.openAddRecord('REMARK')}">📝 添加备注</button>
              </div>
            </div>
            <div class="empty">暂无处理记录，点击上方按钮添加</div>
          </div>
        ` : ''}

        <div class="card">
          <div class="card-title"><span>操作记录与流转日志</span><span style="font-size:12px;color:#999;">共 ${this.logs.length} 条记录</span></div>
          ${this.logs.length === 0 ? html`<div class="empty">暂无操作记录</div>` : html`
            <div class="timeline">
              ${this.logs.map(log => html`
                <div class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="timeline-op">
                        <span class="badge-info" style="margin-right:8px;">${log.userRole}</span>
                        <strong>${log.userName}</strong> · ${log.operation}
                      </span>
                      <span class="timeline-meta">${formatDate(log.createdAt)}</span>
                    </div>
                    <div class="timeline-detail">${log.operationDetail}</div>
                    ${log.fromStatus || log.toStatus ? html`
                      <div class="status-change">
                        状态变更：
                        ${log.fromStatus ? log.fromStatus : '(新建)'}
                        →
                        <strong>${log.toStatus || log.fromStatus}</strong>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `)}
            </div>
          `}
        </div>
      </div>

      ${this.showEditModal ? html`
        <div class="modal-mask" @click="${(e) => e.target === e.currentTarget && (this.showEditModal = false)}">
          <div class="modal-box">
            <div class="modal-header">
              <span>修改申请资料${this.app.status === 'NEED_CORRECTION' ? '（补正模式）' : ''}</span>
              <button class="modal-close" @click="${() => (this.showEditModal = false)}">×</button>
            </div>
            <div class="modal-body">
              ${this.app.status === 'NEED_CORRECTION' ? html`
                <div class="reject-box"><strong>退回原因：</strong>${this.app.rejectReason}</div>
              ` : ''}
              <div class="form-row">
                <div class="form-item">
                  <label class="required">申请人姓名</label>
                  <input .value="${this.editForm.applicantName}"
                    @input="${(e) => (this.editForm = { ...this.editForm, applicantName: e.target.value })}" />
                </div>
                <div class="form-item">
                  <label class="required">身份证号码</label>
                  <input .value="${this.editForm.applicantIdCard}"
                    @input="${(e) => (this.editForm = { ...this.editForm, applicantIdCard: e.target.value })}" />
                </div>
                <div class="form-item">
                  <label class="required">联系电话</label>
                  <input .value="${this.editForm.applicantPhone}"
                    @input="${(e) => (this.editForm = { ...this.editForm, applicantPhone: e.target.value })}" />
                </div>
                <div class="form-item">
                  <label class="required">用水类型</label>
                  <select .value="${this.editForm.waterUsageType}"
                    @change="${(e) => (this.editForm = { ...this.editForm, waterUsageType: e.target.value })}">
                    <option value="">请选择</option>
                    <option value="居民生活用水">居民生活用水</option>
                    <option value="商业用水">商业用水</option>
                    <option value="工业用水">工业用水</option>
                  </select>
                </div>
                <div class="form-item">
                  <label class="required">房屋性质</label>
                  <select .value="${this.editForm.propertyType}"
                    @change="${(e) => (this.editForm = { ...this.editForm, propertyType: e.target.value })}">
                    <option value="">请选择</option>
                    <option value="商品房">商品房</option>
                    <option value="经济适用房">经济适用房</option>
                    <option value="公房">公房</option>
                    <option value="商铺">商铺</option>
                  </select>
                </div>
                <div class="form-item" style="grid-column:span 2;">
                  <label class="required">用水地址</label>
                  <input .value="${this.editForm.applicantAddress}"
                    @input="${(e) => (this.editForm = { ...this.editForm, applicantAddress: e.target.value })}" />
                </div>
                <div class="form-item">
                  <label>身份证正面 URL</label>
                  <input .value="${this.editForm.idCardFrontImg}"
                    @input="${(e) => (this.editForm = { ...this.editForm, idCardFrontImg: e.target.value })}" />
                </div>
                <div class="form-item">
                  <label>身份证反面 URL</label>
                  <input .value="${this.editForm.idCardBackImg}"
                    @input="${(e) => (this.editForm = { ...this.editForm, idCardBackImg: e.target.value })}" />
                </div>
                <div class="form-item" style="grid-column:span 2;">
                  <label>房产证明 URL</label>
                  <input .value="${this.editForm.propertyCertificate}"
                    @input="${(e) => (this.editForm = { ...this.editForm, propertyCertificate: e.target.value })}" />
                </div>
                ${this.app.status === 'NEED_CORRECTION' ? html`
                  <div class="form-item" style="grid-column:span 2;">
                    <label class="required">补正说明</label>
                    <textarea placeholder="请说明针对退回原因做了哪些补正..."
                      .value="${this.editForm.remark}"
                      @input="${(e) => (this.editForm = { ...this.editForm, remark: e.target.value })}"></textarea>
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn" @click="${() => (this.showEditModal = false)}">取消</button>
              <button class="btn btn-primary" @click="${this.saveEdit}">保存修改</button>
            </div>
          </div>
        </div>
      ` : ''}

      ${this.showHandoverModal ? html`
        <div class="modal-mask" @click="${(e) => e.target === e.currentTarget && (this.showHandoverModal = false)}">
          <div class="modal-box">
            <div class="modal-header">
              <span>发起跨班组交接</span>
              <button class="modal-close" @click="${() => (this.showHandoverModal = false)}">×</button>
            </div>
            <div class="modal-body">
              <div class="remark-box">
                <strong>交接申请：</strong>${this.app.applicationNo} - ${this.app.applicantName}<br/>
                <strong>当前状态：</strong>${this.app.statusDisplay}<br/>
                <strong>您的岗位：</strong>${roleDisplayName(this.user.role)}（${this.user.shift}）
              </div>
              <div class="form-row">
                <div class="form-item">
                  <label class="required">接收人</label>
                  <select .value="${this.handoverForm.toUserId}"
                    @change="${(e) => this.onHandoverUserChange(e.target.value)}">
                    <option value="">请选择接收人</option>
                    ${this.getEligibleHandovers().map(u => html`
                      <option value="${u.id}">${u.realName} - ${roleDisplayName(u.role)}（${u.shift}）</option>
                    `)}
                  </select>
                </div>
                <div class="form-item">
                  <label>目标班次</label>
                  <select .value="${this.handoverForm.toShift}"
                    @change="${(e) => (this.handoverForm = { ...this.handoverForm, toShift: e.target.value })}">
                    <option value="白班">白班</option>
                    <option value="夜班">夜班</option>
                    <option value="中班">中班</option>
                  </select>
                </div>
                <div class="form-item" style="grid-column:span 2;">
                  <label class="required">交接说明</label>
                  <textarea placeholder="请详细说明当前申请处理进度、需要注意的事项、遗留问题..."
                    .value="${this.handoverForm.remark}"
                    @input="${(e) => (this.handoverForm = { ...this.handoverForm, remark: e.target.value })}"></textarea>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn" @click="${() => (this.showHandoverModal = false)}">取消</button>
              <button class="btn btn-primary" @click="${this.confirmHandover}">发起交接</button>
            </div>
          </div>
        </div>
      ` : ''}

      ${this.showAuditModal ? html`
        <div class="modal-mask" @click="${(e) => e.target === e.currentTarget && (this.showAuditModal = false)}">
          <div class="modal-box">
            <div class="modal-header">
              <span>${this.auditApproved ? '审核通过' : '审核退回'}</span>
              <button class="modal-close" @click="${() => (this.showAuditModal = false)}">×</button>
            </div>
            <div class="modal-body">
              <div class="remark-box" style="${this.auditApproved ? 'border-left-color:#52c41a;background:#f6ffed;color:#389e0d;' : 'border-left-color:#f5222d;background:#fff1f0;color:#cf1322;'}">
                ${this.auditApproved
                  ? '通过后申请将流转至【待复核】，交由水务营业厅复核负责人处理。'
                  : '退回后申请将返回登记员处【需补正】，登记员补正后可重新提交。'}
              </div>
              <div class="form-row">
                ${!this.auditApproved ? html`
                  <div class="form-item" style="grid-column:span 2;">
                    <label class="required">退回原因</label>
                    <textarea placeholder="请填写具体的退回原因，帮助登记员明确补正方向..."
                      .value="${this.auditForm.reason}"
                      @input="${(e) => (this.auditForm = { ...this.auditForm, reason: e.target.value })}"></textarea>
                  </div>
                ` : ''}
                <div class="form-item" style="grid-column:span 2;">
                  <label>审核意见（可选）</label>
                  <textarea placeholder="可填写补充说明或审核意见..."
                    .value="${this.auditForm.remark}"
                    @input="${(e) => (this.auditForm = { ...this.auditForm, remark: e.target.value })}"></textarea>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn" @click="${() => (this.showAuditModal = false)}">取消</button>
              <button class="btn ${this.auditApproved ? 'btn-success' : 'btn-danger'}" @click="${this.confirmAudit}">
                确认${this.auditApproved ? '通过' : '退回'}
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      ${this.showReviewModal ? html`
        <div class="modal-mask" @click="${(e) => e.target === e.currentTarget && (this.showReviewModal = false)}">
          <div class="modal-box">
            <div class="modal-header">
              <span>${this.reviewApproved ? '复核归档' : '复核退回'}</span>
              <button class="modal-close" @click="${() => (this.showReviewModal = false)}">×</button>
            </div>
            <div class="modal-body">
              <div class="remark-box" style="${this.reviewApproved ? 'border-left-color:#faad14;background:#fffbe6;color:#d46b08;' : 'border-left-color:#f5222d;background:#fff1f0;color:#cf1322;'}">
                ${this.reviewApproved
                  ? '✅ 归档后本开户申请流程完成，用户开户成功。状态将不可变更。'
                  : '退回后申请将返回【待审核】状态，由审核主管重新审核。'}
              </div>
              <div class="form-row">
                ${!this.reviewApproved ? html`
                  <div class="form-item" style="grid-column:span 2;">
                    <label class="required">退回原因</label>
                    <textarea placeholder="请填写复核退回原因..."
                      .value="${this.reviewForm.reason}"
                      @input="${(e) => (this.reviewForm = { ...this.reviewForm, reason: e.target.value })}"></textarea>
                  </div>
                ` : ''}
                <div class="form-item" style="grid-column:span 2;">
                  <label>复核意见</label>
                  <textarea placeholder="可填写复核意见..."
                    .value="${this.reviewForm.remark}"
                    @input="${(e) => (this.reviewForm = { ...this.reviewForm, remark: e.target.value })}"></textarea>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn" @click="${() => (this.showReviewModal = false)}">取消</button>
              <button class="btn ${this.reviewApproved ? 'btn-warning' : 'btn-danger'}" @click="${this.confirmReview}">
                确认${this.reviewApproved ? '归档' : '退回'}
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      ${this.showRecordModal ? html`
        <div class="modal-mask" @click="${(e) => e.target === e.currentTarget && (this.showRecordModal = false)}">
          <div class="modal-box">
            <div class="modal-header">
              <span>添加${this.recordForm.recordType === 'CORRECTION' ? '补正' : this.recordForm.recordType === 'REMARK' ? '备注' : '待办'}记录</span>
              <button class="modal-close" @click="${() => (this.showRecordModal = false)}">×</button>
            </div>
            <div class="modal-body">
              <div class="remark-box">
                <strong>关联申请：</strong>${this.app.applicationNo} - ${this.app.applicantName}<br/>
                <strong>当前状态：</strong>${this.app.statusDisplay}<br/>
                <strong>您的岗位：</strong>${roleDisplayName(this.user.role)}（${this.user.shift}）
              </div>
              <div class="form-row">
                <div class="form-item">
                  <label class="required">记录类型</label>
                  <select .value="${this.recordForm.recordType}"
                    @change="${(e) => (this.recordForm = { ...this.recordForm, recordType: e.target.value })}">
                    <option value="TODO">待办</option>
                    ${this.app.status === 'NEED_CORRECTION' ? html`
                      <option value="CORRECTION">补正</option>
                    ` : ''}
                    <option value="REMARK">备注</option>
                  </select>
                </div>
                <div class="form-item" style="grid-column:span 2;">
                  <label class="required">处理内容</label>
                  <textarea placeholder="请详细描述处理内容..."
                    .value="${this.recordForm.content}"
                    @input="${(e) => (this.recordForm = { ...this.recordForm, content: e.target.value })}"></textarea>
                </div>
                ${(this.recordForm.recordType === 'CORRECTION' || this.app.status === 'NEED_CORRECTION') ? html`
                  <div class="form-item" style="grid-column:span 2;">
                    <label>补正/拒绝原因</label>
                    <textarea placeholder="可填写补正原因或参考的拒绝原因..."
                      .value="${this.recordForm.rejectReason}"
                      @input="${(e) => (this.recordForm = { ...this.recordForm, rejectReason: e.target.value })}"></textarea>
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn" @click="${() => (this.showRecordModal = false)}">取消</button>
              <button class="btn btn-primary" @click="${this.saveRecord}">保存记录</button>
            </div>
          </div>
        </div>
      ` : ''}

      ${this.showUpdateRecordModal && this.currentRecord ? html`
        <div class="modal-mask" @click="${(e) => e.target === e.currentTarget && (this.showUpdateRecordModal = false)}">
          <div class="modal-box">
            <div class="modal-header">
              <span>更新${this.currentRecord.recordTypeDisplay}记录</span>
              <button class="modal-close" @click="${() => (this.showUpdateRecordModal = false)}">×</button>
            </div>
            <div class="modal-body">
              <div class="remark-box">
                <strong>当前状态：</strong>${this.currentRecord.statusDisplay}<br/>
                <strong>记录内容：</strong>${this.currentRecord.content}
                ${this.currentRecord.rejectReason ? html`<br/><strong>补正原因：</strong>${this.currentRecord.rejectReason}` : ''}
              </div>
              <div class="form-row">
                <div class="form-item">
                  <label class="required">更新状态</label>
                  <select .value="${this.updateRecordForm.status}"
                    @change="${(e) => (this.updateRecordForm = { ...this.updateRecordForm, status: e.target.value })}">
                    <option value="PENDING">待处理</option>
                    <option value="PROCESSING">处理中</option>
                    <option value="COMPLETED">已完成</option>
                  </select>
                </div>
                <div class="form-item" style="grid-column:span 2;">
                  <label>更新内容（可选）</label>
                  <textarea placeholder="可更新处理内容..."
                    .value="${this.updateRecordForm.content}"
                    @input="${(e) => (this.updateRecordForm = { ...this.updateRecordForm, content: e.target.value })}"></textarea>
                </div>
                ${this.currentRecord.recordType === 'CORRECTION' ? html`
                  <div class="form-item" style="grid-column:span 2;">
                    <label>补正/拒绝原因（可选）</label>
                    <textarea placeholder="可更新补正原因..."
                      .value="${this.updateRecordForm.rejectReason}"
                      @input="${(e) => (this.updateRecordForm = { ...this.updateRecordForm, rejectReason: e.target.value })}"></textarea>
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn" @click="${() => (this.showUpdateRecordModal = false)}">取消</button>
              <button class="btn btn-primary" @click="${this.saveUpdateRecord}">确认更新</button>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  }
}
customElements.define('application-detail-page', ApplicationDetailPage);
