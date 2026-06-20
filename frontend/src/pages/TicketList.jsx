import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketApi } from '../api'
import { useAuth } from '../hooks/useAuth'

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'pending_audit', label: '待审核' },
  { value: 'processing', label: '办理中' },
  { value: 'pending_review', label: '待复核' },
  { value: 'returned', label: '退回补正' },
  { value: 'archived', label: '已归档' },
]

const statusLabels = {
  draft: '草稿',
  pending_audit: '待审核',
  processing: '办理中',
  pending_review: '待复核',
  returned: '退回补正',
  archived: '已归档',
}

const priorityLabels = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
}

const TicketList = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [tickets, setTickets] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState('')
  const [exceptionFilter, setExceptionFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, pending: 0, processing: 0, exception: 0 })

  const loadTickets = async () => {
    setLoading(true)
    try {
      const params = {
        page,
        page_size: pageSize,
      }
      if (statusFilter) params.status = statusFilter
      if (exceptionFilter !== '') params.is_exception = exceptionFilter === 'true'
      if (keyword) params.keyword = keyword

      const result = await ticketApi.list(params)
      setTickets(result.items)
      setTotal(result.total)
    } catch (e) {
      console.error('加载工单失败', e)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const [allRes, pendingRes, procRes, exceptRes] = await Promise.all([
        ticketApi.list({ page_size: 1 }),
        ticketApi.list({ status: 'pending_audit', page_size: 1 }),
        ticketApi.list({ status: 'processing', page_size: 1 }),
        ticketApi.list({ is_exception: true, page_size: 1 }),
      ])
      setStats({
        total: allRes.total,
        pending: pendingRes.total,
        processing: procRes.total,
        exception: exceptRes.total,
      })
    } catch (e) {
      console.error('加载统计失败', e)
    }
  }

  useEffect(() => {
    loadTickets()
    loadStats()
  }, [page, statusFilter, exceptionFilter, keyword])

  const totalPages = Math.ceil(total / pageSize)

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <h2 className="page-title">投诉工单管理</h2>

      <div className="stat-cards">
        <div className="stat-card primary">
          <div className="label">全部工单</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">待审核</div>
          <div className="value">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="label">办理中</div>
          <div className="value">{stats.processing}</div>
        </div>
        <div className="stat-card danger">
          <div className="label">异常工单</div>
          <div className="value">{stats.exception}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">工单列表</div>
          <div>
            {currentUser?.role === 'registrar' && (
              <button
                className="btn btn-primary"
                onClick={() => navigate('/create')}
              >
                + 新建工单
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          <div className="filter-bar">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={exceptionFilter}
              onChange={(e) => { setExceptionFilter(e.target.value); setPage(1) }}
            >
              <option value="">全部异常状态</option>
              <option value="true">仅异常</option>
              <option value="false">正常</option>
            </select>
            <input
              type="text"
              placeholder="搜索工单号/标题/投诉人..."
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
              style={{ minWidth: 240 }}
            />
            <button className="btn" onClick={() => {
              setStatusFilter('')
              setExceptionFilter('')
              setKeyword('')
              setPage(1)
            }}>
              重置
            </button>
          </div>

          {loading ? (
            <div className="empty">加载中...</div>
          ) : tickets.length === 0 ? (
            <div className="empty">暂无工单数据</div>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>工单号</th>
                    <th>标题</th>
                    <th>投诉人</th>
                    <th>状态</th>
                    <th>优先级</th>
                    <th>异常</th>
                    <th>创建人</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => (
                    <tr key={ticket.id} className="list-item-hover">
                      <td style={{ fontFamily: 'monospace' }}>{ticket.ticket_no}</td>
                      <td style={{ maxWidth: 280 }}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {ticket.title}
                        </div>
                      </td>
                      <td>{ticket.complainant}</td>
                      <td>
                        <span className={`status-badge status-${ticket.status}`}>
                          {statusLabels[ticket.status] || ticket.status}
                        </span>
                      </td>
                      <td className={`priority-${ticket.priority}`}>
                        {priorityLabels[ticket.priority] || ticket.priority}
                      </td>
                      <td>
                        {ticket.is_exception && (
                          <span className="exception-tag">异常</span>
                        )}
                      </td>
                      <td>{ticket.created_by_name || '-'}</td>
                      <td>{formatDate(ticket.created_at)}</td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    上一页
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      className={p === page ? 'active' : ''}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default TicketList
