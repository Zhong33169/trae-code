import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api'
import Modal from '../components/Modal'
import {
  getStatusInfo,
  getAnomalyInfo,
  getRoleInfo,
  MATERIAL_ITEMS,
  OFFLINE_STATUS_OPTIONS,
} from '../utils/constants'

export default function OrderDetail({ currentRole, currentUser }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [activeTab, setActiveTab] = useState('info')

  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnAuditRemark, setReturnAuditRemark] = useState('')

  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewResultRemark, setReviewResultRemark] = useState('')
  const [reviewAuditRemark, setReviewAuditRemark] = useState('')

  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({})

  const [showAttachmentModal, setShowAttachmentModal] = useState(false)
  const [newAttachment, setNewAttachment] = useState({
    file_name: '',
    file_type: 'pdf',
    remark: '',
  })

  const fetchOrder = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getOrderDetail(id)
      setOrder(data)
      setEditForm({
        patient_name: data.patient_name,
        patient_id_card: data.patient_id_card,
        batch_no: data.batch_no,
        lens_type: data.lens_type,
        lens_power: data.lens_power,
        frame_model: data.frame_model,
        prescription_no: data.prescription_no,
        has_prescription: data.has_prescription,
        has_insurance: data.has_insurance,
        has_id_copy: data.has_id_copy,
        has_receipt: data.has_receipt,
        offline_status: data.offline_status,
      })
    } catch (err) {
      showMessage(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleSubmit = async () => {
    try {
      await api.submitOrder(id)
      showMessage('提交审核成功', 'success')
      fetchOrder()
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  const handleReviewPass = async () => {
    try {
      await api.reviewPass(id, {
        result_remark: reviewResultRemark,
        audit_remark: reviewAuditRemark,
      })
      showMessage('审核通过', 'success')
      setShowReviewModal(false)
      setReviewResultRemark('')
      setReviewAuditRemark('')
      fetchOrder()
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  const handleReviewReturn = async () => {
    if (!returnReason.trim()) {
      showMessage('请填写退回原因', 'error')
      return
    }
    try {
      await api.reviewReturn(id, {
        reason: returnReason,
        audit_remark: returnAuditRemark,
      })
      showMessage('已退回', 'success')
      setShowReturnModal(false)
      setReturnReason('')
      setReturnAuditRemark('')
      fetchOrder()
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  const handleFinalPass = async () => {
    try {
      await api.finalPass(id, {
        result_remark: reviewResultRemark,
        audit_remark: reviewAuditRemark,
      })
      showMessage('复核归档成功', 'success')
      setShowReviewModal(false)
      setReviewResultRemark('')
      setReviewAuditRemark('')
      fetchOrder()
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  const handleFinalReturn = async () => {
    if (!returnReason.trim()) {
      showMessage('请填写退回原因', 'error')
      return
    }
    try {
      await api.finalReturn(id, {
        reason: returnReason,
        audit_remark: returnAuditRemark,
      })
      showMessage('已退回', 'success')
      setShowReturnModal(false)
      setReturnReason('')
      setReturnAuditRemark('')
      fetchOrder()
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  const handleUpdateOrder = async () => {
    try {
      await api.updateOrder(id, editForm)
      showMessage('更新成功', 'success')
      setShowEditModal(false)
      fetchOrder()
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  const handleAddAttachment = async () => {
    if (!newAttachment.file_name.trim()) {
      showMessage('请填写文件名', 'error')
      return
    }
    try {
      await api.createAttachment(id, {
        ...newAttachment,
        file_size: Math.floor(Math.random() * 500000) + 10000,
        file_url: `/attachments/${id}/${newAttachment.file_name}`,
      })
      showMessage('上传成功', 'success')
      setShowAttachmentModal(false)
      setNewAttachment({ file_name: '', file_type: 'pdf', remark: '' })
      fetchOrder()
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  const handleDeleteAttachment = async (attachmentId) => {
    if (!confirm('确定要删除这个附件吗？')) return
    try {
      await api.deleteAttachment(id, attachmentId)
      showMessage('删除成功', 'success')
      fetchOrder()
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN')
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const canEdit = (order) => {
    if (!order) return false
    if (currentRole !== 'registrar' && currentRole !== 'supervisor') return false
    return order.status === 'pending_registration' || order.status === 'returned'
  }

  const getActions = (order) => {
    if (!order) return []
    const actions = []

    if (currentRole === 'registrar') {
      if (order.status === 'pending_registration' || order.status === 'returned') {
        actions.push({ label: '编辑', onClick: () => setShowEditModal(true), type: 'secondary' })
        actions.push({ label: '提交审核', onClick: handleSubmit, type: 'primary' })
      }
    }

    if (currentRole === 'supervisor') {
      if (order.status === 'pending_review') {
        actions.push({ label: '审核通过', onClick: () => setShowReviewModal(true), type: 'primary' })
        actions.push({ label: '审核退回', onClick: () => setShowReturnModal(true), type: 'danger' })
      }
    }

    if (currentRole === 'reviewer') {
      if (order.status === 'pending_final') {
        actions.push({ label: '复核归档', onClick: () => setShowReviewModal(true), type: 'primary' })
        actions.push({ label: '复核退回', onClick: () => setShowReturnModal(true), type: 'danger' })
      }
    }

    return actions
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  if (!order) {
    return <div className="error">订单不存在</div>
  }

  const statusInfo = getStatusInfo(order.status)
  const actions = getActions(order)
  const roleInfo = getRoleInfo(currentRole)
  const offlineStatusLabel = OFFLINE_STATUS_OPTIONS.find((s) => s.value === order.offline_status)?.label || order.offline_status

  const tabs = [
    { key: 'info', label: '基本信息' },
    { key: 'materials', label: '材料附件' },
    { key: 'result', label: '结果与退回' },
    { key: 'audit', label: '审计日志' },
  ]

  return (
    <div className="order-detail-page">
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <div>
          <Link to="/" className="back-link">← 返回列表</Link>
          <h2>订单详情</h2>
          <p className="page-desc">
            订单号：<strong>{order.order_no}</strong>
            <span className="status-tag" style={{ background: statusInfo.color + '20', color: statusInfo.color, borderColor: statusInfo.color }}>
              {statusInfo.label}
            </span>
            {order.is_overdue && (
              <span className="status-tag" style={{ background: '#f5222d20', color: '#f5222d', borderColor: '#f5222d' }}>
                已超时
              </span>
            )}
          </p>
        </div>
        <div className="detail-actions">
          {actions.map((action, idx) => (
            <button
              key={idx}
              className={`btn ${action.type === 'primary' ? 'btn-primary' : action.type === 'danger' ? 'btn-danger' : 'btn-secondary'}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {order.anomaly_types && order.anomaly_types.length > 0 && (
        <div className="anomaly-alert">
          <div className="anomaly-alert-title">⚠ 异常提示</div>
          <div className="anomaly-alert-detail">{order.anomaly_remark}</div>
          <div className="anomaly-tags">
            {order.anomaly_types.map((type) => {
              const a = getAnomalyInfo(type)
              return (
                <span key={type} className="anomaly-tag" style={{ background: a.color + '20', color: a.color, borderColor: a.color }}>
                  {a.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      <div className="detail-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="detail-content">
        {activeTab === 'info' && (
          <div className="info-section">
            <div className="info-block">
              <h4>订单信息</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">订单编号</span>
                  <span className="info-value">{order.order_no}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">批次号</span>
                  <span className="info-value">{order.batch_no}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">线上状态</span>
                  <span className="info-value">
                    <span className="status-tag" style={{ background: statusInfo.color + '20', color: statusInfo.color, borderColor: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">线下台账状态</span>
                  <span className="info-value">{offlineStatusLabel}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">创建时间</span>
                  <span className="info-value">{formatDate(order.created_at)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">更新时间</span>
                  <span className="info-value">{formatDate(order.updated_at)}</span>
                </div>
              </div>
            </div>

            <div className="info-block">
              <h4>患者信息</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">患者姓名</span>
                  <span className="info-value">{order.patient_name || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">身份证号</span>
                  <span className="info-value">{order.patient_id_card || '-'}</span>
                </div>
              </div>
            </div>

            <div className="info-block">
              <h4>配镜信息</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">镜片类型</span>
                  <span className="info-value">{order.lens_type || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">镜片度数</span>
                  <span className="info-value">{order.lens_power || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">镜架型号</span>
                  <span className="info-value">{order.frame_model || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">处方单号</span>
                  <span className="info-value">{order.prescription_no || '-'}</span>
                </div>
              </div>
            </div>

            <div className="info-block">
              <h4>处理进度</h4>
              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-dot" style={{ background: order.registered_at ? '#52c41a' : '#d9d9d9' }}></div>
                  <div className="timeline-content">
                    <div className="timeline-title">登记</div>
                    <div className="timeline-desc">
                      {order.registered_by ? `${order.registered_by} · ${formatDate(order.registered_at)}` : '待处理'}
                    </div>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-dot" style={{ background: order.reviewed_at ? '#52c41a' : '#d9d9d9' }}></div>
                  <div className="timeline-content">
                    <div className="timeline-title">审核</div>
                    <div className="timeline-desc">
                      {order.reviewed_by ? `${order.reviewed_by} · ${formatDate(order.reviewed_at)}` : '待处理'}
                    </div>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-dot" style={{ background: order.finalized_at ? '#52c41a' : '#d9d9d9' }}></div>
                  <div className="timeline-content">
                    <div className="timeline-title">复核归档</div>
                    <div className="timeline-desc">
                      {order.finalized_by ? `${order.finalized_by} · ${formatDate(order.finalized_at)}` : '待处理'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="materials-section">
            <div className="info-block">
              <h4>
                材料清单
                {canEdit(order) && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAttachmentModal(true)}>
                    + 添加附件
                  </button>
                )}
              </h4>
              <div className="material-list">
                {MATERIAL_ITEMS.map((item) => (
                  <div key={item.key} className="material-item">
                    <span className={`material-check ${order[item.key] ? 'checked' : ''}`}>
                      {order[item.key] ? '✓' : '○'}
                    </span>
                    <span className="material-label">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-block">
              <h4>附件列表</h4>
              {order.attachments && order.attachments.length > 0 ? (
                <div className="attachment-list">
                  {order.attachments.map((att) => (
                    <div key={att.id} className="attachment-item">
                      <div className="attachment-icon">
                        {att.file_type === 'image' ? '🖼️' : '📄'}
                      </div>
                      <div className="attachment-info">
                        <div className="attachment-name">{att.file_name}</div>
                        <div className="attachment-meta">
                          {formatFileSize(att.file_size)} · {att.uploaded_by} · {formatDate(att.uploaded_at)}
                          {att.remark && ` · ${att.remark}`}
                        </div>
                      </div>
                      {canEdit(order) && (
                        <button className="link-btn link-danger" onClick={() => handleDeleteAttachment(att.id)}>
                          删除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">暂无附件</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'result' && (
          <div className="result-section">
            <div className="info-block">
              <h4>结果说明</h4>
              <div className="result-content">
                {order.result_remark || <span className="text-muted">暂无结果说明</span>}
              </div>
            </div>

            <div className="info-block">
              <h4>退回原因</h4>
              {order.status === 'returned' ? (
                <div className="return-info">
                  <div className="return-reason">{order.return_reason}</div>
                  <div className="return-meta">
                    退回人：{order.return_by} · 退回时间：{formatDate(order.return_at)}
                  </div>
                </div>
              ) : (
                <span className="text-muted">暂无退回记录</span>
              )}
            </div>

            <div className="info-block">
              <h4>审计备注</h4>
              <div className="audit-remark-content">
                {order.audit_remark || <span className="text-muted">暂无审计备注</span>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="audit-section">
            <div className="info-block">
              <h4>审计日志</h4>
              {order.audit_logs && order.audit_logs.length > 0 ? (
                <div className="audit-log-list">
                  {order.audit_logs.map((log) => (
                    <div key={log.id} className={`audit-log-item ${log.is_failure ? 'failure' : ''}`}>
                      <div className="audit-log-dot"></div>
                      <div className="audit-log-content">
                        <div className="audit-log-header">
                          <span className="audit-log-action">{log.action}</span>
                          {log.is_failure && <span className="audit-log-failure">失败</span>}
                          <span className="audit-log-role">{log.actor_role_label}</span>
                          <span className="audit-log-actor">{log.actor}</span>
                          <span className="audit-log-time">{formatDate(log.created_at)}</span>
                        </div>
                        {log.detail && <div className="audit-log-detail">详情：{log.detail}</div>}
                        {log.reason && <div className="audit-log-reason">原因：{log.reason}</div>}
                        {log.failure_reason && <div className="audit-log-failure-reason">失败原因：{log.failure_reason}</div>}
                        {log.status_before && (
                          <div className="audit-log-status">
                            状态：{log.status_before_label} → {log.status_after_label}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">暂无审计记录</div>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal
        title={currentRole === 'supervisor' ? '审核通过' : currentRole === 'reviewer' ? '复核归档' : '确认提交'}
        visible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onOk={currentRole === 'reviewer' ? handleFinalPass : handleReviewPass}
        okText="确认"
        width={500}
      >
        <div className="form-group">
          <label>结果说明</label>
          <textarea
            value={reviewResultRemark}
            onChange={(e) => setReviewResultRemark(e.target.value)}
            placeholder="请输入结果说明（可选）"
            rows={3}
          />
        </div>
        <div className="form-group">
          <label>审计备注</label>
          <textarea
            value={reviewAuditRemark}
            onChange={(e) => setReviewAuditRemark(e.target.value)}
            placeholder="请输入审计备注（可选）"
            rows={2}
          />
        </div>
      </Modal>

      <Modal
        title={currentRole === 'supervisor' ? '审核退回' : '复核退回'}
        visible={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onOk={currentRole === 'reviewer' ? handleFinalReturn : handleReviewReturn}
        okText="确认退回"
        width={500}
      >
        <div className="form-group">
          <label>退回原因 *</label>
          <textarea
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="请详细说明退回原因"
            rows={4}
          />
        </div>
        <div className="form-group">
          <label>审计备注</label>
          <textarea
            value={returnAuditRemark}
            onChange={(e) => setReturnAuditRemark(e.target.value)}
            placeholder="请输入审计备注（可选）"
            rows={2}
          />
        </div>
      </Modal>

      <Modal
        title="编辑订单"
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onOk={handleUpdateOrder}
        okText="保存"
        width={600}
      >
        <div className="form-grid">
          <div className="form-group">
            <label>患者姓名 *</label>
            <input
              type="text"
              value={editForm.patient_name || ''}
              onChange={(e) => setEditForm({ ...editForm, patient_name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>身份证号</label>
            <input
              type="text"
              value={editForm.patient_id_card || ''}
              onChange={(e) => setEditForm({ ...editForm, patient_id_card: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>批次号</label>
            <input
              type="text"
              value={editForm.batch_no || ''}
              onChange={(e) => setEditForm({ ...editForm, batch_no: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>镜片类型</label>
            <input
              type="text"
              value={editForm.lens_type || ''}
              onChange={(e) => setEditForm({ ...editForm, lens_type: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>镜片度数</label>
            <input
              type="text"
              value={editForm.lens_power || ''}
              onChange={(e) => setEditForm({ ...editForm, lens_power: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>镜架型号</label>
            <input
              type="text"
              value={editForm.frame_model || ''}
              onChange={(e) => setEditForm({ ...editForm, frame_model: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>处方单号</label>
            <input
              type="text"
              value={editForm.prescription_no || ''}
              onChange={(e) => setEditForm({ ...editForm, prescription_no: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>线下台账状态</label>
            <select
              value={editForm.offline_status || 'not_recorded'}
              onChange={(e) => setEditForm({ ...editForm, offline_status: e.target.value })}
            >
              {OFFLINE_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>材料清单</label>
          <div className="checkbox-group">
            {MATERIAL_ITEMS.map((item) => (
              <label key={item.key} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={editForm[item.key] || false}
                  onChange={(e) => setEditForm({ ...editForm, [item.key]: e.target.checked })}
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        title="添加附件"
        visible={showAttachmentModal}
        onClose={() => setShowAttachmentModal(false)}
        onOk={handleAddAttachment}
        okText="上传"
        width={450}
      >
        <div className="form-group">
          <label>文件名 *</label>
          <input
            type="text"
            value={newAttachment.file_name}
            onChange={(e) => setNewAttachment({ ...newAttachment, file_name: e.target.value })}
            placeholder="例如：处方单_CF2026001.pdf"
          />
        </div>
        <div className="form-group">
          <label>文件类型</label>
          <select
            value={newAttachment.file_type}
            onChange={(e) => setNewAttachment({ ...newAttachment, file_type: e.target.value })}
          >
            <option value="pdf">PDF</option>
            <option value="image">图片</option>
            <option value="doc">文档</option>
          </select>
        </div>
        <div className="form-group">
          <label>备注</label>
          <input
            type="text"
            value={newAttachment.remark}
            onChange={(e) => setNewAttachment({ ...newAttachment, remark: e.target.value })}
            placeholder="可选"
          />
        </div>
      </Modal>
    </div>
  )
}
