import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { api } from '../../lib/api.js'
import { STATUS, STATUS_NAMES, STATUS_COLORS, ROLES, ROLE_NAMES } from '../../lib/constants.js'
import { useCurrentUser } from '../../lib/userContext.jsx'

export const Route = createFileRoute('/applications/$id')({
  component: ApplicationDetail,
})

function ApplicationDetail() {
  const { id } = Route.useParams()
  const { currentUser } = useCurrentUser()
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [showAttachmentModal, setShowAttachmentModal] = useState(false)
  const [showAuditRemarkModal, setShowAuditRemarkModal] = useState(false)

  const [rejectForm, setRejectForm] = useState({ reject_reason: '', review_comment: '' })
  const [approveForm, setApproveForm] = useState({ review_comment: '' })
  const [archiveForm, setArchiveForm] = useState({ review_comment: '', audit_remark: '' })
  const [attachmentForm, setAttachmentForm] = useState({ filename: '', file_type: '' })
  const [auditRemarkForm, setAuditRemarkForm] = useState({ audit_remark: '' })

  const [archiveIssues, setArchiveIssues] = useState(null)

  const loadData = async () => {
    if (!currentUser) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.getApplication(id)
      setApp(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id, currentUser?.id])

  const handleSubmit = async () => {
    try {
      const data = await api.submitApplication(id)
      setApp(data)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleApprove = async (e) => {
    e.preventDefault()
    try {
      const data = await api.approveApplication(id, approveForm)
      setApp(data)
      setShowApproveModal(false)
      setApproveForm({ review_comment: '' })
    } catch (err) {
      alert(err.message)
    }
  }

  const handleReject = async (e) => {
    e.preventDefault()
    try {
      const data = await api.rejectApplication(id, rejectForm)
      setApp(data)
      setShowRejectModal(false)
      setRejectForm({ reject_reason: '', review_comment: '' })
    } catch (err) {
      alert(err.message)
    }
  }

  const handleArchive = async (e) => {
    e.preventDefault()
    try {
      const data = await api.archiveApplication(id, archiveForm)
      setApp(data)
      setShowArchiveModal(false)
      setArchiveForm({ review_comment: '', audit_remark: '' })
      setArchiveIssues(null)
    } catch (err) {
      if (err.status === 422 && err.data?.issues) {
        setArchiveIssues(err.data)
      } else {
        alert(err.message)
      }
    }
  }

  const handleAddAttachment = async (e) => {
    e.preventDefault()
    try {
      const data = await api.addAttachment(id, attachmentForm)
      setApp(data)
      setShowAttachmentModal(false)
      setAttachmentForm({ filename: '', file_type: '' })
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDeleteAttachment = async (attachId) => {
    if (!confirm('确定删除此附件？')) return
    try {
      const data = await api.deleteAttachment(id, attachId)
      setApp(data)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleUpdateAuditRemark = async (e) => {
    e.preventDefault()
    try {
      const data = await api.updateAuditRemark(id, auditRemarkForm)
      setApp(data)
      setShowAuditRemarkModal(false)
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div>加载中...</div>
  if (error) return <div className="alert alert-error">错误: {error}</div>
  if (!app) return <div>未找到申请</div>

  const isOperator = currentUser?.role === ROLES.METER_OPERATOR
  const isSupervisor = currentUser?.role === ROLES.METER_SUPERVISOR
  const isArchivist = currentUser?.role === ROLES.GAS_ARCHIVIST

  const canSubmit = isOperator && (app.status === STATUS.PENDING_OPERATOR || app.status === STATUS.REJECTED)
  const canApprove = isSupervisor && app.status === STATUS.PENDING_SUPERVISOR
  const canReject = isSupervisor && app.status === STATUS.PENDING_SUPERVISOR
  const canArchive = isArchivist && app.status === STATUS.PENDING_ARCHIVIST
  const canAddAttachment = (isOperator || isSupervisor || isArchivist) && app.status !== STATUS.ARCHIVED
  const canEditAuditRemark = isOperator || isSupervisor || isArchivist

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/" className="link">申请列表</Link>
        <span className="separator">/</span>
        <span className="current">申请详情 {app.id}</span>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: 8 }}>
              申请编号: {app.id}
            </h2>
            <span className="status-tag" style={{ backgroundColor: STATUS_COLORS[app.status] }}>
              {STATUS_NAMES[app.status]}
            </span>
            {app.is_timeout === 1 && <span className="abnormal-tag">超时</span>}
            {app.offline_ledger_failure_reason && <span className="abnormal-tag">台账异常</span>}
          </div>
          <div className="actions">
            {canSubmit && (
              <button className="btn btn-primary" onClick={handleSubmit}>
                {app.status === STATUS.REJECTED ? '补正提交' : '提交审核'}
              </button>
            )}
            {canApprove && (
              <button className="btn btn-success" onClick={() => setShowApproveModal(true)}>
                审核通过
              </button>
            )}
            {canReject && (
              <button className="btn btn-danger" onClick={() => setShowRejectModal(true)}>
                退回
              </button>
            )}
            {canArchive && (
              <button className="btn btn-success" onClick={() => {
                setArchiveIssues(null)
                setShowArchiveModal(true)
              }}>
                复核归档
              </button>
            )}
            {canAddAttachment && (
              <button className="btn btn-secondary" onClick={() => setShowAttachmentModal(true)}>
                上传附件
              </button>
            )}
            {canEditAuditRemark && (
              <button className="btn btn-outline" onClick={() => {
                setAuditRemarkForm({ audit_remark: app.audit_remark || '' })
                setShowAuditRemarkModal(true)
              }}>
                编辑审计备注
              </button>
            )}
          </div>
        </div>

        {app.offline_ledger_failure_reason && (
          <div className="alert alert-error">
            <strong>离线台账回填失败：</strong>
            {app.offline_ledger_failure_reason}
          </div>
        )}

        {app.audit_remark && (
          <div className="alert alert-info">
            <strong>审计备注：</strong>
            {app.audit_remark}
          </div>
        )}

        {app.is_timeout === 1 && (
          <div className="alert alert-warning">
            <strong>超时提醒：</strong>
            该申请已超过 SLA 截止时间（{app.sla_due_at}），请尽快处理。
          </div>
        )}

        {app.offline_ledger_record && (
          <div className="ledger-record">
            <div className="ledger-record-title">线下台账记录</div>
            <div className="ledger-record-grid">
              <div className="ledger-record-field">
                <label>批次号</label>
                <div>{app.offline_ledger_record.batch_no}</div>
              </div>
              <div className="ledger-record-field">
                <label>表号</label>
                <div>{app.offline_ledger_record.meter_no}</div>
              </div>
              <div className="ledger-record-field">
                <label>换表日期</label>
                <div>{app.offline_ledger_record.replacement_date || '-'}</div>
              </div>
              <div className="ledger-record-field">
                <label>台账状态</label>
                <div>{app.offline_ledger_record.status === 'completed' ? '已完成' : app.offline_ledger_record.status === 'rejected' ? '已作废' : app.offline_ledger_record.status}</div>
              </div>
              <div className="ledger-record-field">
                <label>备注</label>
                <div>{app.offline_ledger_record.remark || '-'}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-2">
          <div>
            <h3 className="section-title">基本信息</h3>
            <div className="field">
              <label>批次号</label>
              <div className="value">{app.batch_no}</div>
            </div>
            <div className="field">
              <label>客户名称</label>
              <div className="value">{app.customer_name}</div>
            </div>
            <div className="field">
              <label>客户地址</label>
              <div className="value">{app.customer_address}</div>
            </div>
            <div className="field">
              <label>换表原因</label>
              <div className="value">{app.reason}</div>
            </div>
          </div>
          <div>
            <h3 className="section-title">表计信息</h3>
            <div className="field">
              <label>旧表号</label>
              <div className="value">{app.old_meter_no}</div>
            </div>
            <div className="field">
              <label>新表号</label>
              <div className="value">{app.new_meter_no}</div>
            </div>
            <div className="field">
              <label>离线台账回填状态</label>
              <div className="value">
                {app.offline_ledger_backfilled ? (
                  <span style={{ color: '#16a34a' }}>&#10003; 已回填</span>
                ) : (
                  <span style={{ color: '#dc2626' }}>&#10007; 未回填</span>
                )}
              </div>
            </div>
            <div className="field">
              <label>创建时间</label>
              <div className="value">{app.created_at}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <h3 className="section-title">经办人员</h3>
          <div className="grid grid-3">
            <div className="card" style={{ margin: 0, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>换表登记员（发起）</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {app.operator ? `${app.operator.name} - ${ROLE_NAMES[app.operator.role]}` : '-'}
              </div>
            </div>
            <div className="card" style={{ margin: 0, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>换表审核主管（办理）</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {app.reviewer ? `${app.reviewer.name} - ${ROLE_NAMES[app.reviewer.role]}` : '-'}
              </div>
            </div>
            <div className="card" style={{ margin: 0, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>复核负责人（归档）</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {app.archivist ? `${app.archivist.name} - ${ROLE_NAMES[app.archivist.role]}` : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">附件</h3>
        {app.attachments.length === 0 ? (
          <div className="empty-state">
            <p>暂无附件</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>文件名</th>
                <th>类型</th>
                <th>上传人</th>
                <th>上传时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {app.attachments.map(a => (
                <tr key={a.id}>
                  <td>{a.filename}</td>
                  <td>{a.file_type}</td>
                  <td>{a.uploader_name}</td>
                  <td>{a.uploaded_at}</td>
                  <td>
                    {canAddAttachment && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAttachment(a.id)}>
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">流程记录</h3>
        {app.process_records.length === 0 ? (
          <div className="empty-state">
            <p>暂无流程记录</p>
          </div>
        ) : (
          <div className="timeline">
            {app.process_records.map(r => (
              <div key={r.id} className="timeline-item">
                <div className="timeline-time">{r.created_at}</div>
                <div className="timeline-action">
                  [{r.actor_role_name}] {r.actor_name} - {r.action_name}
                </div>
                {r.review_comment && (
                  <div className="timeline-detail">备注: {r.review_comment}</div>
                )}
                {r.reject_reason && (
                  <div className="failure-detail">退回原因: {r.reject_reason}</div>
                )}
                {r.result && (
                  <div className="timeline-detail">结果: {r.result}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">审计日志</h3>
        {app.audit_logs.length === 0 ? (
          <div className="empty-state">
            <p>暂无审计日志</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>角色</th>
                <th>操作</th>
                <th>详情</th>
                <th>失败原因</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {app.audit_logs.map(l => (
                <tr key={l.id} className={l.failure_reason ? 'row-abnormal' : ''}>
                  <td>{l.created_at}</td>
                  <td>{l.user_name}</td>
                  <td>{l.user_role_name}</td>
                  <td>{l.action_name}</td>
                  <td>{l.details || '-'}</td>
                  <td>
                    {l.failure_reason ? (
                      <span style={{ color: '#dc2626' }}>{l.failure_reason}</span>
                    ) : '-'}
                  </td>
                  <td>
                    {l.remark ? (
                      <span className="remark-text" title={l.remark}>{l.remark}</span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showApproveModal && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>审核通过</h3>
            <form onSubmit={handleApprove}>
              <div className="field">
                <label>审核意见</label>
                <textarea
                  value={approveForm.review_comment}
                  onChange={e => setApproveForm({ review_comment: e.target.value })}
                  placeholder="请输入审核意见（可选）"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowApproveModal(false)}>取消</button>
                <button type="submit" className="btn btn-success">确认通过</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>退回申请</h3>
            <form onSubmit={handleReject}>
              <div className="field">
                <label>退回原因 *</label>
                <textarea
                  required
                  value={rejectForm.reject_reason}
                  onChange={e => setRejectForm({ ...rejectForm, reject_reason: e.target.value })}
                  placeholder="请输入退回原因"
                />
              </div>
              <div className="field">
                <label>备注</label>
                <textarea
                  value={rejectForm.review_comment}
                  onChange={e => setRejectForm({ ...rejectForm, review_comment: e.target.value })}
                  placeholder="请输入备注（可选）"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowRejectModal(false)}>取消</button>
                <button type="submit" className="btn btn-danger">确认退回</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div className="modal-overlay" onClick={() => { setShowArchiveModal(false); setArchiveIssues(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <h3>复核归档</h3>
            {archiveIssues && archiveIssues.issues && archiveIssues.issues.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="alert alert-error" style={{ marginBottom: 12 }}>
                  <strong>归档校验未通过，申请保持待处理状态</strong>
                </div>
                <div className="issue-list">
                  {archiveIssues.issues.map((issue, idx) => (
                    <div key={idx} className="issue-item">
                      <div className="issue-type">[{issue.type_name}]</div>
                      <div className="issue-comparison">
                        <div className="issue-side issue-side-online">
                          <div className="issue-side-label">{issue.online.label}</div>
                          <div>{issue.online.value}</div>
                        </div>
                        <div className="issue-side issue-side-offline">
                          <div className="issue-side-label">{issue.offline.label}</div>
                          <div>{issue.offline.value}</div>
                        </div>
                      </div>
                      <div className="issue-message">{issue.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <form onSubmit={handleArchive}>
              <div className="field">
                <label>复核意见</label>
                <textarea
                  value={archiveForm.review_comment}
                  onChange={e => setArchiveForm({ ...archiveForm, review_comment: e.target.value })}
                  placeholder="请输入复核意见（可选）"
                />
              </div>
              <div className="field">
                <label>审计备注</label>
                <textarea
                  value={archiveForm.audit_remark}
                  onChange={e => setArchiveForm({ ...archiveForm, audit_remark: e.target.value })}
                  placeholder="请输入审计备注（可选）"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setShowArchiveModal(false); setArchiveIssues(null); }}>
                  取消
                </button>
                <button type="submit" className="btn btn-success">确认归档</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAttachmentModal && (
        <div className="modal-overlay" onClick={() => setShowAttachmentModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>上传附件</h3>
            <form onSubmit={handleAddAttachment}>
              <div className="field">
                <label>文件名 *</label>
                <input
                  type="text"
                  required
                  value={attachmentForm.filename}
                  onChange={e => setAttachmentForm({ ...attachmentForm, filename: e.target.value })}
                  placeholder="如 旧表照片.jpg"
                />
              </div>
              <div className="field">
                <label>文件类型</label>
                <input
                  type="text"
                  value={attachmentForm.file_type}
                  onChange={e => setAttachmentForm({ ...attachmentForm, file_type: e.target.value })}
                  placeholder="如 image/jpeg"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAttachmentModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">上传</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAuditRemarkModal && (
        <div className="modal-overlay" onClick={() => setShowAuditRemarkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>编辑审计备注</h3>
            <form onSubmit={handleUpdateAuditRemark}>
              <div className="field">
                <label>审计备注</label>
                <textarea
                  value={auditRemarkForm.audit_remark}
                  onChange={e => setAuditRemarkForm({ audit_remark: e.target.value })}
                  placeholder="请输入审计备注"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAuditRemarkModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
