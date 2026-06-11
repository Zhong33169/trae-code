import { LitElement, html, css } from 'lit'
import { reservationApi, auditApi, statusMap, exceptionMap, roleMap } from '../api/api.js'

export class ReservationDetail extends LitElement {
  static properties = {
    reservationId: { type: Number },
    userRole: { type: String },
    userName: { type: String },
    reservation: { type: Object },
    auditLogs: { type: Array },
    blockLogs: { type: Array },
    traceData: { type: Object },
    loading: { type: Boolean },
    activeTab: { type: String },
    showReturnModal: { type: Boolean },
    returnReason: { type: String },
    resultText: { type: String },
    auditRemark: { type: String },
    showEditModal: { type: Boolean },
    editForm: { type: Object },
    message: { type: String },
    messageType: { type: String },
    offlineForm: { type: Object },
  }

  static styles = css`
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .back-btn {
      cursor: pointer;
      color: #6b7280;
      margin-bottom: 12px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .back-btn:hover {
      color: #2563eb;
    }

    .detail-title {
      font-size: 20px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
    }

    .status-draft { background: #f3f4f6; color: #4b5563; }
    .status-pending_audit { background: #fef3c7; color: #92400e; }
    .status-approved { background: #dbeafe; color: #1e40af; }
    .status-usage_confirmed { background: #d1fae5; color: #065f46; }
    .status-archived { background: #e5e7eb; color: #374151; }
    .status-returned { background: #fee2e2; color: #991b1b; }
    .status-overdue { background: #fecaca; color: #7f1d1d; }

    .detail-actions {
      display: flex;
      gap: 8px;
    }

    .detail-section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
      color: #111827;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px 24px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .info-label {
      font-size: 13px;
      color: #6b7280;
    }

    .info-value {
      font-size: 14px;
      color: #111827;
      font-weight: 500;
    }

    .info-value.full-width {
      grid-column: span 3;
    }

    .exception-box {
      background: #fef2f2;
      border-left: 4px solid #dc2626;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .exception-box h4 {
      color: #991b1b;
      margin-bottom: 4px;
    }

    .exception-box p {
      color: #b91c1c;
      font-size: 13px;
    }

    .return-reason-box {
      background: #fff7ed;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .return-reason-box h4 {
      color: #92400e;
      margin-bottom: 4px;
    }

    .tabs {
      display: flex;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 16px;
    }

    .tab {
      padding: 10px 20px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      font-weight: 500;
      color: #6b7280;
      transition: all 0.2s;
    }

    .tab:hover {
      color: #2563eb;
    }

    .tab.active {
      color: #2563eb;
      border-bottom-color: #2563eb;
    }

    .attachment-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .attachment-item {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .attachment-icon {
      font-size: 16px;
    }

    .timeline {
      position: relative;
      padding-left: 24px;
    }

    .timeline-item {
      position: relative;
      padding-bottom: 20px;
    }

    .timeline-item::before {
      content: '';
      position: absolute;
      left: -24px;
      top: 4px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #2563eb;
    }

    .timeline-item::after {
      content: '';
      position: absolute;
      left: -19px;
      top: 16px;
      width: 2px;
      height: calc(100% - 12px);
      background: #e5e7eb;
    }

    .timeline-item:last-child::after {
      display: none;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .timeline-action {
      font-weight: 600;
      color: #111827;
    }

    .timeline-time {
      font-size: 12px;
      color: #9ca3af;
    }

    .timeline-operator {
      font-size: 13px;
      color: #6b7280;
      margin-top: 2px;
    }

    .timeline-remark {
      color: #4b5563;
      margin-top: 6px;
      font-size: 13px;
      background: #f9fafb;
      padding: 8px 12px;
      border-radius: 4px;
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
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 20px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #374151;
      font-size: 13px;
    }

    .form-group textarea,
    .form-group input,
    .form-group select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
    }

    .form-group textarea {
      min-height: 100px;
      resize: vertical;
    }

    .message {
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 16px;
    }

    .message-success {
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #86efac;
    }

    .message-error {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    .result-box {
      background: #f0fdf4;
      border-left: 4px solid #16a34a;
      padding: 12px 16px;
      border-radius: 4px;
    }

    .result-box h4 {
      color: #166534;
      margin-bottom: 4px;
    }

    .audit-remark-box {
      background: #f0f9ff;
      border-left: 4px solid #0284c7;
      padding: 12px 16px;
      border-radius: 4px;
    }

    .audit-remark-box h4 {
      color: #075985;
      margin-bottom: 4px;
    }

    .offline-hint {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .equipment-section {
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 6px;
      padding: 12px 16px;
    }

    .equipment-section h4 {
      color: #6b21a8;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .equipment-status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .equipment-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .equipment-dot.ready { background: #16a34a; }
    .equipment-dot.not-ready { background: #f59e0b; }
    .section-badge { display: inline-block; padding: 2px 8px; font-size: 12px; border-radius: 4px; margin-left: 6px; font-weight: normal; }
    .badge-online { background: #dbeafe; color: #1e40af; }
    .badge-offline { background: #fef3c7; color: #92400e; }
    .badge-diff { background: #fee2e2; color: #991b1b; }
    .badge-ok { background: #d1fae5; color: #065f46; }
    .reconcile-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
    .summary-card { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; text-align: center; }
    .summary-card .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .summary-card .value { font-size: 20px; font-weight: 600; color: #111827; }
    .summary-card.ok .value { color: #059669; }
    .summary-card.diff .value { color: #dc2626; }
    .diff-item { background: white; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 10px 14px; margin-bottom: 8px; font-size: 13px; }
    .diff-item .diff-field { font-weight: 600; color: #991b1b; margin-bottom: 4px; }
    .diff-item .diff-values { color: #6b7280; display: flex; gap: 16px; font-size: 12px; }
    .diff-item .diff-values span.online { color: #1e40af; }
    .diff-item .diff-values span.offline { color: #92400e; }
    .item-reconcile-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; padding: 8px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 6px; font-size: 13px; align-items: center; }
    .item-reconcile-row.header { background: #f3f4f6; font-weight: 600; }
    .item-reconcile-row.diff { border-color: #fecaca; background: #fef2f2; }
    .item-reconcile-row .status-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .block-item { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 12px 16px; margin-bottom: 10px; }
    .block-item .block-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .block-item .block-type { font-weight: 600; color: #9f1239; font-size: 13px; }
    .block-item .block-time { font-size: 12px; color: #9ca3af; }
    .block-item .block-reason { font-size: 13px; color: #7f1d1d; margin-bottom: 4px; }
    .block-item .block-op { font-size: 12px; color: #6b7280; }
    .rectify-highlight { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; }
    .rectify-highlight h4 { margin: 0 0 8px 0; color: #92400e; font-size: 14px; }
    .rectify-highlight ul { margin: 0; padding-left: 20px; font-size: 13px; color: #a16207; }
    .rectify-tag { display: inline-block; padding: 2px 6px; background: #fecaca; color: #7f1d1d; font-size: 11px; border-radius: 3px; margin-left: 6px; }
    .offline-form-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin: 12px 0; }
  `

