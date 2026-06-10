import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

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

export default function AllOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [allStats, setAllStats] = useState({})
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrders()
  }, [statusFilter])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const data = await api.getAllOrders(statusFilter)
      setOrders(data.orders)
      setAllStats(data.all_stats || {})
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">全部预约单</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filter-bar">
            <span>状态筛选：</span>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">全部状态</option>
              {Object.entries(statusNameMap).map(([key, name]) => (
                <option key={key} value={key}>
                  {name} ({allStats[key]?.count || 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card-body">
          {loading ? (
            <div className="loading">加载中...</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>预约单号</th>
                  <th>团队名称</th>
                  <th>游客人数</th>
                  <th>游览日期</th>
                  <th>导游</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_no}</td>
                    <td>{order.team_name}</td>
                    <td>{order.visitor_count} 人</td>
                    <td>{formatDate(order.visit_date)}</td>
                    <td>{order.guide_name || '-'}</td>
                    <td>
                      <span className={`status-tag status-${statusColorMap[order.status]}`}>
                        {statusNameMap[order.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-link"
                        onClick={() => navigate(`/orders/${order.id}`)}
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
