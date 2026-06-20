import { useState, useEffect } from 'preact/hooks'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { User, PolicyOrder, Attachment, ReviewRecord, AuditLog, api } from '../api/client'

interface Props {
  user: User
}

function OrderDetail({ user }: Props) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<PolicyOrder | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [reviews, setReviews] = useState<ReviewRecord[]>([])
  const [audits, setAudits] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddAttachment, setShowAddAttachment] = useState(false)
  const [showRejectAttachment, setShowRejectAttachment] = useState<number | null>(null)
  const [showReviewReject, setShowReviewReject] = useState(false)
  const [showApproverReject, setShowApproverReject] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  const [attachmentForm, setAttachmentForm] = useState({ name: '', fileType: 'pdf', required: true })
  const [rejectReason, setRejectReason] = useState('')
  const [rejectForm, setRejectForm] = useState({ rejectReason: '', failureReason: '', timeoutDays: 5 })
  const [approveForm, setApproveForm] = useState({ remark: '', auditRemark: '', resultContent: '' })
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) loadDetail()
  }, [id])

  const loadDetail = async () => {
    setLoading(true)
    try {
      const res = await api.orders.get(parseInt(id!))
      setOrder(res.order)
      setAttachments(res.attachments)
      setReviews(res.reviews)
      setAudits(res.audits)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddAttachment = async (e: Event) => {
    e.preventDefault()
    if (!order) return
    setActionLoading(true)
    try {
      await api.attachments.add({
        orderId: order.id,
        name: attachmentForm.name,
        fileType: attachmentForm.fileType,
        fileSize: Math.floor(Math.random() * 2000000) + 100000,
        required: attachmentForm.required,
        userId: user.id
      })
      setShowAddAttachment(false)
      setAttachmentForm({ name: '', fileType: 'pdf', required: true })
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectAttachment = async (attId: number) => {
    if (!rejectReason.trim()) {
      alert('请填写驳回原因')
      return
    }
    try {
      await api.attachments.reject(attId, { rejectReason, userId: user.id })
      setShowRejectAttachment(null)
      setRejectReason('')
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleSubmit = async () => {
    if (!order) return
    setActionLoading(true)
    try {
      await api.review.submit({ orderId: order.id, userId: user.id })
      alert('提交审核成功')
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCorrectionSubmit = async () => {
    if (!order) return
    setActionLoading(true)
    try {
      await api.review.correctionSubmit({ orderId: order.id, userId: user.id })
      alert('补正完成，已重新提交审核')
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReviewApprove = async () => {
    if (!order) return
    setActionLoading(true)
    try {
      await api.review.reviewApprove({
        orderId: order.id,
        userId: user.id,
        remark: approveForm.remark,
        auditRemark: approveForm.auditRemark
      })
      setShowApprove(false)
      setApproveForm({ remark: '', auditRemark: '', resultContent: '' })
      alert('审核通过成功')
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReviewReject = async () => {
    if (!order) return
    if (!rejectForm.rejectReason.trim()) {
      alert('请填写驳回原因')
      return
    }
    setActionLoading(true)
    try {
      await api.review.reviewReject({
        orderId: order.id,
        userId: user.id,
        rejectReason: rejectForm.rejectReason,
        failureReason: rejectForm.failureReason,
        timeoutDays: rejectForm.timeoutDays
      })
      setShowReviewReject(false)
      setRejectForm({ rejectReason: '', failureReason: '', timeoutDays: 5 })
      alert('已驳回补正')
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproverApprove = async () => {
    if (!order) return
    setActionLoading(true)
    try {
      await api.review.approverApprove({
        orderId: order.id,
        userId: user.id,
        remark: approveForm.remark,
        auditRemark: approveForm.auditRemark,
        resultContent: approveForm.resultContent
      })
      setShowApprove(false)
      setApproveForm({ remark: '', auditRemark: '', resultContent: '' })
      alert('复核通过成功')
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproverReject = async () => {
    if (!order) return
    if (!rejectForm.rejectReason.trim()) {
      alert('请填写退回原因')
      return
    }
    setActionLoading(true)
    try {
      await api.review.approverReject({
        orderId: order.id,
        userId: user.id,
        rejectReason: rejectForm.rejectReason,
        failureReason: rejectForm.failureReason
      })
      setShowApproverReject(false)
      setRejectForm({ rejectReason: '', failureReason: '', timeoutDays: 5 })
      alert('已退回')
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleArchive = async () => {
    if (!order) return
    setActionLoading(true)
    try {
      await api.review.archive({
        orderId: order.id,
        userId: user.id,
        auditRemark: approveForm.auditRemark
      })
      setShowArchive(false)
      setApproveForm({ remark: '', auditRemark: '', resultContent: '' })
      alert('归档成功')
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteAttachment = async (attId: number) => {
    if (!confirm('确定要删除该附件吗？')) return
    try {
      await api.attachments.delete(attId)
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleDelete = async () => {
    if (!order) return
    if (!confirm('确定要删除该兑现单吗？')) return
    try {
      await api.orders.delete(order.id)
      navigate('/')
    } catch (e: any) {
      alert(e.message)
    }
  }

  if (loading) return <div class="card">加载中...</div>
  if (!order) return <div class="card">兑现单不存在</div>

  const isRegistrar = user.role === 'REGISTRAR'
  const isReviewer = user.role === 'REVIEWER'
  const isApprover = user.role === 'APPROVER'

  const canEditAttachments = isRegistrar && ['DRAFT', 'PENDING_CORRECTION'].includes(order.status)
  const canRejectAttachment = isReviewer && order.status === 'PENDING_REVIEW'
  const canSubmit = isRegistrar && order.status === 'DRAFT'
  const canCorrectionSubmit = isRegistrar && order.status === 'PENDING_CORRECTION'
  const canReview = isReviewer && order.status === 'PENDING_REVIEW'
  const canApproverReview = isApprover && order.status === 'REVIEWED'
  const canArchive = isApprover && order.status === 'APPROVED'
  const canDelete = isRegistrar && order.status === 'DRAFT'

  const hasAllAttachments = attachments.filter(a => a.required && !a.rejected).length >=
    attachments.filter(a => a.required).length && attachments.filter(a => a.required).length > 0

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  return (
    <div>
      <div class="breadcrumb">
        <Link to="/">← 返回列表</Link>
      </div>

      <div class="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 class="page-title" style={{ marginBottom: 8 }}>{order.title}</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: '#8c8c8c' }}>单号：<b>{order.order_no}</b></span>
              <span class={`status-tag status-${order.status}`}>{order.statusLabel}</span>
              {order.abnormal_type && (
                <span class={`abnormal-tag abnormal-${order.abnormal_type}`}>{order.abnormalLabel}</span>
              )}
              {order.isTimeout && !order.abnormal_type && (
                <span class="abnormal-tag abnormal-TIMEOUT">超时</span>
              )}
            </div>
          </div>
          {canDelete && (
            <button class="btn btn-danger" onClick={handleDelete}>🗑️ 删除</button>
          )}
        </div>

        <div class="detail-grid">
          <div class="detail-item">
            <label>申请单位</label>
            <div class="value">{order.applicant}</div>
          </div>
          <div class="detail-item">
            <label>申请金额</label>
            <div class="value amount">¥{order.amount.toLocaleString()}</div>
          </div>
          <div class="detail-item">
            <label>创建人</label>
            <div class="value">{order.creator_name}</div>
          </div>
          <div class="detail-item">
            <label>创建时间</label>
            <div class="value">{formatDate(order.created_at)}</div>
          </div>
          <div class="detail-item">
            <label>更新时间</label>
            <div class="value">{formatDate(order.updated_at)}</div>
          </div>
          {order.timeout_deadline && (
            <div class="detail-item">
              <label>补正截止日期</label>
              <div class="value" style={{ color: order.isTimeout ? '#ff4d4f' : 'inherit' }}>
                {formatDate(order.timeout_deadline)}
                {order.isTimeout && '（已超时）'}
              </div>
            </div>
          )}
        </div>

        {order.reject_reason && (
          <div class="alert alert-error">
            <b>📝 退回原因：</b>{order.reject_reason}
          </div>
        )}

        {order.audit_remark && (
          <div class="alert alert-info">
            <b>📋 审计备注：</b>{order.audit_remark}
          </div>
        )}

        {order.result_content && (
          <div class="alert alert-warning">
            <b>🎯 办理结果：</b>{order.result_content}
          </div>
        )}

        <div class="action-bar">
          {canSubmit && (
            <button
              class="btn btn-primary"
              onClick={handleSubmit}
              disabled={!hasAllAttachments || actionLoading}
            >
              📤 发起审核
              {!hasAllAttachments && '（请先补齐附件）'}
            </button>
          )}
          {canCorrectionSubmit && (
            <button
              class="btn btn-success"
              onClick={handleCorrectionSubmit}
              disabled={!hasAllAttachments || actionLoading}
            >
              ✅ 补正完成，重新提交
              {!hasAllAttachments && '（请先补齐附件）'}
            </button>
          )}
          {canReview && (
            <>
              <button class="btn btn-success" onClick={() => setShowApprove(true)} disabled={actionLoading}>
                ✅ 审核通过
              </button>
              <button class="btn btn-danger" onClick={() => setShowReviewReject(true)} disabled={actionLoading}>
                ❌ 驳回补正
              </button>
            </>
          )}
          {canApproverReview && (
            <>
              <button class="btn btn-success" onClick={() => setShowApprove(true)} disabled={actionLoading}>
                ✅ 复核通过
              </button>
              <button class="btn btn-danger" onClick={() => setShowApproverReject(true)} disabled={actionLoading}>
                ❌ 退回
              </button>
            </>
          )}
          {canArchive && (
            <button class="btn btn-primary" onClick={() => setShowArchive(true)} disabled={actionLoading}>
              📦 归档
            </button>
          )}
          {canEditAttachments && (
            <button class="btn btn-default" onClick={() => setShowAddAttachment(true)}>
              ➕ 添加附件
            </button>
          )}
        </div>
      </div>

      <div class="card">
        <h3 class="section-title">
          附件材料
          <span style={{ fontSize: 13, fontWeight: 'normal', marginLeft: 12, color: hasAllAttachments ? '#52c41a' : '#faad14' }}>
            {attachments.filter(a => a.required && !a.rejected).length}/{attachments.filter(a => a.required).length} 个必要附件
            {!hasAllAttachments && attachments.filter(a => a.required).length > 0 && '（需补齐）'}
          </span>
        </h3>

        {attachments.length === 0 ? (
          <div class="empty">暂无附件</div>
        ) : (
          attachments.map(att => (
            <div key={att.id} class={`attachment-item ${att.rejected ? 'rejected' : ''}`}>
              <div class="attachment-info">
                <div class="attachment-icon">📄</div>
                <div>
                  <div>
                    {att.name}
                    {att.required && <span style={{ color: '#ff4d4f', fontSize: 12, marginLeft: 8 }}>（必填）</span>}
                    {att.rejected && <span class="reject-badge">已驳回</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                    {att.file_type.toUpperCase()} · {formatFileSize(att.file_size)} ·
                    上传人：{att.uploader_name} · {formatDate(att.created_at)}
                  </div>
                  {att.rejected && att.reject_reason && (
                    <div class="reject-reason">❌ 驳回原因：{att.reject_reason}</div>
                  )}
                </div>
              </div>
              <div>
                {canRejectAttachment && !att.rejected && (
                  <button class="link-btn danger" onClick={() => setShowRejectAttachment(att.id)}>
                    驳回附件
                  </button>
                )}
                {canEditAttachments && att.rejected && (
                  <button class="link-btn" onClick={() => {
                    setAttachmentForm({ name: att.name, fileType: att.file_type, required: att.required === 1 })
                    setShowAddAttachment(true)
                  }}>
                    重新上传
                  </button>
                )}
                {canEditAttachments && (
                  <button class="link-btn danger" onClick={() => handleDeleteAttachment(att.id)}>
                    删除
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div class="card">
        <h3 class="section-title">过程核验记录</h3>
        {reviews.length === 0 ? (
          <div class="empty">暂无核验记录</div>
        ) : (
          <div class="timeline">
            {reviews.map(r => (
              <div key={r.id} class="timeline-item">
                <div>
                  <span class="timeline-action">{r.action}</span>
                  <span class="timeline-operator">{r.operator_name}</span>
                </div>
                <div class="timeline-time">{formatDate(r.created_at)}</div>
                {r.from_status && r.to_status && (
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                    状态变更：{r.from_status} → {r.to_status}
                  </div>
                )}
                {r.remark && <div class="timeline-remark">{r.remark}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div class="card">
        <h3 class="section-title">审计日志（失败/异常记录）</h3>
        {audits.length === 0 ? (
          <div class="empty">暂无审计异常记录</div>
        ) : (
          audits.map(a => (
            <div key={a.id} class="audit-item">
              <div class="audit-reason">
                ⚠️ {a.action} - {a.operator_name}
                <span style={{ fontSize: 12, fontWeight: 'normal', marginLeft: 8 }}>
                  {formatDate(a.created_at)}
                </span>
              </div>
              {a.failure_reason && (
                <div style={{ color: '#d46b08', fontSize: 13, marginTop: 4 }}>
                  <b>失败原因：</b>{a.failure_reason}
                </div>
              )}
              {a.detail && <div class="audit-detail">{a.detail}</div>}
            </div>
          ))
        )}
      </div>

      {showAddAttachment && (
        <div class="modal-mask" onClick={() => setShowAddAttachment(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">{showRejectAttachment ? '重新上传附件' : '添加附件'}</h3>
            <form onSubmit={handleAddAttachment}>
              <div class="form-group">
                <label>附件名称</label>
                <input
                  type="text"
                  value={attachmentForm.name}
                  onInput={(e) => setAttachmentForm({ ...attachmentForm, name: (e.target as HTMLInputElement).value })}
                  placeholder="如：营业执照.pdf"
                  required
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>文件类型</label>
                  <select
                    value={attachmentForm.fileType}
                    onInput={(e) => setAttachmentForm({ ...attachmentForm, fileType: (e.target as HTMLSelectElement).value })}
                  >
                    <option value="pdf">PDF</option>
                    <option value="doc">Word</option>
                    <option value="xls">Excel</option>
                    <option value="jpg">图片</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>是否必填</label>
                  <select
                    value={attachmentForm.required ? '1' : '0'}
                    onInput={(e) => setAttachmentForm({ ...attachmentForm, required: (e.target as HTMLSelectElement).value === '1' })}
                  >
                    <option value="1">是</option>
                    <option value="0">否</option>
                  </select>
                </div>
              </div>
              <div class="alert alert-info" style={{ fontSize: 12 }}>
                💡 演示环境：文件大小将自动生成
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-default" onClick={() => setShowAddAttachment(false)}>
                  取消
                </button>
                <button type="submit" class="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? '上传中...' : '上传'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRejectAttachment && (
        <div class="modal-mask" onClick={() => { setShowRejectAttachment(null); setRejectReason('') }}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">驳回附件</h3>
            <div class="form-group">
              <label>驳回原因</label>
              <textarea
                value={rejectReason}
                onInput={(e) => setRejectReason((e.target as HTMLTextAreaElement).value)}
                placeholder="请填写驳回原因"
                rows={4}
              />
            </div>
            <div class="modal-footer">
              <button class="btn btn-default" onClick={() => { setShowRejectAttachment(null); setRejectReason('') }}>
                取消
              </button>
              <button class="btn btn-danger" onClick={() => handleRejectAttachment(showRejectAttachment)}>
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewReject && (
        <div class="modal-mask" onClick={() => setShowReviewReject(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">审核驳回 - 要求补正</h3>
            <div class="form-group">
              <label>补正要求（退回原因）</label>
              <textarea
                value={rejectForm.rejectReason}
                onInput={(e) => setRejectForm({ ...rejectForm, rejectReason: (e.target as HTMLTextAreaElement).value })}
                placeholder="请详细说明需要补正的内容"
                rows={3}
              />
            </div>
            <div class="form-group">
              <label>失败原因（计入审计）</label>
              <textarea
                value={rejectForm.failureReason}
                onInput={(e) => setRejectForm({ ...rejectForm, failureReason: (e.target as HTMLTextAreaElement).value })}
                placeholder="请说明不符合要求的具体原因"
                rows={3}
              />
            </div>
            <div class="form-group">
              <label>补正期限（天）</label>
              <input
                type="number"
                min="1"
                value={rejectForm.timeoutDays}
                onInput={(e) => setRejectForm({ ...rejectForm, timeoutDays: parseInt((e.target as HTMLInputElement).value) })}
              />
            </div>
            <div class="modal-footer">
              <button class="btn btn-default" onClick={() => setShowReviewReject(false)}>取消</button>
              <button class="btn btn-danger" onClick={handleReviewReject} disabled={actionLoading}>
                {actionLoading ? '提交中...' : '确认驳回'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproverReject && (
        <div class="modal-mask" onClick={() => setShowApproverReject(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">复核退回</h3>
            <div class="alert alert-error">
              ⚠️ 复核退回后，该兑现单将标记为「已退回」，流程终止
            </div>
            <div class="form-group">
              <label>退回原因</label>
              <textarea
                value={rejectForm.rejectReason}
                onInput={(e) => setRejectForm({ ...rejectForm, rejectReason: (e.target as HTMLTextAreaElement).value })}
                placeholder="请详细说明退回原因"
                rows={3}
              />
            </div>
            <div class="form-group">
              <label>失败原因（计入审计）</label>
              <textarea
                value={rejectForm.failureReason}
                onInput={(e) => setRejectForm({ ...rejectForm, failureReason: (e.target as HTMLTextAreaElement).value })}
                placeholder="请说明不符合要求的具体原因"
                rows={3}
              />
            </div>
            <div class="modal-footer">
              <button class="btn btn-default" onClick={() => setShowApproverReject(false)}>取消</button>
              <button class="btn btn-danger" onClick={handleApproverReject} disabled={actionLoading}>
                {actionLoading ? '提交中...' : '确认退回'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApprove && (
        <div class="modal-mask" onClick={() => setShowApprove(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">
              {order.status === 'PENDING_REVIEW' ? '审核通过' : '复核通过'}
            </h3>
            <div class="form-group">
              <label>审核意见</label>
              <textarea
                value={approveForm.remark}
                onInput={(e) => setApproveForm({ ...approveForm, remark: (e.target as HTMLTextAreaElement).value })}
                placeholder="请填写审核意见（可选）"
                rows={2}
              />
            </div>
            {order.status === 'REVIEWED' && (
              <div class="form-group">
                <label>办理结果</label>
                <textarea
                  value={approveForm.resultContent}
                  onInput={(e) => setApproveForm({ ...approveForm, resultContent: (e.target as HTMLTextAreaElement).value })}
                  placeholder="请填写办理结果，如拨付时间、金额等"
                  rows={3}
                />
              </div>
            )}
            <div class="form-group">
              <label>审计备注</label>
              <textarea
                value={approveForm.auditRemark}
                onInput={(e) => setApproveForm({ ...approveForm, auditRemark: (e.target as HTMLTextAreaElement).value })}
                placeholder="请填写审计备注（可选）"
                rows={2}
              />
            </div>
            <div class="modal-footer">
              <button class="btn btn-default" onClick={() => setShowApprove(false)}>取消</button>
              <button class="btn btn-success" onClick={order.status === 'PENDING_REVIEW' ? handleReviewApprove : handleApproverApprove} disabled={actionLoading}>
                {actionLoading ? '提交中...' : '确认通过'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchive && (
        <div class="modal-mask" onClick={() => setShowArchive(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">归档</h3>
            <div class="form-group">
              <label>审计备注</label>
              <textarea
                value={approveForm.auditRemark}
                onInput={(e) => setApproveForm({ ...approveForm, auditRemark: (e.target as HTMLTextAreaElement).value })}
                placeholder="请填写审计备注（可选）"
                rows={3}
              />
            </div>
            <div class="alert alert-info">
              归档后，该兑现单流程正式完成
            </div>
            <div class="modal-footer">
              <button class="btn btn-default" onClick={() => setShowArchive(false)}>取消</button>
              <button class="btn btn-primary" onClick={handleArchive} disabled={actionLoading}>
                {actionLoading ? '提交中...' : '确认归档'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderDetail
