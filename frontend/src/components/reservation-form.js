import { LitElement, html, css } from 'lit'
import { reservationApi, batchApi } from '../api/api.js'

export class ReservationForm extends LitElement {
  static properties = {
    userRole: { type: String },
    form: { type: Object },
    batchWarning: { type: Object },
    loading: { type: Boolean },
    message: { type: String },
    messageType: { type: String },
  }

  static styles = css`
    .form-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .back-btn {
      cursor: pointer;
      color: #6b7280;
      margin-bottom: 16px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .back-btn:hover {
      color: #2563eb;
    }

    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 24px;
    }

    .page-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #111827;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin: 20px 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
      color: #111827;
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

    .form-group label .required {
      color: #dc2626;
      margin-left: 2px;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
    }

    .form-group textarea {
      min-height: 80px;
      resize: vertical;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }

    .batch-check-box {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 12px 16px;
      margin-top: 8px;
      font-size: 13px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .batch-check-box.warning {
      background: #fef3c7;
      border-color: #fcd34d;
    }

    .batch-check-box.error {
      background: #fee2e2;
      border-color: #fca5a5;
    }

    .hint-text {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
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

    button.primary {
      background-color: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    button.primary:hover {
      background-color: #1d4ed8;
    }

    button.secondary {
      background-color: white;
      color: #374151;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    button.secondary:hover {
      background-color: #f9fafb;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
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
    }
    this.batchWarning = null
    this.loading = false
    this.message = ''
    this.messageType = ''
    this._batchCheckTimer = null
  }

  _onInput(field, value) {
    this.form = { ...this.form, [field]: value }

    if (field === 'batch_no') {
      this._debounceBatchCheck(value)
    }

    this.requestUpdate()
  }

  _debounceBatchCheck(value) {
    if (this._batchCheckTimer) {
      clearTimeout(this._batchCheckTimer)
    }
    if (!value || value.length < 3) {
      this.batchWarning = null
      this.requestUpdate()
      return
    }
    this._batchCheckTimer = setTimeout(async () => {
      try {
        const result = await batchApi.check(value)
        this.batchWarning = result
        this.requestUpdate()
      } catch (e) {
        console.error('批次校验失败', e)
      }
    }, 500)
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

  async _handleSave() {
    if (!this._validate()) return

    this.loading = true
    try {
      const result = await reservationApi.create(this.form)
      this._showMessage('创建成功')
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
    if (!this._validate()) return

    this.loading = true
    try {
      const result = await reservationApi.create(this.form)
      await reservationApi.submit(result.id)
      this._showMessage('创建并提交审核成功')
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

  _validate() {
    const errors = []
    if (!this.form.batch_no) errors.push('请输入批次号')
    if (!this.form.title) errors.push('请输入会议主题')
    if (!this.form.meeting_room) errors.push('请选择会议室')
    if (!this.form.meeting_date) errors.push('请选择会议日期')
    if (!this.form.start_time) errors.push('请选择开始时间')
    if (!this.form.end_time) errors.push('请选择结束时间')
    if (!this.form.participants || this.form.participants <= 0) errors.push('请输入正确的参会人数')

    if (errors.length > 0) {
      this._showMessage(errors.join('；'), 'error')
      return false
    }
    return true
  }

  render() {
    return html`
      <div class="form-container">
        <div class="back-btn" @click=${() => this.dispatchEvent(new CustomEvent('back'))}>
          ← 返回列表
        </div>

        ${this.message ? html`
          <div class="message message-${this.messageType}">${this.message}</div>
        ` : ''}

        <div class="card">
          <h1 class="page-title">新建会议预约单</h1>

