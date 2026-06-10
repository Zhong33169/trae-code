import { useState, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { api, formatDuration, todayStr } from '../utils/api.js'
import CreateRecordModal from '../components/CreateRecordModal.jsx'

export default function Records({ user }) {
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [childName, setChildName] = useState('')
  const [checkDate, setCheckDate] = useState(todayStr())
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const loadData = async () => {
    setLoading(true)
    try {
      const params = { page, pageSize }
      if (activeTab === 'queue') {
        params.queue = '1'
      }
      if (status) params.status = status
      if (childName) params.child_name = childName
      if (checkDate) params.check_date = checkDate

      const res = await api.getRecords(params)
      setRecords(res.list)
      setTotal(res.total)
    } catch (err) {
      alert(err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, status, childName, checkDate, activeTab])

  const handleSearch = () => {
    setPage(1)
    loadData()
  }

  const handleCreated = () => {
    setShowCreate(false)
    loadData()
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div className="page-header">
        <h1>晨检记录</h1>
        {user.role === 'registrar' && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + 新建记录
          </button>
        )}
      </div>

      <div className="page-content">
        <div className="card">
          <div className="tab-bar">
            <div
              className={`tab ${activeTab === 'queue' ? 'active' : ''}`}
              onClick={() => { setActiveTab('queue'); setPage(1) }}
            >
              我的待办
            </div>
            <div
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => { setActiveTab('all'); setPage(1) }}
            >
              全部记录
            </div>
          </div>

          <div className="filter-bar">
            <div className="form-item">
              <label>幼儿姓名</label>
              <input
                type="text"
                placeholder="请输入"
                value={childName}
                onInput={(e) => setChildName(e.target.value)}
              />
            </div>
            <div className="form-item">
              <label>检查日期</label>
              <input
                type="date"
                value={checkDate}
                onInput={(e) => setCheckDate(e.target.value)}
              />
            </div>
            {activeTab === 'all' && (
              <div className="form-item">
                <label>状态</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">全部状态</option>
                  <option value="pending_registration">待登记</option>
                  <option value="pending_correction">待补正</option>
                  <option value="pending_audit">待审核</option>
                  <option value="pending_review">待复核</option>
                  <option value="archived">已归档</option>
                </select>
              </div>
            )}
            <button className="btn btn-primary" onClick={handleSearch}>查询</button>
            <button className="btn" onClick={() => {
              setChildName('')
              setStatus('')
              setCheckDate(todayStr())
              setPage(1)
            }}>重置</button>
          </div>

          {loading ? (
            <div className="empty">加载中...</div>
          ) : records.length === 0 ? (
            <div className="empty">暂无记录</div>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>幼儿姓名</th>
                    <th>班级</th>
                    <th>检查日期</th>
                    <th>体温</th>
                    <th>状态</th>
                    <th>当前节点</th>
                    <th>超时情况</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr key={record.id}>
                      <td>#{record.id}</td>
                      <td>{record.child_name}</td>
                      <td>{record.class_name}</td>
                      <td>{record.check_date}</td>
                      <td>{record.temperature ? record.temperature + '℃' : '-'}</td>
                      <td>
                        <span className={`status-tag status-${record.status}`}>
                          {record.status_name}
                        </span>
                      </td>
                      <td>{record.current_node_name}</td>
                      <td>
                        {record.status === 'archived' ? (
                          <span className="timeout-tag normal">已完成</span>
                        ) : record.timeout?.isTimeout ? (
                          <span className="timeout-tag">
                            超时 {formatDuration(record.timeout.overdueMs)}
                          </span>
                        ) : (
                          <span className="timeout-tag normal">
                            剩余 {formatDuration(record.timeout?.remainingMs || 0)}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-small"
                          onClick={() => route(`/records/${record.id}`)}
                        >
                          详情
                        </button>
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

      {showCreate && (
        <CreateRecordModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          defaultDate={checkDate}
        />
      )}
    </div>
  )
}
