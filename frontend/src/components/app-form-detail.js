import { LitElement, html, css } from 'lit';
import { api, extractFormFromResponse, extractActionsFromResponse } from '../services/api.js';

const STATUS_LABELS = {
  draft: '草稿', pending_review: '待审核', reviewing: '审核中',
  pending_courseware: '待课件审核', courseware_reviewing: '课件审核中',
  pending_teaching: '待授课', teaching_completed: '授课完成',
  pending_evaluation: '待课后评价', evaluating: '评价中',
  pending_archive: '待归档', archived: '已归档',
  rejected: '已驳回', timeout_handling: '超时处理中',
};

const STATUS_FLOW = [
  'pending_review', 'reviewing', 'pending_courseware', 'courseware_reviewing',
  'pending_teaching', 'teaching_completed', 'pending_evaluation', 'evaluating',
  'pending_archive', 'archived',
];

const CW_STATUS = { pending: '待审核', reviewing: '审核中', approved: '已通过', rejected: '已驳回' };
const EVAL_STATUS = { pending: '待评价', evaluating: '评价中', completed: '已完成' };

class AppFormDetail extends LitElement {
  static properties = {
    user: { type: Object },
    formId: { type: Number },
    form: { type: Object },
    actions: { type: Array },
    logs: { type: Array },
    timeoutRecords: { type: Array },
    schedules: { type: Array },
    coursewareReviews: { type: Array },
    evaluations: { type: Array },
    showRejectDialog: { type: Boolean },
    showTimeoutDialog: { type: Boolean },
    showCoursewareDialog: { type: Boolean },
    showEvaluationDialog: { type: Boolean },
    showScheduleDialog: { type: Boolean },
    rejectRemark: { type: String },
    timeoutReason: { type: String },
    timeoutFollowUp: { type: String },
    cwResult: { type: String },
    cwComment: { type: String },
    evalScore: { type: Number },
    evalComment: { type: String },
    schedDate: { type: String },
    schedSlot: { type: String },
    schedRemark: { type: String },
    error: { type: String },
    success: { type: String },
  };

  static styles = css`
    :host { display: block; }
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
      color: #555;
      font-size: 13px;
      cursor: pointer;
      margin-bottom: 16px;
    }
    .back-btn:hover { background: #f5f5f5; }
    .grid { display: grid; grid-template-columns: 1fr 360px; gap: 20px; }
    @media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: white;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      margin-bottom: 16px;
    }
    .card h3 {
      font-size: 15px;
      color: #333;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .field-row {
      display: flex;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .field-label {
      width: 100px;
      color: #888;
      flex-shrink: 0;
    }
    .field-value { color: #333; flex: 1; }
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
      display: inline-block; background: #e53e3e; color: white;
      padding: 1px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px;
      animation: blink 2s infinite;
    }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

    .flow-tracker {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 12px 0;
    }
    .flow-node {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      background: #f1f5f9;
      color: #94a3b8;
      position: relative;
    }
    .flow-node.completed { background: #d1fae5; color: #065f46; }
    .flow-node.current { background: #667eea; color: white; font-weight: 600; }
    .flow-node.timeout { background: #fee2e2; color: #991b1b; }
    .flow-arrow { display: flex; align-items: center; color: #cbd5e1; font-size: 10px; }

    .actions-bar { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary { background: #667eea; color: white; }
    .btn-success { background: #38a169; color: white; }
    .btn-danger { background: #e53e3e; color: white; }
    .btn-warning { background: #dd6b20; color: white; }
    .btn-secondary { background: #64748b; color: white; }
    .btn-outline { background: white; color: #667eea; border: 1px solid #667eea; }

    .log-item {
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12px;
    }
    .log-item:last-child { border-bottom: none; }
    .log-time { color: #999; font-size: 11px; }
    .log-operator { font-weight: 500; color: #333; }
    .log-action { color: #555; }
    .log-status-change {
      display: inline-block;
      font-size: 11px;
    }

    .timeout-item {
      padding: 10px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      margin-bottom: 8px;
      background: #fef2f2;
    }
    .timeout-item.handled { background: #f0fdf4; border-color: #bbf7d0; }
    .timeout-field { font-size: 12px; margin-bottom: 4px; }
    .timeout-field .label { color: #888; }

    .schedule-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .schedule-status {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
    }
    .schedule-status.planned { background: #fef3c7; color: #92400e; }
    .schedule-status.confirmed { background: #dbeafe; color: #1e40af; }
    .schedule-status.completed { background: #d1fae5; color: #065f46; }
    .schedule-status.cancelled { background: #fee2e2; color: #991b1b; }

    .dialog-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    }
    .dialog {
      background: white;
      border-radius: 12px;
      padding: 24px;
      width: 440px;
      max-width: 90vw;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .dialog h3 { margin-bottom: 16px; font-size: 16px; }
    .dialog .form-group { margin-bottom: 14px; }
    .dialog label { display: block; font-size: 13px; font-weight: 500; color: #555; margin-bottom: 4px; }
    .dialog input, .dialog textarea, .dialog select {
      width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;
    }
    .dialog textarea { min-height: 60px; resize: vertical; }
    .dialog .btn-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
    .error-msg { background: #fee2e2; color: #991b1b; padding: 8px; border-radius: 6px; font-size: 12px; margin-bottom: 12px; }
    .success-msg { background: #d1fae5; color: #065f46; padding: 8px; border-radius: 6px; font-size: 12px; margin-bottom: 12px; }

    .remaining { font-size: 12px; color: #dd6b20; }
    .remaining.timeout { color: #e53e3e; font-weight: 600; }
  `;

