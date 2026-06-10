import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
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

const evidenceNameMap = {
  booking_sheet: '预约单',
  ticket_voucher: '票务凭证',
  entry_record: '入园记录',
  settlement_note: '结算单'
}

const roleNameMap = {
  ticket_specialist: '票务专员',
  site_dispatcher: '现场调度',
  scenic_manager: '景区经理'
}

export default function Queue() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [queueData, setQueueData] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const [queueRes, statsRes] = await Promise.all([
        api.getQueue(),
        api.getStats()
      ])
      setQueueData(queueRes)
      setStats(statsRes)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getUrgencyLevel = (order) => {
    const visitDate = new Date(order.visit_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    visitDate.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today - visitDate) / (1000 * 60 * 60 * 24))

    if (order.status === 'appeal_pending') return 'urgent'
    if (diffDays > 3) return 'urgent'
    if (diffDays > 0) return 'warning'
    return ''
  }

  const parseEvidence = (evidenceStr) => {
    if (!evidenceStr) return []
    try {
      return JSON.parse(evidenceStr)
    } catch {
      return []
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const getDaysLabel = (dateStr) => {
    const visitDate = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    visitDate.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today - visitDate) / (1000 * 60 * 60 * 24))

    if (diffDays > 0) return `逾期 ${diffDays} 天`
    if (diffDays === 0) return '今日'
    return `还有 ${Math.abs(diffDays)} 天`
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>
  }

  const orders = queueData?.orders || []
  const statsData = stats?.by_status || {}

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          我的队列 - {user?.role_name}
        </h1>
        <button className="btn btn-primary" onClick={loadData}>
          刷新
        </button>
      </div>

      {stats && (
        <div className="stats-cards">
          <div className="stat-card primary">
            <div className="label">待处理总数</div>
            <div className="value">{orders.length}</div>
          </div>
          <div className="stat-card">
            <div className="label">全部预约单</div>
            <div className="value">{stats.total_orders || 0}</div>
          </div>
          <div className="stat-card success">
            <div className="label">已归档</div>
            <div className="value">{statsData.archived?.count || 0}</div>
          </div>
          <div className="stat-card danger">
            <div className="label">申诉中</div>
            <div className="value">{statsData.appeal_pending?.count || 0}</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span>待处理队列</span>
          <span className="queue-count">{orders.length} 条</span>
        </div>
        <div className="card-body">
          {orders.length === 0 ? (
            <div className="empty">
              <p>暂无待处理的预约单</p>
              <p style={{ marginTop: '8px', fontSize: '13px' }}>
                当前岗位：{user?.role_name}
              </p>
            </div>
          ) : (
            <div>
              {orders.map((order) => {
                const urgency = getUrgencyLevel(order)
                const evidence = parseEvidence(order.evidence)
                return (
                  <div
                    key={order.id}
                    className={`order-card ${urgency}`}
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div className="order-card-header">
                      <div>
                        <div className="order-card-title">{order.team_name}</div>
                        <div className="order-card-subtitle">
                          单号：{order.order_no}
                        </div>
                      </div>
                      <span className={`status-tag status-${statusColorMap[order.status]}`}>
                        {statusNameMap[order.status]}
                      </span>
                    </div>

                    <div className="order-card-info">
                      <div className="order-card-info-item">
                        <span className="label">游客人数</span>
                        <span className="value">{order.visitor_count} 人</span>
                      </div>
                      <div className="order-card-info-item">
                        <span className="label">游览日期</span>
                        <span className="value">{formatDate(order.visit_date)}</span>
                      </div>
                      <div className="order-card-info-item">
                        <span className="label">导游</span>
                        <span className="value">{order.guide_name || '-'}</span>
                      </div>
                    </div>

                    <div className="order-card-footer">
                      <div className="evidence-list">
                        {evidence.length > 0 ? (
                          evidence.map((e) => (
                            <span key={e} className="evidence-tag has">
                              ✓ {evidenceNameMap[e] || e}
                            </span>
                          ))
                        ) : (
                          <span className="evidence-tag missing">无证据</span>
                        )}
                      </div>
                      <div className="order-card-meta">
                        <span>处理：{roleNameMap[order.current_handler_role] || order.current_handler_role}</span>
                        <span style={{ marginLeft: '8px' }}>{getDaysLabel(order.visit_date)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
