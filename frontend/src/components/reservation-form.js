import { LitElement, html, css } from 'lit'
import { reservationApi, batchApi, statusMap } from '../api/api.js'

export class ReservationForm extends LitElement {
  static properties = {
    userRole: { type: String },
    form: { type: Object },
    batchWarning: { type: Object },
    reconcileResult: { type: Object },
    loading: { type: Boolean },
    message: { type: String },
    messageType: { type: String },
  }

  static styles = css`
    .form-container { max-width: 1000px; margin: 0 auto; }
    .back-btn { cursor: pointer; color: #6b7280; margin-bottom: 16px; display: inline-flex; align-items: center; gap: 4px; }
    .back-btn:hover { color: #2563eb; }
    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px; }
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #111827; }
    .section-title { font-size: 16px; font-weight: 600; margin: 20px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; color: #111827; }
    .section-badge { display: inline-block; padding: 2px 8px; font-size: 12px; border-radius: 4px; margin-left: 8px; font-weight: normal; }
    .badge-online { background: #dbeafe; color: #1e40af; }
    .badge-offline { background: #fef3c7; color: #92400e; }
    .badge-diff { background: #fee2e2; color: #991b1b; }
    .badge-ok { background: #d1fae5; color: #065f46; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 13px; }
    .form-group label .required { color: #dc2626; margin-left: 2px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; font-family: inherit; box-sizing: border-box; }
    .form-group textarea { min-height: 72px; resize: vertical; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .batch-check-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 12px 16px; margin-top: 8px; font-size: 13px; display: flex; align-items: flex-start; gap: 8px; }
    .batch-check-box.warning { background: #fef3c7; border-color: #fcd34d; }
    .batch-check-box.error { background: #fee2e2; border-color: #fca5a5; }
    .batch-check-box.blocked { background: #fee2e2; border-color: #ef4444; border-width: 2px; }
    .hint-text { font-size: 12px; color: #9ca3af; margin-top: 4px; }
    .message { padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; }
    .message-success { background: #f0fdf4; color: #166534; border: 1px solid #86efac; }
    .message-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    button.primary { background: #2563eb; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; font-weight: 500; cursor: pointer; }
    button.primary:hover { background: #1d4ed8; }
    button.primary.danger { background: #dc2626; }
    button.primary.danger:hover { background: #b91c1c; }
    button.secondary { background: white; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 20px; font-size: 14px; font-weight: 500; cursor: pointer; }
    button.secondary:hover { background: #f9fafb; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .reconcile-panel { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .reconcile-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .reconcile-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .summary-card { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; text-align: center; }
    .summary-card .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .summary-card .value { font-size: 20px; font-weight: 600; color: #111827; }
    .summary-card.ok .value { color: #059669; }
    .summary-card.diff .value { color: #dc2626; }
    .diff-list { margin-top: 12px; }
    .diff-item { background: white; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 10px 14px; margin-bottom: 8px; font-size: 13px; }
    .diff-item .diff-field { font-weight: 600; color: #991b1b; margin-bottom: 4px; }
    .diff-item .diff-values { color: #6b7280; display: flex; gap: 16px; font-size: 12px; }
    .diff-item .diff-values span.online { color: #1e40af; }
    .diff-item .diff-values span.offline { color: #92400e; }
    .item-reconcile-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; padding: 8px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 6px; font-size: 13px; align-items: center; }
    .item-reconcile-row.header { background: #f3f4f6; font-weight: 600; }
    .item-reconcile-row.diff { border-color: #fecaca; background: #fef2f2; }
    .item-reconcile-row .status-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .force-checkbox { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4px; margin: 12px 0; font-size: 13px; color: #92400e; }
    .force-checkbox input { width: auto; }
    .offline-section { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin-top: 8px; }
    .offline-section-title { font-size: 14px; font-weight: 600; color: #92400e; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
  `

  constructor() {
    super()
    this.form = {
      batch_no: '',
      title: '',
      meeting_room: '',
      meeting_date: '',
      start_time: '',
      end_time: '',
      participants: 0,
      organizer: '',
      organizer_dept: '',
      contact_phone: '',
      equipment: '',
      attachment_names: '',
      offline_attachment_count: 0,
      offline_count: 1,
      offline_status: '',
      offline_attachment_list: [],
      force_submit: false,
    }
    this.batchWarning = null
    this.reconcileResult = null
    this.loading = false
    this.message = ''
    this.messageType = ''
    this._batchCheckTimer = null
  }