  constructor() {
    super();
    this.formId = null;
    this.form = null;
    this.actions = [];
    this.logs = [];
    this.timeoutRecords = [];
    this.schedules = [];
    this.coursewareReviews = [];
    this.evaluations = [];
    this.showRejectDialog = false;
    this.showTimeoutDialog = false;
    this.showCoursewareDialog = false;
    this.showEvaluationDialog = false;
    this.showScheduleDialog = false;
    this.rejectRemark = '';
    this.timeoutReason = '';
    this.timeoutFollowUp = '';
    this.cwResult = 'approved';
    this.cwComment = '';
    this.evalScore = 80;
    this.evalComment = '';
    this.schedDate = '';
    this.schedSlot = '';
    this.schedRemark = '';
    this.error = '';
    this.success = '';
  }

  async connectedCallback() {
    super.connectedCallback();
    if (this.formId) await this._loadData();
  }

  async updated(changed) {
    if (changed.has('formId') && this.formId) {
      await this._loadData();
    }
  }

  async _loadData() {
    try {
      const [formResp, logs, timeouts, schedules, cwReviews, evals] = await Promise.all([
        api.getForm(this.formId),
        api.getLogs(this.formId),
        api.getTimeoutRecords(this.formId),
        api.getSchedules(this.formId),
        api.getCoursewareReviews(this.formId),
        api.getEvaluations(this.formId),
      ]);
      this.form = extractFormFromResponse(formResp);
      this.actions = extractActionsFromResponse(formResp);
      this.logs = logs;
      this.timeoutRecords = timeouts;
      this.schedules = schedules;
      this.coursewareReviews = cwReviews;
      this.evaluations = evals;
      this.error = '';
      this.success = '';
    } catch (e) {
      this.error = e.message;
    }
  }

  async _doTransition(action, remark) {
    try {
      const resp = await api.transitionStatus(this.formId, action, remark);
      this.form = extractFormFromResponse(resp);
      this.actions = extractActionsFromResponse(resp);
      this.logs = await api.getLogs(this.formId);
      this.success = '操作成功';
    } catch (e) {
      this.error = e.message;
    }
  }

  async _doReject() {
    if (!this.rejectRemark.trim()) { this.error = '请填写驳回原因'; return; }
    await this._doTransition('reject', this.rejectRemark);
    this.showRejectDialog = false;
    this.rejectRemark = '';
  }

  async _doTimeoutHandle() {
    if (!this.timeoutReason.trim() || !this.timeoutFollowUp.trim()) {
      this.error = '请填写超时原因和后续处理记录';
      return;
    }
    try {
      const resp = await api.handleTimeout(this.formId, { reason: this.timeoutReason, follow_up: this.timeoutFollowUp });
      this.form = extractFormFromResponse(resp);
      this.actions = extractActionsFromResponse(resp);
      this.showTimeoutDialog = false;
      this.timeoutReason = '';
      this.timeoutFollowUp = '';
      this.logs = await api.getLogs(this.formId);
      this.timeoutRecords = await api.getTimeoutRecords(this.formId);
      this.success = '超时处理成功';
    } catch (e) {
      this.error = e.message;
    }
  }