  constructor() {
    super()
    this.reservation = null
    this.auditLogs = []
    this.blockLogs = []
    this.traceData = null
    this.loading = true
    this.activeTab = 'basic'
    this.showReturnModal = false
    this.returnReason = ''
    this.resultText = ''
    this.auditRemark = ''
    this.showEditModal = false
    this.editForm = {}
    this.offlineForm = {}
    this.message = ''
    this.messageType = ''
  }

  connectedCallback() {
    super.connectedCallback()
    this._loadData()
  }

  updated(changedProps) {
    if (changedProps.has('reservationId') && this.reservationId) {
      this._loadData()
    }
  }

  async _loadData() {
    if (!this.reservationId) return
    this.loading = true
    try {
      const [reservation, auditData, traceData, blockData] = await Promise.all([
        reservationApi.get(this.reservationId),
        auditApi.list({ reservation_id: this.reservationId }),
        auditApi.traceReservation(this.reservationId),
        auditApi.blocks({ reservation_id: this.reservationId }),
      ])
      this.reservation = reservation
      this.auditLogs = auditData.items
      this.traceData = traceData
      this.blockLogs = blockData.items || []
      this.offlineForm = {
        offline_count: reservation.offline_count || 1,
        offline_status: reservation.offline_status || '',
        offline_attachment_list: reservation.offline_attachment_list || '',
      }
    } catch (e) {
      console.error('加载详情失败', e)
    } finally {
      this.loading = false
      this.requestUpdate()
    }
  }

  _showMessage(msg, type = 'success') {
    this.message = msg
    this.messageType = type
    this.requestUpdate()
    setTimeout(() => {
      this.message = ''
      this.requestUpdate()
    }, 3000)
  }

  _canEdit() {
    if (!this.reservation) return false
    if (this.userRole !== 'registrar') return false
    return ['draft', 'returned'].includes(this.reservation.status)
  }

  _canSubmit() {
    if (!this.reservation) return false
    if (this.userRole !== 'registrar') return false
    return ['draft', 'returned'].includes(this.reservation.status)
  }

  _canAuditPass() {
    if (!this.reservation) return false
    if (this.userRole !== 'auditor') return false
    return this.reservation.status === 'pending_audit'
  }