          <div class="section-title">批次信息</div>
          <div class="form-group">
            <label>批次号 <span class="required">*</span></label>
            <input
              type="text"
              placeholder="请输入批次号，如：BATCH-20260612-01"
              .value=${this.form.batch_no}
              @input=${(e) => this._onInput('batch_no', e.target.value)}
            />
            ${this.batchWarning ? html`
              <div class="batch-check-box ${this.batchWarning.is_duplicate ? 'warning' : ''} ${this.batchWarning.is_status_mismatch ? 'error' : ''}">
                <span>${this.batchWarning.is_duplicate ? '⚠️' : '✓'}</span>
                <div>
                  <div>${this.batchWarning.message}</div>
                  ${this.batchWarning.is_status_mismatch && this.batchWarning.mismatch_details ? html`
                    <div style="margin-top: 8px; font-size: 12px;">
                      该批次内状态：${this.batchWarning.statuses?.join('、')}
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : html`
              <div class="hint-text">线下台账批次号，同一批次请使用相同批次号</div>
            `}
          </div>

          <div class="section-title">基本信息</div>

          <div class="form-group">
            <label>会议主题 <span class="required">*</span></label>
            <input
              type="text"
              placeholder="请输入会议主题"
              .value=${this.form.title}
              @input=${(e) => this._onInput('title', e.target.value)}
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>会议室 <span class="required">*</span></label>
              <select
                .value=${this.form.meeting_room}
                @change=${(e) => this._onInput('meeting_room', e.target.value)}
              >
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
              <input
                type="date"
                .value=${this.form.meeting_date}
                @input=${(e) => this._onInput('meeting_date', e.target.value)}
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>开始时间 <span class="required">*</span></label>
              <input
                type="time"
                .value=${this.form.start_time}
                @input=${(e) => this._onInput('start_time', e.target.value)}
              />
            </div>
            <div class="form-group">
              <label>结束时间 <span class="required">*</span></label>
              <input
                type="time"
                .value=${this.form.end_time}
                @input=${(e) => this._onInput('end_time', e.target.value)}
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>参会人数 <span class="required">*</span></label>
              <input
                type="number"
                min="1"
                placeholder="请输入参会人数"
                .value=${this.form.participants}
                @input=${(e) => this._onInput('participants', parseInt(e.target.value) || 0)}
              />
            </div>
            <div class="form-group">
              <label>组织者</label>
              <input
                type="text"
                placeholder="请输入组织者姓名"
                .value=${this.form.organizer}
                @input=${(e) => this._onInput('organizer', e.target.value)}
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>所属部门</label>
              <input
                type="text"
                placeholder="请输入所属部门"
                .value=${this.form.organizer_dept}
                @input=${(e) => this._onInput('organizer_dept', e.target.value)}
              />
            </div>
            <div class="form-group">
              <label>联系电话</label>
              <input
                type="text"
                placeholder="请输入联系电话"
                .value=${this.form.contact_phone}
                @input=${(e) => this._onInput('contact_phone', e.target.value)}
              />
            </div>
          </div>

          <div class="section-title">设备需求</div>
          <div class="form-group">
            <label>所需设备</label>
            <textarea
              placeholder="投影仪、白板、视频会议终端、音响系统等，多个用顿号分隔"
              .value=${this.form.equipment}
              @input=${(e) => this._onInput('equipment', e.target.value)}
            ></textarea>
          </div>

          <div class="section-title">附件材料</div>
          <div class="form-group">
            <label>附件清单</label>
            <textarea
              placeholder="请输入附件文件名，多个用逗号分隔"
              .value=${this.form.attachment_names}
              @input=${(e) => this._onInput('attachment_names', e.target.value)}
            ></textarea>
            <div class="hint-text">对应线下台账中登记的附件名称</div>
          </div>

          <div class="form-group">
            <label>线下附件数量</label>
            <input
              type="number"
              min="0"
              .value=${this.form.offline_attachment_count}
              @input=${(e) => this._onInput('offline_attachment_count', parseInt(e.target.value) || 0)}
            />
            <div class="hint-text">已提交至行政后勤中心的纸质材料份数</div>
          </div>

          <div class="form-actions">
            <button class="secondary" @click=${() => this.dispatchEvent(new CustomEvent('back'))}>
              取消
            </button>
            <button class="secondary" ?disabled=${this.loading} @click=${this._handleSave}>
              保存草稿
            </button>
            <button class="primary" ?disabled=${this.loading} @click=${this._handleSaveAndSubmit}>
              保存并提交审核
            </button>
          </div>
        </div>
      </div>
    `
  }
}

customElements.define('reservation-form', ReservationForm)