  async _doCoursewareReview() {
    try {
      const resp = await api.reviewCourseware(this.formId, { result: this.cwResult, comment: this.cwComment });
      this.form = extractFormFromResponse(resp);
      this.actions = extractActionsFromResponse(resp);
      this.showCoursewareDialog = false;
      this.cwComment = '';
      this.logs = await api.getLogs(this.formId);
      this.coursewareReviews = await api.getCoursewareReviews(this.formId);
      this.success = '课件审核完成';
    } catch (e) {
      this.error = e.message;
    }
  }

  async _doEvaluation() {
    try {
      const resp = await api.createEvaluation(this.formId, { score: this.evalScore, comment: this.evalComment });
      this.form = extractFormFromResponse(resp);
      this.actions = extractActionsFromResponse(resp);
      this.showEvaluationDialog = false;
      this.evalComment = '';
      this.logs = await api.getLogs(this.formId);
      this.evaluations = await api.getEvaluations(this.formId);
      this.success = '评价提交成功';
    } catch (e) {
      this.error = e.message;
    }
  }

  async _doConfirmTeaching() {
    if (!confirm('确认授课已完成？')) return;
    try {
      const resp = await api.confirmTeaching(this.formId);
      this.form = extractFormFromResponse(resp);
      this.actions = extractActionsFromResponse(resp);
      this.logs = await api.getLogs(this.formId);
      this.success = '授课确认完成';
    } catch (e) {
      this.error = e.message;
    }
  }

  async _doAddSchedule() {
    if (!this.schedDate || !this.schedSlot) { this.error = '请填写日期和时段'; return; }
    try {
      await api.addSchedule(this.formId, { schedule_date: this.schedDate, time_slot: this.schedSlot, remark: this.schedRemark });
      this.schedules = await api.getSchedules(this.formId);
      this.showScheduleDialog = false;
      this.schedDate = '';
      this.schedSlot = '';
      this.schedRemark = '';
      this.success = '排期添加成功';
    } catch (e) {
      this.error = e.message;
    }
  }

  _goBack() {
    this.dispatchEvent(new CustomEvent('navigate', { detail: { route: 'list' }, bubbles: true, composed: true }));
  }

  _renderFlowTracker() {
    if (!this.form) return '';
    const currentIdx = STATUS_FLOW.indexOf(this.form.status);
    const isRejected = this.form.status === 'rejected';
    const isTimeout = this.form.status === 'timeout_handling';

    return html`
      <div class="flow-tracker">
        ${STATUS_FLOW.map((s, i) => {
          let cls = '';
          if (isRejected || isTimeout) {
            cls = i <= currentIdx ? 'completed' : '';
          } else if (i < currentIdx) {
            cls = 'completed';
          } else if (i === currentIdx) {
            cls = this.form.is_timeout ? 'timeout' : 'current';
          }
          return html`
            ${i > 0 ? html`<span class="flow-arrow">→</span>` : ''}
            <span class="flow-node ${cls}">${STATUS_LABELS[s]}</span>
          `;
        })}
        ${isRejected ? html`<span class="flow-arrow">→</span><span class="flow-node timeout">已驳回</span>` : ''}
        ${isTimeout ? html`<span class="flow-arrow">→</span><span class="flow-node timeout">超时处理</span>` : ''}
      </div>
    `;
  }