  _onInput(field, value) {
    if (field === 'offline_attachment_list') {
      value = value.split(',').map(a => a.trim()).filter(a => a)
    }
    this.form = { ...this.form, [field]: value }
    if (field === 'batch_no') this._debounceBatchCheck(value)
    if (['batch_no', 'offline_count', 'offline_status', 'offline_attachment_list'].includes(field)) {
      this._runReconcile()
    }
    this.requestUpdate()
  }

  _debounceBatchCheck(value) {
    if (this._batchCheckTimer) clearTimeout(this._batchCheckTimer)
    if (!value || value.length < 3) {
      this.batchWarning = null
      this.requestUpdate()
      return
    }
    this._batchCheckTimer = setTimeout(async () => {
      try {
        const result = await batchApi.check(value)
        this.batchWarning = result
        this._runReconcile()
        this.requestUpdate()
      } catch (e) {
        console.error('批次校验失败', e)
      }
    }, 500)
  }

  async _runReconcile() {
    if (!this.form.batch_no || this.form.batch_no.length < 3) {
      this.reconcileResult = null
      return
    }
    try {
      const offline_statuses = []
      if (this.batchWarning?.mismatch_details) {
        this.batchWarning.mismatch_details.forEach(d => {
          offline_statuses.push({
            reservation_no: d.reservation_no,
            status: d.status,
            attachments: d.online_attachments ? d.online_attachments.split(',').map(a => a.trim()).filter(a => a) : [],
          })
        })
      }
      offline_statuses.push({
        reservation_no: 'NEW',
        status: this.form.offline_status || 'draft',
        attachments: this.form.offline_attachment_list || [],
      })
      const result = await batchApi.statusCheck({
        batch_no: this.form.batch_no,
        offline_count: this.form.offline_count,
        offline_statuses,
      })
      this.reconcileResult = result
    } catch (e) {
      console.error('核对失败', e)
    }
  }

  _showMessage(msg, type = 'success') {
    this.message = msg
    this.messageType = type
    this.requestUpdate()
    setTimeout(() => { this.message = ''; this.requestUpdate() }, 5000)
  }

  async _handleSave() {
    if (!this._validate(false)) return
    this.loading = true
    try {
      const result = await reservationApi.create(this.form)
      this._showMessage('草稿保存成功')
      setTimeout(() => {
        this.dispatchEvent(new CustomEvent('created', { detail: { id: result.id } }))
      }, 500)
    } catch (e) {
      this._showMessage(e.message, 'error')
    } finally {
      this.loading = false
      this.requestUpdate()
    }
  }

  async _handleSaveAndSubmit() {
    if (!this._validate(true)) return
    this.loading = true
    try {
      const createResult = await reservationApi.create(this.form)
      const offline_statuses = []
      if (this.batchWarning?.mismatch_details) {
        this.batchWarning.mismatch_details.forEach(d => {
          offline_statuses.push({
            reservation_no: d.reservation_no,
            status: d.offline_status || d.status,
            attachments: Array.isArray(d.offline_attachments) ? d.offline_attachments : (d.online_attachments ? d.online_attachments.split(',').map(a => a.trim()).filter(a => a) : []),
          })
        })
      }
      offline_statuses.push({
        reservation_no: createResult.reservation_no,
        status: this.form.offline_status || 'draft',
        attachments: this.form.offline_attachment_list || [],
      })
      await reservationApi.submit(createResult.id, {
        offline_count: this.form.offline_count,
        offline_statuses,
        force_submit: this.form.force_submit,
      })
      this._showMessage('创建并提交审核成功')
      setTimeout(() => {
        this.dispatchEvent(new CustomEvent('created', { detail: { id: createResult.id } }))
      }, 500)
    } catch (e) {
      this._showMessage(e.message, 'error')
    } finally {
      this.loading = false
      this.requestUpdate()
    }
  }

  _validate(forSubmit = false) {
    const errors = []
    if (!this.form.batch_no) errors.push('请输入批次号')
    if (!this.form.title) errors.push('请输入会议主题')
    if (!this.form.meeting_room) errors.push('请选择会议室')
    if (!this.form.meeting_date) errors.push('请选择会议日期')
    if (!this.form.start_time) errors.push('请选择开始时间')
    if (!this.form.end_time) errors.push('请选择结束时间')
    if (!this.form.participants || this.form.participants <= 0) errors.push('请输入正确的参会人数')

    if (forSubmit && this.batchWarning?.is_blocked && !this.form.force_submit) {
      errors.push(this.batchWarning.message)
    }
    if (forSubmit && this.reconcileResult?.is_blocked && !this.form.force_submit) {
      errors.push(this.reconcileResult.message)
    }

    if (errors.length > 0) {
      this._showMessage(errors.join('；'), 'error')
      return false
    }
    return true
  }

