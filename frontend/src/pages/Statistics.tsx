import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { statsApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Statistics, OperationLog } from '../types'
import { EmptyState, Loading, formatDate, Pagination, StatusBadge, RoleBadge } from '../components/Common'

export default function StatisticsPage() {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const { showToast } = useToast()

  useEffect(() => {
    loadAll()
  }, [page])

  async function loadAll() {
    setLoading(true)
    try {
      const [s, l] = await Promise.all([
        statsApi.getOverview(),
        statsApi.getLogs({ page, pageSize }),
      ])
      setStats(s)
      setLogs(l.items || [])
      setLogsTotal(l.total || 0)
    } catch (err: any) {
      showToast(err.message || '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="center-loading"><Loading size="lg" /></div>
  if (!stats) return <EmptyState />

  const statusEntries = Object.entries(stats.statusNames || {})

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

  return (
    <div>
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
            <h3>本月新增申请</h3>
            <div className="stat-card-value">{stats.newThisMonth}</div>
          </div>
          <div className="stat-card-icon green">⬆️</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <h3>超时申请数</h3>
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
            <div className="card-title">📊 按状态分布统计</div>
          </div>
          <div className="card-body">
            <div className="status-bar-list">
              {statusEntries.map(([key, label]) => {
                const v = (stats.statusStats as any)?.[key] || 0
                const color = statusColorMap[key] || '#9ca3af'
                const max = Math.max(1, ...Object.values(stats.statusStats || {}).map(Number))
                return (
                  <Link
                    key={key}
                    to={`/applications?status=${key === 'pendingReview' ? 'pending_review' : key === 'pendingConfirm' ? 'pending_confirm' : key === 'pendingHandover' ? 'pending_handover' : key === 'roomConfirmed' ? 'room_confirmed' : key}`}
                    style={{ display: 'block', color: 'inherit' }}
                  >
                    <div className="status-bar-item">
                      <div className="status-bar-label">{label}</div>
                      <div className="status-bar-track">
                        <div className="status-bar-fill" style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: color }} />
                      </div>
                      <div className="status-bar-value" style={{ color, fontWeight: 700 }}>{v}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
            <div className="mt-16 pt-16" style={{ borderTop: '1px dashed #e5e7eb', fontSize: '12px', color: '#6b7280' }}>
              💡 点击任意一行可跳转至对应状态的租约列表
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">💰 租金与公寓分布</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '16px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '32px' }}>🏠</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#92400e' }}>在管公寓月租金合计</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#78350f' }}>¥ {stats.totalRent?.toLocaleString() || 0}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>🏢 公寓申请数量 Top</div>
              {(stats.apartmentStats || []).length === 0 ? (
                <EmptyState text="暂无公寓数据" />
              ) : (
                (stats.apartmentStats || []).slice(0, 5).map((apt, i) => {
                  const maxCount = Math.max(...(stats.apartmentStats || []).map(a => a.count))
                  return (
                    <div key={i} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {apt.apartmentName}</span>
                        <span><b style={{ color: '#2563eb' }}>{apt.count}</b> 单 · ¥{apt.totalRent.toLocaleString()}/月</span>
                      </div>
                      <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(apt.count / maxCount) * 100}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: '3px' }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-header">
          <div className="card-title">🗂️ 各节点时限进度统计</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            {[
              { k: 'contractSigning', n: '租客签约', t: 24, c: '#3b82f6', icon: '📝' },
              { k: 'review', n: '租约审核', t: 48, c: '#8b5cf6', icon: '✅' },
              { k: 'roomConfirm', n: '房态确认', t: 24, c: '#f59e0b', icon: '🏠' },
              { k: 'handover', n: '入住交接', t: 48, c: '#0ea5e9', icon: '🔑' },
              { k: 'archive', n: '复核归档', t: 72, c: '#10b981', icon: '📁' },
            ].map(node => {
              const count = (stats.nodeStats as any)?.[node.k] || 0
              return (
                <Link
                  key={node.k}
                  to={`/applications?currentNode=${node.k}`}
                  style={{ display: 'block', padding: '16px', borderRadius: '8px', border: '2px solid var(--gray-200)', color: 'inherit', transition: 'all 0.2s' }}
                  className="stat-node-card"
                >
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>{node.icon}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: node.c }}>{node.n}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>时限 {node.t}h</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: node.c }}>{count}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>当前处理中</div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📜 全平台操作日志 <span className="badge badge-blue ml-8">{logsTotal} 条</span></div>
          <button className="btn btn-sm" onClick={loadAll}>🔄 刷新</button>
        </div>
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {logs.length === 0 ? (
            <EmptyState text="暂无操作记录" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作人</th>
                  <th>角色</th>
                  <th>申请ID</th>
                  <th>操作类型</th>
                  <th>状态变更</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDate(log.createdAt)}</td>
                    <td>{log.userName}</td>
                    <td><RoleBadge role={log.userRole} /></td>
                    <td>
                      <Link to={`/applications/${log.applicationId}`} style={{ fontWeight: 600 }}>#{log.applicationId}</Link>
                    </td>
                    <td><span className="badge badge-purple">{log.operationName}</span></td>
                    <td>
                      {log.oldStatus && log.oldStatus !== log.newStatus ? (
                        <div style={{ fontSize: '12px' }}>
                          <StatusBadge status={log.oldStatus} />
                          <span style={{ margin: '0 4px' }}>→</span>
                          <StatusBadge status={log.newStatus || ''} />
                        </div>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>-</span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', maxWidth: '400px' }}>{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {logs.length > 0 && <Pagination total={logsTotal} page={page} pageSize={pageSize} onChange={setPage} />}
      </div>

      <style>{`
        .stat-node-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  )
}