  render() {
    if (!this.form) return html`<div style="text-align:center;padding:40px;color:#888;">加载中...</div>`;

    const f = this.form;
    const role = this.user?.role;

    return html`
      <button class="back-btn" @click=${this._goBack}>← 返回列表</button>

      ${this.error ? html`<div class="error-msg" style="margin-bottom:16px;background:#fee2e2;color:#991b1b;padding:8px 12px;border-radius:8px;font-size:13px;">${this.error}</div>` : ''}
      ${this.success ? html`<div class="success-msg" style="margin-bottom:16px;background:#d1fae5;color:#065f46;padding:8px 12px;border-radius:8px;font-size:13px;">${this.success}</div>` : ''}

      <div class="grid">
        <div>
          <div class="card">
            <h3>排课单信息 ${f.form_no}
              <span class="status-badge s-${f.status}" style="margin-left:8px;">${f.status_label}</span>
              ${f.is_timeout ? html`<span class="timeout-mark">超时</span>` : ''}
            </h3>

            ${this._renderFlowTracker()}

            ${f.timeout_remaining_hours !== undefined && f.timeout_remaining_hours !== null ? html`
              <div style="margin-bottom:12px;">
                <span class="remaining ${f.is_timeout ? 'timeout' : ''}">
                  ${f.is_timeout ? '已超时' : `剩余 ${f.timeout_remaining_hours}h`}
                </span>
              </div>
            ` : ''}

            <div class="field-row"><span class="field-label">标题</span><span class="field-value">${f.title}</span></div>
            <div class="field-row"><span class="field-label">讲师</span><span class="field-value">${f.instructor_name}${f.instructor_id ? ` (${f.instructor_id})` : ''}</span></div>
            <div class="field-row"><span class="field-label">课程</span><span class="field-value">${f.course_name}</span></div>
            ${f.course_type !== undefined ? html`<div class="field-row"><span class="field-label">课程类型</span><span class="field-value">${f.course_type || '-'}</span></div>` : ''}
            ${f.training_company !== undefined ? html`<div class="field-row"><span class="field-label">培训公司</span><span class="field-value">${f.training_company || '-'}</span></div>` : ''}
            ${f.start_date !== undefined ? html`<div class="field-row"><span class="field-label">培训日期</span><span class="field-value">${f.start_date || '-'} ~ ${f.end_date || '-'}</span></div>` : ''}
            ${f.location !== undefined ? html`<div class="field-row"><span class="field-label">地点</span><span class="field-value">${f.location || '-'}</span></div>` : ''}
            ${f.student_count !== undefined ? html`<div class="field-row"><span class="field-label">学员人数</span><span class="field-value">${f.student_count || 0}</span></div>` : ''}
            ${f.description !== undefined ? html`<div class="field-row"><span class="field-label">描述</span><span class="field-value">${f.description || '-'}</span></div>` : ''}
            ${f.created_by_name !== undefined ? html`<div class="field-row"><span class="field-label">创建人</span><span class="field-value">${f.created_by_name || '-'}</span></div>` : ''}
            ${f.created_at !== undefined ? html`<div class="field-row"><span class="field-label">创建时间</span><span class="field-value">${f.created_at}</span></div>` : ''}
            ${f.courseware_status !== undefined ? html`<div class="field-row"><span class="field-label">课件审核</span><span class="field-value">${CW_STATUS[f.courseware_status] || f.courseware_status || '-'}</span></div>` : ''}
            ${f.evaluation_status !== undefined ? html`<div class="field-row"><span class="field-label">课后评价</span><span class="field-value">${EVAL_STATUS[f.evaluation_status] || f.evaluation_status || '-'}</span></div>` : ''}
            ${f.current_node_entered_at !== undefined ? html`<div class="field-row"><span class="field-label">节点进入时间</span><span class="field-value">${f.current_node_entered_at || '-'}</span></div>` : ''}
          </div>

          ${this._renderActions()}

          <div class="card">
            <h3>讲师排期
              ${(role === 'clerk' || role === 'manager') ? html`
                <button class="btn btn-outline" style="float:right;font-size:12px;padding:4px 10px;" @click=${() => { this.showScheduleDialog = true; }}>+ 添加排期</button>
              ` : ''}
            </h3>
            ${this.schedules.length === 0 ? html`<div style="color:#999;font-size:13px;">暂无排期</div>` : html`
              ${this.schedules.map(s => html`
                <div class="schedule-item">
                  <span>${s.schedule_date} ${s.time_slot}</span>
                  <span>
                    <span class="schedule-status ${s.status}">${s.status === 'planned' ? '计划' : s.status === 'confirmed' ? '已确认' : s.status === 'completed' ? '已完成' : '已取消'}</span>
                    ${s.remark ? html`<span style="color:#888;font-size:11px;margin-left:8px;">${s.remark}</span>` : ''}
                  </span>
                </div>
              `)}
            `}
          </div>

          ${this.coursewareReviews.length > 0 ? html`
            <div class="card">
              <h3>课件审核记录</h3>
              ${this.coursewareReviews.map(r => html`
                <div class="log-item">
                  <span class="log-operator">${r.reviewer_name}</span>
                  <span style="color:${r.result === 'approved' ? '#38a169' : '#e53e3e'};font-size:12px;margin:0 6px;">
                    ${r.result === 'approved' ? '通过' : '驳回'}
                  </span>
                  <span style="color:#888;font-size:12px;">${r.comment || ''}</span>
                  <div class="log-time">${r.reviewed_at}</div>
                </div>
              `)}
            </div>
          ` : ''}

          ${this.evaluations.length > 0 ? html`
            <div class="card">
              <h3>课后评价记录</h3>
              ${this.evaluations.map(e => html`
                <div class="log-item">
                  <span class="log-operator">${e.evaluator_name}</span>
                  <span style="font-weight:600;color:#333;margin:0 6px;">${e.score}分</span>
                  <span style="color:#888;font-size:12px;">${e.comment || ''}</span>
                  <div class="log-time">${e.evaluated_at}</div>
                </div>
              `)}
            </div>
          ` : ''}
        </div>

        <div>
          ${this.timeoutRecords.length > 0 ? html`
            <div class="card">
              <h3>超时记录</h3>
              ${this.timeoutRecords.map(t => html`
                <div class="timeout-item ${t.status === 'handled' ? 'handled' : ''}">
                  <div class="timeout-field"><span class="label">节点：</span>${t.node_label}</div>
                  <div class="timeout-field"><span class="label">超时时间：</span>${t.timeout_at}</div>
                  <div class="timeout-field"><span class="label">状态：</span>${t.status === 'pending' ? '待处理' : '已处理'}</div>
                  ${t.reason ? html`<div class="timeout-field"><span class="label">原因：</span>${t.reason}</div>` : ''}
                  ${t.follow_up ? html`<div class="timeout-field"><span class="label">后续处理：</span>${t.follow_up}</div>` : ''}
                  ${t.handled_by_name ? html`<div class="timeout-field"><span class="label">处理人：</span>${t.handled_by_name}</div>` : ''}
                  ${t.handled_at ? html`<div class="timeout-field"><span class="label">处理时间：</span>${t.handled_at}</div>` : ''}
                </div>
              `)}
            </div>
          ` : ''}

          <div class="card">
            <h3>操作记录</h3>
            ${this.logs.length === 0 ? html`<div style="color:#999;font-size:13px;">暂无记录</div>` : html`
              ${this.logs.map(l => html`
                <div class="log-item">
                  <div>
                    <span class="log-operator">${l.operator_name}</span>
                    <span class="log-action">${l.action}</span>
                    ${l.from_status_label && l.to_status_label ? html`
                      <span class="log-status-change">
                        ${l.from_status_label} → ${l.to_status_label}
                      </span>
                    ` : ''}
                  </div>
                  ${l.remark ? html`<div style="color:#888;font-size:11px;">${l.remark}</div>` : ''}
                  <div class="log-time">${l.created_at}</div>
                </div>
              `)}
            `}
          </div>
        </div>
      </div>

      ${this.showRejectDialog ? this._renderRejectDialog() : ''}
      ${this.showTimeoutDialog ? this._renderTimeoutDialog() : ''}
      ${this.showCoursewareDialog ? this._renderCoursewareDialog() : ''}
      ${this.showEvaluationDialog ? this._renderEvaluationDialog() : ''}
      ${this.showScheduleDialog ? this._renderScheduleDialog() : ''}
    `;
  }