  _canAuditReturn() {
    if (!this.reservation) return false
    if (this.userRole !== 'auditor') return false
    return this.reservation.status === 'pending_audit'
  }

  _canConfirmUsage() {
    if (!this.reservation) return false
    if (this.userRole !== 'registrar') return false
    return this.reservation.status === 'approved'
  }

  _canReviewPass() {
    if (!this.reservation) return false
    if (this.userRole !== 'reviewer') return false
    return this.reservation.status === 'usage_confirmed'
  }

  _canReviewReturn() {
    if (!this.reservation) return false
    if (this.userRole !== 'reviewer') return false
    return this.reservation.status === 'usage_confirmed'
  }

  async _handleSubmit() {
    if (!confirm('确认提交该会议预约单进行审核吗？请确保已核对线下台账信息。')) return
    try {
      await reservationApi.submit(this.reservationId)
      this._showMessage('提交成功，已进入审核队列')
      this._loadData()
      this.dispatchEvent(new CustomEvent('updated'))
    } catch (e) {
      this._showMessage(e.message, 'error')
    }
  }

  _openReturnModal() {
    this.returnReason = ''
    this.showReturnModal = true
    this.requestUpdate()
  }

  async _handleReturn() {
    if (!this.returnReason.trim()) {
      this._showMessage('请填写退回原因', 'error')
      return
    }
    try {
      await reservationApi.audit(this.reservationId, 'return', {
        return_reason: this.returnReason,
        exception_type: 'info_error',
      })
      this.showReturnModal = false
      this._showMessage('已退回，请注意查收登记员补正')
      this._loadData()
      this.dispatchEvent(new CustomEvent('updated'))
    } catch (e) {
      this._showMessage(e.message, 'error')
    }
  }

  async _handleAuditPass() {
    if (!confirm('确认审核通过？通过后预约单将进入使用准备阶段。')) return
    try {
      await reservationApi.audit(this.reservationId, 'pass')
      this._showMessage('审核通过，设备已标记为准备中')
      this._loadData()
      this.dispatchEvent(new CustomEvent('updated'))
    } catch (e) {
      this._showMessage(e.message, 'error')
    }
  }

  _openUsageConfirm() {
    this.resultText = this.reservation?.result || ''
    this.activeTab = 'result'
    this.requestUpdate()
  }

  async _handleConfirmUsage() {
    if (!this.resultText.trim()) {
      this._showMessage('请填写使用结果', 'error')
      return
    }
    try {
      await reservationApi.confirmUsage(this.reservationId, {
        result: this.resultText,
      })
      this._showMessage('使用确认完成，已提交复核')
      this._loadData()
      this.dispatchEvent(new CustomEvent('updated'))
    } catch (e) {
      this._showMessage(e.message, 'error')
    }
  }

  async _handleReviewPass() {
    if (!confirm('确认复核通过并归档？归档后将无法修改。请核对线下台账是否一致。')) return
    try {
      await reservationApi.review(this.reservationId, 'pass')
      this._showMessage('复核通过，已归档')
      this._loadData()
      this.dispatchEvent(new CustomEvent('updated'))
    } catch (e) {
      this._showMessage(e.message, 'error')
    }
  }

  _openReviewReturn() {
    this.returnReason = ''
    this.showReturnModal = true
    this.requestUpdate()
  }

  async _handleReviewReturn() {
    if (!this.returnReason.trim()) {
      this._showMessage('请填写退回原因', 'error')
      return
    }
    try {
      await reservationApi.review(this.reservationId, 'return', {
        return_reason: this.returnReason,
      })
      this.showReturnModal = false
      this._showMessage('已退回登记员补充材料')
      this._loadData()
      this.dispatchEvent(new CustomEvent('updated'))
    } catch (e) {
      this._showMessage(e.message, 'error')
    }
  }

  _openEdit() {
    this.editForm = {
      title: this.reservation.title,
      meeting_room: this.reservation.meeting_room,
      meeting_date: this.reservation.meeting_date,
      start_time: this.reservation.start_time,
      end_time: this.reservation.end_time,
      participants: this.reservation.participants,
      organizer: this.reservation.organizer,
      organizer_dept: this.reservation.organizer_dept,
      contact_phone: this.reservation.contact_phone,
      equipment: this.reservation.equipment,
      attachment_names: this.reservation.attachment_names,
      offline_attachment_count: this.reservation.offline_attachment_count,
    }
    this.showEditModal = true
    this.requestUpdate()
  }

  async _handleEditSave() {
    try {
      await reservationApi.update(this.reservationId, this.editForm)
      this.showEditModal = false
      this._showMessage('保存成功')
      this._loadData()
      this.dispatchEvent(new CustomEvent('updated'))
    } catch (e) {
      this._showMessage(e.message, 'error')
    }
  }

