import React, { useState } from 'react'
import { ROLE_LABELS, STATUS_LABELS } from '../pages/Dashboard'

export default function FormDetail({ formData, user, onProcess, onRefresh, onNotify }) {
  const { form, evidences = [], supplements = [], audit_logs = [] } = formData
  const [activeTab, setActiveTab] = useState('info')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [pendingRejectAction, setPendingRejectAction] = useState('')

  const canSubmit = user.role === 'clerk' && ['draft', 'pending_clerk', 'rejected'].includes(form.status)
  const canForemanVerify = user.role === 'foreman' && form.status === 'pending_foreman' && form.current_handler === user.id
  const canForemanReject = user.role === 'foreman' && form.status === 'pending_foreman' && form.current_handler === user.id
  const canManagerConfirm = user.role === 'manager' && form.status === 'pending_manager' && form.current_handler === user.id
  const canManagerReject = user.role === 'manager' && form.status === 'pending_manager' && form.current_handler === user.id
  const canArchive = user.role === 'clerk' && form.status === 'verified'

  const handleReject = (action) => {
    setPendingRejectAction(action)
    setShowRejectModal(true)
  }

  const confirmReject = () => {
    if (!rejectReason.trim()) {
      onNotify('驳回必须填写原因', 'error')
      return
    }
    onProcess(pendingRejectAction, { reason: rejectReason })
    setShowRejectModal(false)
    setRejectReason('')
  }

  const missingEvidence = []
  const hasType = (t) => evidences.some((e) => e.type === t)
  if (['pending_foreman', 'pending_manager', 'verified', 'archived'].includes(form.status) && !hasType('registration')) {
    missingEvidence.push('登记资料')
  }
  if (['pending_manager', 'verified', 'archived'].includes(form.status) && !hasType('inspection')) {
    missingEvidence.push('过程核验')
  }
  if (['verified', 'archived'].includes(form.status) && !hasType('archive')) {
    missingEvidence.push('复核归档')
  }

  return (
    <div className="form-detail">
      <div className="detail-header">
        <div>
          <div className="detail-code-row">
            <span className="detail-code">{form.code}</span>
            <span className={`status-badge status-${form.status}`}>{STATUS_LABELS[form.status]}</span>
            <span className="version-badge">版本 v{form.version}</span>
          </div>
          <h2 className="detail-title">{form.subcontractor_name}</h2>
        </div>
        <div className="detail-actions">
          {canSubmit && (
            <button className="btn btn-primary" onClick={() => onProcess('submit')}>
              提交登记
            </button>
          )}
          {canForemanVerify && (
            <button className="btn btn-primary" onClick={() => onProcess('verify_foreman')}>
              现场核验通过
            </button>
          )}
          {canForemanReject && (
            <button className="btn btn-danger" onClick={() => handleReject('reject_foreman')}>
              核验驳回
            </button>
          )}
          {canManagerConfirm && (
            <button className="btn btn-primary" onClick={() => onProcess('confirm_manager')}>
              项目经理确认
            </button>
          )}
          {canManagerReject && (
            <button className="btn btn-danger" onClick={() => handleReject('reject_manager')}>
              经理驳回
            </button>
          )}
          {canArchive && (
            <button className="btn btn-secondary" onClick={() => onProcess('archive')}>
              归档
            </button>
          )}
        </div>
      </div>

      {form.reject_reason && (
        <div className="reject-banner">
          <b>驳回原因：</b>{form.reject_reason}
        </div>
      )}

      {missingEvidence.length > 0 && (
        <div className="warn-banner">
          <b>缺失必要证据：</b>{missingEvidence.join('、')}
        </div>
      )}

      <div className="detail-tabs">
        <button
          className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >基本信息</button>
        <button
          className={`tab-btn ${activeTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setActiveTab('evidence')}
        >证据清单 ({evidences.length})</button>
        <button
          className={`tab-btn ${activeTab === 'supplements' ? 'active' : ''}`}
          onClick={() => setActiveTab('supplements')}
        >补录/操作历史 ({supplements.length})</button>
        <button
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >审计流转 ({audit_logs.length})</button>
      </div>

      <div className="detail-content">
        {activeTab === 'info' && (
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">项目名称</span>
              <span className="info-value">{form.project_name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">分包单位</span>
              <span className="info-value">{form.subcontractor_name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">进场日期</span>
              <span className="info-value">{new Date(form.entry_date).toLocaleDateString('zh-CN')}</span>
            </div>
            <div className="info-item">
              <span className="info-label">进场人数</span>
              <span className="info-value">{form.workers_count} 人</span>
            </div>
            <div className="info-item full">
              <span className="info-label">施工内容</span>
              <span className="info-value">{form.work_content}</span>
            </div>
            <div className="info-item">
              <span className="info-label">创建人</span>
              <span className="info-value">{form.created_by}</span>
            </div>
            <div className="info-item">
              <span className="info-label">当前处理人</span>
              <span className="info-value">{form.current_handler || '—'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">创建时间</span>
              <span className="info-value">{new Date(form.created_at).toLocaleString('zh-CN')}</span>
            </div>
            <div className="info-item">
              <span className="info-label">更新时间</span>
              <span className="info-value">{new Date(form.updated_at).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="evidence-detail">
            {evidences.length === 0 && <div className="empty-small">暂无证据</div>}
            {evidences.map((e) => (
              <div key={e.id} className={`evidence-row ${e.is_supplemental ? 'supplemental' : ''}`}>
                <div className="evidence-main">
                  <span className="evidence-icon">📎</span>
                  <div>
                    <div className="evidence-name">{e.name}</div>
                    <div className="evidence-sub">
                      <span className={`evidence-type type-${e.type}`}>
                        {e.type === 'registration' ? '登记资料' : e.type === 'inspection' ? '过程核验' : '复核归档'}
                      </span>
                      <span>上传于 {new Date(e.uploaded_at).toLocaleString('zh-CN')}</span>
                      {e.is_supplemental && <span className="supplement-badge">补录</span>}
                    </div>
                  </div>
                </div>
                {e.is_supplemental && e.supplement_note && (
                  <div className="supplement-reason-inline">补录原因：{e.supplement_note}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'supplements' && (
          <div className="timeline">
            {supplements.length === 0 && <div className="empty-small">暂无补录记录</div>}
            {supplements.map((s, idx) => (
              <div key={s.id} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-action">{s.action}</span>
                    <span className="timeline-time">{new Date(s.performed_at).toLocaleString('zh-CN')}</span>
                  </div>
                  {s.reason && <div className="timeline-reason">原因：{s.reason}</div>}
                  {s.details && Object.keys(s.details).length > 0 && (
                    <div className="timeline-details">
                      {Object.entries(s.details).map(([k, v]) => (
                        <div key={k}><b>{k}:</b> {v}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="audit-list">
            {audit_logs.length === 0 && <div className="empty-small">暂无审计记录</div>}
            {audit_logs.map((l) => (
              <div key={l.id} className="audit-row">
                <div className="audit-main">
                  <span className="audit-action">{l.action}</span>
                  <span className="audit-status">
                    {l.from_status && <span>{STATUS_LABELS[l.from_status]} → </span>}
                    <b>{STATUS_LABELS[l.to_status]}</b>
                  </span>
                </div>
                <div className="audit-meta">
                  <span>操作人：{l.user_id}</span>
                  <span>{new Date(l.timestamp).toLocaleString('zh-CN')}</span>
                </div>
                {l.details && <div className="audit-details">{l.details}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>填写驳回原因</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={5}
              className="input"
              placeholder="请详细说明驳回原因，以便资料员补录"
            />
            <div className="modal-actions">
              <button className="btn btn-text" onClick={() => { setShowRejectModal(false); setRejectReason('') }}>取消</button>
              <button
                className="btn btn-danger"
                onClick={confirmReject}
                disabled={!rejectReason.trim()}
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