  _renderBatchWarning() {
    if (!this.batchWarning) return ''
    const isBlocked = this.batchWarning.is_blocked
    const isDup = this.batchWarning.is_duplicate
    const cls = isBlocked ? 'blocked' : (isDup ? 'warning' : '')
    const icon = isBlocked ? '🚫' : (isDup ? '⚠️' : '✓')
    return html`
      <div class="batch-check-box ${cls}">
        <span>${icon}</span>
        <div style="flex:1">
          <div style="font-weight: ${isBlocked ? 600 : 500}">${this.batchWarning.message}</div>
          ${this.batchWarning.is_status_mismatch && this.batchWarning.mismatch_details?.length ? html`
            <div style="margin-top:8px">
              <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">批次内预约单状态：</div>
              ${this.batchWarning.mismatch_details.map(d => html`
                <div style="font-size:12px; padding:4px 8px; background:rgba(255,255,255,0.6); border-radius:4px; margin-bottom:4px;">
                  <b>${d.reservation_no}</b> - ${d.title}
                  <span style="margin-left:12px; color:#991b1b;">${d.status_label}</span>
                  <span style="margin-left:8px; font-size:11px; color:#9ca3af;">${d.suggestion}</span>
                </div>
              `)}
            </div>
          ` : ''}
          ${isDup && !isBlocked ? html`
            <div style="margin-top:6px; font-size:12px; color:#92400e;">提示：同一批次号可继续录入，但请确保线下台账批次号与线上一致。</div>
          ` : ''}
        </div>
      </div>
    `
  }

  _renderReconcile() {
    if (!this.reconcileResult) return ''
    const r = this.reconcileResult
    return html`
      <div class="reconcile-panel">
        <div class="reconcile-title">
          ${r.is_consistent ? '✓ 线上线下台账核对一致' : (r.is_blocked ? '🚫 批次核对阻断' : '⚠️ 线上线下存在差异')}
          <span class="section-badge ${r.is_consistent ? 'badge-ok' : (r.is_blocked ? 'badge-diff' : 'badge-diff')}">
            ${r.is_consistent ? '一致' : (r.is_blocked ? '阻断' : '差异')}
          </span>
        </div>
        <div style="font-size:13px; color:#4b5563; margin-bottom:12px;">${r.message}</div>
        <div class="reconcile-summary">
          <div class="summary-card">
            <div class="label">线上数量</div>
            <div class="value">${r.total_online}</div>
          </div>
          <div class="summary-card">
            <div class="label">线下数量</div>
            <div class="value">${r.total_offline}</div>
          </div>
          <div class="summary-card ${r.diff_count === 0 ? 'ok' : 'diff'}">
            <div class="label">差异项</div>
            <div class="value">${r.diff_count}</div>
          </div>
          <div class="summary-card ${r.is_consistent ? 'ok' : 'diff'}">
            <div class="label">核对结果</div>
            <div class="value">${r.is_consistent ? '通过' : '未通过'}</div>
          </div>
        </div>
        ${r.diffs?.length ? html`
          <div class="diff-list">
            <div style="font-size:13px; font-weight:600; color:#374151; margin-bottom:8px;">差异明细：</div>
            ${r.diffs.map(d => html`
              <div class="diff-item">
                <div class="diff-field">${d.field}${d.message ? ' - ' + d.message : ''}</div>
                ${d.online_value !== undefined || d.offline_value !== undefined ? html`
                  <div class="diff-values">
                    <span class="online">线上：${Array.isArray(d.online_value) ? d.online_value.join('、') : (d.online_value ?? '无')}</span>
                    <span class="offline">线下：${d.offline_value ?? '无'}</span>
                  </div>
                ` : ''}
              </div>
            `)}
          </div>
        ` : ''}
        ${r.item_results?.length ? html`
          <div style="margin-top:16px;">
            <div style="font-size:13px; font-weight:600; color:#374151; margin-bottom:8px;">逐单核对结果：</div>
            <div class="item-reconcile-row header">
              <span>预约单 / 标题</span>
              <span>线上状态</span>
              <span>线下状态</span>
              <span>核对</span>
            </div>
            ${r.item_results.map(item => html`
              <div class="item-reconcile-row ${!item.is_consistent ? 'diff' : ''}">
                <div>
                  <div style="font-weight:500;">${item.reservation_no}</div>
                  <div style="font-size:12px; color:#6b7280;">${item.title}</div>
                  ${item.status_diffs?.length || item.attachment_diffs?.length ? html`
                    <div style="font-size:11px; color:#dc2626; margin-top:4px;">
                      ${item.status_diffs?.map(d => html`<div>状态：${d.message}</div>`)}
                      ${item.attachment_diffs?.map(d => html`<div>附件：${d.message}</div>`)}
                    </div>
                  ` : ''}
                </div>
                <span><span class="status-tag" style="background:#dbeafe; color:#1e40af;">${statusMap[item.online_status] || item.online_status}</span></span>
                <span><span class="status-tag" style="background:#fef3c7; color:#92400e;">${item.offline_status ? (statusMap[item.offline_status] || item.offline_status) : '未填写'}</span></span>
                <span><span class="status-tag" style="background:${item.is_consistent ? '#d1fae5;color:#065f46;' : '#fee2e2;color:#991b1b;'}">${item.is_consistent ? '✓ 一致' : '✗ 差异'}</span></span>
              </div>
            `)}
          </div>
        ` : ''}
      </div>
    `
  }

