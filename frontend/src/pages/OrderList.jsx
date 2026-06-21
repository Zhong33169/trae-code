import { useState, useEffect } from 'preact/hooks'
import { getOrders, createOrder } from '../api/client.js'
import { STATUS_MAP, PRIORITY_MAP, formatDate, isOverdue, ROLE_MAP } from '../utils/constants.js'

export default function OrderList(props) {
  const defaultView = props.defaultView || 'all'
  const onNavigate = props.onNavigate || ((path) => { window.location.href = path })
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [status, setStatus] = useState(defaultView === 'all' ? '' : getDefaultStatus(defaultView))
  const [keyword, setKeyword] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [stats, setStats] = useState({ pending: 0, processing: 0, completed: 0, overdue: 0 })
  const [currentUser, setCurrentUser] = useState(null)

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
  }, [page, status, keyword])

  useEffect(() => {
    if (defaultView !== 'all') {
      setStatus(getDefaultStatus(defaultView))
    }
  }, [defaultView])

  async function loadOrders() {
    const params = {
      status: status.includes(',') ? status.split(',')[0] : status,
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
          const res = await getOrders({ status: s, keyword, page: 1, page_size: 100 })
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
    const [pendingRes, processingRes, completedRes] = await Promise.all([
      getOrders({ status: 'pending', page_size: 100 }),
      getOrders({ status: 'processing', page_size: 100 }),
      getOrders({ status: 'completed', page_size: 100 })
    ])

    let overdueCount = 0
    const allStatuses = ['pending', 'supplement', 'processing', 'review', 'returned']
    for (const s of allStatuses) {
      const res = await getOrders({ status: s, page_size: 100 })
      if (res.list) {
        res.list.forEach(order => {
          if (isOverdue(order.due_at)) {
            overdueCount++
          }
        })
      }
    }

    setStats({
      pending: pendingRes.total || 0,
      processing: processingRes.total || 0,
      completed: completedRes.total || 0,
      overdue: overdueCount
    })
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
      )}

      <div className="section-card">
        <div className="filter-bar">
          <div className="filter-item">
            <span className="filter-label">状态:</span>
            <select className="select" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
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
              onKeyDown={e => { if (e.key === 'Enter') { setPage(1); loadOrders() } }}
            />
          </div>
          <button className="btn btn-default btn-sm" onClick={() => { setPage(1); loadOrders() }}>
            查询
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>服务单号</th>
              <th>会员姓名</th>
              <th>服务类型</th>
              <th>状态</th>
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
    </div>
  )
}
