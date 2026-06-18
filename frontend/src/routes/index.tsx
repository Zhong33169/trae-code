import { useState, useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { api } from '../lib/api.js'
import { STATUS, STATUS_NAMES, STATUS_COLORS, ROLES, ISSUE_TYPE_NAMES, SAMPLE_CASE_NAMES, SAMPLE_CASE_COLORS } from '../lib/constants.js'
import { useCurrentUser } from '../lib/userContext.jsx'

export const Route = createFileRoute('/')({
  component: ApplicationsList,
})

function ApplicationsList() {
  const { currentUser } = useCurrentUser()
  const [data, setData] = useState({ list: [], current_user: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    status: '',
    abnormal: '',
    batch_no: '',
    keyword: ''
  })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showBatchResult, setShowBatchResult] = useState(null)
  const [createForm, setCreateForm] = useState({
    batch_no: '',
    customer_name: '',
    customer_address: '',
    old_meter_no: '',
    new_meter_no: '',
    reason: ''
  })

  const loadData = () => {
    if (!currentUser) return
    setLoading(true)
    setError(null)
    const params = {}
    Object.keys(filters).forEach(k => {
      if (filters[k]) params[k] = filters[k]
    })
    api.getApplications(params)
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [filters, currentUser?.id])

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === data.list.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.list.map(a => a.id)))
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await api.createApplication(createForm)
      setShowCreateModal(false)
      setCreateForm({
        batch_no: '',
        customer_name: '',
        customer_address: '',
        old_meter_no: '',
        new_meter_no: '',
        reason: ''
      })
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleBatchArchive = async () => {
    if (selectedIds.size === 0) {
      alert('请选择要归档的申请')
      return
    }
    try {
      const result = await api.batchArchive({ ids: Array.from(selectedIds) })
      setShowBatchResult(result)
      setSelectedIds(new Set())
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const canCreate = currentUser?.role === ROLES.METER_OPERATOR
  const canBatchArchive = currentUser?.role === ROLES.GAS_ARCHIVIST
  const archivableCount = data.list.filter(a =>
    a.status === STATUS.PENDING_ARCHIVIST && selectedIds.has(a.id)
  ).length

  if (loading) return <div>加载中...</div>
  if (error) return <div className="alert alert-error">错误: {error}</div>

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="section-title">换表申请列表</h2>
          <div className="actions">
            {canCreate && (
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                + 新建申请
              </button>
            )}
          </div>
        </div>

        <div className="filters" style={{ marginBottom: 16 }}>
          <div className="filter-group">
            <label>状态</label>
            <select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)}>
              <option value="">全部状态</option>
              {Object.entries(STATUS_NAMES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>异常</label>
            <select value={filters.abnormal} onChange={e => handleFilterChange('abnormal', e.target.value)}>
              <option value="">全部</option>
              <option value="true">仅异常</option>
            </select>
          </div>
          <div className="filter-group">
            <label>批次号</label>
            <input
              type="text"
              placeholder="输入批次号"
              value={filters.batch_no}
              onChange={e => handleFilterChange('batch_no', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>关键词</label>
            <input
              type="text"
              placeholder="客户名称/表号"
              value={filters.keyword}
              onChange={e => handleFilterChange('keyword', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <button className="btn btn-outline" onClick={() => setFilters({
              status: '', abnormal: '', batch_no: '', keyword: ''
            })}>重置筛选</button>
          </div>
        </div>

        {canBatchArchive && (
          <div className="batch-actions">
            <button
              className="btn btn-success btn-sm"
              onClick={handleBatchArchive}
              disabled={archivableCount === 0}
            >
              批量复核归档 ({archivableCount})
            </button>
            <span className="batch-count">
              已选 {selectedIds.size} / 共 {data.list.length} 条
            </span>
          </div>
        )}

        <table className="table">
          <thead>
            <tr>
              {canBatchArchive && (
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === data.list.length && data.list.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <th>申请编号</th>
              <th>批次号</th>
              <th>客户名称</th>
              <th>样例类型</th>
              <th>状态</th>
              <th>下一步办理人</th>
              <th>离线台账</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.list.length === 0 ? (
              <tr>
                <td colSpan={canBatchArchive ? 9 : 8} className="empty-state">
                  暂无数据
                </td>
              </tr>
            ) : data.list.map(app => (
              <tr key={app.id} className={app.is_abnormal ? 'row-abnormal' : ''}>
                {canBatchArchive && (
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(app.id)}
                      onChange={() => toggleSelect(app.id)}
                    />
                  </td>
                )}
                <td>
                  <Link to="/applications/$id" params={{ id: app.id }} className="link">
                    {app.id}
                  </Link>
                </td>
                <td>{app.batch_no}</td>
                <td>{app.customer_name}</td>
                <td>
                  {app.sample_case_name && (
                    <span className="sample-tag" style={{ backgroundColor: app.sample_case_color || '#64748b', color: '#fff' }}>
                      {app.sample_case_name}
                    </span>
                  )}
                  {app.offline_expected_issue_name && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
                      预期异常：{app.offline_expected_issue_name}
                    </div>
                  )}
                </td>
                <td>
                  <span className="status-tag" style={{ backgroundColor: STATUS_COLORS[app.status] }}>
                    {STATUS_NAMES[app.status]}
                  </span>
                  {app.is_abnormal && <span className="abnormal-tag">异常</span>}
                </td>
                <td>
                  {app.next_action?.next_user ? (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {app.next_action.next_user.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {app.next_action.next_user.role_name}
                      </div>
                      <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>
                        {app.next_action.action_name}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: 13 }}>-</span>
                  )}
                </td>
                <td>
                  {app.offline_ledger_backfilled ? (
                    <span style={{ color: '#16a34a', fontSize: 13 }}>&#10003; 已回填</span>
                  ) : (
                    <span style={{ color: '#dc2626', fontSize: 13 }}>&#10007; 未回填</span>
                  )}
                </td>
                <td>
                  <Link to="/applications/$id" params={{ id: app.id }} className="link">
                    查看详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>新建换表申请</h3>
            <form onSubmit={handleCreate}>
              <div className="field">
                <label>批次号 *</label>
                <input
                  type="text"
                  required
                  value={createForm.batch_no}
                  onChange={e => setCreateForm({ ...createForm, batch_no: e.target.value })}
                  placeholder="如 BATCH202501001"
                />
              </div>
              <div className="field">
                <label>客户名称 *</label>
                <input
                  type="text"
                  required
                  value={createForm.customer_name}
                  onChange={e => setCreateForm({ ...createForm, customer_name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>客户地址 *</label>
                <input
                  type="text"
                  required
                  value={createForm.customer_address}
                  onChange={e => setCreateForm({ ...createForm, customer_address: e.target.value })}
                />
              </div>
              <div className="field">
                <label>旧表号 *</label>
                <input
                  type="text"
                  required
                  value={createForm.old_meter_no}
                  onChange={e => setCreateForm({ ...createForm, old_meter_no: e.target.value })}
                />
              </div>
              <div className="field">
                <label>新表号 *</label>
                <input
                  type="text"
                  required
                  value={createForm.new_meter_no}
                  onChange={e => setCreateForm({ ...createForm, new_meter_no: e.target.value })}
                />
              </div>
              <div className="field">
                <label>换表原因 *</label>
                <select
                  required
                  value={createForm.reason}
                  onChange={e => setCreateForm({ ...createForm, reason: e.target.value })}
                >
                  <option value="">请选择</option>
                  <option value="到期更换">到期更换</option>
                  <option value="故障更换">故障更换</option>
                  <option value="损坏更换">损坏更换</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  提交申请
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBatchResult && (
        <div className="modal-overlay" onClick={() => setShowBatchResult(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <h3>批量归档结果</h3>
            <div style={{ marginBottom: 12 }}>
              <span style={{ color: '#16a34a' }}>成功: {showBatchResult.success}</span>
              <span style={{ margin: '0 12px', color: '#94a3b8' }}>|</span>
              <span style={{ color: '#d97706' }}>拦截: {showBatchResult.blocked}</span>
              <span style={{ margin: '0 12px', color: '#94a3b8' }}>|</span>
              <span style={{ color: '#dc2626' }}>失败: {showBatchResult.failed}</span>
              <span style={{ margin: '0 12px', color: '#94a3b8' }}>|</span>
              <span>总计: {showBatchResult.total}</span>
            </div>
            <div className="result-list">
              {showBatchResult.results.map(r => (
                <div key={r.id} className={`result-item ${r.archived ? 'success' : 'failed'}`}>
                  <strong>{r.id}</strong>
                  {r.archived ? (
                    <span> - {r.detail}</span>
                  ) : (
                    <div>
                      <div>- {r.error || r.detail}</div>
                      {r.issues && r.issues.length > 0 && (
                        <div className="issue-list">
                          {r.issues.map((issue, idx) => (
                            <div key={idx} className="issue-item" style={{ padding: 8 }}>
                              <div className="issue-type">[{issue.type_name}]</div>
                              <div className="issue-comparison">
                                <div className="issue-side issue-side-online">
                                  <div className="issue-side-label">{issue.online.label}</div>
                                  <div>{issue.online.value}</div>
                                </div>
                                <div className="issue-side issue-side-offline">
                                  <div className="issue-side-label">{issue.offline.label}</div>
                                  <div>{issue.offline.value}</div>
                                </div>
                              </div>
                              <div className="issue-message">{issue.message}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowBatchResult(null)}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