  render() {
    const isBlocked = this.batchWarning?.is_blocked || this.reconcileResult?.is_blocked
    return html`
      <div class="form-container">
        <div class="back-btn" @click=${() => this.dispatchEvent(new CustomEvent('back'))}>← 返回列表</div>
        ${this.message ? html`<div class="message message-${this.messageType}">${this.message}</div>` : ''}
        <div class="card">
          <h1 class="page-title">新建会议预约单</h1>

          <div class="section-title">
            批次信息
            <span class="section-badge badge-online">线上</span>
          </div>
          <div class="form-group">
            <label>批次号 <span class="required">*</span></label>
            <input type="text" placeholder="请输入批次号，如：BATCH-20260612-01"
              .value=${this.form.batch_no}
              @input=${(e) => this._onInput('batch_no', e.target.value)} />
            ${this._renderBatchWarning()}
            <div class="hint-text">线下台账批次号，同一批次请使用相同批次号；录入时系统自动核对线上线下一致性</div>
          </div>

          ${this._renderReconcile()}

          ${isBlocked ? html`
            <label class="force-checkbox">
              <input type="checkbox"
                ?checked=${this.form.force_submit}
                @change=${(e) => this._onInput('force_submit', e.target.checked)} />
              我已核对线下台账，确认此预约单与线上批次属于同一会务安排，强制继续提交
            </label>
          ` : ''}

          <div class="section-title">
            基本信息 - 会议室预约
            <span class="section-badge badge-online">线上</span>
          </div>
          <div class="form-group">
            <label>会议主题 <span class="required">*</span></label>
            <input type="text" placeholder="请输入会议主题" .value=${this.form.title}
              @input=${(e) => this._onInput('title', e.target.value)} />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>会议室 <span class="required">*</span></label>
              <select .value=${this.form.meeting_room} @change=${(e) => this._onInput('meeting_room', e.target.value)}>
                <option value="">请选择会议室</option>
                <option value="1楼大会议室">1楼大会议室</option>
                <option value="1楼多功能厅">1楼多功能厅</option>
                <option value="2楼培训室A">2楼培训室A</option>
                <option value="2楼会议室B">2楼会议室B</option>
                <option value="3楼第一会议室">3楼第一会议室</option>
                <option value="3楼第二会议室">3楼第二会议室</option>
                <option value="4楼VIP会议室">4楼VIP会议室</option>
                <option value="5楼多功能厅">5楼多功能厅</option>
              </select>
            </div>
            <div class="form-group">
              <label>会议日期 <span class="required">*</span></label>
              <input type="date" .value=${this.form.meeting_date}
                @input=${(e) => this._onInput('meeting_date', e.target.value)} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>开始时间 <span class="required">*</span></label>
              <input type="time" .value=${this.form.start_time}
                @input=${(e) => this._onInput('start_time', e.target.value)} />
            </div>
            <div class="form-group">
              <label>结束时间 <span class="required">*</span></label>
              <input type="time" .value=${this.form.end_time}
                @input=${(e) => this._onInput('end_time', e.target.value)} />
            </div>
          </div>
          <div class="form-row-3">
            <div class="form-group">
              <label>参会人数 <span class="required">*</span></label>
              <input type="number" min="1" placeholder="请输入参会人数" .value=${this.form.participants}
                @input=${(e) => this._onInput('participants', parseInt(e.target.value) || 0)} />
            </div>
            <div class="form-group">
              <label>组织者</label>
              <input type="text" placeholder="请输入组织者姓名" .value=${this.form.organizer}
                @input=${(e) => this._onInput('organizer', e.target.value)} />
            </div>
            <div class="form-group">
              <label>联系电话</label>
              <input type="text" placeholder="请输入联系电话" .value=${this.form.contact_phone}
                @input=${(e) => this._onInput('contact_phone', e.target.value)} />
            </div>
          </div>
          <div class="form-group">
            <label>所属部门</label>
            <input type="text" placeholder="请输入所属部门" .value=${this.form.organizer_dept}
              @input=${(e) => this._onInput('organizer_dept', e.target.value)} />
          </div>

          <div class="section-title">
            设备准备
            <span class="section-badge badge-online">线上</span>
          </div>
          <div class="form-group">
            <label>所需设备</label>
            <textarea placeholder="投影仪、白板、视频会议终端、音响系统等，多个用顿号分隔"
              .value=${this.form.equipment}
              @input=${(e) => this._onInput('equipment', e.target.value)}></textarea>
          </div>

          <div class="section-title">
            附件材料 - 线上线下对比
            <span class="section-badge badge-online">线上</span>
            <span class="section-badge badge-offline">线下</span>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>线上附件清单 <span class="section-badge badge-online">线上</span></label>
              <textarea placeholder="请输入线上已登记附件文件名，多个用逗号分隔"
                .value=${this.form.attachment_names}
                @input=${(e) => this._onInput('attachment_names', e.target.value)}></textarea>
              <div class="hint-text">线上系统中登记的附件名称</div>
            </div>
            <div class="form-group">
              <label>线下附件清单 <span class="section-badge badge-offline">线下</span></label>
              <textarea placeholder="请输入线下台账中登记的附件文件名，多个用逗号分隔"
                .value=${Array.isArray(this.form.offline_attachment_list) ? this.form.offline_attachment_list.join(', ') : (this.form.offline_attachment_list || '')}
                @input=${(e) => this._onInput('offline_attachment_list', e.target.value)}></textarea>
              <div class="hint-text">线下纸质台账中记录的附件名称</div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>线下附件数量 <span class="section-badge badge-offline">线下</span></label>
              <input type="number" min="0" .value=${this.form.offline_attachment_count}
                @input=${(e) => this._onInput('offline_attachment_count', parseInt(e.target.value) || 0)} />
              <div class="hint-text">已提交至行政后勤中心的纸质材料份数</div>
            </div>
          </div>

          <div class="section-title">
            离线台账核对
            <span class="section-badge badge-offline">线下</span>
          </div>
          <div class="offline-section">
            <div class="offline-section-title">📋 请填写线下台账信息用于系统自动核对</div>
            <div class="form-row">
              <div class="form-group">
                <label>线下同批次预约单数量 <span class="required">*</span></label>
                <input type="number" min="1" .value=${this.form.offline_count}
                  @input=${(e) => this._onInput('offline_count', parseInt(e.target.value) || 1)} />
                <div class="hint-text">离线台账中该批次号下登记的会议预约单总数</div>
              </div>
              <div class="form-group">
                <label>线下台账中本单状态</label>
                <select .value=${this.form.offline_status}
                  @change=${(e) => this._onInput('offline_status', e.target.value)}>
                  <option value="">（请选择线下状态）</option>
                  <option value="draft">草稿</option>
                  <option value="pending_audit">待审核</option>
                  <option value="approved">审核通过</option>
                  <option value="usage_confirmed">使用确认</option>
                  <option value="archived">已归档</option>
                  <option value="returned">已退回</option>
                  <option value="overdue">已超时</option>
                </select>
                <div class="hint-text">离线台账中该预约单当前登记的处理状态</div>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button class="secondary" @click=${() => this.dispatchEvent(new CustomEvent('back'))}>取消</button>
            <button class="secondary" ?disabled=${this.loading} @click=${this._handleSave}>保存草稿</button>
            <button class="primary ${isBlocked && !this.form.force_submit ? '' : ''}"
              ?disabled=${this.loading || (isBlocked && !this.form.force_submit)}
              @click=${this._handleSaveAndSubmit}>
              ${isBlocked && !this.form.force_submit ? '请先核对台账差异' : '保存并提交审核'}
            </button>
          </div>
        </div>
      </div>
    `
  }
}

customElements.define('reservation-form', ReservationForm)
