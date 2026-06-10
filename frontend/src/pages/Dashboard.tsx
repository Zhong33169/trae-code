import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { statsApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { Statistics } from '../types'
import { EmptyState, Loading } from '../components/Common'

export default function Dashboard() {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const { hasRole, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)
    try {
      const s = await statsApi.getOverview()
      setStats(s)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="center-loading"><Loading size="lg" /></div>
  if (!stats) return <EmptyState />

  const myPendingEntries = Object.entries(stats.myPending || {})
  const totalPending = myPendingEntries.reduce((s, [, v]) => s + (v as number), 0)

  const statusColorMap: Record<string, string> = {
    draft: '#9ca3af',
    pendingReview: '#2563eb',
    returned: '#f59e0b',
    reviewed: '#3b82f6',
    pendingConfirm: '#8b5cf6',
    roomConfirmed: '#ea580c',
    pendingHandover: '#0ea5e9',
    completed: '#10b981',
    rejected: '#ef4444',
  }

  const quickActions = hasRole('registrar') ? [
    { label: '新建租约申请', icon: '📝', path: '/applications/new', color: 'btn-primary' },
    { label: '查看草稿', icon: '📋', path: '/applications?status=draft', color: '' },
    { label: '补正被退回', icon: '🔄', path: '/applications?status=returned', color: 'btn-warning' },
  ] : hasRole('auditor') ? [
    { label: '审核待处理', icon: '✅', path: '/applications?status=pending_review', color: 'btn-primary' },
    { label: '房态确认', icon: '🏠', path: '/applications?status=pending_confirm', color: 'btn-success' },
    { label: '入住交接', icon: '🔑', path: '/applications?status=pending_handover', color: 'btn-warning' },
  ] : [
    { label: '待复核归档', icon: '📁', path: '/applications?status=room_confirmed', color: 'btn-primary' },
    { label: '查看全部', icon: '📋', path: '/applications', color: '' },
  ]

  return (
    <div>
      {totalPending > 0 && (
        <div className="alert alert-warning mb-16" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ 您有 <b style={{ fontSize: '16px' }}>{totalPending}</b> 条待处理事项，请及时处理避免超时</span>
          <Link to="/applications" className="btn btn-sm btn-warning">立即处理 →</Link>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-info">
            <h3>租约申请总数</h3>
            <div className="stat-card-value">{stats.total}</div>
          </div>
          <div className="stat-card-icon blue">📋</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <h3>本月新增</h3>
            <div className="stat-card-value">{stats.newThisMonth}</div>
          </div>
          <div className="stat-card-icon green">⬆️</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <h3>超时未处理</h3>
            <div className="stat-card-value" style={{ color: stats.overdueCount > 0 ? '#ef4444' : undefined }}>{stats.overdueCount}</div>
          </div>
          <div className="stat-card-icon red">⏰</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <h3>本月完成归档</h3>
            <div className="stat-card-value">{stats.completedThisMonth}</div>
          </div>
          <div className="stat-card-icon yellow">✅</div>
        </div>
      </div>

      <div className="grid-2 mb-24">
        <div className="card">
          <div className="card-header">
            <div className="card-title">📌 我的待办事项</div>
          </div>
          <div className="card-body">
            {myPendingEntries.length === 0 ? (
              <EmptyState text="暂无待办事项" />
            ) : (
              <div className="status-bar-list">
                {Object.entries(stats.statusNames || {}).map(([key, label]) => {
                  const value = (stats.statusStats as any)?.[key] || 0
                  const myVal = (stats.myPending as any)?.[key]
                  if (myVal === undefined) return null
                  const max = Math.max(1, stats.total)
                  const color = statusColorMap[key] || '#9ca3af'
                  return (
                    <div key={key} onClick={() => navigate(`/applications?status=${key === 'pendingReview' ? 'pending_review' : key === 'pendingConfirm' ? 'pending_confirm' : key === 'pendingHandover' ? 'pending_handover' : key === 'roomConfirmed' ? 'room_confirmed' : key === 'pendingArchive' ? 'room_confirmed' : key}`)} style={{ cursor: 'pointer' }}>
                      <div className="status-bar-item">
                        <div className="status-bar-label">{label}</div>
                        <div className="status-bar-track">
                          <div
                            className="status-bar-fill"
                            style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}
                          />
                        </div>
                        <div className="status-bar-value" style={{ color }}>
                          {myVal > 0 ? <b>{myVal}待办</b> : `${value}总`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">⚡ 快捷操作</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {quickActions.map((a, i) => (
                <Link
                  key={i}
                  to={a.path}
                  className={`btn ${a.color} btn-lg`}
                  style={{ justifyContent: 'flex-start', padding: '14px 16px' }}
                >
                  <span style={{ fontSize: '18px' }}>{a.icon}</span>
                  <span style={{ fontWeight: 500 }}>{a.label}</span>
                </Link>
              ))}
            </div>

            <div className="mt-24">
              <div className="section-title" style={{ border: 'none', padding: 0, marginBottom: '12px' }}>💰 租金统计</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '16px', background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', borderRadius: '8px' }}>
                <div style={{ fontSize: '36px' }}>💵</div>
                <div>
                  <div style={{ fontSize: '12px', color: '#1e40af' }}>月租金总额 (在管)</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e3a8a' }}>
                    ¥ {stats.totalRent?.toLocaleString() || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">🏘️ 公寓申请分布 Top 10</div>
          </div>
          <div className="card-body">
            {(stats.apartmentStats || []).length === 0 ? (
              <EmptyState text="暂无公寓数据" />
            ) : (
              <div>
                {(stats.apartmentStats || []).map((apt, i) => (
                  <div key={i} className="apt-row">
                    <div className="apt-name">
                      <span style={{ display: 'inline-block', width: '20px', textAlign: 'center', marginRight: '8px', color: i < 3 ? '#f59e0b' : '#9ca3af', fontWeight: 700 }}>
                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                      </span>
                      {apt.apartmentName}
                    </div>
                    <div className="apt-info">
                      <span>{apt.count} 单</span>
                      <span>¥{apt.totalRent.toLocaleString()}/月</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">📊 各节点处理分布</div>
          </div>
          <div className="card-body">
            <div className="status-bar-list">
              {[
                { k: 'contractSigning', n: '租客签约' },
                { k: 'review', n: '租约审核' },
                { k: 'roomConfirm', n: '房态确认' },
                { k: 'handover', n: '入住交接' },
                { k: 'archive', n: '复核归档' },
              ].map(({ k, n }) => {
                const v = (stats.nodeStats as any)?.[k] || 0
                const max = Math.max(1, ...Object.values(stats.nodeStats || {}).map(Number))
                const color = ['#3b82f6', '#8b5cf6', '#f59e0b', '#0ea5e9', '#10b981'][['contractSigning', 'review', 'roomConfirm', 'handover', 'archive'].indexOf(k)]
                return (
                  <div key={k} className="status-bar-item">
                    <div className="status-bar-label">{n}</div>
                    <div className="status-bar-track">
                      <div className="status-bar-fill" style={{ width: `${(v / max) * 100}%`, background: color }} />
                    </div>
                    <div className="status-bar-value" style={{ color }}>{v}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
