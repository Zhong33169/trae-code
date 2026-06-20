import { useState, useEffect } from 'preact/hooks'
import { Link } from 'react-router-dom'
import { AuditLog, ROLE_LABELS, api } from '../api/client'

function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showFailuresOnly, setShowFailuresOnly] = useState(false)

  useEffect(() => {
    loadLogs()
  }, [showFailuresOnly])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const res = showFailuresOnly ? await api.audit.failures() : await api.audit.list()
      setLogs(res.logs)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const getRoleLabel = (role: string) => ROLE_LABELS[role] || role

  return (
    <div>
      <div class="breadcrumb">
        <Link to="/">← 返回列表</Link>
      </div>

      <h2 class="page-title">审计日志</h2>

      <div class="card">
        <div class="filter-bar">
          <div class="filter-group">
            <label>
            <input
              type="checkbox"
              style={{ marginRight: 6 }}
              checked={showFailuresOnly}
              onInput={(e) => setShowFailuresOnly((e.target as HTMLInputElement).checked)}
            />
              只看失败/异常记录
            </label>
          </div>
          <div style={{ flex: 1 }}></div>
          <button class="btn btn-default" onClick={loadLogs}>
            🔄 刷新
          </button>
        </div>

        {loading ? (
          <div class="empty">加载中...</div>
        ) : logs.length === 0 ? (
          <div class="empty">暂无审计记录</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>兑现单</th>
                <th>操作人</th>
                <th>角色</th>
                <th>操作</th>
                <th>失败原因</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, color: '#8c8c8c' }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td>
                    {log.order_no && (
                      <Link to={`/orders/${log.order_id}`} class="link-btn">
                        {log.order_no}
                      </Link>
                    )}
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>{log.title}</div>
                  </td>
                  <td>{log.operator_name}</td>
                  <td>
                    <span class="status-tag status-DRAFT" style={{ fontSize: 11 }}>
                      {getRoleLabel(log.operator_role)}
                    </span>
                  </td>
                  <td>{log.action}</td>
                  <td>
                    {log.failure_reason ? (
                      <span style={{ color: '#cf1322' }}>{log.failure_reason}</span>
                    ) : (
                      <span style={{ color: '#52c41a' }}>正常</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: '#595959', maxWidth: 300 }}>
                    {log.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default AuditLogs
