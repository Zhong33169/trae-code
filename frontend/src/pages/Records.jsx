import { useState, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { api, formatDuration, todayStr } from '../utils/api.js'
import CreateRecordModal from '../components/CreateRecordModal.jsx'
import BatchResultModal from '../components/BatchResultModal.jsx'

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
  const [activeTab, setActiveTab] = useState('queue')
  const [selectedIds, setSelectedIds] = useState([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResult, setBatchResult] = useState(null)
  const [batchType, setBatchType] = useState('audit')

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
      setSelectedIds([])
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

  const toggleSelectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(records.map(r => r.id))
    }
  }

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const canShowBatchAudit = () => {
    return user.role === 'auditor' && selectedIds.length > 0 && activeTab === 'queue'
  }

  const canShowBatchReview = () => {
    return user.role === 'reviewer' && selectedIds.length > 0 && activeTab === 'queue'
  }

  const handleBatchAudit = async () => {
    if (!confirm(`确定要批量审核选中的 ${selectedIds.length} 条记录吗？`)) return
    setBatchLoading(true)
    try {
      const res = await api.batchAuditPass(selectedIds, '批量审核通过')
      setBatchType('audit')
      setBatchResult(res)
      loadData()
    } catch (err) {
      alert(err.message || '批量审核失败')
    } finally {
      setBatchLoading(false)
    }
  }

  const handleBatchReview = async () => {
    if (!confirm(`确定要批量复核选中的 ${selectedIds.length} 条记录吗？`)) return
    setBatchLoading(true)
    try {
      const res = await api.batchReviewPass(selectedIds, '批量复核归档')
      setBatchType('review')
      setBatchResult(res)
      loadData()
    } catch (err) {
      alert(err.message || '批量复核失败')
    } finally {
      setBatchLoading(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)
  const isAllSelected = records.length > 0 && selectedIds.length === records.length

  const showCheckbox = () => {
    if (activeTab !== 'queue') return false
    return user.role === 'auditor' || user.role === 'reviewer'
  }

  return (
    <div>
      <div className="page-header">
        <h1>晨检记录</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {showCheckbox() && selectedIds.length > 0 && (
            <span style={{ fontSize: '13px', color: '#606266' }}>
              已选 {selectedIds.length} 项
            </span>
          )}
          {canShowBatchAudit() && (
            <button
              className="btn btn-success"
              onClick={handleBatchAudit}
              disabled={batchLoading}
            >
              {batchLoading ? '处理中...' : '批量审核通过'}
            </button>
          )}
          {canShowBatchReview() && (
            <button
              className="btn btn-success"
              onClick={handleBatchReview}
              disabled={batchLoading}
            >
              {batchLoading ? '处理中...' : '批量复核归档'}
            </button>
          )}
          {user.role === 'registrar' && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + 新建记录
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="tab-bar">
            <div
              className={`tab ${activeTab === 'queue' ? 'active' : ''}`}
              onClick={() => { setActiveTab('queue'); setPage(1); setSelectedIds([]) }}
            >
              我的待办
            </div>
            <div
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => { setActiveTab('all'); setPage(1); setSelectedIds([]) }}
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
                    {showCheckbox() && (
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                        />
                      </th>
                    )}
                    <th>ID</th>
                    <th>幼儿姓名</th>
                    <th>班级</th>
                    <th>检查日期</th>
                    {user.role !== 'registrar' || activeTab === 'all' ? (
                      <th>体温</th>
                    ) : null}
                    <th>状态</th>
                    <th>当前节点</th>
                    <th>超时情况</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr key={record.id}>
                      {showCheckbox() && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(record.id)}
                            onChange={() => toggleSelect(record.id)}
                          />
                        </td>
                      )}
                      <td>#{record.id}</td>
                      <td>{record.child_name}</td>
                      <td>{record.class_name}</td>
                      <td>{record.check_date}</td>
                      {user.role !== 'registrar' || activeTab === 'all' ? (
                        <td>{record.temperature ? record.temperature + '℃' : '-'}</td>
                      ) : null}
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

      {batchResult && (
        <BatchResultModal
          result={batchResult}
          type={batchType}
          onClose={() => setBatchResult(null)}
        />
      )}
    </div>
  )
}