  _renderActions() {
    const role = this.user?.role;
    const f = this.form;
    const actions = this.actions || [];

    return html`
      <div class="card">
        <h3>操作</h3>
        <div class="actions-bar">
          ${actions.map(a => {
            let btnClass = 'btn btn-secondary';
            if (a.action === 'submit' || a.action === 'archive' || a.action === 'confirm_teaching') btnClass = 'btn btn-primary';
            if (a.action === 'reject' || a.action === 'timeout_handle') btnClass = 'btn btn-danger';
            if (a.action === 'courseware_review') btnClass = 'btn btn-warning';
            if (a.action === 'evaluate') btnClass = 'btn btn-success';

            const handler = () => {
              this.error = '';
              this.success = '';
              if (a.action === 'reject') {
                this.showRejectDialog = true;
              } else if (a.action === 'timeout_handle') {
                this.showTimeoutDialog = true;
              } else if (a.action === 'courseware_review') {
                this.showCoursewareDialog = true;
              } else if (a.action === 'evaluate') {
                this.showEvaluationDialog = true;
              } else if (a.action === 'confirm_teaching') {
                this._doConfirmTeaching();
              } else {
                this._doTransition(a.action, a.requires_remark ? undefined : '');
              }
            };

            return html`<button class="${btnClass}" @click=${handler}>${a.label}</button>`;
          })}

          ${actions.length === 0
            ? html`<span style="color:#999;font-size:13px;">当前岗位无可用操作</span>` : ''}
        </div>
      </div>
    `;
  }

