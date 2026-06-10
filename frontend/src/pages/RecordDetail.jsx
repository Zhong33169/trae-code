import { useState, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { api, formatDateTime, formatDuration } from '../utils/api.js'

export default function RecordDetail({ user, id }) {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionType, setActionType] = useState('')
  const [recordBatches, setRecordBatches] = useState([])
  const [formData, setFormData] = useState({
    temperature: '',
    mental_status: '',
    skin_condition: '',
    throat_condition: '',
    hand_foot_condition: '',
    other_symptoms: '',
    registration_note: '',
    audit_note: '',
    review_note: '',
    abnormal_reason: '',
  })

  const loadDetail = async () => {
    setLoading(true)
    try {
      const res = await api.getRecord(id)
      setRecord(res)
      setFormData({
        temperature: res.temperature || '',
        mental_status: res.mental_status || '',
        skin_condition: res.skin_condition || '',
        throat_condition: res.throat_condition || '',
        hand_foot_condition: res.hand_foot_condition || '',
        other_symptoms: res.other_symptoms || '',
        registration_note: res.registration_note || '',
        audit_note: res.audit_note || '',
        review_note: res.review_note || '',
        abnormal_reason: '',
      })
      loadBatches()
    } catch (err) {
      alert(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadBatches = async () => {
    try {
      const res = await api.getRecordBatches(id)
      setRecordBatches(res.list || [])
    } catch (err) {
      console.error('加载批次历史失败:', err)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id])

  const canDoAction = (action) => {
    if (!record?.available_actions) return false
    return record.available_actions.some(a => a.action === action)
  }

  const hasAnyAction = () => {
    return record?.available_actions?.length > 0
  }

  const handleSubmitAudit = async () => {
    if (!formData.temperature) {
      alert('请填写体温')
      return
    }
    setActionLoading(true)
    try {
      await api.submitAudit(id, {
        temperature: parseFloat(formData.temperature) || null,
        mental_status: formData.mental_status,
        skin_condition: formData.skin_condition,
        throat_condition: formData.throat_condition,
        hand_foot_condition: formData.hand_foot_condition,
        other_symptoms: formData.other_symptoms,
        registration_note: formData.registration_note,
      })
      alert('提交审核成功')
      setActionType('')
      loadDetail()
    } catch (err) {
      alert(err.message || '提交失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAuditPass = async () => {
    setActionLoading(true)
    try {
      await api.auditPass(id, {
        audit_note: formData.audit_note,
      })
      alert('审核通过')
      setActionType('')
      loadDetail()
    } catch (err) {
      alert(err.message || '操作失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAuditReject = async () => {
    if (!formData.abnormal_reason) {
      alert('请填写异常原因')
      return
    }
    setActionLoading(true)
    try {
      await api.auditReject(id, {
        audit_note: formData.audit_note,
        abnormal_reason: formData.abnormal_reason,
      })
      alert('已退回补正')
      setActionType('')
      loadDetail()
    } catch (err) {
      alert(err.message || '操作失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReviewPass = async () => {
    setActionLoading(true)
    try {
      await api.reviewPass(id, {
        review_note: formData.review_note,
      })
      alert('复核通过，已归档')
      setActionType('')
      loadDetail()
    } catch (err) {
      alert(err.message || '操作失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReviewReject = async () => {
    if (!formData.abnormal_reason) {
      alert('请填写异常原因')
      return
    }
    setActionLoading(true)
    try {
      await api.reviewReject(id, {
        review_note: formData.review_note,
        abnormal_reason: formData.abnormal_reason,
      })
      alert('已退回重审')
      setActionType('')
      loadDetail()
    } catch (err) {
      alert(err.message || '操作失败')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="card">加载中...</div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="page-content">
        <div className="card">记录不存在</div>
      </div>
    )
  }

  const nodes = [
    { key: 'registration', name: '登记节点', status: 'done' },
    { key: 'audit', name: '审核节点', status: 'pending' },
    { key: 'review', name: '复核节点', status: 'pending' },
    { key: 'completed', name: '已归档', status: 'pending' },
  ]

  if (record.status === 'pending_registration' || record.status === 'pending_correction') {
    nodes[0].status = 'active'
    if (record.timeout?.isTimeout) nodes[0].status = 'timeout'
  } else if (record.status === 'pending_audit') {
    nodes[0].status = 'done'
    nodes[1].status = 'active'
    if (record.timeout?.isTimeout) nodes[1].status = 'timeout'
  } else if (record.status === 'pending_review') {
    nodes[0].status = 'done'
    nodes[1].status = 'done'
    nodes[2].status = 'active'
    if (record.timeout?.isTimeout) nodes[2].status = 'timeout'
  } else if (record.status === 'archived') {
    nodes.forEach(n => n.status = 'done')
    nodes[3].status = 'done'
  }

  const showRegistrationForm = canDoAction('submit_audit') && actionType === 'edit'
  const showAuditForm = (canDoAction('audit_pass') || canDoAction('audit_reject')) && actionType === 'audit'
  const showReviewForm = (canDoAction('review_pass') || canDoAction('review_reject')) && actionType === 'review'

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-small" onClick={() => route('/records')}>← 返回</button>
          <h1>晨检记录详情</h1>
          <span className={`status-tag status-${record.status}`}>
            {record.status_name}
          </span>
        </div>
        <div>
          {record.timeout?.isTimeout && record.status !== 'archived' && (
            <span className="timeout-tag" style={{ marginRight: '12px' }}>
              ⚠️ {record.current_node_name}已超时 {formatDuration(record.timeout.overdueMs)}
            </span>
          )}
          <button className="btn btn-small" onClick={loadDetail}>刷新</button>
        </div>
      </div>

      <div className="page-content">
        {record.abnormal_reason && (
          <div className="alert alert-warning">
            <strong>异常原因：</strong>{record.abnormal_reason}
            {record.abnormal_by_name && (
              <span style={{ marginLeft: '12px', fontSize: '13px', opacity: 0.8 }}>
                （责任人：{record.abnormal_by_name}）
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div>
            <div className="card">
              <h3 className="section-title">幼儿信息</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="label">姓名</span>
                  <span className="value">{record.child_name}</span>
                </div>
                <div className="detail-item">
                  <span className="label">性别</span>
                  <span className="value">{record.child_gender || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">出生日期</span>
                  <span className="value">{record.birth_date || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">班级</span>
                  <span className="value">{record.class_name}</span>
                </div>
                <div className="detail-item">
                  <span className="label">监护人</span>
                  <span className="value">{record.guardian_name || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">联系电话</span>
                  <span className="value">{record.guardian_phone || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">健康状况</span>
                  <span className="value">{record.child_health_status}</span>
                </div>
                <div className="detail-item">
                  <span className="label">检查日期</span>
                  <span className="value">{record.check_date}</span>
                </div>
              </div>
            </div>

            {record.temperature !== undefined && (
              <div className="card">
                <h3 className="section-title">晨检信息</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">体温</span>
                    <span className="value">{record.temperature ? record.temperature + '℃' : '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">精神状态</span>
                    <span className="value">{record.mental_status || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">皮肤情况</span>
                    <span className="value">{record.skin_condition || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">咽喉情况</span>
                    <span className="value">{record.throat_condition || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">手足情况</span>
                    <span className="value">{record.hand_foot_condition || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">其他症状</span>
                    <span className="value">{record.other_symptoms || '-'}</span>
                  </div>
                </div>
                {(record.registration_note || record.audit_note || record.review_note) && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #ebeef5' }}>
                    {record.registration_note && (
                      <div className="detail-item" style={{ marginBottom: '8px' }}>
                        <span className="label">登记备注</span>
                        <span className="value">{record.registration_note}</span>
                      </div>
                    )}
                    {record.audit_note && (
                      <div className="detail-item" style={{ marginBottom: '8px' }}>
                        <span className="label">审核意见</span>
                        <span className="value">{record.audit_note}</span>
                      </div>
                    )}
                    {record.review_note && (
                      <div className="detail-item">
                        <span className="label">复核意见</span>
                        <span className="value">{record.review_note}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {showRegistrationForm && (
              <div className="card">
                <h3 className="section-title">
                  {record.status === 'pending_correction' ? '补正登记' : '登记信息'}
                </h3>
                <div className="form-row">
                  <div className="form-item">
                    <label>体温 (℃)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature}
                      onInput={(e) => setFormData({ ...formData, temperature: e.target.value })}
                      placeholder="如 36.5"
                    />
                  </div>
                  <div className="form-item">
                    <label>精神状态</label>
                    <select
                      value={formData.mental_status}
                      onChange={(e) => setFormData({ ...formData, mental_status: e.target.value })}
                    >
                      <option value="">请选择</option>
                      <option value="良好">良好</option>
                      <option value="一般">一般</option>
                      <option value="较差">较差</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-item">
                    <label>皮肤情况</label>
                    <select
                      value={formData.skin_condition}
                      onChange={(e) => setFormData({ ...formData, skin_condition: e.target.value })}
                    >
                      <option value="">请选择</option>
                      <option value="正常">正常</option>
                      <option value="皮疹">皮疹</option>
                      <option value="黄疸">黄疸</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="form-item">
                    <label>咽喉情况</label>
                    <select
                      value={formData.throat_condition}
                      onChange={(e) => setFormData({ ...formData, throat_condition: e.target.value })}
                    >
                      <option value="">请选择</option>
                      <option value="正常">正常</option>
                      <option value="红肿">红肿</option>
                      <option value="化脓">化脓</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-item">
                    <label>手足情况</label>
                    <select
                      value={formData.hand_foot_condition}
                      onChange={(e) => setFormData({ ...formData, hand_foot_condition: e.target.value })}
                    >
                      <option value="">请选择</option>
                      <option value="正常">正常</option>
                      <option value="疱疹">疱疹</option>
                      <option value="皮疹">皮疹</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="form-item">
                    <label>其他症状</label>
                    <input
                      type="text"
                      value={formData.other_symptoms}
                      onInput={(e) => setFormData({ ...formData, other_symptoms: e.target.value })}
                      placeholder="如有请描述"
                    />
                  </div>
                </div>
                <div className="form-item">
                  <label>登记备注</label>
                  <textarea
                    value={formData.registration_note}
                    onInput={(e) => setFormData({ ...formData, registration_note: e.target.value })}
                    placeholder="登记备注信息"
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn" onClick={() => setActionType('')}>取消</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmitAudit}
                    disabled={actionLoading}
                    style={{ marginLeft: '8px' }}
                  >
                    {actionLoading ? '提交中...' : '提交审核'}
                  </button>
                </div>
              </div>
            )}

            {showAuditForm && (
              <div className="card">
                <h3 className="section-title">审核处理</h3>
                <div className="form-item">
                  <label>审核意见</label>
                  <textarea
                    value={formData.audit_note}
                    onInput={(e) => setFormData({ ...formData, audit_note: e.target.value })}
                    placeholder="请填写审核意见（选填）"
                  />
                </div>
                <div className="form-item">
                  <label style={{ color: '#f56c6c' }}>* 异常原因（退回时必填）</label>
                  <textarea
                    value={formData.abnormal_reason}
                    onInput={(e) => setFormData({ ...formData, abnormal_reason: e.target.value })}
                    placeholder="退回补正必须填写异常原因"
                    style={{ borderColor: '#fbc4c4' }}
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn" onClick={() => setActionType('')}>取消</button>
                  <button
                    className="btn btn-warning"
                    onClick={handleAuditReject}
                    disabled={actionLoading}
                    style={{ marginLeft: '8px' }}
                  >
                    {actionLoading ? '处理中...' : '退回补正'}
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleAuditPass}
                    disabled={actionLoading}
                    style={{ marginLeft: '8px' }}
                  >
                    {actionLoading ? '处理中...' : '审核通过'}
                  </button>
                </div>
              </div>
            )}

            {showReviewForm && (
              <div className="card">
                <h3 className="section-title">复核处理</h3>
                <div className="form-item">
                  <label>复核意见</label>
                  <textarea
                    value={formData.review_note}
                    onInput={(e) => setFormData({ ...formData, review_note: e.target.value })}
                    placeholder="请填写复核意见（选填）"
                  />
                </div>
                <div className="form-item">
                  <label style={{ color: '#f56c6c' }}>* 异常原因（退回时必填）</label>
                  <textarea
                    value={formData.abnormal_reason}
                    onInput={(e) => setFormData({ ...formData, abnormal_reason: e.target.value })}
                    placeholder="退回重审必须填写异常原因"
                    style={{ borderColor: '#fbc4c4' }}
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn" onClick={() => setActionType('')}>取消</button>
                  <button
                    className="btn btn-warning"
                    onClick={handleReviewReject}
                    disabled={actionLoading}
                    style={{ marginLeft: '8px' }}
                  >
                    {actionLoading ? '处理中...' : '退回重审'}
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleReviewPass}
                    disabled={actionLoading}
                    style={{ marginLeft: '8px' }}
                  >
                    {actionLoading ? '处理中...' : '复核归档'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="card">
              <h3 className="section-title">处理节点</h3>
              <ul className="node-timeline">
                {nodes.map((node, idx) => (
                  <li key={node.key} className={node.status}>
                    <div className="node-name">
                      {node.name}
                      {node.status === 'done' && ' ✓'}
                      {node.status === 'timeout' && ' ⚠️'}
                    </div>
                    {node.key === 'registration' && record.registered_at && (
                      <div className="node-time">登记于 {formatDateTime(record.registered_at)}</div>
                    )}
                    {node.key === 'audit' && record.audit_submitted_at && record.status !== 'pending_correction' && (
                      <div className="node-time">提交于 {formatDateTime(record.audit_submitted_at)}</div>
                    )}
                    {node.key === 'review' && record.review_submitted_at && (
                      <div className="node-time">提交于 {formatDateTime(record.review_submitted_at)}</div>
                    )}
                    {node.key === 'completed' && record.review_completed_at && (
                      <div className="node-time">归档于 {formatDateTime(record.review_completed_at)}</div>
                    )}
                    {node.status === 'timeout' && record.timeout && (
                      <div className="node-timeout">
                        已超时 {formatDuration(record.timeout.overdueMs)}
                      </div>
                    )}
                    {node.status === 'active' && record.timeout && !record.timeout.isTimeout && (
                      <div className="node-time" style={{ color: '#67c23a' }}>
                        剩余 {formatDuration(record.timeout.remainingMs)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h3 className="section-title">操作按钮</h3>
              {hasAnyAction() && !actionType && (
                <>
                  {canDoAction('submit_audit') && (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginBottom: '10px' }}
                      onClick={() => setActionType('edit')}
                    >
                      {record.status === 'pending_correction' ? '补正并提交审核' : '登记并提交审核'}
                    </button>
                  )}
                  {(canDoAction('audit_pass') || canDoAction('audit_reject')) && (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginBottom: '10px' }}
                      onClick={() => setActionType('audit')}
                    >
                      处理审核
                    </button>
                  )}
                  {(canDoAction('review_pass') || canDoAction('review_reject')) && (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginBottom: '10px' }}
                      onClick={() => setActionType('review')}
                    >
                      处理复核
                    </button>
                  )}
                </>
              )}
              {!hasAnyAction() && (
                <div style={{ color: '#909399', fontSize: '13px', textAlign: 'center' }}>
                  当前状态下您没有可执行的操作
                </div>
              )}
            </div>

            {record.status !== 'archived' && (
              <div className="card">
                <h3 className="section-title">责任信息</h3>
                <div className="detail-item" style={{ marginBottom: '8px' }}>
                  <span className="label">责任岗位</span>
                  <span className="value">
                    <span className={`role-badge role-${record.responsible_role}`}>
                      {record.responsible_role_name || '-'}
                    </span>
                  </span>
                </div>
                {record.responsible_user_name && (
                  <div className="detail-item" style={{ marginBottom: '8px' }}>
                    <span className="label">责任人</span>
                    <span className="value">{record.responsible_user_name}</span>
                  </div>
                )}
                {record.responsible_action_tip && (
                  <div className="detail-item">
                    <span className="label">补正提示</span>
                    <span className="value" style={{ color: '#e6a23c' }}>
                      {record.responsible_action_tip}
                    </span>
                  </div>
                )}
                {record.timeout?.isTimeout && (
                  <div style={{ marginTop: '12px', padding: '8px 12px', background: '#fef0f0', borderRadius: '4px', fontSize: '13px', color: '#f56c6c' }}>
                    ⚠️ 当前节点已超时 {formatDuration(record.timeout.overdueMs)}
                  </div>
                )}
              </div>
            )}

            {recordBatches.length > 0 && (
              <div className="card">
                <h3 className="section-title">批量处理历史</h3>
                {recordBatches.map(b => (
                  <div key={b.id} className="log-item">
                    <div className="log-header">
                      <span className={`batch-result ${b.result}`}>
                        {b.result_name}
                      </span>
                      <span className="log-time">{formatDateTime(b.batch_created_at)}</span>
                    </div>
                    <div className="log-user">
                      {b.batch_type_name} · {b.operator_name}
                    </div>
                    <div className="log-status" style={{ fontSize: '12px', color: '#909399' }}>
                      批次号：{b.batch_no}
                    </div>
                    {b.from_status && b.to_status && (
                      <div className="log-status">
                        {b.from_status_name} → {b.to_status_name}
                      </div>
                    )}
                    {b.error_message && (
                      <div className="log-note" style={{ color: '#f56c6c' }}>
                        失败原因：{b.error_message}
                      </div>
                    )}
                    {b.remark && (
                      <div className="log-note">备注：{b.remark}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="card">
              <h3 className="section-title">操作记录</h3>
              {record.operation_logs?.length === 0 ? (
                <div className="empty">暂无操作记录</div>
              ) : (
                record.operation_logs?.map(log => (
                  <div key={log.id} className="log-item">
                    <div className="log-header">
                      <span className="log-action">{log.action}</span>
                      <span className="log-time">{formatDateTime(log.created_at)}</span>
                    </div>
                    <div className="log-user">
                      {log.user_name}（{log.user_role === 'registrar' ? '登记员' : log.user_role === 'auditor' ? '审核主管' : '复核负责人'}）
                    </div>
                    {log.from_status && log.to_status && (
                      <div className="log-status">
                        {log.from_status} → {log.to_status}
                      </div>
                    )}
                    {log.note && (
                      <div className="log-note">{log.note}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
