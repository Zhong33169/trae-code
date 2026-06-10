import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { api } from '../api'
import Modal from '../components/Modal'

const statusColorMap = {
  pending_verification: 'primary',
  verified: 'processing',
  entered: 'warning',
  archived: 'success',
  appeal_pending: 'danger'
}

const statusNameMap = {
  pending_verification: '待票务核销',
  verified: '已核销待入园',
  entered: '已入园待归档',
  archived: '已归档',
  appeal_pending: '申诉中'
}

const appealStatusNameMap = {
  submitted: '已提交',
  accepted: '已受理',
  rejected_correction: '驳回补正',
  resubmitted: '再次提交',
  approved: '申诉通过',
  denied: '申诉驳回'
}

const appealStatusColorMap = {
  submitted: 'primary',
  accepted: 'processing',
  rejected_correction: 'warning',
  resubmitted: 'primary',
  approved: 'success',
  denied: 'danger'
}

const evidenceNameMap = {
  booking_sheet: '预约单',
  ticket_voucher: '票务凭证',
  entry_record: '入园记录',
  settlement_note: '结算单'
}

const requiredEvidenceMap = {
  pending_verification: ['booking_sheet'],
  verified: ['booking_sheet', 'ticket_voucher'],
  entered: ['booking_sheet', 'ticket_voucher', 'entry_record'],
  archived: ['booking_sheet', 'ticket_voucher', 'entry_record', 'settlement_note']
}

const roleNameMap = {
  ticket_specialist: '票务专员',
  site_dispatcher: '现场调度',
  scenic_manager: '景区经理'
}

