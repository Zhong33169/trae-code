import { useState, useEffect } from 'preact/hooks'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  User, PolicyOrder, Attachment, ReviewRecord, AuditLog,
  RequiredAttachmentDef, AttachmentCompletion, ATTACHMENT_STATUS_LABELS, ROLE_LABELS,
  api
} from '../api/client'

interface Props {
  user: User
}

function OrderDetail({ user }: Props) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<PolicyOrder | null>(null)
  const [requiredDefs, setRequiredDefs] = useState<RequiredAttachmentDef[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [groupedAttachments, setGroupedAttachments] = useState<Record<string, Attachment[]>>({})
  const [attachmentCompletion, setAttachmentCompletion] = useState<AttachmentCompletion[]>([])
  const [reviews, setReviews] = useState<ReviewRecord[]>([])
  const [audits, setAudits] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddAttachment, setShowAddAttachment] = useState<{ type: 'new' | 'reupload'; attId?: number; defId?: number } | null>(null)
  const [showRejectAttachment, setShowRejectAttachment] = useState<number | null>(null)
  const [showReviewReject, setShowReviewReject] = useState(false)
  const [showApproverReject, setShowApproverReject] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', applicant: '', amount: '', requiredAttachmentNames: [] as string[] })

  const [attachmentForm, setAttachmentForm] = useState({ name: '', fileType: 'pdf', requiredDefId: '' as string | number })
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
      setRequiredDefs(res.requiredDefs || [])
      setAttachments(res.attachments || [])
      setGroupedAttachments(res.groupedAttachments || {})
      setAttachmentCompletion(res.attachmentCompletion || [])
      setReviews(res.reviews || [])
      setAudits(res.audits || [])
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const validCount = attachmentCompletion.filter(c => c.attachment_id && c.rejected === 0).length
  const totalRequired = requiredDefs.length
  const hasAllAttachments = totalRequired > 0 && validCount >= totalRequired

  const handleAddAttachment = async (e: Event) => {
    e.preventDefault()
    if (!order) return
    setActionLoading(true)
    try {
      if (showAddAttachment?.type === 'reupload' && showAddAttachment.attId) {
        await api.attachments.reupload(showAddAttachment.attId, {
          name: attachmentForm.name,
          fileType: attachmentForm.fileType,
          fileSize: Math.floor(Math.random() * 2000000) + 100000
        })
      } else {
        const defId = attachmentForm.requiredDefId ? Number(attachmentForm.requiredDefId) : undefined
        await api.attachments.add({
          orderId: order.id,
          name: attachmentForm.name,
          fileType: attachmentForm.fileType,
          fileSize: Math.floor(Math.random() * 2000000) + 100000,
          required: !!defId,
          requiredDefId: defId
        })
      }
      setShowAddAttachment(null)
      setAttachmentForm({ name: '', fileType: 'pdf', requiredDefId: '' })
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const openReupload = (att: Attachment) => {
    setAttachmentForm({ name: att.name, fileType: att.file_type, requiredDefId: att.required_def_id || '' })
    setShowAddAttachment({ type: 'reupload', attId: att.id, defId: att.required_def_id || undefined })
  }

  const openAddNew = (defId?: number) => {
    const def = defId ? requiredDefs.find(d => d.id === defId) : null
    setAttachmentForm({
      name: def ? `${def.name}.pdf` : '',
      fileType: 'pdf',
      requiredDefId: defId || ''
    })
    setShowAddAttachment({ type: 'new', defId })
  }

  const handleRejectAttachment = async (attId: number) => {
    if (!rejectReason.trim()) {
      alert('请填写驳回原因')
      return
    }
    try {
      await api.attachments.reject(attId, { rejectReason })
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
      await api.review.submit({ orderId: order.id })
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
      await api.review.correctionSubmit({ orderId: order.id })
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

  const canEdit = isRegistrar && order && ['DRAFT', 'PENDING_CORRECTION'].includes(order.status)

  const openEditModal = () => {
    if (!order) return
    setEditForm({
      title: order.title,
      applicant: order.applicant,
      amount: String(order.amount),
      requiredAttachmentNames: requiredDefs.slice().sort((a, b) => a.sort_order - b.sort_order).map(d => d.name)
    })
    setShowEditModal(true)
  }

  const addEditDef = () => setEditForm({ ...editForm, requiredAttachmentNames: [...editForm.requiredAttachmentNames, ''] })
  const removeEditDef = (idx: number) => {
    const def = requiredDefs[idx]
    const activeVersion = def && groupedAttachments[`def_${def.id}`]?.find((v: Attachment) => v.att_status === 'ACTIVE' && v.rejected === 0)
    if (activeVersion) {
      alert(`「${def!.name}」已上传有效附件，无法删除。请先删除对应附件。`)
      return
    }
    const next = editForm.requiredAttachmentNames.slice()
    next.splice(idx, 1)
    setEditForm({ ...editForm, requiredAttachmentNames: next })
  }
  const updateEditDef = (idx: number, value: string) => {
    const next = editForm.requiredAttachmentNames.slice()
    next[idx] = value
    setEditForm({ ...editForm, requiredAttachmentNames: next })
  }

  const handleSaveEdit = async (e: Event) => {
    e.preventDefault()
    if (!order) return
    const names = editForm.requiredAttachmentNames.filter(n => n.trim())
    if (names.length === 0) {
      alert('请至少保留 1 项必备附件清单')
      return
    }
    setActionLoading(true)
    try {
      await api.orders.update(order.id, {
        title: editForm.title.trim(),
        applicant: editForm.applicant.trim(),
        amount: parseFloat(editForm.amount),
        requiredAttachmentNames: names
      })
      setShowEditModal(false)
      loadDetail()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(false)
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  const getAttachmentClass = (att: Attachment) => {
    if (att.att_status === 'REJECTED') return 'rejected'
    if (att.att_status === 'SUPERSEDED') return 'superseded'
    return ''
  }

  const getStatusBadge = (att: Attachment) => {
    if (att.att_status === 'ACTIVE' && att.rejected === 0) {
      return <span class="status-badge status-active">有效</span>
    }
    if (att.att_status === 'REJECTED' || att.rejected === 1) {
      return <span class="status-badge status-rejected">已驳回</span>
    }
    if (att.att_status === 'SUPERSEDED') {
      return <span class="status-badge status-superseded">已作废</span>
    }
    return null
  }

  const missingDefs = requiredDefs.filter(def =>
    !attachmentCompletion.find(c => c.def_id === def.id && c.attachment_id && c.rejected === 0)
  )

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
          <div style={{ display: 'flex', gap: 8 }}>
            {canEdit && (
              <button class="btn btn-default" onClick={openEditModal} disabled={actionLoading}>✏️ 编辑</button>
            )}
            {canDelete && (
              <button class="btn btn-danger" onClick={handleDelete} disabled={actionLoading}>🗑️ 删除</button>
            )}
          </div>
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
              {!hasAllAttachments && `（还差 ${totalRequired - validCount} 个必备附件）`}
            </button>
          )}
          {canCorrectionSubmit && (
            <button
              class="btn btn-success"
              onClick={handleCorrectionSubmit}
              disabled={!hasAllAttachments || actionLoading}
            >
              ✅ 补正完成，重新提交
              {!hasAllAttachments && `（还差 ${totalRequired - validCount} 个必备附件）`}
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
        </div>
      </div>

      <div class="card">
        <h3 class="section-title">
          必备附件清单
          <span style={{ fontSize: 13, fontWeight: 'normal', marginLeft: 12, color: hasAllAttachments ? '#52c41a' : '#faad14' }}>
            {validCount}/{totalRequired} 个必备附件已齐全
            {!hasAllAttachments && totalRequired > 0 && `（还缺 ${totalRequired - validCount} 个）`}
          </span>
        </h3>

        {requiredDefs.length === 0 ? (
          <div class="empty">未配置必备附件清单，请联系管理员</div>
        ) : (
          <div class="def-list">
            {requiredDefs.map(def => {
              const versions = groupedAttachments[`def_${def.id}`] || []
              const activeAtt = versions.find(v => v.att_status === 'ACTIVE' && v.rejected === 0)
              const rejectedAtts = versions.filter(v => v.att_status === 'REJECTED' || v.rejected === 1)
              const supersededAtts = versions.filter(v => v.att_status === 'SUPERSEDED')
              const isDone = !!activeAtt
              const missingDef = missingDefs.find(d => d.id === def.id)
              const canUploadThis = canEditAttachments && !isDone
              const activeForReject = versions.find(v => v.att_status === 'ACTIVE')

              return (
                <div key={def.id} class={`def-item ${isDone ? 'def-complete' : 'def-incomplete'}`}>
                  <div class="def-header">
                    <span class="def-icon">{isDone ? '✅' : '⭕'}</span>
                    <span class="def-name">{def.name}</span>
                    <span class="def-status">
                      {isDone ? '已上传' : '待上传'}
                    </span>
                    <div style={{ marginLeft: 'auto' }}>
                      {canRejectAttachment && activeForReject && (
                        <button class="link-btn danger" onClick={() => setShowRejectAttachment(activeForReject.id)}>
                          驳回
                        </button>
                      )}
                      {canUploadThis && !activeAtt && (
                        <button class="link-btn" onClick={() => openAddNew(def.id)}>
                          上传
                        </button>
                      )}
                    </div>
                  </div>

                  {rejectedAtts.length > 0 && (
                    <div class="version-list">
                      {rejectedAtts.map(att => (
                        <div key={att.id} class={`attachment-item ${getAttachmentClass(att)}`}>
                          <div class="attachment-info">
                            <div class="attachment-icon">📄</div>
                            <div>
                              <div>
                                {att.name}
                                {att.version > 1 && <span class="version-tag">V{att.version}</span>}
                                {getStatusBadge(att)}
                              </div>
                              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                                {att.file_type.toUpperCase()} · {formatFileSize(att.file_size)} ·
                                上传人：{att.uploader_name} · {formatDate(att.created_at)}
                              </div>
                              {att.reject_reason && (
                                <div class="reject-reason">❌ 驳回原因：{att.reject_reason}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {supersededAtts.length > 0 && (
                    <div class="version-list">
                      {supersededAtts.map(att => (
                        <div key={att.id} class={`attachment-item ${getAttachmentClass(att)}`}>
                          <div class="attachment-info">
                            <div class="attachment-icon">📄</div>
                            <div>
                              <div>
                                {att.name}
                                {att.version > 1 && <span class="version-tag">V{att.version}</span>}
                                {getStatusBadge(att)}
                              </div>
                              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                                {att.file_type.toUpperCase()} · {formatFileSize(att.file_size)} ·
                                上传人：{att.uploader_name} · {formatDate(att.created_at)}
                              </div>
                              {att.reject_reason && (
                                <div class="reject-reason" style={{ background: '#f5f5f5', color: '#8c8c8c' }}>
                                  📌 历史驳回原因（已作废版本）：{att.reject_reason}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeAtt && (
                    <div class="version-list">
                      <div class={`attachment-item ${getAttachmentClass(activeAtt)}`}>
                        <div class="attachment-info">
                          <div class="attachment-icon">📄</div>
                          <div>
                            <div>
                              {activeAtt.name}
                              {activeAtt.version > 1 && <span class="version-tag">V{activeAtt.version}</span>}
                              {getStatusBadge(activeAtt)}
                            </div>
                            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                              {activeAtt.file_type.toUpperCase()} · {formatFileSize(activeAtt.file_size)} ·
                              上传人：{activeAtt.uploader_name} · {formatDate(activeAtt.created_at)}
                            </div>
                          </div>
                        </div>
                        <div>
                          {canEditAttachments && (
                            <button class="link-btn" onClick={() => openReupload(activeAtt)}>
                              重新上传
                            </button>
                          )}
                          {canEditAttachments && order.status === 'DRAFT' && (
                            <button class="link-btn danger" onClick={() => handleDeleteAttachment(activeAtt.id)}>
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {missingDef && rejectedAtts.length === 0 && !activeAtt && (
                    <div style={{ padding: '8px 16px', fontSize: 13, color: '#8c8c8c', background: '#fafafa' }}>
                      尚未上传此附件
                    </div>
                  )}

                  {rejectedAtts.length > 0 && !activeAtt && canEditAttachments && (
                    <div style={{ padding: '8px 16px' }}>
                      <button class="btn btn-default btn-sm" onClick={() => openReupload(rejectedAtts[rejectedAtts.length - 1])}>
                        🔄 重新上传被驳回附件
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
                  <span class="timeline-operator">
                    {r.operator_name}
                    {r.operator_role && `（${ROLE_LABELS[r.operator_role] || r.operator_role}）`}
                  </span>
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
                {a.operator_role && `（${ROLE_LABELS[a.operator_role] || a.operator_role}）`}
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
        <div class="modal-mask" onClick={() => setShowAddAttachment(null)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">
              {showAddAttachment.type === 'reupload' ? '🔄 重新上传附件（将作废旧版本）' : '➕ 上传附件'}
            </h3>
            {showAddAttachment.type === 'reupload' && (
              <div class="alert alert-warning" style={{ fontSize: 13, marginBottom: 16 }}>
                ⚠️ 重新上传后，原附件将标记为「已作废」，但驳回原因会保留作为历史记录。
              </div>
            )}
            <form onSubmit={handleAddAttachment}>
              <div class="form-group">
                <label>所属必备清单</label>
                <select
                  value={String(attachmentForm.requiredDefId)}
                  onInput={(e) => setAttachmentForm({ ...attachmentForm, requiredDefId: (e.target as HTMLSelectElement).value })}
                  disabled={!!attachmentForm.requiredDefId}
                >
                  <option value="">— 不属于必备清单（补充附件）—</option>
                  {requiredDefs.map(def => (
                    <option key={def.id} value={def.id}>{def.name}</option>
                  ))}
                </select>
              </div>
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
              <div class="alert alert-info" style={{ fontSize: 12 }}>
                💡 演示环境：文件大小将自动生成
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-default" onClick={() => setShowAddAttachment(null)}>
                  取消
                </button>
                <button type="submit" class="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? '上传中...' : (showAddAttachment.type === 'reupload' ? '重新上传' : '上传')}
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
                placeholder="请填写驳回原因（将永久保留在附件历史中）"
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

      {showEditModal && order && (
        <div class="modal-mask" onClick={() => setShowEditModal(false)}>
          <div class="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">编辑政策兑现单</h3>
            <form onSubmit={handleSaveEdit}>
              <div class="form-group">
                <label>兑现项目名称</label>
                <input
                  type="text"
                  value={editForm.title}
                  onInput={(e) => setEditForm({ ...editForm, title: (e.target as HTMLInputElement).value })}
                  required
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>申请单位</label>
                  <input
                    type="text"
                    value={editForm.applicant}
                    onInput={(e) => setEditForm({ ...editForm, applicant: (e.target as HTMLInputElement).value })}
                    required
                  />
                </div>
                <div class="form-group">
                  <label>申请金额（元）</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.amount}
                    onInput={(e) => setEditForm({ ...editForm, amount: (e.target as HTMLInputElement).value })}
                    required
                  />
                </div>
              </div>
              <div class="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ marginBottom: 0 }}>📋 必备附件清单</label>
                  <button type="button" class="link-btn" style={{ fontSize: '13px' }} onClick={addEditDef}>
                    ➕ 新增一项
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {editForm.requiredAttachmentNames.map((name, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#8c8c8c', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        第 {idx + 1} 项：
                      </span>
                      <input
                        type="text"
                        value={name}
                        onInput={(e) => updateEditDef(idx, (e.target as HTMLInputElement).value)}
                        placeholder="必备附件名称"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        onClick={() => removeEditDef(idx)}
                        disabled={editForm.requiredAttachmentNames.length <= 1}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
                <div class="alert alert-info" style={{ fontSize: '12px', marginTop: 10 }}>
                  💡 已上传有效附件的清单项不能删除，只能改名。
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-default" onClick={() => setShowEditModal(false)}>
                  取消
                </button>
                <button type="submit" class="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? '保存中...' : '保存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderDetail
