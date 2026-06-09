import { useState, useEffect } from 'react'
import { api } from '../api'
import { ROLE_OPTIONS } from '../utils/constants'

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    is_failure: '',
    actor_role: '',
    search: '',
  })

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.is_failure !== '') params.is_failure = filters.is_failure
      if (filters.actor_role) params.actor_role = filters.actor_role
      if (filters.search) params.search = filters.search
      const data = await api.listAllAuditLogs(params)
      setLogs(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [filters])

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN')
  }

  return (
    <div className="audit-log-page">
      <div className="page-header">
        <div>
          <h2>审计日志</h2>
          <p className="page-desc">查看所有操作记录和失败原因</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label>操作结果：</label>
          <select
            value={filters.is_failure}
            onChange={(e) => setFilters({ ...filters, is_failure: e.target.value })}
            className="filter-select"
          >
            <option value="">全部</option>
            <option value="true">仅失败</option>
            <option value="false">仅成功</option>
          </select>
        </div>
        <div className="filter-group">
          <label>角色：</label>
          <select
            value={filters.actor_role}
            onChange={(e) => setFilters({ ...filters, actor_role: e.target.value })}
            className="filter-select"
          >
            <option value="">全部角色</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>搜索：</label>
          <input
            type="text"
            placeholder="操作人/原因/详情"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="filter-input"
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
          />
        </div>
      </div>

      <div className="audit-log-list full-width">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">暂无审计记录</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`audit-log-item ${log.is_failure ? 'failure' : ''}`}>
              <div className="audit-log-dot"></div>
              <div className="audit-log-content">
                <div className="audit-log-header">
                  <span className="audit-log-action">{log.action}</span>
                  {log.is_failure && <span className="audit-log-failure">失败</span>}
                  <span className="audit-log-role">{log.actor_role_label}</span>
                  <span className="audit-log-actor">{log.actor}</span>
                  <span className="audit-log-time">{formatDate(log.created_at)}</span>
                  {log.order && <span className="audit-log-order">订单：{log.order.order_no}</span>}
                </div>
                {log.detail && <div className="audit-log-detail">详情：{log.detail}</div>}
                {log.reason && <div className="audit-log-reason">原因：{log.reason}</div>}
                {log.failure_reason && (
                  <div className="audit-log-failure-reason">失败原因：{log.failure_reason}</div>
                )}
                {log.status_before && (
                  <div className="audit-log-status">
                    状态：{log.status_before_label} → {log.status_after_label}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
