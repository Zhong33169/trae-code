import { useState, useEffect } from 'preact/hooks'
import { getOrders, createOrder, batchProcessOrders } from '../api/client.js'
import { STATUS_MAP, PRIORITY_MAP, formatDate, isOverdue, ROLE_MAP, EXCEPTION_OPTIONS } from '../utils/constants.js'

export default function OrderList(props) {
  const defaultView = props.defaultView || 'all'
  const onNavigate = props.onNavigate || ((path) => { window.location.href = path })
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [status, setStatus] = useState(defaultView === 'all' ? '' : getDefaultStatus(defaultView))
  const [keyword, setKeyword] = useState('')
  const [exception, setException] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [stats, setStats] = useState({ pending: 0, processing: 0, completed: 0, overdue: 0 })
  const [exceptionStats, setExceptionStats] = useState({ overdue: 0, returned: 0, missing_material: 0, batch_failed: 0 })
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchAction, setBatchAction] = useState('')
  const [batchForm, setBatchForm] = useState({ reason: '', remark: '', result: '' })
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [batchResult, setBatchResult] = useState(null)
  const [showBatchResult, setShowBatchResult] = useState(false)

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || 'null')
      setCurrentUser(user)
    } catch (e) {
      setCurrentUser({ id: 1, name: '李登记', role: 'registrar' })
    }
  }, [])

  function getDefaultStatus(view) {
    switch (view) {
      case 'supplement': return 'supplement,returned'
      case 'processing': return 'pending,processing'
      case 'review': return 'review'
      default: return ''
    }
  }

  useEffect(() => {
    loadOrders()
  }, [page, status, keyword, exception])

  useEffect(() => {
    if (defaultView !== 'all') {
      setStatus(getDefaultStatus(defaultView))
    }
  }, [defaultView])

  async function loadOrders() {
    const params = {
      status: status.includes(',') ? status.split(',')[0] : status,
      exception,
      keyword,
      page,
      page_size: pageSize
    }
    
    if (status.includes(',')) {
      const statuses = status.split(',')
      params.status = statuses[0]
    }
    
    const data = await getOrders(params)
    if (data.list) {
      if (status.includes(',')) {
        let allOrders = []
        const statuses = status.split(',')
        for (const s of statuses) {
          const res = await getOrders({ status: s, exception, keyword, page: 1, page_size: 100 })
          if (res.list) {
            allOrders = [...allOrders, ...res.list]
          }
        }
        allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        const start = (page - 1) * pageSize
        setOrders(allOrders.slice(start, start + pageSize))
        setTotal(allOrders.length)
      } else {
        setOrders(data.list)
        setTotal(data.total)
      }
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const allRes = await getOrders({ page_size: 1000 })
    const allOrders = allRes.list || []
    
    let pendingCount = 0
    let processingCount = 0
    let completedCount = 0
    let overdueCount = 0
    
    const excStats = { overdue: 0, returned: 0, missing_material: 0, batch_failed: 0 }
    
    allOrders.forEach(order => {
      if (order.status === 'pending' || order.status === 'supplement') pendingCount++
      if (order.status === 'processing' || order.status === 'review') processingCount++
      if (order.status === 'completed') completedCount++
      if (isOverdue(order.due_at) && order.status !== 'completed' && order.status !== 'rejected') {
        overdueCount++
      }
      
      if (order.exceptions) {
        order.exceptions.forEach(exc => {
          if (exc.type in excStats) {
            excStats[exc.type]++
          }
        })
      }
    })

    setStats({
      pending: pendingCount,
      processing: processingCount,
      completed: completedCount,
      overdue: overdueCount
    })
    setExceptionStats(excStats)
  }

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'pending', label: '待审核' },
    { value: 'supplement', label: '待补正' },
    { value: 'processing', label: '审核中' },
    { value: 'review', label: '待复核' },
    { value: 'completed', label: '已完成' },
    { value: 'rejected', label: '已驳回' },
    { value: 'returned', label: '已退回' }
  ]

  const canCreate = currentUser?.role === 'registrar'
  const canBatch = currentUser?.role === 'auditor' || currentUser?.role === 'reviewer'

  function toggleSelect(id) {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  function toggleSelectAll() {
    if (selectedIds.length === orders.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(orders.map(o => o.id))
    }
  }

  function openBatchModal(action) {
    if (selectedIds.length === 0) {
      alert('请先选择要处理的工单')
      return
    }
    setBatchAction(action)
    setBatchForm({ reason: '', remark: '', result: '' })
    setShowBatchModal(true)
  }

  async function submitBatch() {
    if (!batchAction) return
    setBatchProcessing(true)

    const data = {
      action: batchAction,
      order_ids: selectedIds,
      reason: batchForm.reason,
      remark: batchForm.remark,
      result: batchForm.result
    }

    try {
      const res = await batchProcessOrders(data)
      setBatchResult(res)
      setShowBatchResult(true)
      setShowBatchModal(false)
      setSelectedIds([])
      loadOrders()
      loadStats()
    } catch (e) {
      alert('批量处理失败')
    } finally {
      setBatchProcessing(false)
    }
  }

  function getBatchActions() {
    if (currentUser?.role === 'auditor') {
      return [
        { key: 'start_process', label: '批量开始审核', type: 'primary' },
        { key: 'approve', label: '批量审核通过', type: 'primary' },
        { key: 'return_supplement', label: '批量退回补正', type: 'default' },
        { key: 'reject', label: '批量驳回', type: 'danger' }
      ]
    }
    if (currentUser?.role === 'reviewer') {
      return [
        { key: 'review_approve', label: '批量复核归档', type: 'primary' },
        { key: 'review_return', label: '批量退回补正', type: 'danger' }
      ]
    }
    return []
  }

  function handleCreateSubmit(e) {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = {
      member_name: formData.get('member_name'),
      member_phone: formData.get('member_phone'),
      service_type: formData.get('service_type'),
      priority: formData.get('priority') || 'normal',
      description: formData.get('description')
    }
    createOrder(data).then(res => {
      if (res.id) {
        setShowCreateModal(false)
        loadOrders()
        loadStats()
        onNavigate(`/order/${res.id}`)
      }
    })
  }

  const pageTitle = {
    all: '全部会员服务单',
    supplement: '附件缺失补正队列',
    processing: '审核处理队列',
    review: '复核归档队列'
  }[defaultView] || '会员服务单'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{pageTitle}</h1>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + 新建服务单
          </button>
        )}
      </div>

      {defaultView === 'all' && (
        <div>
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-label">待审核</div>
              <div className="stat-value pending">{stats.pending}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">处理中</div>
              <div className="stat-value processing">{stats.processing}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">已完成</div>
              <div className="stat-value completed">{stats.completed}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">已超时</div>
              <div className="stat-value overdue">{stats.overdue}</div>
            </div>
          </div>
          <div className="stat-cards" style={{ marginTop: '12px' }}>
            <div
              className={`stat-card ${exception === 'overdue' ? 'active' : ''}`}
              onClick={() => { setException(exception === 'overdue' ? '' : 'overdue'); setPage(1) }}
              style={{ cursor: 'pointer', border: exception === 'overdue' ? '2px solid #f5222d' : '1px solid #e8e8e8' }}
            >
              <div className="stat-label" style={{ color: '#f5222d' }}>⚠ 超时</div>
              <div className="stat-value overdue">{exceptionStats.overdue}</div>
            </div>
            <div
              className={`stat-card ${exception === 'returned' ? 'active' : ''}`}
              onClick={() => { setException(exception === 'returned' ? '' : 'returned'); setPage(1) }}
              style={{ cursor: 'pointer', border: exception === 'returned' ? '2px solid #faad14' : '1px solid #e8e8e8' }}
            >
              <div className="stat-label" style={{ color: '#faad14' }}>↺ 退回补正</div>
              <div className="stat-value" style={{ color: '#faad14' }}>{exceptionStats.returned}</div>
            </div>
            <div
              className={`stat-card ${exception === 'missing_material' ? 'active' : ''}`}
              onClick={() => { setException(exception === 'missing_material' ? '' : 'missing_material'); setPage(1) }}
              style={{ cursor: 'pointer', border: exception === 'missing_material' ? '2px solid #fa8c16' : '1px solid #e8e8e8' }}
            >
              <div className="stat-label" style={{ color: '#fa8c16' }}>📋 缺必需材料</div>
              <div className="stat-value" style={{ color: '#fa8c16' }}>{exceptionStats.missing_material}</div>
            </div>
            <div
              className={`stat-card ${exception === 'batch_failed' ? 'active' : ''}`}
              onClick={() => { setException(exception === 'batch_failed' ? '' : 'batch_failed'); setPage(1) }}
              style={{ cursor: 'pointer', border: exception === 'batch_failed' ? '2px solid #eb2f96' : '1px solid #e8e8e8' }}
            >
              <div className="stat-label" style={{ color: '#eb2f96' }}>✗ 批量失败</div>
              <div className="stat-value" style={{ color: '#eb2f96' }}>{exceptionStats.batch_failed}</div>
            </div>
          </div>
        </div>
      )}

      {canBatch && selectedIds.length > 0 && (
        <div className="section-card" style={{ marginBottom: '16px', padding: '12px 16px', background: '#e6f7ff', border: '1px solid #91d5ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#1890ff', fontWeight: '500' }}>
              已选择 {selectedIds.length} 个工单
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {getBatchActions().map(action => (
                <button
                  key={action.key}
                  className={`btn btn-sm ${action.type === 'danger' ? 'btn-danger' : action.type === 'default' ? 'btn-default' : 'btn-primary'}`}
                  onClick={() => openBatchModal(action.key)}
                >
                  {action.label}
                </button>
              ))}
              <button className="btn btn-default btn-sm" onClick={() => setSelectedIds([])}>
                取消选择
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="section-card">
        <div className="filter-bar">
          <div className="filter-item">
            <span className="filter-label">状态:</span>
            <select className="select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); setSelectedIds([]) }}>
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <span className="filter-label">异常:</span>
            <select className="select" value={exception} onChange={e => { setException(e.target.value); setPage(1); setSelectedIds([]) }}>
              <option value="">全部（无异常筛选）</option>
              {EXCEPTION_OPTIONS.filter(o => o.value !== 'all').map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label} ({exceptionStats[opt.value] || 0})</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <span className="filter-label">搜索:</span>
            <input
              className="input"
              placeholder="输入单号/姓名/手机号"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setPage(1); setSelectedIds([]); loadOrders() } }}
            />
          </div>
          <button className="btn btn-default btn-sm" onClick={() => { setPage(1); setSelectedIds([]); loadOrders() }}>
            查询
          </button>
          {exception && (
            <button className="btn btn-sm" style={{ background: '#f0f0f0', color: '#666' }} onClick={() => { setException(''); setPage(1) }}>
              ✕ 清除异常筛选
            </button>
          )}
        </div>

        <table className="table">
          <thead>
            <tr>
              {canBatch && (
                <th style={{ width: '50px' }}>
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedIds.length === orders.length}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <th>服务单号</th>
              <th>会员姓名</th>
              <th>服务类型</th>
              <th>状态</th>
              <th>异常标签</th>
              <th>优先级</th>
              <th>当前处理人</th>
              <th>创建时间</th>
              <th>截止时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                {canBatch && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      onClick={e => e.stopPropagation()}
                    />
                  </td>
                )}
                <td className="link" onClick={() => onNavigate(`/order/${order.id}`)}>
                  {order.order_no}
                </td>
                <td>{order.member_name}</td>
                <td>{order.service_type}</td>
                <td>
                  <span className="status-tag" style={{ background: STATUS_MAP[order.status]?.color + '20', color: STATUS_MAP[order.status]?.color }}>
                    {STATUS_MAP[order.status]?.label}
                  </span>
                </td>
                <td>
                  {order.exceptions && order.exceptions.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {order.exceptions.map(exc => (
                        <span
                          key={exc.type}
                          className="status-tag"
                          style={{
                            background: exc.color + '15',
                            color: exc.color,
                            fontSize: '11px',
                            padding: '2px 6px',
                            border: `1px solid ${exc.color}40`
                          }}
                          title={exc.desc}
                        >
                          {exc.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#999', fontSize: '12px' }}>-</span>
                  )}
                </td>
                <td>
                  <span style={{ color: PRIORITY_MAP[order.priority]?.color }}>
                    {PRIORITY_MAP[order.priority]?.label}
                  </span>
                </td>
                <td>{order.handler_name || '-'}</td>
                <td>{formatDate(order.created_at)}</td>
                <td>
                  {order.due_at ? (
                    <span style={{ color: isOverdue(order.due_at) ? '#f5222d' : '#333' }}>
                      {formatDate(order.due_at)}
                      {isOverdue(order.due_at) && ' (超时)'}
                    </span>
                  ) : '-'}
                </td>
                <td>
                  <span className="link" onClick={() => window.location.href = `/order/${order.id}`}>
                    详情
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {orders.length === 0 && <div className="empty">暂无数据</div>}

        <div className="pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            &lt;
          </button>
          {Array.from({ length: Math.ceil(total / pageSize) || 1 }, (_, i) => i + 1).slice(0, 5).map(p => (
            <button
              key={p}
              className={`page-btn ${page === p ? 'active' : ''}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
          <button
            className="page-btn"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage(p => p + 1)}
          >
            &gt;
          </button>
          <span style={{ marginLeft: '12px', color: '#999', fontSize: '13px' }}>
            共 {total} 条
          </span>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">新建会员服务单</span>
              <span className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</span>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-item">
                  <label className="form-label required">会员姓名</label>
                  <input className="form-input" name="member_name" required />
                </div>
                <div className="form-item">
                  <label className="form-label required">联系电话</label>
                  <input className="form-input" name="member_phone" required />
                </div>
                <div className="form-item">
                  <label className="form-label required">服务类型</label>
                  <select className="form-select" name="service_type" required>
                    <option value="">请选择</option>
                    <option value="洁牙服务">洁牙服务</option>
                    <option value="正畸咨询">正畸咨询</option>
                    <option value="种植牙服务">种植牙服务</option>
                    <option value="儿童涂氟">儿童涂氟</option>
                    <option value="根管治疗">根管治疗</option>
                    <option value="美白牙齿">美白牙齿</option>
                    <option value="镶牙服务">镶牙服务</option>
                  </select>
                </div>
                <div className="form-item">
                  <label className="form-label">优先级</label>
                  <select className="form-select" name="priority">
                    <option value="low">低</option>
                    <option value="normal" selected>普通</option>
                    <option value="high">高</option>
                  </select>
                </div>
                <div className="form-item">
                  <label className="form-label">服务说明</label>
                  <textarea className="form-textarea" name="description" placeholder="请输入服务说明"></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-default" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  提交
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{getBatchModalTitle(batchAction)}</span>
              <span className="modal-close" onClick={() => setShowBatchModal(false)}>&times;</span>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f5ff', borderRadius: '6px', fontSize: '13px' }}>
                <span style={{ fontWeight: '500' }}>将批量处理 {selectedIds.length} 个工单</span>
              </div>
              {['return_supplement', 'reject', 'review_return'].includes(batchAction) && (
                <div className="form-item">
                  <label className="form-label required">{getBatchReasonLabel(batchAction)}</label>
                  <textarea
                    className="form-textarea"
                    value={batchForm.reason}
                    onInput={e => setBatchForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="请输入原因"
                  />
                </div>
              )}
              {batchAction === 'approve' && (
                <div className="form-item">
                  <label className="form-label">处理结果</label>
                  <textarea
                    className="form-textarea"
                    value={batchForm.result}
                    onInput={e => setBatchForm(f => ({ ...f, result: e.target.value }))}
                    placeholder="请输入处理结果"
                  />
                </div>
              )}
              {['review_approve', 'submit', 'start_process'].includes(batchAction) && (
                <div className="form-item">
                  <label className="form-label">备注</label>
                  <textarea
                    className="form-textarea"
                    value={batchForm.remark}
                    onInput={e => setBatchForm(f => ({ ...f, remark: e.target.value }))}
                    placeholder="请输入备注（选填）"
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowBatchModal(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={submitBatch}
                disabled={batchProcessing}
              >
                {batchProcessing ? '处理中...' : '确认批量处理'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchResult && batchResult && (
        <div className="modal-overlay" onClick={() => setShowBatchResult(false)}>
          <div className="modal" style={{ width: '600px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">批量处理结果</span>
              <span className="modal-close" onClick={() => setShowBatchResult(false)}>&times;</span>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', padding: '16px', borderRadius: '6px', background: '#fafafa' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>{batchResult.total}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>总数</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>{batchResult.success}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>成功</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f5222d' }}>{batchResult.failed}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>失败</div>
                </div>
              </div>

              <div className="detail-title" style={{ marginBottom: '12px', borderLeft: 'none', paddingLeft: 0 }}>
                处理详情
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {batchResult.results?.map(res => (
                  <div
                    key={res.order_id}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      border: `1px solid ${res.success ? '#b7eb8f' : '#ffa39e'}`,
                      background: res.success ? '#f6ffed' : '#fff1f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500' }}>{res.order_no}</span>
                      <span className="status-tag" style={{
                        background: res.success ? '#52c41a20' : '#f5222d20',
                        color: res.success ? '#52c41a' : '#f5222d'
                      }}>
                        {res.success ? '成功' : '失败'}
                      </span>
                    </div>
                    {res.status && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        状态: {STATUS_MAP[res.status]?.label || res.status}
                      </div>
                    )}
                    {!res.success && (
                      <div style={{ fontSize: '13px', marginTop: '4px', color: '#cf1322', fontWeight: '500' }}>
                        失败原因: {res.message}
                      </div>
                    )}
                    {res.success && (
                      <div style={{ fontSize: '13px', marginTop: '4px', color: '#389e0d' }}>
                        {res.message}
                      </div>
                    )}
                    {(res.operator || res.processed_at) && (
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed ' + (res.success ? '#b7eb8f' : '#ffa39e') }}>
                        {res.operator && (
                          <span style={{ marginRight: '12px' }}>
                            操作者: {res.operator}（{ROLE_MAP[res.role]?.label || res.role}）
                          </span>
                        )}
                        {res.processed_at && (
                          <span>处理时间: {formatDate(res.processed_at)}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowBatchResult(false)}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getBatchModalTitle(action) {
  const titles = {
    submit: '批量提交审核',
    start_process: '批量开始审核',
    approve: '批量审核通过',
    reject: '批量驳回',
    return_supplement: '批量退回补正',
    review_approve: '批量复核归档',
    review_return: '批量复核退回'
  }
  return titles[action] || '批量处理'
}

function getBatchReasonLabel(action) {
  const labels = {
    reject: '驳回原因',
    return_supplement: '退补原因',
    review_return: '退回原因'
  }
  return labels[action] || '原因'
}
