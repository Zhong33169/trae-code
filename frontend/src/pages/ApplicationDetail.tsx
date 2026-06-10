import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { applicationApi, attachmentApi, statsApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { LeaseApplication, OperationLog, NodeTimeline, Attachment as AttachmentType, NodeType } from '../types'
import {
  EmptyState, Loading, Modal, StatusBadge, NodeBadge,
  formatDate, formatFileSize, getOverdueDays,
} from '../components/Common'

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole, user } = useAuth()
  const { showToast } = useToast()
  const appId = Number(id)

  const [loading, setLoading] = useState(true)
  const [app, setApp] = useState<LeaseApplication | null>(null)
  const [logs, setLogs] = useState<OperationLog[]>([])

  const [showSubmit, setShowSubmit] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showHandover, setShowHandover] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [showOverdue, setShowOverdue] = useState(false)

  const [submitRemark, setSubmitRemark] = useState('')
  const [reviewAction, setReviewAction] = useState<'approve' | 'return' | 'reject'>('approve')
  const [reviewResult, setReviewResult] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [confirmResult, setConfirmResult] = useState('')
  const [handoverResult, setHandoverResult] = useState('')
  const [archiveRemark, setArchiveRemark] = useState('')
  const [overdueReason, setOverdueReason] = useState('')
  const [followUpAction, setFollowUpAction] = useState('')

  const [submitOverdueReason, setSubmitOverdueReason] = useState('')
  const [submitFollowUpAction, setSubmitFollowUpAction] = useState('')
  const [reviewOverdueReason, setReviewOverdueReason] = useState('')
  const [reviewFollowUpAction, setReviewFollowUpAction] = useState('')
  const [confirmOverdueReason, setConfirmOverdueReason] = useState('')
  const [confirmFollowUpAction, setConfirmFollowUpAction] = useState('')
  const [handoverOverdueReason, setHandoverOverdueReason] = useState('')
  const [handoverFollowUpAction, setHandoverFollowUpAction] = useState('')
  const [archiveOverdueReason, setArchiveOverdueReason] = useState('')
  const [archiveFollowUpAction, setArchiveFollowUpAction] = useState('')

  function isCurrentNodeOverdue() {
    if (!app || !app.nodeTimelines) return false
    const tl = app.nodeTimelines.find(t => t.nodeType === app.currentNode)
    return tl ? (tl.isOverdue || app.isOverdue) : app.isOverdue
  }

  function hasExistingOverdueRecord() {
    if (!app || !app.nodeTimelines) return false
    const tl = app.nodeTimelines.find(t => t.nodeType === app.currentNode)
    const tlHas = tl && tl.overdueReason && tl.overdueReason.trim() && tl.followUpAction && tl.followUpAction.trim()
    const appHas = app.overdueReason && app.overdueReason.trim() && app.followUpAction && app.followUpAction.trim()
    return !!(tlHas || appHas)
  }

  function requireOverdueRecordInput() {
    return isCurrentNodeOverdue() && !hasExistingOverdueRecord()
  }

  function getNodeBlockedHistory(nodeType: string) {
    if (!app?.overdueAudits) return []
    return app.overdueAudits.filter(a => a.nodeType === nodeType && a.auditType === 'blocked')
  }

  const [uploadLoading, setUploadLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadCategory, setUploadCategory] = useState('签约资料')

  useEffect(() => {
    loadDetail()
  }, [appId])

  async function loadDetail() {
    setLoading(true)
    try {
      const [detail, logRes] = await Promise.all([
        applicationApi.getDetail(appId),
        statsApi.getLogs({ applicationId: String(appId), pageSize: 100 }),
      ])
      setApp(detail)
      setLogs(logRes.items || [])
    } catch (err: any) {
      showToast(err.message || '加载详情失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="center-loading"><Loading size="lg" /></div>
  if (!app) return <EmptyState text="租约申请不存在" />

  const processSteps: Array<{ node: NodeType; name: string }> = [
    { node: 'contract_signing', name: '租客签约' },
    { node: 'review', name: '租约审核' },
    { node: 'room_confirm', name: '房态确认' },
    { node: 'handover', name: '入住交接' },
    { node: 'archive', name: '复核归档' },
  ]

  function getStepState(nodeType: NodeType) {
    const tl = app.nodeTimelines?.find(t => t.nodeType === nodeType)
    const currentIdx = processSteps.findIndex(s => s.node === app.currentNode)
    const stepIdx = processSteps.findIndex(s => s.node === nodeType)
    if (!tl) {
      if (stepIdx < currentIdx) return 'done'
      if (stepIdx === currentIdx) return app.isOverdue ? 'overdue' : 'current'
      return 'pending'
    }
    if (tl.status === 'completed') return 'done'
    if (tl.status === 'processing') return app.isOverdue && app.currentNode === nodeType ? 'overdue' : 'current'
    if (tl.status === 'returned') return 'returned'
    if (tl.status === 'rejected') return 'overdue'
    if (stepIdx < currentIdx) return 'done'
    return 'pending'
  }

  async function handleSubmit() {
    try {
      await applicationApi.submit(appId, {
        remark: submitRemark,
        overdueReason: submitOverdueReason,
        followUpAction: submitFollowUpAction,
      })
      showToast('提交审核成功', 'success')
      setShowSubmit(false)
      setSubmitRemark('')
      setSubmitOverdueReason('')
      setSubmitFollowUpAction('')
      loadDetail()
    } catch (err: any) {
      showToast(err.message || '提交失败', 'error')
    }
  }

  async function handleReview() {
    if (reviewAction === 'return' && !returnReason.trim()) {
      showToast('请填写退回原因', 'warning'); return
    }
    if (reviewAction === 'reject' && !rejectReason.trim()) {
      showToast('请填写拒绝原因', 'warning'); return
    }
    if (requireOverdueRecordInput() && (!reviewOverdueReason.trim() || !reviewFollowUpAction.trim())) {
      showToast('当前节点已超时，请填写【超时原因】和【后续处理措施】后再推进', 'warning'); return
    }
    try {
      await applicationApi.review(appId, {
        action: reviewAction,
        reviewResult: reviewResult,
        returnReason: returnReason,
        rejectReason: rejectReason,
        overdueReason: reviewOverdueReason,
        followUpAction: reviewFollowUpAction,
      })
      showToast(reviewAction === 'approve' ? '审核通过，已流转至房态确认' : reviewAction === 'return' ? '已退回租约登记员' : '已拒绝，流程终止', 'success')
      setShowReview(false)
      setReviewOverdueReason('')
      setReviewFollowUpAction('')
      loadDetail()
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error')
    }
  }

  async function handleRoomConfirm() {
    if (!confirmResult.trim()) { showToast('请填写房态确认结果', 'warning'); return }
    if (requireOverdueRecordInput() && (!confirmOverdueReason.trim() || !confirmFollowUpAction.trim())) {
      showToast('当前节点已超时，请填写【超时原因】和【后续处理措施】后再推进', 'warning'); return
    }
    try {
      await applicationApi.roomConfirm(appId, {
        action: 'confirm',
        confirmResult,
        overdueReason: confirmOverdueReason,
        followUpAction: confirmFollowUpAction,
      })
      showToast('房态确认成功，已流转至入住交接', 'success')
      setShowConfirm(false)
      setConfirmResult('')
      setConfirmOverdueReason('')
      setConfirmFollowUpAction('')
      loadDetail()
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error')
    }
  }

  async function handleHandover() {
    if (!handoverResult.trim()) { showToast('请填写入住交接说明', 'warning'); return }
    if (requireOverdueRecordInput() && (!handoverOverdueReason.trim() || !handoverFollowUpAction.trim())) {
      showToast('当前节点已超时，请填写【超时原因】和【后续处理措施】后再推进', 'warning'); return
    }
    try {
      await applicationApi.handover(appId, {
        action: 'complete',
        handoverResult,
        overdueReason: handoverOverdueReason,
        followUpAction: handoverFollowUpAction,
      })
      showToast('入住交接完成，等待复核归档', 'success')
      setShowHandover(false)
      setHandoverResult('')
      setHandoverOverdueReason('')
      setHandoverFollowUpAction('')
      loadDetail()
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error')
    }
  }

  async function handleArchive() {
    if (requireOverdueRecordInput() && (!archiveOverdueReason.trim() || !archiveFollowUpAction.trim())) {
      showToast('当前节点已超时，请填写【超时原因】和【后续处理措施】后再推进', 'warning'); return
    }
    try {
      await applicationApi.archive(appId, {
        action: 'archive',
        remark: archiveRemark,
        overdueReason: archiveOverdueReason,
        followUpAction: archiveFollowUpAction,
      })
      showToast('复核归档成功，流程全部完成', 'success')
      setShowArchive(false)
      setArchiveRemark('')
      setArchiveOverdueReason('')
      setArchiveFollowUpAction('')
      loadDetail()
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error')
    }
  }

  async function handleOverdueRecord() {
    if (!overdueReason.trim()) { showToast('请填写超时原因', 'warning'); return }
    if (!followUpAction.trim()) { showToast('请填写后续处理措施', 'warning'); return }
    try {
      await applicationApi.recordOverdue(appId, {
        overdueReason, followUpAction, nodeType: app.currentNode,
      })
      showToast('超时记录已保存', 'success')
      setShowOverdue(false)
      setOverdueReason('')
      setFollowUpAction('')
      loadDetail()
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error')
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { showToast('文件不能超过 10MB', 'warning'); return }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('applicationId', String(appId))
    fd.append('category', uploadCategory)
    setUploadLoading(true)
    try {
      await attachmentApi.upload(fd)
      showToast('附件上传成功', 'success')
      loadDetail()
    } catch (err: any) {
      showToast(err.message || '上传失败', 'error')
    } finally {
      setUploadLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteAttachment(att: AttachmentType) {
    if (!confirm(`确定删除附件【${att.fileName}】？`)) return
    try {
      await attachmentApi.delete(att.id)
      showToast('删除成功', 'success')
      loadDetail()
    } catch (err: any) {
      showToast(err.message || '删除失败', 'error')
    }
  }

  function canEdit() {
    return (app.status === 'draft' || app.status === 'returned') && hasRole('registrar') && app.createdBy === user?.id
  }

  function canUploadAttachment() {
    if (app.status === 'completed' || app.status === 'rejected') return false
    if (hasRole('registrar')) {
      if (app.createdBy !== user?.id) return false
      return app.status === 'draft' || app.status === 'returned'
    }
    if (hasRole('auditor')) {
      return ['pending_review', 'reviewed', 'pending_confirm', 'pending_handover'].includes(app.status)
    }
    if (hasRole('reviewer')) {
      return app.status === 'room_confirmed'
    }
    return false
  }

  function canDeleteAttachment(att: AttachmentType) {
    if (!canUploadAttachment()) return false
    if (hasRole('registrar')) {
      return att.uploadedBy === user?.id
    }
    return true
  }

  function getAttachmentPermissionHint() {
    if (app.status === 'completed' || app.status === 'rejected') {
      return '流程已结束，不允许上传/删除附件'
    }
    if (hasRole('registrar')) {
      if (app.createdBy !== user?.id) return '登记员只能上传/删除自己申请的附件'
      if (app.status !== 'draft' && app.status !== 'returned') return '登记员仅在【草稿/已退回】状态可上传附件'
    }
    if (hasRole('auditor')) {
      if (!['pending_review', 'reviewed', 'pending_confirm', 'pending_handover'].includes(app.status)) {
        return '审核主管仅在【待审核/待房态确认/待入住交接】状态可上传附件'
      }
    }
    if (hasRole('reviewer')) {
      if (app.status !== 'room_confirmed') return '复核负责人仅在【待复核归档】状态可补充附件'
    }
    return ''
  }

  function renderProcessFlow() {
    return (
      <div className="process-flow">
        {processSteps.map((step, i) => {
          const state = getStepState(step.node)
          const tl = app.nodeTimelines?.find(t => t.nodeType === step.node)
          return (
            <div key={step.node} className={`process-step ${state}`}>
              <div className="step-icon">
                {state === 'done' ? '✓' : state === 'overdue' ? '!' : i + 1}
              </div>
              <div className="step-label">{step.name}</div>
              <div className="step-time">
                {state === 'done' && tl?.endTime ? formatDate(tl.endTime, false) :
                 state === 'current' && tl?.dueTime ? (
                   <span style={{ color: getOverdueDays(tl.dueTime) > 0 ? '#dc2626' : '#6b7280' }}>
                     时限 {tl.timeLimitHours}h
                   </span>
                 ) : state === 'overdue' ? (
                   <span style={{ color: '#dc2626' }}>已超时 {getOverdueDays(tl?.dueTime)} 天</span>
                 ) : ''}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const categoryOptions = ['签约资料', '身份证明', '房产证明', '缴费凭证', '照片记录', '其他']

  return (
    <div>
      <div className="mb-16 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <button className="btn" onClick={() => navigate(-1)}>← 返回列表</button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
              租约申请：<span style={{ color: '#2563eb' }}>{app.applicationNo}</span>
            </h2>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              登记人：{app.createdByName} · 创建于 {formatDate(app.createdAt)}
            </div>
          </div>
        </div>
        <div className="flex gap-8 items-center flex-wrap">
          <StatusBadge status={app.status} statusName={app.statusName} />
          <NodeBadge nodeType={app.currentNode} nodeName={app.currentNodeName} />
          {app.isOverdue && <span className="badge badge-red">⚠️ 已超时</span>}
          {canEdit() && <Link to={`/applications/${appId}/edit`} className="btn btn-warning">📝 编辑信息</Link>}
        </div>
      </div>

      {app.isOverdue && (app.overdueReason || app.followUpAction) && (
        <div className="alert alert-error mb-16">
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>⏰ 超时说明</div>
          {app.overdueReason && <div><b>超时原因：</b>{app.overdueReason}</div>}
          {app.followUpAction && <div><b>后续措施：</b>{app.followUpAction}</div>}
        </div>
      )}

      {app.returnReason && (
        <div className="alert alert-warning mb-16">
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>🔄 审核退回说明</div>
          <div>{app.returnReason}</div>
          {canEdit() && (
            <div style={{ marginTop: '8px' }}>
              <Link to={`/applications/${appId}/edit`} className="btn btn-sm btn-warning">去补正材料 →</Link>
            </div>
          )}
        </div>
      )}

      {app.rejectReason && (
        <div className="alert alert-error mb-16">
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>❌ 审核拒绝说明</div>
          <div>{app.rejectReason}</div>
        </div>
      )}

      {renderProcessFlow()}

      {/* 操作区 */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">⚡ 当前操作区 — {app.currentNodeName}</div>
        </div>
        <div className="card-body">
          <div className="grid-2">
            {/* 左：当前节点处理结果 */}
            <div>
              {app.reviewResult && (
                <div className="section">
                  <div className="section-title">✅ 审核结果</div>
                  <div className="data-list">
                    <div className="data-item"><span className="data-label">审核人</span><span className="data-value">{app.reviewedByName || '-'}</span></div>
                    <div className="data-item"><span className="data-label">审核时间</span><span className="data-value">{app.reviewedAt ? formatDate(app.reviewedAt) : '-'}</span></div>
                    <div className="data-item" style={{ gridColumn: 'span 2' }}>
                      <span className="data-label">审核意见</span>
                      <span className="data-value">{app.reviewResult || '-'}</span>
                    </div>
                  </div>
                </div>
              )}
              {app.confirmResult && (
                <div className="section">
                  <div className="section-title">🏠 房态确认</div>
                  <div className="data-list">
                    <div className="data-item"><span className="data-label">确认人</span><span className="data-value">{app.confirmedByName || '-'}</span></div>
                    <div className="data-item"><span className="data-label">确认时间</span><span className="data-value">{app.confirmedAt ? formatDate(app.confirmedAt) : '-'}</span></div>
                    <div className="data-item" style={{ gridColumn: 'span 2' }}>
                      <span className="data-label">确认结果</span>
                      <span className="data-value">{app.confirmResult || '-'}</span>
                    </div>
                  </div>
                </div>
              )}
              {app.handoverResult && (
                <div className="section">
                  <div className="section-title">🔑 入住交接</div>
                  <div className="data-list">
                    <div className="data-item"><span className="data-label">交接人</span><span className="data-value">{app.handedOverByName || '-'}</span></div>
                    <div className="data-item"><span className="data-label">交接时间</span><span className="data-value">{app.handedOverAt ? formatDate(app.handedOverAt) : '-'}</span></div>
                    <div className="data-item" style={{ gridColumn: 'span 2' }}>
                      <span className="data-label">交接说明</span>
                      <span className="data-value">{app.handoverResult || '-'}</span>
                    </div>
                  </div>
                </div>
              )}
              {app.status === 'completed' && (
                <div className="section">
                  <div className="section-title">📁 复核归档</div>
                  <div className="data-list">
                    <div className="data-item"><span className="data-label">归档人</span><span className="data-value">{app.archivedByName || '-'}</span></div>
                    <div className="data-item"><span className="data-label">归档时间</span><span className="data-value">{app.completedAt ? formatDate(app.completedAt) : '-'}</span></div>
                    {app.remark && (
                      <div className="data-item" style={{ gridColumn: 'span 2' }}>
                        <span className="data-label">归档备注</span>
                        <span className="data-value">{app.remark}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {app.remark && app.status !== 'completed' && (
                <div className="section">
                  <div className="section-title">📝 备注说明</div>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>{app.remark}</div>
                </div>
              )}
            </div>

            {/* 右：动作按钮 */}
            <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px' }}>可执行操作</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {hasRole('registrar') && (app.status === 'draft' || app.status === 'returned') && (
                    <>
                      <Link to={`/applications/${appId}/edit`} className="btn btn-warning btn-lg">📝 编辑/补正信息</Link>
                      <button className="btn btn-primary btn-lg" onClick={() => setShowSubmit(true)}>📤 提交审核</button>
                    </>
                  )}
                  {hasRole('auditor') && app.status === 'pending_review' && (
                    <button className="btn btn-success btn-lg" onClick={() => setShowReview(true)}>✅ 执行审核（通过/退回/拒绝）</button>
                  )}
                  {hasRole('auditor') && app.status === 'pending_confirm' && (
                    <button className="btn btn-warning btn-lg" onClick={() => setShowConfirm(true)}>🏠 确认房态</button>
                  )}
                  {(hasRole('auditor') || hasRole('reviewer')) && app.status === 'pending_handover' && (
                    <button className="btn btn-warning btn-lg" onClick={() => setShowHandover(true)}>🔑 办理入住交接</button>
                  )}
                  {hasRole('reviewer') && app.status === 'room_confirmed' && (
                    <button className="btn btn-success btn-lg" onClick={() => setShowArchive(true)}>📁 复核归档</button>
                  )}
                  {app.isOverdue && app.status !== 'completed' && app.status !== 'rejected' && (
                    <button className="btn btn-danger btn-lg" onClick={() => setShowOverdue(true)}>⏰ 记录超时处理</button>
                  )}
                  <button className="btn btn-lg" onClick={loadDetail}>🔄 刷新详情</button>
                </div>
              </div>
              <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>
                💡 <b>提示：</b>所有操作将立即写入数据库，刷新页面后数据保持一致。操作完成后建议点击"刷新详情"查看最新状态。
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">👤 租客信息 & 🏠 房屋信息</div>
        </div>
        <div className="card-body">
          <div className="section">
            <div className="section-title">租客信息</div>
            <div className="data-list-3">
              <div className="data-item"><span className="data-label">姓名</span><span className="data-value">{app.tenantName}</span></div>
              <div className="data-item"><span className="data-label">身份证号</span><span className="data-value">{app.tenantIdCard}</span></div>
              <div className="data-item"><span className="data-label">联系电话</span><span className="data-value">{app.tenantPhone}</span></div>
            </div>
          </div>
          <div className="section">
            <div className="section-title">房屋租赁信息</div>
            <div className="data-list-3">
              <div className="data-item"><span className="data-label">公寓名称</span><span className="data-value">{app.apartmentName}</span></div>
              <div className="data-item"><span className="data-label">房号</span><span className="data-value">{app.roomNo}</span></div>
              <div className="data-item"><span className="data-label">建筑面积</span><span className="data-value">{app.roomArea} ㎡</span></div>
              <div className="data-item"><span className="data-label">月租金</span><span className="data-value" style={{ color: '#dc2626', fontWeight: 600 }}>¥ {app.monthlyRent.toLocaleString()}</span></div>
              <div className="data-item"><span className="data-label">押金金额</span><span className="data-value">¥ {app.depositAmount.toLocaleString()}</span></div>
              <div className="data-item"><span className="data-label">付款方式</span><span className="data-value">{app.paymentMethod || '-'}</span></div>
              <div className="data-item"><span className="data-label">租期开始</span><span className="data-value">{app.leaseStartDate}</span></div>
              <div className="data-item"><span className="data-label">租期结束</span><span className="data-value">{app.leaseEndDate}</span></div>
              <div className="data-item">
                <span className="data-label">租约时长</span>
                <span className="data-value">
                  {(() => {
                    const s = new Date(app.leaseStartDate), e = new Date(app.leaseEndDate)
                    const months = Math.round((e.getTime() - s.getTime()) / (30 * 24 * 3600 * 1000))
                    return `${months} 个月`
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 附件 + 节点进度 */}
      <div className="grid-2 mb-24">
        {/* 附件管理 */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📎 附件资料</div>
          </div>
          <div className="card-body">
            {canUploadAttachment() && (
              <div style={{ marginBottom: '16px', border: '1px dashed #d1d5db', borderRadius: '6px', padding: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select className="form-control" value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} style={{ width: '140px' }}>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleUpload}
                    disabled={uploadLoading}
                    style={{ display: 'none' }}
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className={`btn btn-primary ${uploadLoading ? '' : ''}`} style={{ cursor: uploadLoading ? 'not-allowed' : 'pointer' }}>
                    {uploadLoading ? <Loading size="sm" /> : '⬆️'} {uploadLoading ? '上传中...' : '上传附件'}
                  </label>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>支持 PDF、图片、Office 文档，单文件 ≤ 10MB</span>
                </div>
              </div>
            )}
            {!canUploadAttachment() && getAttachmentPermissionHint() && (
              <div className="alert alert-info" style={{ marginBottom: '16px', fontSize: '12px' }}>
                💡 {getAttachmentPermissionHint()}
              </div>
            )}
            <div className="attachment-list">
              {(app.attachments || []).length === 0 ? (
                <EmptyState text="暂无附件" />
              ) : (
                (app.attachments || []).map(att => (
                  <div key={att.id} className="attachment-item">
                    <div className="attachment-info">
                      <div className="attachment-icon">
                        {/\.(jpg|jpeg|png|gif)$/i.test(att.fileName) ? '🖼️' : /\.pdf$/i.test(att.fileName) ? '📄' : /\.(doc|docx)$/i.test(att.fileName) ? '📝' : /\.(xls|xlsx)$/i.test(att.fileName) ? '📊' : '📎'}
                      </div>
                      <div>
                        <a href={att.fileUrl} target="_blank" className="attachment-name" rel="noreferrer">{att.fileName}</a>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                          <span className="badge badge-blue" style={{ marginRight: '6px' }}>{att.category}</span>
                          {formatFileSize(att.fileSize)} · {att.uploadedByName} · {formatDate(att.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-8">
                      <a className="btn btn-sm" href={att.fileUrl} target="_blank" rel="noreferrer">下载</a>
                      {canDeleteAttachment(att) && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteAttachment(att)}>删除</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 节点进度时间线 */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📅 节点进度追踪（含时限）</div>
          </div>
          <div className="card-body">
            <div className="timeline">
              {(app.nodeTimelines || []).length === 0 ? (
                <EmptyState text="暂无节点数据" />
              ) : (
                (app.nodeTimelines || []).map(tl => {
                  let cls = 'pending'
                  if (tl.status === 'completed') cls = 'completed'
                  else if (tl.status === 'processing') cls = tl.isOverdue ? 'overdue' : 'processing'
                  else if (tl.status === 'returned') cls = 'returned'
                  else if (tl.status === 'rejected') cls = 'overdue'
                  return (
                    <div key={tl.id} className={`timeline-item ${cls}`}>
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <div className="timeline-title">{tl.nodeName}</div>
                          <div className="timeline-time">
                            <span className={`badge ${cls === 'completed' ? 'badge-green' : cls === 'processing' ? 'badge-blue' : cls === 'overdue' ? 'badge-red' : cls === 'returned' ? 'badge-yellow' : 'badge-gray'}`}>
                              {tl.status === 'completed' ? '已完成' : tl.status === 'processing' ? (tl.isOverdue ? '处理中(超时)' : '处理中') : tl.status === 'returned' ? '已退回' : tl.status === 'rejected' ? '已拒绝' : '待处理'}
                            </span>
                          </div>
                        </div>
                        <div className="timeline-meta">
                          ⏱️ 时限 {tl.timeLimitHours}h · 开始 {formatDate(tl.startTime, false)}
                          {tl.dueTime && <> · 截止 {formatDate(tl.dueTime, false)}</>}
                          {tl.endTime && <> · 完成 {formatDate(tl.endTime)}</>}
                        </div>
                        {tl.handlerName && (
                          <div className="timeline-meta">👤 处理人：{tl.handlerName}</div>
                        )}
                        {getOverdueDays(tl.dueTime) > 0 && (
                          <div className="timeline-overdue">
                            <div className="timeline-overdue-title">⚠️ 已超时 {getOverdueDays(tl.dueTime)} 天</div>
                            {tl.overdueReason && <div><b>原因：</b>{tl.overdueReason}</div>}
                            {tl.followUpAction && <div><b>后续措施：</b>{tl.followUpAction}</div>}
                          </div>
                        )}
                        {tl.remark && <div style={{ fontSize: '12px', color: '#6b7280' }}>备注：{tl.remark}</div>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 操作记录 */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📜 操作日志（全流程追溯） <span className="badge badge-blue ml-8">{logs.length} 条</span></div>
          <button className="btn btn-sm" onClick={loadDetail}>🔄 刷新</button>
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {logs.length === 0 ? (
            <EmptyState text="暂无操作记录" />
          ) : (
            logs.map(log => (
              <div key={log.id} className="log-item">
                <div className="log-header">
                  <div className="log-name">
                    <span className="badge badge-purple" style={{ marginRight: '8px' }}>{log.operationName}</span>
                  </div>
                  <div className="log-time">{formatDate(log.createdAt)}</div>
                </div>
                <div className="log-meta">
                  <span>👤 {log.userName}</span>
                  <span className="badge badge-info">{log.userRole === 'registrar' ? '租约登记员' : log.userRole === 'auditor' ? '审核主管' : '复核负责人'}</span>
                  {log.oldStatus && log.newStatus && log.oldStatus !== log.newStatus && (
                    <span style={{ color: '#6b7280' }}>
                      状态变更：<StatusBadge status={log.oldStatus} /> → <StatusBadge status={log.newStatus} />
                    </span>
                  )}
                </div>
                {log.detail && <div className="log-detail">📝 {log.detail}</div>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 超时审计记录 */}
      {app.overdueAudits && app.overdueAudits.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              ⏰ 超时审计记录
              <span className="badge badge-red ml-8">拦截 {app.overdueBlockedCount || 0} 次</span>
              <span className="badge badge-green ml-8">补录 {app.overdueSupplementedCount || 0} 次</span>
            </div>
          </div>
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {app.overdueAudits.map(audit => (
              <div key={audit.id} className="log-item">
                <div className="log-header">
                  <div className="log-name">
                    <span className={`badge ${audit.auditType === 'blocked' ? 'badge-red' : 'badge-green'}`} style={{ marginRight: '8px' }}>
                      {audit.auditType === 'blocked' ? '🚫 超时拦截' : '✅ 超时补录'}
                    </span>
                    <span style={{ fontWeight: 500 }}>{audit.nodeName}</span>
                    {audit.proceedAction && <span style={{ color: '#6b7280', marginLeft: '8px' }}> · {audit.proceedAction}</span>}
                  </div>
                  <div className="log-time">{formatDate(audit.createdAt)}</div>
                </div>
                <div className="log-meta">
                  <span>👤 {audit.handlerName}</span>
                  <span className="badge badge-info">{audit.handlerRole === 'registrar' ? '租约登记员' : audit.handlerRole === 'auditor' ? '审核主管' : '复核负责人'}</span>
                </div>
                {audit.auditType === 'blocked' && audit.blockedReason && (
                  <div className="log-detail" style={{ background: '#fef2f2' }}>
                    <b style={{ color: '#dc2626' }}>🚫 拦截原因：</b>{audit.blockedReason}
                  </div>
                )}
                {audit.auditType === 'supplemented' && (
                  <>
                    <div className="log-detail" style={{ background: '#f0fdf4' }}>
                      <b style={{ color: '#16a34a' }}>⏰ 超时原因：</b>{audit.overdueReason}
                    </div>
                    <div className="log-detail" style={{ background: '#f0fdf4', marginTop: '4px' }}>
                      <b style={{ color: '#16a34a' }}>📋 后续处理：</b>{audit.followUpAction}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 提交审核 Modal */}
      <Modal
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        title="📤 提交租约申请至审核"
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowSubmit(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleSubmit}>确认提交</button>
          </>
        }
      >
        <div className="alert alert-info">
          即将提交申请 <b>{app.applicationNo}</b> 至租约审核主管处理，提交后将进入时限追踪。
        </div>
        <div className="form-group">
          <label className="form-label">备注说明（可选）</label>
          <textarea className="form-control" value={submitRemark} onChange={e => setSubmitRemark(e.target.value)} placeholder="如有补充说明请填写" />
        </div>
        {requireOverdueRecordInput() && (
          <div className="alert alert-error" style={{ marginTop: '16px' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>⚠️ 当前节点【{app.currentNodeName}】已超时，必须填写以下信息才能推进</div>
            <div className="form-group">
              <label className="form-label required">超时原因</label>
              <textarea className="form-control" value={submitOverdueReason} onChange={e => setSubmitOverdueReason(e.target.value)} placeholder="请说明超时的具体原因" rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label required">后续处理措施</label>
              <textarea className="form-control" value={submitFollowUpAction} onChange={e => setSubmitFollowUpAction(e.target.value)} placeholder="请说明将采取的后续措施" rows={2} />
            </div>
          </div>
        )}
        {getNodeBlockedHistory(app.currentNode).length > 0 && (
          <div className="card" style={{ marginTop: '16px', background: '#fff7ed' }}>
            <div className="card-header" style={{ padding: '8px 12px' }}>
              <div className="card-title" style={{ fontSize: '13px' }}>
                🚫 该节点拦截历史（{getNodeBlockedHistory(app.currentNode).length} 次）
              </div>
            </div>
            <div style={{ maxHeight: '140px', overflowY: 'auto', padding: '8px 12px' }}>
              {getNodeBlockedHistory(app.currentNode).slice(0, 5).map(audit => (
                <div key={audit.id} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px dashed #fed7aa' }}>
                  <div style={{ color: '#9a3412', marginBottom: '2px' }}>
                    <b>[{audit.handlerName}]</b> {formatDate(audit.createdAt)}
                  </div>
                  <div style={{ color: '#78350f' }}>{audit.blockedReason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 审核 Modal */}
      <Modal
        open={showReview}
        onClose={() => setShowReview(false)}
        title="✅ 租约审核处理"
        size="lg"
        footer={
          <>
            <button className="btn" onClick={() => setShowReview(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleReview}>
              确认{reviewAction === 'approve' ? '通过' : reviewAction === 'return' ? '退回' : '拒绝'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label required">审核动作</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {([
              { v: 'approve', l: '✅ 审核通过', cls: 'btn-success' },
              { v: 'return', l: '🔄 退回补正', cls: 'btn-warning' },
              { v: 'reject', l: '❌ 拒绝申请', cls: 'btn-danger' },
            ] as Array<{ v: any; l: string; cls: string }>).map(opt => (
              <button
                key={opt.v}
                type="button"
                className={`btn ${reviewAction === opt.v ? opt.cls : ''}`}
                onClick={() => setReviewAction(opt.v)}
              >{opt.l}</button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">租客姓名</label>
            <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px' }}>{app.tenantName}</div>
          </div>
          <div className="form-group">
            <label className="form-label">公寓/房号</label>
            <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px' }}>{app.apartmentName} {app.roomNo}</div>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">月租金</label>
            <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>¥ {app.monthlyRent.toLocaleString()}</div>
          </div>
          <div className="form-group">
            <label className="form-label">租期</label>
            <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px' }}>{app.leaseStartDate} ~ {app.leaseEndDate}</div>
          </div>
        </div>

        {(reviewAction === 'approve' || reviewAction === 'return') && (
          <div className="form-group">
            <label className={`form-label ${reviewAction === 'approve' ? '' : 'required'}`}>
              {reviewAction === 'approve' ? '审核意见' : '退回原因'}
            </label>
            <textarea
              className="form-control"
              value={reviewAction === 'approve' ? reviewResult : returnReason}
              onChange={e => reviewAction === 'approve' ? setReviewResult(e.target.value) : setReturnReason(e.target.value)}
              placeholder={reviewAction === 'approve' ? '请填写审核通过的意见' : '请详细说明需要补正的材料或问题'}
              rows={4}
            />
          </div>
        )}
        {reviewAction === 'reject' && (
          <div className="form-group">
            <label className="form-label required">拒绝原因</label>
            <textarea className="form-control" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="请详细说明拒绝理由" rows={4} />
          </div>
        )}

        {(app.attachments || []).length > 0 && (
          <div className="form-group">
            <label className="form-label">已上传附件（{app.attachments?.length || 0}）</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {app.attachments?.slice(0, 6).map(a => (
                <a key={a.id} href={a.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm" style={{ fontSize: '12px' }}>
                  📎 {a.category}
                </a>
              ))}
            </div>
          </div>
        )}

        {requireOverdueRecordInput() && (
          <div className="alert alert-error" style={{ marginTop: '16px' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>⚠️ 当前节点【{app.currentNodeName}】已超时，必须填写以下信息才能推进</div>
            <div className="form-group">
              <label className="form-label required">超时原因</label>
              <textarea className="form-control" value={reviewOverdueReason} onChange={e => setReviewOverdueReason(e.target.value)} placeholder="请说明超时的具体原因" rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label required">后续处理措施</label>
              <textarea className="form-control" value={reviewFollowUpAction} onChange={e => setReviewFollowUpAction(e.target.value)} placeholder="请说明将采取的后续措施" rows={2} />
            </div>
          </div>
        )}
        {getNodeBlockedHistory(app.currentNode).length > 0 && (
          <div className="card" style={{ marginTop: '16px', background: '#fff7ed' }}>
            <div className="card-header" style={{ padding: '8px 12px' }}>
              <div className="card-title" style={{ fontSize: '13px' }}>
                🚫 该节点拦截历史（{getNodeBlockedHistory(app.currentNode).length} 次）
              </div>
            </div>
            <div style={{ maxHeight: '140px', overflowY: 'auto', padding: '8px 12px' }}>
              {getNodeBlockedHistory(app.currentNode).slice(0, 5).map(audit => (
                <div key={audit.id} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px dashed #fed7aa' }}>
                  <div style={{ color: '#9a3412', marginBottom: '2px' }}>
                    <b>[{audit.handlerName}]</b> {formatDate(audit.createdAt)}
                  </div>
                  <div style={{ color: '#78350f' }}>{audit.blockedReason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 房态确认 */}
      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="🏠 房态确认处理"
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowConfirm(false)}>取消</button>
            <button className="btn btn-warning" onClick={handleRoomConfirm}>确认房态无误</button>
          </>
        }
      >
        <div className="alert alert-info">确认 <b>{app.apartmentName} {app.roomNo}</b> 房态可用后，将流转至入住交接环节。</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">公寓</label>
            <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px' }}>{app.apartmentName}</div>
          </div>
          <div className="form-group">
            <label className="form-label">房号</label>
            <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>{app.roomNo}</div>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label required">房态确认结果</label>
          <textarea className="form-control" value={confirmResult} onChange={e => setConfirmResult(e.target.value)}
            placeholder="例：房屋已腾空、水电煤气结清、门锁完好、设备齐全，可正常交付" rows={4} />
        </div>
        {requireOverdueRecordInput() && (
          <div className="alert alert-error" style={{ marginTop: '16px' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>⚠️ 当前节点【{app.currentNodeName}】已超时，必须填写以下信息才能推进</div>
            <div className="form-group">
              <label className="form-label required">超时原因</label>
              <textarea className="form-control" value={confirmOverdueReason} onChange={e => setConfirmOverdueReason(e.target.value)} placeholder="请说明超时的具体原因" rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label required">后续处理措施</label>
              <textarea className="form-control" value={confirmFollowUpAction} onChange={e => setConfirmFollowUpAction(e.target.value)} placeholder="请说明将采取的后续措施" rows={2} />
            </div>
          </div>
        )}
        {getNodeBlockedHistory(app.currentNode).length > 0 && (
          <div className="card" style={{ marginTop: '16px', background: '#fff7ed' }}>
            <div className="card-header" style={{ padding: '8px 12px' }}>
              <div className="card-title" style={{ fontSize: '13px' }}>
                🚫 该节点拦截历史（{getNodeBlockedHistory(app.currentNode).length} 次）
              </div>
            </div>
            <div style={{ maxHeight: '140px', overflowY: 'auto', padding: '8px 12px' }}>
              {getNodeBlockedHistory(app.currentNode).slice(0, 5).map(audit => (
                <div key={audit.id} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px dashed #fed7aa' }}>
                  <div style={{ color: '#9a3412', marginBottom: '2px' }}>
                    <b>[{audit.handlerName}]</b> {formatDate(audit.createdAt)}
                  </div>
                  <div style={{ color: '#78350f' }}>{audit.blockedReason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 入住交接 */}
      <Modal
        open={showHandover}
        onClose={() => setShowHandover(false)}
        title="🔑 入住交接办理"
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowHandover(false)}>取消</button>
            <button className="btn btn-warning" onClick={handleHandover}>确认交接完成</button>
          </>
        }
      >
        <div className="alert alert-success">
          租客 <b>{app.tenantName}</b> 入住交接，交接完成后将流转至复核归档环节。
        </div>
        <div className="form-group">
          <label className="form-label required">交接说明</label>
          <textarea className="form-control" value={handoverResult} onChange={e => setHandoverResult(e.target.value)}
            placeholder="例：已交付钥匙、门禁卡；抄录水电表读数；讲解公寓设施使用注意事项；租客确认签收"
            rows={4} />
        </div>
        {requireOverdueRecordInput() && (
          <div className="alert alert-error" style={{ marginTop: '16px' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>⚠️ 当前节点【{app.currentNodeName}】已超时，必须填写以下信息才能推进</div>
            <div className="form-group">
              <label className="form-label required">超时原因</label>
              <textarea className="form-control" value={handoverOverdueReason} onChange={e => setHandoverOverdueReason(e.target.value)} placeholder="请说明超时的具体原因" rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label required">后续处理措施</label>
              <textarea className="form-control" value={handoverFollowUpAction} onChange={e => setHandoverFollowUpAction(e.target.value)} placeholder="请说明将采取的后续措施" rows={2} />
            </div>
          </div>
        )}
        {getNodeBlockedHistory(app.currentNode).length > 0 && (
          <div className="card" style={{ marginTop: '16px', background: '#fff7ed' }}>
            <div className="card-header" style={{ padding: '8px 12px' }}>
              <div className="card-title" style={{ fontSize: '13px' }}>
                🚫 该节点拦截历史（{getNodeBlockedHistory(app.currentNode).length} 次）
              </div>
            </div>
            <div style={{ maxHeight: '140px', overflowY: 'auto', padding: '8px 12px' }}>
              {getNodeBlockedHistory(app.currentNode).slice(0, 5).map(audit => (
                <div key={audit.id} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px dashed #fed7aa' }}>
                  <div style={{ color: '#9a3412', marginBottom: '2px' }}>
                    <b>[{audit.handlerName}]</b> {formatDate(audit.createdAt)}
                  </div>
                  <div style={{ color: '#78350f' }}>{audit.blockedReason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 复核归档 */}
      <Modal
        open={showArchive}
        onClose={() => setShowArchive(false)}
        title="📁 租约复核归档"
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowArchive(false)}>取消</button>
            <button className="btn btn-success" onClick={handleArchive}>确认完成归档</button>
          </>
        }
      >
        <div className="alert alert-success">
          申请 <b>{app.applicationNo}</b> 全部节点完成，归档后租约申请流程正式结束。
        </div>
        <div className="data-list mb-16">
          <div className="data-item"><span className="data-label">租客</span><span className="data-value">{app.tenantName}</span></div>
          <div className="data-item"><span className="data-label">房号</span><span className="data-value">{app.apartmentName} {app.roomNo}</span></div>
          <div className="data-item"><span className="data-label">月租金</span><span className="data-value">¥{app.monthlyRent.toLocaleString()}</span></div>
          <div className="data-item"><span className="data-label">附件数</span><span className="data-value">{app.attachments?.length || 0} 个</span></div>
        </div>
        <div className="form-group">
          <label className="form-label">归档备注（可选）</label>
          <textarea className="form-control" value={archiveRemark} onChange={e => setArchiveRemark(e.target.value)}
            placeholder="如有归档说明可填写，无则留空" rows={3} />
        </div>
        {requireOverdueRecordInput() && (
          <div className="alert alert-error" style={{ marginTop: '16px' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>⚠️ 当前节点【{app.currentNodeName}】已超时，必须填写以下信息才能推进</div>
            <div className="form-group">
              <label className="form-label required">超时原因</label>
              <textarea className="form-control" value={archiveOverdueReason} onChange={e => setArchiveOverdueReason(e.target.value)} placeholder="请说明超时的具体原因" rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label required">后续处理措施</label>
              <textarea className="form-control" value={archiveFollowUpAction} onChange={e => setArchiveFollowUpAction(e.target.value)} placeholder="请说明将采取的后续措施" rows={2} />
            </div>
          </div>
        )}
        {getNodeBlockedHistory(app.currentNode).length > 0 && (
          <div className="card" style={{ marginTop: '16px', background: '#fff7ed' }}>
            <div className="card-header" style={{ padding: '8px 12px' }}>
              <div className="card-title" style={{ fontSize: '13px' }}>
                🚫 该节点拦截历史（{getNodeBlockedHistory(app.currentNode).length} 次）
              </div>
            </div>
            <div style={{ maxHeight: '140px', overflowY: 'auto', padding: '8px 12px' }}>
              {getNodeBlockedHistory(app.currentNode).slice(0, 5).map(audit => (
                <div key={audit.id} style={{ fontSize: '12px', padding: '6px 0', borderBottom: '1px dashed #fed7aa' }}>
                  <div style={{ color: '#9a3412', marginBottom: '2px' }}>
                    <b>[{audit.handlerName}]</b> {formatDate(audit.createdAt)}
                  </div>
                  <div style={{ color: '#78350f' }}>{audit.blockedReason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 超时记录 */}
      <Modal
        open={showOverdue}
        onClose={() => setShowOverdue(false)}
        title="⏰ 超时原因与后续处理记录"
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowOverdue(false)}>取消</button>
            <button className="btn btn-danger" onClick={handleOverdueRecord}>保存超时记录</button>
          </>
        }
      >
        <div className="alert alert-error">
          当前节点【{app.currentNodeName}】已超时，请如实记录超时原因并制定后续处理措施，以便追溯。
        </div>
        <div className="form-group">
          <label className="form-label required">超时原因</label>
          <textarea className="form-control" value={overdueReason} onChange={e => setOverdueReason(e.target.value)}
            placeholder="请详细说明超时的具体原因，例如：租客资料不全、系统故障、节假日延误等" rows={3} />
        </div>
        <div className="form-group">
          <label className="form-label required">后续处理措施</label>
          <textarea className="form-control" value={followUpAction} onChange={e => setFollowUpAction(e.target.value)}
            placeholder="请说明将采取的后续措施，例如：已联系租客补充资料、已安排优先处理、预计X日内完成等" rows={3} />
        </div>
      </Modal>
    </div>
  )
}
