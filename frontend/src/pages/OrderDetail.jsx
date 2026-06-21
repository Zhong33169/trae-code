import { useState, useEffect } from 'preact/hooks'
import { getOrder, processOrder, uploadAttachment, rejectAttachment, approveAttachment, deleteAttachment } from '../api/client.js'
import { STATUS_MAP, ATTACHMENT_STATUS_MAP, ROLE_MAP, formatDate, formatFileSize, isOverdue } from '../utils/constants.js'

export default function OrderDetail(props) {
  const orderId = props.id
  const onNavigate = props.onNavigate || ((path) => { window.location.href = path })
  const onBack = props.onBack || (() => { window.history.back() })
  const [order, setOrder] = useState(null)
  const [activeTab, setActiveTab] = useState('basic')
  const [currentUser, setCurrentUser] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [showActionModal, setShowActionModal] = useState(null)
  const [actionForm, setActionForm] = useState({ reason: '', remark: '', result: '' })

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || 'null')
      setCurrentUser(user)
    } catch (e) {
      setCurrentUser({ id: 1, name: '李登记', role: 'registrar' })
    }
  }, [])

  useEffect(() => {
    loadOrder()
  }, [orderId])

  async function loadOrder() {
    const data = await getOrder(orderId)
    setOrder(data)
  }

  function handleAction(action) {
    setShowActionModal(action)
    setActionForm({ reason: '', remark: '', result: '' })
  }

  async function submitAction() {
    if (!showActionModal) return
    setProcessing(true)

    const data = {
      action: showActionModal,
      reason: actionForm.reason,
      remark: actionForm.remark,
      result: actionForm.result
    }

    const res = await processOrder(orderId, data)
    setProcessing(false)

    if (res.id || res.status) {
      setShowActionModal(null)
      loadOrder()
    } else {
      alert(res.error || '操作失败')
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessing(true)
    const res = await uploadAttachment(orderId, file)
    setProcessing(false)
    if (res.id) {
      loadOrder()
    } else {
      alert(res.error || '上传失败')
    }
  }

  async function handleRejectAttachment(attId) {
    const reason = prompt('请输入驳回原因:')
    if (!reason) return
    const res = await rejectAttachment(attId, reason)
    if (res.id) {
      loadOrder()
    }
  }

  async function handleApproveAttachment(attId) {
    const res = await approveAttachment(attId)
    if (res.id) {
      loadOrder()
    }
  }

  async function handleDeleteAttachment(attId) {
    if (!confirm('确定删除此附件？')) return
    const res = await deleteAttachment(attId)
    if (res.message) {
      loadOrder()
    }
  }

  if (!order || !currentUser) {
    return <div className="section-card">加载中...</div>
  }

  const canUpload = currentUser.role === 'registrar' &&
    (order.status === 'draft' || order.status === 'supplement' || order.status === 'returned')

  const canAuditAttachment = (currentUser.role === 'auditor' || currentUser.role === 'reviewer') &&
    (order.status === 'processing' || order.status === 'review')

  const actions = getAvailableActions(order.status, currentUser.role)

  const hasRejectedAttachment = order.attachments?.some(a => a.status === 'rejected')
  const hasNoAttachment = !order.attachments || order.attachments.length === 0

  return (
    <div>
      <div className="breadcrumb">
        <span className="breadcrumb-link" onClick={onBack}>返回列表</span>
        <span>/</span>
        <span>服务单详情</span>
      </div>

      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ marginBottom: '8px' }}>{order.order_no}</h2>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span className="status-tag" style={{
                background: STATUS_MAP[order.status]?.color + '20',
                color: STATUS_MAP[order.status]?.color,
                fontSize: '14px',
                padding: '4px 12px'
              }}>
                {STATUS_MAP[order.status]?.label}
              </span>
              <span style={{ color: '#888', fontSize: '13px' }}>
                当前处理人: {order.handler_name || '无'}
              </span>
              {order.due_at && (
                <span style={{
                  color: isOverdue(order.due_at) ? '#f5222d' : '#888',
                  fontSize: '13px'
                }}>
                  截止时间: {formatDate(order.due_at)}
                  {isOverdue(order.due_at) && ' (已超时)'}
                </span>
              )}
            </div>
          </div>
          <div className="action-bar">
            {actions.map(action => (
              <button
                key={action.key}
                className={`btn ${action.type === 'danger' ? 'btn-danger' : action.type === 'default' ? 'btn-default' : 'btn-primary'}`}
                onClick={() => handleAction(action.key)}
                disabled={action.disabled}
                title={action.disabled ? action.disabledReason : ''}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(order.reject_reason || order.return_reason) && (
        <div className="alert alert-error">
          <strong>驳回/退回原因：</strong>
          {order.reject_reason || order.return_reason}
        </div>
      )}

      {hasRejectedAttachment && (order.status === 'supplement' || order.status === 'returned') && (
        <div className="alert alert-warning">
          <strong>附件异常：</strong>
          存在被驳回的附件，请修正后重新提交
        </div>
      )}

      <div className="tabs">
        <div
          className={`tab-item ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          基本信息
        </div>
        <div
          className={`tab-item ${activeTab === 'attachments' ? 'active' : ''}`}
          onClick={() => setActiveTab('attachments')}
        >
          附件材料 ({order.attachments?.length || 0})
        </div>
        <div
          className={`tab-item ${activeTab === 'result' ? 'active' : ''}`}
          onClick={() => setActiveTab('result')}
        >
          处理结果
        </div>
        <div
          className={`tab-item ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          操作记录/审计
        </div>
      </div>

      {activeTab === 'basic' && (
        <div className="section-card">
          <div className="detail-section">
            <div className="detail-title">会员信息</div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">会员姓名</span>
                <span className="detail-value">{order.member_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">联系电话</span>
                <span className="detail-value">{order.member_phone}</span>
              </div>
            </div>
          </div>
          <div className="detail-section">
            <div className="detail-title">服务信息</div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">服务类型</span>
                <span className="detail-value">{order.service_type}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">优先级</span>
                <span className="detail-value">{order.priority === 'high' ? '高' : order.priority === 'low' ? '低' : '普通'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">创建人</span>
                <span className="detail-value">{order.created_by_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">创建时间</span>
                <span className="detail-value">{formatDate(order.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="detail-section">
            <div className="detail-title">服务说明</div>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '4px', lineHeight: '1.6' }}>
              {order.description || '无'}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'attachments' && (
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div className="detail-title" style={{ marginBottom: 0, borderLeft: 'none', paddingLeft: 0 }}>
              附件材料
            </div>
            {canUpload && (
              <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
                + 上传附件
                <input
                  type="file"
                  style={{ display: 'none' }}
                  onChange={handleUpload}
                  disabled={processing}
                />
              </label>
            )}
          </div>

          {order.attachments?.length > 0 ? (
            <div className="attachment-list">
              {order.attachments.map(att => (
                <div key={att.id} className="attachment-item">
                  <div className="attachment-icon">📄</div>
                  <div className="attachment-info">
                    <div className="attachment-name">{att.file_name}</div>
                    <div className="attachment-meta">
                      {formatFileSize(att.file_size)} · 上传人: {att.uploaded_by_name} · {formatDate(att.created_at)}
                    </div>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="status-tag" style={{
                        background: ATTACHMENT_STATUS_MAP[att.status]?.color + '20',
                        color: ATTACHMENT_STATUS_MAP[att.status]?.color
                      }}>
                        {ATTACHMENT_STATUS_MAP[att.status]?.label}
                      </span>
                    </div>
                    {att.status === 'rejected' && att.reject_reason && (
                      <div className="reject-reason">
                        驳回原因: {att.reject_reason}
                      </div>
                    )}
                  </div>
                  <div className="attachment-actions">
                    {canAuditAttachment && att.status === 'pending' && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => handleApproveAttachment(att.id)}>
                          通过
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleRejectAttachment(att.id)}>
                          驳回
                        </button>
                      </>
                    )}
                    {canUpload && att.status === 'rejected' && (
                      <button className="btn btn-default btn-sm" onClick={() => handleDeleteAttachment(att.id)}>
                        删除重传
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">暂无附件</div>
          )}
        </div>
      )}

      {activeTab === 'result' && (
        <div className="section-card">
          <div className="detail-section">
            <div className="detail-title">处理结果</div>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '4px', lineHeight: '1.6', minHeight: '60px' }}>
              {order.result || '暂无处理结果'}
            </div>
          </div>
          <div className="detail-section">
            <div className="detail-title">审计备注</div>
            <div style={{ padding: '12px', background: '#fafafa', borderRadius: '4px', lineHeight: '1.6', minHeight: '60px' }}>
              {order.audit_remark || '暂无审计备注'}
            </div>
          </div>
          {order.completed_at && (
            <div className="detail-section">
              <div className="detail-title">完成时间</div>
              <div style={{ color: '#52c41a', fontWeight: '500' }}>
                {formatDate(order.completed_at)}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="section-card">
          <div className="detail-title">操作记录/审计日志</div>
          {order.logs?.length > 0 ? (
            <div className="log-list">
              {order.logs.map(log => (
                <div key={log.id} className="log-item">
                  <div className="log-time">{formatDate(log.created_at)}</div>
                  <div className="log-content">
                    <div className="log-action">
                      <span className="dot" style={{ background: ROLE_MAP[log.role]?.color || '#999' }}></span>
                      <strong>{log.action}</strong>
                      <span className="log-operator">
                        {log.operator} ({ROLE_MAP[log.role]?.label || log.role})
                      </span>
                    </div>
                    {log.remark && (
                      <div className="log-remark">{log.remark}</div>
                    )}
                    {log.from_status && log.to_status && (
                      <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                        状态: {STATUS_MAP[log.from_status]?.label || log.from_status} → {STATUS_MAP[log.to_status]?.label || log.to_status}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">暂无操作记录</div>
          )}
        </div>
      )}

      {showActionModal && (
        <div className="modal-overlay" onClick={() => setShowActionModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{getActionModalTitle(showActionModal)}</span>
              <span className="modal-close" onClick={() => setShowActionModal(null)}>&times;</span>
            </div>
            <div className="modal-body">
              {['return_supplement', 'reject', 'review_return'].includes(showActionModal) && (
                <div className="form-item">
                  <label className="form-label required">{getReasonLabel(showActionModal)}</label>
                  <textarea
                    className="form-textarea"
                    value={actionForm.reason}
                    onInput={e => setActionForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="请输入原因"
                  />
                </div>
              )}
              {showActionModal === 'approve' && (
                <div className="form-item">
                  <label className="form-label">处理结果</label>
                  <textarea
                    className="form-textarea"
                    value={actionForm.result}
                    onInput={e => setActionForm(f => ({ ...f, result: e.target.value }))}
                    placeholder="请输入处理结果"
                  />
                </div>
              )}
              {['review_approve', 'submit', 'start_process'].includes(showActionModal) && (
                <div className="form-item">
                  <label className="form-label">备注</label>
                  <textarea
                    className="form-textarea"
                    value={actionForm.remark}
                    onInput={e => setActionForm(f => ({ ...f, remark: e.target.value }))}
                    placeholder="请输入备注（选填）"
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowActionModal(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={submitAction}
                disabled={processing}
              >
                {processing ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getAvailableActions(status, role) {
  const actions = []

  if (role === 'registrar') {
    if (status === 'draft' || status === 'supplement' || status === 'returned') {
      actions.push({ key: 'submit', label: '提交审核', type: 'primary' })
    }
  }

  if (role === 'auditor') {
    if (status === 'pending') {
      actions.push({ key: 'start_process', label: '开始审核', type: 'primary' })
    }
    if (status === 'processing') {
      actions.push({ key: 'approve', label: '审核通过', type: 'primary' })
      actions.push({ key: 'return_supplement', label: '退回补正', type: 'default' })
      actions.push({ key: 'reject', label: '驳回', type: 'danger' })
    }
  }

  if (role === 'reviewer') {
    if (status === 'review') {
      actions.push({ key: 'review_approve', label: '复核归档', type: 'primary' })
      actions.push({ key: 'review_return', label: '退回补正', type: 'danger' })
    }
  }

  return actions
}

function getActionModalTitle(action) {
  const titles = {
    submit: '提交审核确认',
    start_process: '开始审核确认',
    approve: '审核通过',
    reject: '驳回确认',
    return_supplement: '退回补正确认',
    review_approve: '复核归档确认',
    review_return: '复核退回确认'
  }
  return titles[action] || '操作确认'
}

function getReasonLabel(action) {
  const labels = {
    reject: '驳回原因',
    return_supplement: '退补原因',
    review_return: '退回原因'
  }
  return labels[action] || '原因'
}