const transitionLabels = {
  'pending_verification->verified': '票务核销',
  'verified->entered': '入园统计',
  'entered->archived': '归档'
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('info')

  const [appealModal, setAppealModal] = useState(false)
  const [appealReason, setAppealReason] = useState('')
  const [transitionModal, setTransitionModal] = useState(false)
  const [transitionTarget, setTransitionTarget] = useState('')
  const [transitionRemark, setTransitionRemark] = useState('')
  const [transitionEvidence, setTransitionEvidence] = useState([])
  const [processing, setProcessing] = useState(false)

  const [acceptAppealModal, setAcceptAppealModal] = useState(false)
  const [rejectAppealModal, setRejectAppealModal] = useState(false)
  const [resubmitAppealModal, setResubmitAppealModal] = useState(false)
  const [approveAppealModal, setApproveAppealModal] = useState(false)
  const [denyAppealModal, setDenyAppealModal] = useState(false)
  const [appealText, setAppealText] = useState('')
  const [targetOrderStatus, setTargetOrderStatus] = useState('')

  useEffect(() => {
    loadOrder()
  }, [id])

  const loadOrder = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.getOrderDetail(id)
      setOrder(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const parseEvidence = (evidenceStr) => {
    if (!evidenceStr) return []
    try {
      return JSON.parse(evidenceStr)
    } catch {
      return []
    }
  }

  const getAvailableTransitions = () => {
    if (!order || !user) return []

    const transitions = {
      ticket_specialist: {
        pending_verification: ['verified']
      },
      site_dispatcher: {
        verified: ['entered']
      },
      scenic_manager: {
        entered: ['archived']
      }
    }

    const targets = transitions[user.role]?.[order.status] || []
    return targets
  }

  const canSubmitAppeal = () => {
    if (!order || !user) return false
    if (order.status === 'archived') return false
    if (order.status === 'appeal_pending') return false

    const appealSubmitterRoles = {
      pending_verification: 'ticket_specialist',
      verified: 'site_dispatcher',
      entered: 'site_dispatcher'
    }

    return appealSubmitterRoles[order.status] === user.role || user.role === 'scenic_manager'
  }

  const canHandleAppeal = () => {
    if (!order || !user) return false
    if (order.status !== 'appeal_pending') return false
    return user.role === 'scenic_manager'
  }

  const getCurrentAppeal = () => {
    if (!order?.appeals || order.appeals.length === 0) return null
    return order.appeals.find(a =>
      ['submitted', 'accepted', 'rejected_correction', 'resubmitted'].includes(a.status)
    ) || order.appeals[0]
  }

  const canResubmitAppeal = () => {
    const appeal = getCurrentAppeal()
    if (!appeal || !user) return false
    if (appeal.status !== 'rejected_correction') return false
    return appeal.submitter_role === user.role
  }

  const handleTransition = async () => {
    if (!transitionTarget) return

    setProcessing(true)
    try {
      const currentEvidence = parseEvidence(order.evidence)
      const newEvidence = [...new Set([...currentEvidence, ...transitionEvidence])]
      await api.transitionOrder(order.id, transitionTarget, order.version, newEvidence, transitionRemark)
      setTransitionModal(false)
      setTransitionTarget('')
      setTransitionRemark('')
      setTransitionEvidence([])
      loadOrder()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const openTransitionModal = (target) => {
    setTransitionTarget(target)
    setTransitionEvidence(parseEvidence(order.evidence))
    setTransitionRemark('')
    setTransitionModal(true)
  }

  const handleSubmitAppeal = async () => {
    if (!appealReason.trim()) {
      alert('请填写申诉理由')
      return
    }
    setProcessing(true)
    try {
      await api.submitAppeal(order.id, appealReason)
      setAppealModal(false)
      setAppealReason('')
      loadOrder()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleAcceptAppeal = async () => {
    const appeal = getCurrentAppeal()
    if (!appeal) return
    setProcessing(true)
    try {
      await api.acceptAppeal(appeal.id, appealText)
      setAcceptAppealModal(false)
      setAppealText('')
      loadOrder()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleRejectAppeal = async () => {
    const appeal = getCurrentAppeal()
    if (!appeal) return
    if (!appealText.trim()) {
      alert('请填写驳回原因')
      return
    }
    setProcessing(true)
    try {
      await api.rejectAppeal(appeal.id, appealText)
      setRejectAppealModal(false)
      setAppealText('')
      loadOrder()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleResubmitAppeal = async () => {
    const appeal = getCurrentAppeal()
    if (!appeal) return
    if (!appealText.trim()) {
      alert('请填写补充申诉理由')
      return
    }
    setProcessing(true)
    try {
      await api.resubmitAppeal(appeal.id, appealText)
      setResubmitAppealModal(false)
      setAppealText('')
      loadOrder()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleApproveAppeal = async () => {
    const appeal = getCurrentAppeal()
    if (!appeal) return
    if (!targetOrderStatus) {
      alert('请选择申诉通过后预约单的目标状态')
      return
    }
    setProcessing(true)
    try {
      await api.approveAppeal(appeal.id, appealText, targetOrderStatus)
      setApproveAppealModal(false)
      setAppealText('')
      setTargetOrderStatus('')
      loadOrder()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleDenyAppeal = async () => {
    const appeal = getCurrentAppeal()
    if (!appeal) return
    if (!appealText.trim()) {
      alert('请填写驳回原因')
      return
    }
    setProcessing(true)
    try {
      await api.denyAppeal(appeal.id, appealText)
      setDenyAppealModal(false)
      setAppealText('')
      loadOrder()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const formatDateTime = (str) => {
    if (!str) return '-'
    const d = new Date(str)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const formatDate = (str) => {
    if (!str) return '-'
    const d = new Date(str)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const toggleEvidence = (key) => {
    setTransitionEvidence(prev =>
      prev.includes(key)
        ? prev.filter(e => e !== key)
        : [...prev, key]
    )
  }

  const getMissingEvidence = (targetStatus) => {
    const required = requiredEvidenceMap[targetStatus] || []
    const current = parseEvidence(order?.evidence || '')
    return required.filter(e => !current.includes(e))
  }

  if (loading) return <div className="loading">加载中...</div>
  if (error) return <div className="alert alert-error">{error}</div>
  if (!order) return <div className="empty">预约单不存在</div>

  const currentEvidence = parseEvidence(order.evidence)
  const availableTransitions = getAvailableTransitions()
  const currentAppeal = getCurrentAppeal()
  const missingEvidence = getMissingEvidence(order.status)

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-link" onClick={() => navigate(-1)} style={{ marginRight: '12px' }}>
            ← 返回
          </button>
          <span className="page-title">预约单详情</span>
        </div>
        <button className="btn btn-default" onClick={loadOrder}>刷新</button>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="card">
            <div className="card-header">
              <span>{order.team_name}</span>
              <span className={`status-tag status-${statusColorMap[order.status]}`}>
                {statusNameMap[order.status]}
              </span>
            </div>
            <div className="card-body">
              <div className="detail-info-grid">
                <div className="detail-item">
                  <span className="label">预约单号</span>
                  <span className="value">{order.order_no}</span>
                </div>
                <div className="detail-item">
                  <span className="label">游客人数</span>
                  <span className="value">{order.visitor_count} 人</span>
                </div>
                <div className="detail-item">
                  <span className="label">游览日期</span>
                  <span className="value">{formatDate(order.visit_date)}</span>
                </div>
                <div className="detail-item">
                  <span className="label">导游</span>
                  <span className="value">{order.guide_name || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">导游电话</span>
                  <span className="value">{order.guide_phone || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">当前处理岗位</span>
                  <span className="value">{roleNameMap[order.current_handler_role] || order.current_handler_role}</span>
                </div>
                <div className="detail-item">
                  <span className="label">版本号</span>
                  <span className="value">v{order.version}</span>
                </div>
                <div className="detail-item">
                  <span className="label">创建时间</span>
                  <span className="value">{formatDateTime(order.created_at)}</span>
                </div>
                <div className="detail-item full">
                  <span className="label">备注</span>
                  <span className="value">{order.remark || '无'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">证据材料</div>
            <div className="card-body">
              <div className="evidence-list">
                {Object.entries(evidenceNameMap).map(([key, name]) => {
                  const has = currentEvidence.includes(key)
                  return (
                    <span key={key} className={`evidence-tag ${has ? 'has' : 'missing'}`}>
                      {has ? '✓' : '✗'} {name}
                    </span>
                  )
                })}
              </div>
              {missingEvidence.length > 0 && (
                <div className="alert alert-warning" style={{ marginTop: '16px' }}>
                  当前状态缺少必填证据：
                  {missingEvidence.map(e => evidenceNameMap[e] || e).join('、')}
                </div>
              )}
            </div>
          </div>

          {currentAppeal && (
            <div className="appeal-card">
              <div className="appeal-header">
                <span className="appeal-title">
                  📋 异常申诉
                  <span
                    className={`status-tag status-${appealStatusColorMap[currentAppeal.status]}`}
                    style={{ marginLeft: '8px' }}
                  >
                    {appealStatusNameMap[currentAppeal.status]}
                  </span>
                </span>
                <span style={{ fontSize: '12px', color: '#999' }}>
                  提交人：{currentAppeal.submitter_name}（{roleNameMap[currentAppeal.submitter_role]}）
                </span>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: '500', marginBottom: '4px', color: '#d48806' }}>申诉理由</div>
                <div style={{ background: 'white', padding: '10px 12px', borderRadius: '4px', fontSize: '13px' }}>
                  {currentAppeal.reason}
                </div>
              </div>

              {currentAppeal.review_opinion && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '500', marginBottom: '4px', color: '#1890ff' }}>复核意见</div>
                  <div style={{ background: 'white', padding: '10px 12px', borderRadius: '4px', fontSize: '13px' }}>
                    {currentAppeal.review_opinion}
                  </div>
                </div>
              )}

              {currentAppeal.reject_reason && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '500', marginBottom: '4px', color: '#ff4d4f' }}>驳回原因</div>
                  <div style={{ background: 'white', padding: '10px 12px', borderRadius: '4px', fontSize: '13px' }}>
                    {currentAppeal.reject_reason}
                  </div>
                </div>
              )}

              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                原状态：{statusNameMap[currentAppeal.original_status]}
                {currentAppeal.resubmit_count > 0 && ` | 补正次数：${currentAppeal.resubmit_count} 次`}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
                <div
                  className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('logs')}
                >
                  操作记录
                </div>
                <div
                  className={`tab ${activeTab === 'appeals' ? 'active' : ''}`}
                  onClick={() => setActiveTab('appeals')}
                >
                  申诉记录
                </div>
              </div>
            </div>
            <div className="card-body">
              {activeTab === 'logs' && (
                <div className="timeline">
                  {order.logs?.map((log) => (
                    <div key={log.id} className="timeline-item">
                      <div className="time">{formatDateTime(log.created_at)}</div>
                      <div className="action">{log.action}</div>
                      <div className="operator">
                        {log.operator_name || '系统'}
                        {log.operator_role ? `（${roleNameMap[log.operator_role] || log.operator_role}）` : ''}
                      </div>
                      {(log.from_status || log.to_status) && (
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {log.from_status
                            ? `${statusNameMap[log.from_status] || log.from_status} → `
                            : ''}
                          {log.to_status
                            ? statusNameMap[log.to_status] || log.to_status
                            : ''}
                        </div>
                      )}
                      {log.remark && <div className="remark">{log.remark}</div>}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'appeals' && (
                <div>
                  {!order.appeals || order.appeals.length === 0 ? (
                    <div className="empty">暂无申诉记录</div>
                  ) : (
                    <div className="timeline">
                      {order.appeals.flatMap((appeal) =>
                        (appeal.logs || []).map((log) => (
                          <div key={log.id} className="timeline-item">
                            <div className="time">{formatDateTime(log.created_at)}</div>
                            <div className="action">申诉 - {log.action}</div>
                            <div className="operator">
                              {log.operator_name || '系统'}
                              {log.operator_role ? `（${roleNameMap[log.operator_role] || log.operator_role}）` : ''}
                            </div>
                            {(log.from_status || log.to_status) && (
                              <div style={{ fontSize: '12px', color: '#999' }}>
                                {log.from_status
                                  ? `${appealStatusNameMap[log.from_status] || log.from_status} → `
                                  : ''}
                                {log.to_status
                                  ? appealStatusNameMap[log.to_status] || log.to_status
                                  : ''}
                              </div>
                            )}
                            {log.remark && <div className="remark">{log.remark}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="detail-side">
          <div className="card">
            <div className="card-header">操作面板</div>
            <div className="card-body">
              <div className="action-panel">
                {availableTransitions.length > 0 && (
                  <div className="action-buttons">
                    {availableTransitions.map((target) => {
                      const label = transitionLabels[`${order.status}->${target}`] || `流转到${statusNameMap[target]}`
                      const missing = getMissingEvidence(target)
                      return (
                        <button
                          key={target}
                          className="btn btn-primary"
                          onClick={() => openTransitionModal(target)}
                        >
                          {label}
                          {missing.length > 0 && '（需补证据）'}
                        </button>
                      )
                    })}
                  </div>
                )}

                {canSubmitAppeal() && !currentAppeal && (
                  <button
                    className="btn btn-warning"
                    onClick={() => setAppealModal(true)}
                  >
                    提交异常申诉
                  </button>
                )}

                {canHandleAppeal() && currentAppeal && (
                  <div className="action-buttons">
                    {['submitted', 'resubmitted'].includes(currentAppeal.status) && (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setAppealText('')
                          setAcceptAppealModal(true)
                        }}
                      >
                        受理申诉
                      </button>
                    )}

                    {['submitted', 'accepted', 'resubmitted'].includes(currentAppeal.status) && (
                      <>
                        <button
                          className="btn btn-warning"
                          onClick={() => {
                            setAppealText('')
                            setRejectAppealModal(true)
                          }}
                        >
                          驳回补正
                        </button>
                        <button
                          className="btn btn-success"
                          onClick={() => {
                            setAppealText('')
                            setTargetOrderStatus(currentAppeal.original_status)
                            setApproveAppealModal(true)
                          }}
                        >
                          申诉通过
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => {
                            setAppealText('')
                            setDenyAppealModal(true)
                          }}
                        >
                          申诉驳回
                        </button>
                      </>
                    )}
                  </div>
                )}

                {canResubmitAppeal() && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setAppealText('')
                      setResubmitAppealModal(true)
                    }}
                  >
                    再次提交申诉
                  </button>
                )}

                {availableTransitions.length === 0 &&
                  !canSubmitAppeal() &&
                  !canHandleAppeal() &&
                  !canResubmitAppeal() && (
                    <div className="empty" style={{ padding: '20px 0' }}>
                      当前状态无可操作项
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">当前用户信息</div>
            <div className="card-body">
              <div className="detail-info-grid" style={{ gap: '12px' }}>
                <div className="detail-item">
                  <span className="label">姓名</span>
                  <span className="value">{user?.name}</span>
                </div>
                <div className="detail-item">
                  <span className="label">岗位</span>
                  <span className="value">{user?.role_name}</span>
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#999', lineHeight: '1.6' }}>
                岗位权限说明：<br />
                • 票务专员：核销预约单<br />
                • 现场调度：入园统计<br />
                • 景区经理：归档、申诉处理
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        title="状态流转确认"
        visible={transitionModal}
        onClose={() => setTransitionModal(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setTransitionModal(false)}>取消</button>
            <button
              className="btn btn-primary"
              onClick={handleTransition}
              disabled={processing}
            >
              {processing ? '处理中...' : '确认'}
            </button>
          </>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          确认将预约单从
          <strong style={{ margin: '0 6px' }}>{statusNameMap[order.status]}</strong>
          流转到
          <strong style={{ margin: '0 6px', color: '#1890ff' }}>
            {statusNameMap[transitionTarget]}
          </strong>
          ？
        </div>

        <div className="form-item">
          <label className="form-label">证据材料（勾选当前已有的）</label>
          <div className="checkbox-group">
            {Object.entries(evidenceNameMap).map(([key, name]) => {
              const required = (requiredEvidenceMap[transitionTarget] || []).includes(key)
              return (
                <label key={key} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={transitionEvidence.includes(key)}
                    onChange={() => toggleEvidence(key)}
                  />
                  <span>
                    {name}
                    {required && <span style={{ color: '#ff4d4f' }}> *</span>}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="form-item">
          <label className="form-label">备注</label>
          <textarea
            className="form-textarea"
            value={transitionRemark}
            onChange={(e) => setTransitionRemark(e.target.value)}
            placeholder="请输入操作备注（可选）"
          />
        </div>
      </Modal>

      <Modal
        title="提交异常申诉"
        visible={appealModal}
        onClose={() => setAppealModal(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setAppealModal(false)}>取消</button>
            <button
              className="btn btn-warning"
              onClick={handleSubmitAppeal}
              disabled={processing}
            >
              {processing ? '提交中...' : '提交申诉'}
            </button>
          </>
        }
      >
        <div className="form-item">
          <label className="form-label">申诉理由</label>
          <textarea
            className="form-textarea"
            value={appealReason}
            onChange={(e) => setAppealReason(e.target.value)}
            placeholder="请详细描述申诉理由和异常情况..."
            style={{ minHeight: '120px' }}
          />
        </div>
        <div style={{ fontSize: '12px', color: '#999' }}>
          申诉提交后，预约单状态将变为「申诉中」，由景区经理复核。
        </div>
      </Modal>

      <Modal
        title="受理申诉"
        visible={acceptAppealModal}
        onClose={() => setAcceptAppealModal(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setAcceptAppealModal(false)}>取消</button>
            <button
              className="btn btn-primary"
              onClick={handleAcceptAppeal}
              disabled={processing}
            >
              {processing ? '处理中...' : '确认受理'}
            </button>
          </>
        }
      >
        <div className="form-item">
          <label className="form-label">复核意见（可选）</label>
          <textarea
            className="form-textarea"
            value={appealText}
            onChange={(e) => setAppealText(e.target.value)}
            placeholder="请输入复核意见..."
          />
        </div>
      </Modal>

      <Modal
        title="驳回补正"
        visible={rejectAppealModal}
        onClose={() => setRejectAppealModal(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setRejectAppealModal(false)}>取消</button>
            <button
              className="btn btn-warning"
              onClick={handleRejectAppeal}
              disabled={processing}
            >
              {processing ? '处理中...' : '确认驳回'}
            </button>
          </>
        }
      >
        <div className="form-item">
          <label className="form-label">驳回原因 <span style={{ color: '#ff4d4f' }}>*</span></label>
          <textarea
            className="form-textarea"
            value={appealText}
            onChange={(e) => setAppealText(e.target.value)}
            placeholder="请详细说明驳回原因和需要补充的材料..."
            style={{ minHeight: '120px' }}
          />
        </div>
      </Modal>

      <Modal
        title="再次提交申诉"
        visible={resubmitAppealModal}
        onClose={() => setResubmitAppealModal(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setResubmitAppealModal(false)}>取消</button>
            <button
              className="btn btn-primary"
              onClick={handleResubmitAppeal}
              disabled={processing}
            >
              {processing ? '提交中...' : '再次提交'}
            </button>
          </>
        }
      >
        <div className="form-item">
          <label className="form-label">补充申诉理由 <span style={{ color: '#ff4d4f' }}>*</span></label>
          <textarea
            className="form-textarea"
            value={appealText}
            onChange={(e) => setAppealText(e.target.value)}
            placeholder="请补充申诉材料和说明..."
            style={{ minHeight: '120px' }}
          />
        </div>
      </Modal>

      <Modal
        title="申诉通过"
        visible={approveAppealModal}
        onClose={() => setApproveAppealModal(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setApproveAppealModal(false)}>取消</button>
            <button
              className="btn btn-success"
              onClick={handleApproveAppeal}
              disabled={processing}
            >
              {processing ? '处理中...' : '确认通过'}
            </button>
          </>
        }
      >
        <div className="form-item">
          <label className="form-label">预约单目标状态 <span style={{ color: '#ff4d4f' }}>*</span></label>
          <select
            className="form-input"
            value={targetOrderStatus}
            onChange={(e) => setTargetOrderStatus(e.target.value)}
          >
            <option value="">请选择</option>
            <option value="pending_verification">待票务核销</option>
            <option value="verified">已核销待入园</option>
            <option value="entered">已入园待归档</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div className="form-item">
          <label className="form-label">复核意见</label>
          <textarea
            className="form-textarea"
            value={appealText}
            onChange={(e) => setAppealText(e.target.value)}
            placeholder="请输入复核意见..."
          />
        </div>
      </Modal>

      <Modal
        title="申诉驳回"
        visible={denyAppealModal}
        onClose={() => setDenyAppealModal(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setDenyAppealModal(false)}>取消</button>
            <button
              className="btn btn-danger"
              onClick={handleDenyAppeal}
              disabled={processing}
            >
              {processing ? '处理中...' : '确认驳回'}
            </button>
          </>
        }
      >
        <div className="form-item">
          <label className="form-label">驳回原因 <span style={{ color: '#ff4d4f' }}>*</span></label>
          <textarea
            className="form-textarea"
            value={appealText}
            onChange={(e) => setAppealText(e.target.value)}
            placeholder="请详细说明驳回原因..."
            style={{ minHeight: '120px' }}
          />
        </div>
        <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
          驳回后预约单将回到原状态：
          <strong style={{ color: '#333' }}>
            {currentAppeal ? statusNameMap[currentAppeal.original_status] : ''}
          </strong>
        </div>
      </Modal>
    </div>
  )
}
