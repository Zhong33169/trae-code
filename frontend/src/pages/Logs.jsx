import { useState, useEffect } from 'preact/hooks'
import { api, formatDateTime } from '../utils/api.js'

const ROLE_LABELS = {
  registrar: '晨检登记员',
  auditor: '晨检审核主管',
  reviewer: '幼儿园复核负责人',
}

export default function Logs({ user }) {
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [recordId, setRecordId] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const params = { page, pageSize }
      if (recordId) params.record_id = recordId
      const res = await api.getLogs(params)
      setList(res.list)
      setTotal(res.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, recordId])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div className="page-header">
        <h1>操作记录</h1>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="filter-bar">
            <div className="form-item">
              <label>记录ID</label>
              <input
                type="text"
                placeholder="输入记录ID筛选"
                value={recordId}
                onInput={(e) => setRecordId(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setPage(1)}>查询</button>
            <button className="btn" onClick={() => { setRecordId(''); setPage(1) }}>重置</button>
          </div>

          {loading ? (
            <div className="empty">加载中...</div>
          ) : list.length === 0 ? (
            <div className="empty">暂无操作记录</div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>操作人</th>
                    <th>角色</th>
                    <th>操作</th>
                    <th>关联记录</th>
                    <th>状态变化</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.created_at)}</td>
                      <td>{log.user_name}</td>
                      <td>
                        <span className="status-tag status-pending_audit">
                          {ROLE_LABELS[log.user_role] || log.user_role}
                        </span>
                      </td>
                      <td>{log.action}</td>
                      <td>{log.record_id ? `#${log.record_id}` : '-'}</td>
                      <td>
                        {log.from_status && log.to_status ? (
                          <span>
                            {log.from_status} → {log.to_status}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination">
                <span className="page-info">共 {total} 条</span>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  上一页
                </button>
                <span className="page-info">{page} / {totalPages || 1}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  下一页
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