  _renderRejectDialog() {
    return html`
      <div class="dialog-overlay" @click=${(e) => { if (e.target === e.currentTarget) this.showRejectDialog = false; }}>
        <div class="dialog">
          <h3>驳回排课单</h3>
          ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}
          <div class="form-group">
            <label>驳回原因</label>
            <textarea .value=${this.rejectRemark} @input=${(e) => this.rejectRemark = e.target.value} placeholder="请填写驳回原因"></textarea>
          </div>
          <div class="btn-row">
            <button class="btn btn-outline" @click=${() => { this.showRejectDialog = false; }}>取消</button>
            <button class="btn btn-danger" @click=${this._doReject}>确认驳回</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderTimeoutDialog() {
    return html`
      <div class="dialog-overlay" @click=${(e) => { if (e.target === e.currentTarget) this.showTimeoutDialog = false; }}>
        <div class="dialog">
          <h3>超时处理</h3>
          ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}
          <div class="form-group">
            <label>超时原因</label>
            <textarea .value=${this.timeoutReason} @input=${(e) => this.timeoutReason = e.target.value} placeholder="请填写超时原因"></textarea>
          </div>
          <div class="form-group">
            <label>后续处理记录</label>
            <textarea .value=${this.timeoutFollowUp} @input=${(e) => this.timeoutFollowUp = e.target.value} placeholder="请填写后续处理措施"></textarea>
          </div>
          <div class="btn-row">
            <button class="btn btn-outline" @click=${() => { this.showTimeoutDialog = false; }}>取消</button>
            <button class="btn btn-warning" @click=${this._doTimeoutHandle}>提交处理</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderCoursewareDialog() {
    return html`
      <div class="dialog-overlay" @click=${(e) => { if (e.target === e.currentTarget) this.showCoursewareDialog = false; }}>
        <div class="dialog">
          <h3>课件审核</h3>
          ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}
          <div class="form-group">
            <label>审核结果</label>
            <select .value=${this.cwResult} @change=${(e) => this.cwResult = e.target.value}>
              <option value="approved">通过</option>
              <option value="rejected">驳回</option>
            </select>
          </div>
          <div class="form-group">
            <label>审核意见</label>
            <textarea .value=${this.cwComment} @input=${(e) => this.cwComment = e.target.value} placeholder="请填写审核意见"></textarea>
          </div>
          <div class="btn-row">
            <button class="btn btn-outline" @click=${() => { this.showCoursewareDialog = false; }}>取消</button>
            <button class="btn btn-warning" @click=${this._doCoursewareReview}>提交审核</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderEvaluationDialog() {
    return html`
      <div class="dialog-overlay" @click=${(e) => { if (e.target === e.currentTarget) this.showEvaluationDialog = false; }}>
        <div class="dialog">
          <h3>课后评价</h3>
          ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}
          <div class="form-group">
            <label>评分 (1-100)</label>
            <input type="number" min="1" max="100" .value=${this.evalScore} @input=${(e) => this.evalScore = parseInt(e.target.value) || 80} />
          </div>
          <div class="form-group">
            <label>评价内容</label>
            <textarea .value=${this.evalComment} @input=${(e) => this.evalComment = e.target.value} placeholder="请填写评价内容"></textarea>
          </div>
          <div class="btn-row">
            <button class="btn btn-outline" @click=${() => { this.showEvaluationDialog = false; }}>取消</button>
            <button class="btn btn-success" @click=${this._doEvaluation}>提交评价</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderScheduleDialog() {
    return html`
      <div class="dialog-overlay" @click=${(e) => { if (e.target === e.currentTarget) this.showScheduleDialog = false; }}>
        <div class="dialog">
          <h3>添加排期</h3>
          ${this.error ? html`<div class="error-msg">${this.error}</div>` : ''}
          <div class="form-group">
            <label>日期</label>
            <input type="date" .value=${this.schedDate} @input=${(e) => this.schedDate = e.target.value} />
          </div>
          <div class="form-group">
            <label>时段</label>
            <input type="text" .value=${this.schedSlot} @input=${(e) => this.schedSlot = e.target.value} placeholder="如 09:00-12:00" />
          </div>
          <div class="form-group">
            <label>备注</label>
            <input type="text" .value=${this.schedRemark} @input=${(e) => this.schedRemark = e.target.value} />
          </div>
          <div class="btn-row">
            <button class="btn btn-outline" @click=${() => { this.showScheduleDialog = false; }}>取消</button>
            <button class="btn btn-primary" @click=${this._doAddSchedule}>添加</button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('app-form-detail', AppFormDetail);