  _onEditInput(field, value) {
    this.editForm = { ...this.editForm, [field]: value }
    this.requestUpdate()
  }

  render() {
    if (this.loading && !this.reservation) {
      return html`<div class="card">加载中...</div>`
    }

    const r = this.reservation
    if (!r) return html`<div class="card">未找到预约单</div>`

    return html`
      <div class="back-btn" @click=${() => this.dispatchEvent(new CustomEvent('back'))}>
        ← 返回列表
      </div>

      ${this.message ? html`
        <div class="message message-${this.messageType}">${this.message}</div>
      ` : ''}

      <div class="detail-section">
        <div class="detail-header">
          <div class="detail-title">
            ${r.title}
            <span class="status-badge status-${r.status}">
              ${statusMap[r.status] || r.status}
            </span>
          </div>
          <div class="detail-actions">
            ${this._canEdit() ? html`
              <button class="secondary" @click=${this._openEdit}>编辑</button>
            ` : ''}
            ${this._canSubmit() ? html`
              <button class="primary" @click=${this._handleSubmit}>提交审核</button>
            ` : ''}
            ${this._canAuditPass() ? html`
              <button class="success" @click=${this._handleAuditPass}>审核通过</button>
            ` : ''}
            ${this._canAuditReturn() ? html`
              <button class="warning" @click=${this._openReturnModal}>退回补正</button>
            ` : ''}
            ${this._canConfirmUsage() ? html`
              <button class="primary" @click=${this._openUsageConfirm}>使用确认</button>
            ` : ''}
            ${this._canReviewPass() ? html`
              <button class="success" @click=${this._handleReviewPass}>复核归档</button>
            ` : ''}
            ${this._canReviewReturn() ? html`
              <button class="warning" @click=${this._openReviewReturn}>退回补正</button>
            ` : ''}
          </div>
        </div>

        <div style="font-size: 13px; color: #6b7280; margin-bottom: 16px;">
          预约单号：${r.reservation_no} | 批次号：${r.batch_no} | 创建人：${r.created_by || '-'}
        </div>

        ${r.exception_type ? html`
          <div class="exception-box">
            <h4>⚠️ 异常：${exceptionMap[r.exception_type] || r.exception_type}</h4>
            <p>${r.exception_desc || ''}</p>
          </div>
        ` : ''}

        ${r.return_reason ? html`
          <div class="return-reason-box">
            <h4>📝 退回原因</h4>
            <p>${r.return_reason}</p>
          </div>
        ` : ''}
      </div>

      <div class="detail-section">
        <div class="tabs">
          <div class="tab ${this.activeTab === 'basic' ? 'active' : ''}"
               @click=${() => { this.activeTab = 'basic'; this.requestUpdate() }}>
            基本信息
          </div>
          <div class="tab ${this.activeTab === 'equipment' ? 'active' : ''}"
               @click=${() => { this.activeTab = 'equipment'; this.requestUpdate() }}>
            设备准备
          </div>
          <div class="tab ${this.activeTab === 'attachments' ? 'active' : ''}"
               @click=${() => { this.activeTab = 'attachments'; this.requestUpdate() }}>
            附件材料
          </div>
          <div class="tab ${this.activeTab === 'result' ? 'active' : ''}"
               @click=${() => { this.activeTab = 'result'; this.requestUpdate() }}>
            使用结果
          </div>
          <div class="tab ${this.activeTab === 'audit' ? 'active' : ''}"
               @click=${() => { this.activeTab = 'audit'; this.requestUpdate() }}>
            审计备注
          </div>
          <div class="tab ${this.activeTab === 'reconcile' ? 'active' : ''}"
               @click=${() => { this.activeTab = 'reconcile'; this.requestUpdate() }}>
            离线台账核对
          </div>
        </div>

        ${this.activeTab === 'basic' ? this._renderBasicTab() : ''}
        ${this.activeTab === 'equipment' ? this._renderEquipmentTab() : ''}
        ${this.activeTab === 'attachments' ? this._renderAttachmentsTab() : ''}
        ${this.activeTab === 'result' ? this._renderResultTab() : ''}
        ${this.activeTab === 'audit' ? this._renderAuditTab() : ''}
        ${this.activeTab === 'reconcile' ? this._renderReconcileTab() : ''}
      </div>

      <div class="detail-section">
        <div class="section-title">操作轨迹 / 审计日志</div>
        <div class="timeline">
          ${this.auditLogs.map(log => html`
            <div class="timeline-item">
              <div class="timeline-header">
                <span class="timeline-action">${this._getActionName(log.action)}</span>
                <span class="timeline-time">${this._formatTime(log.created_at)}</span>
              </div>
              <div class="timeline-operator">
                ${log.operator} (${roleMap[log.operator_role] || log.operator_role})
                ${log.status_from && log.status_to ? html`
                  | ${statusMap[log.status_from]} → ${statusMap[log.status_to]}
                ` : ''}
              </div>
              ${log.remark ? html`
                <div class="timeline-remark">${log.remark}</div>
              ` : ''}
            </div>
          `)}
        </div>
      </div>

      ${this.showReturnModal ? html`
        <div class="modal-overlay" @click=${(e) => { if (e.target === e.currentTarget) { this.showReturnModal = false; this.requestUpdate() } }}>
          <div class="modal">
            <div class="modal-header">退回补正</div>
            <div class="form-group">
              <label>退回原因 <span style="color: red">*</span></label>
              <textarea
                .value=${this.returnReason}
                @input=${(e) => { this.returnReason = e.target.value; this.requestUpdate() }}
                placeholder="请详细说明退回原因，方便登记员补正..."
              ></textarea>
              <div class="offline-hint">请对照线下台账说明需要补充的内容</div>
            </div>
            <div class="modal-footer">
              <button class="secondary" @click=${() => { this.showReturnModal = false; this.requestUpdate() }}>取消</button>
              <button class="danger" @click=${this.userRole === 'auditor' ? this._handleReturn : this._handleReviewReturn}>
                确认退回
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      ${this.showEditModal ? html`
        <div class="modal-overlay" @click=${(e) => { if (e.target === e.currentTarget) { this.showEditModal = false; this.requestUpdate() } }}>
          <div class="modal" style="max-width: 600px;">
            <div class="modal-header">编辑会议预约</div>
            <div class="form-group">
              <label>会议主题 <span style="color: red">*</span></label>
              <input .value=${this.editForm.title || ''}
                     @input=${(e) => this._onEditInput('title', e.target.value)} />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>会议室 <span style="color: red">*</span></label>
                <input .value=${this.editForm.meeting_room || ''}
                       @input=${(e) => this._onEditInput('meeting_room', e.target.value)} />
              </div>
              <div class="form-group">
                <label>会议日期 <span style="color: red">*</span></label>
                <input type="date" .value=${this.editForm.meeting_date || ''}
                       @input=${(e) => this._onEditInput('meeting_date', e.target.value)} />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>开始时间 <span style="color: red">*</span></label>
                <input type="time" .value=${this.editForm.start_time || ''}
                       @input=${(e) => this._onEditInput('start_time', e.target.value)} />
              </div>
              <div class="form-group">
                <label>结束时间 <span style="color: red">*</span></label>
                <input type="time" .value=${this.editForm.end_time || ''}
                       @input=${(e) => this._onEditInput('end_time', e.target.value)} />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>参会人数 <span style="color: red">*</span></label>
                <input type="number" .value=${this.editForm.participants || 0}
                       @input=${(e) => this._onEditInput('participants', parseInt(e.target.value) || 0)} />
              </div>
              <div class="form-group">
                <label>联系人</label>
                <input .value=${this.editForm.organizer || ''}
                       @input=${(e) => this._onEditInput('organizer', e.target.value)} />
              </div>
            </div>
            <div class="form-group">
              <label>联系电话</label>
              <input .value=${this.editForm.contact_phone || ''}
                     @input=${(e) => this._onEditInput('contact_phone', e.target.value)} />
            </div>
            <div class="form-group">
              <label>所需设备</label>
              <textarea
                .value=${this.editForm.equipment || ''}
                @input=${(e) => this._onEditInput('equipment', e.target.value)}
                placeholder="投影仪、白板、视频会议终端等"
              ></textarea>
            </div>
            <div class="form-group">
              <label>附件清单</label>
              <textarea
                .value=${this.editForm.attachment_names || ''}
                @input=${(e) => this._onEditInput('attachment_names', e.target.value)}
                placeholder="多个附件用逗号分隔"
              ></textarea>
            </div>
            <div class="form-group">
              <label>线下附件数量</label>
              <input type="number" .value=${this.editForm.offline_attachment_count || 0}
                     @input=${(e) => this._onEditInput('offline_attachment_count', parseInt(e.target.value) || 0)} />
              <div class="offline-hint">已交至行政后勤中心的纸质材料数量</div>
            </div>
            <div class="modal-footer">
              <button class="secondary" @click=${() => { this.showEditModal = false; this.requestUpdate() }}>取消</button>
              <button class="primary" @click=${this._handleEditSave}>保存</button>
            </div>
          </div>
        </div>
      ` : ''}
    `
  }

  _renderBasicTab() {
    const r = this.reservation
    return html`
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">预约单号</span>
          <span class="info-value">${r.reservation_no}</span>
        </div>
        <div class="info-item">
          <span class="info-label">批次号</span>
          <span class="info-value">${r.batch_no}</span>
        </div>
        <div class="info-item">
          <span class="info-label">当前状态</span>
          <span class="info-value">${statusMap[r.status] || r.status}</span>
        </div>
        <div class="info-item">
          <span class="info-label">会议室</span>
          <span class="info-value">${r.meeting_room}</span>
        </div>
        <div class="info-item">
          <span class="info-label">会议日期</span>
          <span class="info-value">${r.meeting_date}</span>
        </div>
        <div class="info-item">
          <span class="info-label">会议时间</span>
          <span class="info-value">${r.start_time} - ${r.end_time}</span>
        </div>
        <div class="info-item">
          <span class="info-label">参会人数</span>
          <span class="info-value">${r.participants} 人</span>
        </div>
        <div class="info-item">
          <span class="info-label">组织者</span>
          <span class="info-value">${r.organizer || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">所属部门</span>
          <span class="info-value">${r.organizer_dept || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">联系电话</span>
          <span class="info-value">${r.contact_phone || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">创建人</span>
          <span class="info-value">${r.created_by || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">创建时间</span>
          <span class="info-value">${this._formatTime(r.created_at)}</span>
        </div>
      </div>
    `
  }

  _renderEquipmentTab() {
    const r = this.reservation
    return html`
      <div class="equipment-section">
        <h4>设备准备状态</h4>
        <div class="equipment-status">
          <span class="equipment-dot ${r.equipment_ready ? 'ready' : 'not-ready'}"></span>
          <span>${r.equipment_ready ? '已准备就绪' : '待准备'}</span>
        </div>
        <p style="font-size: 13px; color: #6b7280;">
          ${r.equipment_ready
            ? '设备已由行政后勤中心检查确认，可正常使用。'
            : '设备尚未确认，请等待审核通过后由后勤人员准备。'}
        </p>
      </div>
      <div style="margin-top: 16px;">
        <div class="info-label" style="margin-bottom: 8px;">所需设备清单</div>
        ${r.equipment ? html`
          <div style="background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 14px;">
            ${r.equipment}
          </div>
        ` : html`
          <div style="color: #9ca3af;">暂无特殊设备需求</div>
        `}
      </div>
    `
  }

  _renderAttachmentsTab() {
    const r = this.reservation
    const attachments = r.attachment_names ? r.attachment_names.split(',').map(a => a.trim()).filter(a => a) : []

    return html`
      <div style="margin-bottom: 16px;">
        <div class="info-label" style="margin-bottom: 8px;">线上附件清单</div>
        ${attachments.length > 0 ? html`
          <div class="attachment-list">
            ${attachments.map(name => html`
              <div class="attachment-item">
                <span class="attachment-icon">📄</span>
                <span>${name}</span>
              </div>
            `)}
          </div>
        ` : html`
          <div style="color: #9ca3af;">暂无附件</div>
        `}
      </div>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px;">
        <div style="font-weight: 500; color: #92400e; margin-bottom: 4px;">线下台账材料</div>
        <div style="font-size: 13px; color: #a16207;">
          已收到线下材料 ${r.offline_attachment_count || 0} 份
          <span style="font-size: 12px; margin-left: 8px;">（请核对纸质台账）</span>
        </div>
      </div>
    `
  }

  _renderResultTab() {
    const r = this.reservation
    const canConfirm = this._canConfirmUsage()

    return html`
      ${r.result ? html`
        <div class="result-box">
          <h4>✓ 使用确认结果</h4>
          <p style="font-size: 14px;">${r.result}</p>
          <div style="font-size: 12px; color: #166534; margin-top: 8px;">
            确认人：${r.usage_confirm_user || '-'} | 确认时间：${this._formatTime(r.usage_confirm_time)}
          </div>
        </div>
      ` : canConfirm ? html`
        <div class="form-group">
          <label>使用结果 <span style="color: red">*</span></label>
          <textarea
            .value=${this.resultText}
            @input=${(e) => { this.resultText = e.target.value; this.requestUpdate() }}
            placeholder="请填写会议使用情况、设备状态等..."
            style="min-height: 120px;"
          ></textarea>
          <div class="offline-hint">请对照线下台账使用记录填写</div>
        </div>
        <button class="primary" @click=${this._handleConfirmUsage}>确认使用完成</button>
      ` : html`
        <div style="color: #9ca3af; text-align: center; padding: 20px;">
          暂无使用结果
        </div>
      `}
    `
  }

  _renderAuditTab() {
    const r = this.reservation

    return html`
      ${r.audit_remark ? html`
        <div class="audit-remark-box">
          <h4>📋 审计备注</h4>
          <p style="font-size: 14px;">${r.audit_remark}</p>
        </div>
      ` : html`
        <div style="color: #9ca3af; margin-bottom: 16px;">暂无审计备注</div>
      `}
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <div class="info-label" style="margin-bottom: 8px;">审核信息</div>
        <div class="info-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="info-item">
            <span class="info-label">审核人</span>
            <span class="info-value">${r.audit_by || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">审核时间</span>
            <span class="info-value">${r.audit_at ? this._formatTime(r.audit_at) : '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">复核人</span>
            <span class="info-value">${r.review_by || '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">复核时间</span>
            <span class="info-value">${r.review_at ? this._formatTime(r.review_at) : '-'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">归档时间</span>
            <span class="info-value">${r.archived_at ? this._formatTime(r.archived_at) : '-'}</span>
          </div>
        </div>
      </div>
      ${this.blockLogs?.length ? html`
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <div class="section-title" style="font-size:14px; border:none; padding:0; margin-bottom:12px;">
            🚫 阻断 / 失败记录 (${this.blockLogs.length})
          </div>
          ${this.blockLogs.map(log => html`
            <div class="block-item">
              <div class="block-head">
                <span class="block-type">${this._getBlockTypeName(log.block_type)}</span>
                <span class="block-time">${this._formatTime(log.created_at)}</span>
              </div>
              <div class="block-reason">${log.reason}</div>
              <div class="block-op">操作人：${log.operator || '-'} (${roleMap[log.operator_role] || log.operator_role || '-'})</div>
              ${log.detail?.diffs?.length ? html`
                <div style="margin-top:8px; font-size:12px;">
                  <div style="color:#6b7280; margin-bottom:4px;">差异详情：</div>
                  ${log.detail.diffs.map(d => html`
                    <div style="padding:4px 8px; background:#fff; border-radius:3px; margin-bottom:3px;">
                      <b style="color:#991b1b;">${d.field}</b>：${d.message || ''}
                    </div>
                  `)}
                </div>
              ` : ''}
            </div>
          `)}
        </div>
      ` : ''}
    `
  }

  _renderReconcileTab() {
    const r = this.reservation
    const reconcile = r.batch_reconcile || r.offline_check_diff
    const canEdit = this._canEdit()

    return html`
      ${r.status === 'returned' && r.return_reason ? html`
        <div class="rectify-highlight">
          <h4>⚠️ 需补正内容 <span class="rectify-tag">退回单</span></h4>
          <ul>
            <li>${r.return_reason}</li>
            ${r.exception_desc ? html`<li>异常说明：${r.exception_desc}</li>` : ''}
          </ul>
        </div>
      ` : ''}

      ${reconcile ? html`
        <div style="background:#fafafa; border:1px solid #e5e7eb; border-radius:6px; padding:16px;">
          <div style="font-size:14px; font-weight:600; color:${reconcile.is_consistent ? '#065f46' : (reconcile.is_blocked ? '#991b1b' : '#92400e')}; margin-bottom:12px;">
            ${reconcile.is_consistent ? '✓ 线上线下一致' : (reconcile.is_blocked ? '🚫 批次核对阻断' : '⚠️ 存在差异')}
            ${reconcile.message ? html` - ${reconcile.message}` : ''}
          </div>
          <div class="reconcile-summary">
            <div class="summary-card">
              <div class="label">线上数量</div>
              <div class="value">${reconcile.total_online ?? '-'}</div>
            </div>
            <div class="summary-card">
              <div class="label">线下数量</div>
              <div class="value">${reconcile.total_offline ?? r.offline_count ?? 1}</div>
            </div>
            <div class="summary-card ${reconcile.diff_count === 0 ? 'ok' : 'diff'}">
              <div class="label">差异项</div>
              <div class="value">${reconcile.diff_count ?? 0}</div>
            </div>
            <div class="summary-card ${reconcile.is_consistent ? 'ok' : 'diff'}">
              <div class="label">核对结果</div>
              <div class="value">${reconcile.is_consistent ? '通过' : '未通过'}</div>
            </div>
          </div>
          ${reconcile.diffs?.length ? html`
            <div style="margin-bottom:16px;">
              <div style="font-size:13px; font-weight:600; margin-bottom:8px;">差异明细：</div>
              ${reconcile.diffs.map(d => html`
                <div class="diff-item">
                  <div class="diff-field">${d.field}${d.message ? ' - ' + d.message : ''}</div>
                  <div class="diff-values">
                    <span class="online">线上：${Array.isArray(d.online_value) ? d.online_value.map(s => statusMap[s] || s).join('、') : (d.online_value ?? '无')}</span>
                    ${d.offline_value !== undefined && d.offline_value !== null ? html`
                      <span class="offline">线下：${Array.isArray(d.offline_value) ? d.offline_value.map(s => statusMap[s] || s).join('、') : (d.offline_value ?? '无')}</span>
                    ` : ''}
                  </div>
                </div>
              `)}
            </div>
          ` : ''}
          ${reconcile.item_results?.length ? html`
            <div>
              <div style="font-size:13px; font-weight:600; margin-bottom:8px;">逐单核对：</div>
              <div class="item-reconcile-row header">
                <span>预约单 / 标题</span><span>线上状态</span><span>线下状态</span><span>核对</span>
              </div>
              ${reconcile.item_results.map(item => html`
                <div class="item-reconcile-row ${!item.is_consistent ? 'diff' : ''}">
                  <div>
                    <div style="font-weight:500;">${item.reservation_no}</div>
                    <div style="font-size:12px; color:#6b7280;">${item.title}</div>
                    ${item.status_diffs?.length || item.attachment_diffs?.length ? html`
                      <div style="font-size:11px; color:#dc2626; margin-top:4px;">
                        ${item.status_diffs?.map(d => html`<div>${d.message}</div>`)}
                        ${item.attachment_diffs?.map(d => html`<div>${d.message}</div>`)}
                      </div>
                    ` : ''}
                  </div>
                  <span><span class="status-tag" style="background:#dbeafe; color:#1e40af;">${statusMap[item.online_status] || item.online_status}</span></span>
                  <span><span class="status-tag" style="background:#fef3c7; color:#92400e;">${item.offline_status ? (statusMap[item.offline_status] || item.offline_status) : '-'}</span></span>
                  <span><span class="status-tag" style="background:${item.is_consistent ? '#d1fae5;color:#065f46;' : '#fee2e2;color:#991b1b;'}">${item.is_consistent ? '✓ 一致' : '✗ 差异'}</span></span>
                </div>
              `)}
            </div>
          ` : ''}
        </div>
      ` : html`
        <div style="color:#9ca3af; text-align:center; padding:20px; background:#fafafa; border-radius:6px;">
          尚未进行离线台账核对。登记员提交时系统会自动执行核对。
        </div>
      `}

      ${canEdit ? html`
        <div class="offline-form-box">
          <div style="font-size:14px; font-weight:600; color:#92400e; margin-bottom:12px;">
            📋 修改线下台账信息（用于补正后重新核对）
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>线下同批次预约单数量 <span class="section-badge badge-offline">线下</span></label>
              <input type="number" min="1" .value=${this.offlineForm.offline_count || 1}
                @input=${(e) => { this.offlineForm = {...this.offlineForm, offline_count: parseInt(e.target.value) || 1}; this.requestUpdate() }} />
            </div>
            <div class="form-group">
              <label>线下台账中本单状态 <span class="section-badge badge-offline">线下</span></label>
              <select .value=${this.offlineForm.offline_status || ''}
                @change=${(e) => { this.offlineForm = {...this.offlineForm, offline_status: e.target.value}; this.requestUpdate() }}>
                <option value="">（请选择）</option>
                ${Object.entries(statusMap).map(([v, l]) => html`<option value=${v}>${l}</option>`)}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>线下附件清单 <span class="section-badge badge-offline">线下</span></label>
            <textarea placeholder="多个用逗号分隔" .value=${this.offlineForm.offline_attachment_list || ''}
              @input=${(e) => { this.offlineForm = {...this.offlineForm, offline_attachment_list: e.target.value}; this.requestUpdate() }}></textarea>
          </div>
          <button class="primary" @click=${this._handleOfflineReconcile}>重新核对并保存</button>
        </div>
      ` : ''}
    `
  }

  async _handleOfflineReconcile() {
    try {
      await reservationApi.reconcile(this.reservationId, this.offlineForm)
      this._showMessage('离线台账核对完成')
      this._loadData()
    } catch (e) {
      this._showMessage(e.message, 'error')
    }
  }

  _getBlockTypeName(type) {
    const map = {
      duplicate_batch: '重复批次阻断',
      batch_mismatch: '批次不一致阻断',
      permission_denied: '权限不足阻断',
      missing_fields: '材料缺失阻断',
      missing_reason: '退回原因缺失阻断',
      missing_result: '使用结果缺失阻断',
      status_mismatch: '状态不一致阻断',
    }
    return map[type] || type
  }

  _getActionName(action) {
    const names = {
      create: '创建预约单',
      update: '更新信息',
      submit: '提交审核',
      audit_pass: '审核通过',
      return: '退回补正',
      usage_confirm: '使用确认',
      review: '复核通过',
      archive: '归档',
      review_return: '复核退回',
    }
    return names[action] || action
  }

  _formatTime(time) {
    if (!time) return '-'
    const d = new Date(time)
    if (isNaN(d.getTime())) return time
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
}

customElements.define('reservation-detail', ReservationDetail)
