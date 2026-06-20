import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ticketApi, attachmentApi, auditApi } from '../api'
import { useAuth } from '../hooks/useAuth'

const statusLabels = {
  draft: '草稿',
  pending_audit: '待审核',
  processing: '办理中',
  pending_review: '待复核',
  returned: '退回补正',
  archived: '已归档',
}

const priorityLabels = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
}

const sourceLabels = {
  online: '线上投诉',
  phone: '电话投诉',
  offline_import: '离线导入',
  other: '其他',
}

const roleLabels = {
  registrar: '投诉登记员',
  auditor: '投诉审核主管',
  reviewer: '复核负责人',
}

const actionLabels = {
  create_ticket: '创建工单',
  update_ticket: '更新工单',
  start_process: '开始办理',
  submit_review: '提交复核',
  return_ticket_auditor: '审核退回',
  return_ticket_reviewer: '复核退回',
  resubmit_ticket: '补正重提',
  archive: '复核归档',
  import_success: '导入成功',
  import_duplicate: '导入重复',
  import_conflict: '导入冲突',
  import_failed: '导入失败',
  import_batch: '批次导入',
  delete_attachment: '删除附件',
  upload_attachment: '上传附件',
  create_ticket_forbidden: '创建工单(无权限)',
  update_ticket_forbidden: '更新工单(无权限)',
  start_process_forbidden: '开始办理(无权限)',
  submit_review_forbidden: '提交复核(无权限)',
  return_ticket_forbidden: '退回(无权限)',
  resubmit_ticket_forbidden: '补正重提(无权限)',
  archive_forbidden: '归档(无权限)',
  import_forbidden: '导入(无权限)',
  upload_attachment_forbidden: '上传附件(无权限)',
  delete_attachment_forbidden: '删除附件(无权限)',
  update_ticket_status_conflict: '更新工单(状态冲突)',
  start_process_status_conflict: '开始办理(状态冲突)',
  submit_review_status_conflict: '提交复核(状态冲突)',
  return_ticket_status_conflict: '退回(状态冲突)',
  resubmit_ticket_status_conflict: '补正重提(状态冲突)',
  archive_status_conflict: '归档(状态冲突)',
  create_ticket_failed: '创建工单失败',
}

const TicketDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [activeTab, setActiveTab] = useState('info')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [processResult, setProcessResult] = useState('')
  const [processRemark, setProcessRemark] = useState('')
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveRemark, setArchiveRemark] = useState('')
  const [uploading, setUploading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [ticketData, attachData, auditData] = await Promise.all([
        ticketApi.get(id),
        attachmentApi.list(id),
        auditApi.listByTicket(id),
      ])
      setTicket(ticketData)
      setAttachments(attachData)
      setAuditLogs(auditData)
    } catch (e) {
      setErrorMsg(e.message || '加载工单详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const role = currentUser?.role
  const status = ticket?.status

  const canStartProcess = role === 'auditor' && status === 'pending_audit'
  const canSubmitReview = role === 'auditor' && status === 'processing'
  const canReturnAuditor = role === 'auditor' && (status === 'pending_audit' || status === 'processing')
  const canReturnReviewer = role === 'reviewer' && status === 'pending_review'
  const canReturn = canReturnAuditor || canReturnReviewer
  const canResubmit = role === 'registrar' && (status === 'returned' || status === 'draft')
  const canArchive = role === 'reviewer' && status === 'pending_review'
  const canEdit = role === 'registrar' && (status === 'draft' || status === 'returned')
  const canUpload = role === 'registrar' || role === 'auditor'
  const canDeleteAttachment = role === 'registrar'

  const forbiddenHints = []
  if (status === 'pending_audit' && role === 'registrar') {
    forbiddenHints.push('当前工单待审核，需审核主管开始办理')
  }
  if (status === 'processing' && role !== 'auditor') {
    forbiddenHints.push('当前工单办理中，需审核主管操作')
  }
  if (status === 'pending_review' && role !== 'reviewer') {
    forbiddenHints.push('当前工单待复核，需复核负责人操作')
  }
  if (status === 'archived') {
    forbiddenHints.push('当前工单已归档，不可再操作')
  }
  if (status === 'returned' && role !== 'registrar') {
    forbiddenHints.push('当前工单已退回，需投诉登记员补正后重提')
  }

  const handleError = (e, action) => {
    const msg = e?.message || (action + '失败')
    const code = e?.code
    let prefix = action + '失败'
    if (code === 401) prefix = '登录已过期'
    else if (code === 403) prefix = '无权操作'
    else if (code === 409) prefix = '状态冲突'
    setErrorMsg(prefix + '：' + msg)
    loadData()
  }

  const handleStartProcess = async () => {
    setErrorMsg('')
    try {
      await ticketApi.startProcess(id)
      loadData()
    } catch (e) {
      handleError(e, '开始办理')
    }
  }

  const handleSubmitReview = async () => {
    if (!processResult.trim()) {
      setErrorMsg('请填写处理结果')
      return
    }
    setErrorMsg('')
    try {
      await ticketApi.submitReview(id, {
        result_summary: processResult,
        audit_remark: processRemark,
      })
      setShowProcessModal(false)
      setProcessResult('')
      setProcessRemark('')
      loadData()
    } catch (e) {
      handleError(e, '提交复核')
    }
  }

  const handleReturn = async () => {
    if (!returnReason.trim()) {
      setErrorMsg('请填写退回原因')
      return
    }
    setErrorMsg('')
    try {
      await ticketApi.returnTicket(id, returnReason)
      setShowReturnModal(false)
      setReturnReason('')
      loadData()
    } catch (e) {
      handleError(e, '退回')
    }
  }

  const handleResubmit = async () => {
    setErrorMsg('')
    try {
      await ticketApi.resubmit(id)
      loadData()
    } catch (e) {
      handleError(e, '补正重提')
    }
  }

  const handleArchive = async () => {
    setErrorMsg('')
    try {
      await ticketApi.archive(id, {
        audit_remark: archiveRemark,
      })
      setShowArchiveModal(false)
      setArchiveRemark('')
      loadData()
    } catch (e) {
      handleError(e, '归档')
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setErrorMsg('')
    try {
      await attachmentApi.upload(id, file)
      loadData()
    } catch (e) {
      handleError(e, '上传附件')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteAttachment = async (attId) => {
    setErrorMsg('')
    try {
      await attachmentApi.remove(id, attId)
      loadData()
    } catch (e) {
      handleError(e, '删除附件')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN')
  }

  const formatFileSize = (size) => {
    if (!size) return '-'
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / 1024 / 1024).toFixed(2)} MB`
  }

  if (loading) {
    return <div className="empty">加载中...</div>
  }

  if (!ticket) {
    return <div className="empty">工单不存在</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <button className="btn btn-sm" onClick={() => navigate(-1)}>
            ← 返回列表
          </button>
          <h2 className="page-title" style={{ display: 'inline-block', marginLeft: 16, marginBottom: 0 }}>
            工单详情
            <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#999', marginLeft: 12 }}>
              {ticket.ticket_no}
            </span>
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#888', padding: '4px 8px', background: '#f5f5f5', borderRadius: 4 }}>
            当前角色：{roleLabels[role] || role}
          </span>
          {canStartProcess && (
            <button className="btn btn-primary" onClick={handleStartProcess}>
              开始办理
            </button>
          )}
          {canSubmitReview && (
            <button className="btn btn-primary" onClick={() => setShowProcessModal(true)}>
              提交复核
            </button>
          )}
          {canReturn && (
            <button className="btn btn-warning" onClick={() => setShowReturnModal(true)}>
              {canReturnReviewer ? '复核退回' : '退回'}
            </button>
          )}
          {canResubmit && (
            <button className="btn btn-primary" onClick={handleResubmit}>
              补正后重提
            </button>
          )}
          {canArchive && (
            <button className="btn btn-success" onClick={() => setShowArchiveModal(true)}>
              复核归档
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div style={{
          padding: '10px 14px',
          background: '#fff0f0',
          border: '1px solid #ffcccc',
          borderRadius: 6,
          color: '#c01818',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{errorMsg}</span>
          <button style={{ background: 'none', border: 'none', color: '#c01818', cursor: 'pointer', fontSize: 16 }} onClick={() => setErrorMsg('')}>×</button>
        </div>
      )}

      {forbiddenHints.length > 0 && (
        <div style={{
          padding: '10px 14px',
          background: '#f0f5ff',
          border: '1px solid #cce0ff',
          borderRadius: 6,
          color: '#3366cc',
          marginBottom: 16,
        }}>
          {forbiddenHints.map((hint, i) => (
            <div key={i}>ℹ️ {hint}</div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{ticket.title}</h3>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', color: '#666' }}>
                <span className={`status-badge status-${ticket.status}`}>
                  {statusLabels[ticket.status]}
                </span>
                <span className={`priority-${ticket.priority}`}>
                  优先级：{priorityLabels[ticket.priority]}
                </span>
                {ticket.is_exception && (
                  <span className="exception-tag">异常</span>
                )}
                <span>来源：{sourceLabels[ticket.source] || ticket.source}</span>
              </div>
            </div>
          </div>

          {ticket.exception_reason && (
            <div style={{
              padding: '10px 14px',
              background: '#fff0f0',
              border: '1px solid #ffcccc',
              borderRadius: 6,
              color: '#c01818',
              marginBottom: 16,
            }}>
              <strong>异常原因：</strong>{ticket.exception_reason}
            </div>
          )}

          {ticket.return_reason && (
            <div style={{
              padding: '10px 14px',
              background: '#fff8e6',
              border: '1px solid #ffe0a3',
              borderRadius: 6,
              color: '#cc8f00',
              marginBottom: 16,
            }}>
              <strong>退回原因：</strong>{ticket.return_reason}
            </div>
          )}

          <div className="tabs">
            <div
              className={`tab ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              基本信息
            </div>
            <div
              className={`tab ${activeTab === 'result' ? 'active' : ''}`}
              onClick={() => setActiveTab('result')}
            >
              处理结果
            </div>
            <div
              className={`tab ${activeTab === 'attachments' ? 'active' : ''}`}
              onClick={() => setActiveTab('attachments')}
            >
              附件 ({attachments.length})
            </div>
            <div
              className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              审计日志 ({auditLogs.length})
            </div>
          </div>

          {activeTab === 'info' && (
            <div className="detail-grid">
              <div className="label">投诉人</div>
              <div className="value">{ticket.complainant}</div>

              <div className="label">联系方式</div>
              <div className="value">{ticket.contact || '-'}</div>

              <div className="label">投诉内容</div>
              <div className="value" style={{ whiteSpace: 'pre-wrap' }}>{ticket.content}</div>

              <div className="label">截止时间</div>
              <div className="value">{ticket.deadline ? formatDate(ticket.deadline) : '-'}</div>

              <div className="label">创建人</div>
              <div className="value">{ticket.created_by_name || '-'}</div>

              <div className="label">创建时间</div>
              <div className="value">{formatDate(ticket.created_at)}</div>

              <div className="label">办理人</div>
              <div className="value">{ticket.handler_name || '-'}</div>

              <div className="label">复核人</div>
              <div className="value">{ticket.reviewer_name || '-'}</div>

              <div className="label">更新时间</div>
              <div className="value">{formatDate(ticket.updated_at)}</div>

              {ticket.audit_remark && (
                <>
                  <div className="label">审核备注</div>
                  <div className="value">{ticket.audit_remark}</div>
                </>
              )}
            </div>
          )}

          {activeTab === 'result' && (
            <div>
              {ticket.result_summary ? (
                <div className="detail-grid">
                  <div className="label">处理结果</div>
                  <div className="value" style={{ whiteSpace: 'pre-wrap' }}>
                    {ticket.result_summary}
                  </div>
                </div>
              ) : (
                <div className="empty">暂无处理结果</div>
              )}
            </div>
          )}

          {activeTab === 'attachments' && (
            <div>
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                {canUpload ? (
                  <label className="btn btn-primary btn-sm">
                    {uploading ? '上传中...' : '+ 上传附件'}
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                ) : (
                  <span style={{ fontSize: 12, color: '#999' }}>当前角色不可上传附件</span>
                )}
              </div>
              {attachments.length === 0 ? (
                <div className="empty">暂无附件</div>
              ) : (
                attachments.map(att => (
                  <div key={att.id} className="attachment-item">
                    <span>📎</span>
                    <span className="name">{att.filename}</span>
                    <span className="size">{formatFileSize(att.file_size)}</span>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      {att.uploaded_by_name} · {formatDate(att.uploaded_at)}
                    </span>
                    {canDeleteAttachment && (
                      <button
                        className="btn btn-sm"
                        onClick={() => handleDeleteAttachment(att.id)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div>
              {auditLogs.length === 0 ? (
                <div className="empty">暂无审计日志</div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="audit-log-item">
                    <span className="audit-log-time">{formatDate(log.created_at)}</span>
                    <span className="audit-log-user">{log.user_name}</span>
                    <span className={`audit-log-action ${log.is_failure ? 'audit-log-failure' : ''}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                    {log.is_failure && log.failure_reason && (
                      <span style={{ color: '#e01b24', fontSize: 12 }}>
                        [失败] {log.failure_reason}
                      </span>
                    )}
                    {log.detail && (
                      <span className="audit-log-detail">{log.detail}</span>
                    )}
                    {log.batch_id && (
                      <span style={{ color: '#888', fontSize: 11 }}>
                        批次#{log.batch_id}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showReturnModal && (
        <div className="modal-mask" onClick={() => setShowReturnModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>{canReturnReviewer ? '复核退回' : '退回工单'}</span>
              <span className="modal-close" onClick={() => setShowReturnModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>退回原因 *</label>
                <textarea
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  placeholder="请详细说明退回原因，以便登记员补正..."
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowReturnModal(false)}>
                取消
              </button>
              <button className="btn btn-danger" onClick={handleReturn}>
                确认退回
              </button>
            </div>
          </div>
        </div>
      )}

      {showProcessModal && (
        <div className="modal-mask" onClick={() => setShowProcessModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>提交复核</span>
              <span className="modal-close" onClick={() => setShowProcessModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>处理结果 *</label>
                <textarea
                  value={processResult}
                  onChange={e => setProcessResult(e.target.value)}
                  placeholder="请详细描述处理结果..."
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>审核备注</label>
                <textarea
                  value={processRemark}
                  onChange={e => setProcessRemark(e.target.value)}
                  placeholder="可选：审核过程中的备注信息..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowProcessModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSubmitReview}>
                提交复核
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div className="modal-mask" onClick={() => setShowArchiveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>复核归档</span>
              <span className="modal-close" onClick={() => setShowArchiveModal(false)}>×</span>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>复核备注</label>
                <textarea
                  value={archiveRemark}
                  onChange={e => setArchiveRemark(e.target.value)}
                  placeholder="可选：复核意见..."
                  rows={3}
                />
              </div>
              <p style={{ color: '#666', fontSize: 13 }}>
                归档后工单状态将变为"已归档"，不可再修改。
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowArchiveModal(false)}>
                取消
              </button>
              <button className="btn btn-success" onClick={handleArchive}>
                确认归档
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TicketDetail
