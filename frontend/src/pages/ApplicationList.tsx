import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { applicationApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { LeaseApplication } from '../types'
import {
  EmptyState, Loading, Pagination, StatusBadge, NodeBadge,
} from '../components/Common'

export default function ApplicationList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const { showToast } = useToast()

  const [list, setList] = useState<Partial<LeaseApplication>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const initialLoad = useRef(true)

  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    keyword: searchParams.get('keyword') || '',
    isOverdue: searchParams.get('isOverdue') || '',
    currentNode: searchParams.get('currentNode') || '',
    hasOverdueBlocked: searchParams.get('hasOverdueBlocked') || '',
  })

  const statusOptions: Array<{ v: string; l: string }> = [
    { v: '', l: '全部状态' },
    { v: 'draft', l: '草稿' },
    { v: 'pending_review', l: '待审核' },
    { v: 'returned', l: '已退回' },
    { v: 'pending_confirm', l: '待房态确认' },
    { v: 'pending_handover', l: '待入住交接' },
    { v: 'room_confirmed', l: '待复核归档' },
    { v: 'completed', l: '已完成' },
    { v: 'rejected', l: '已拒绝' },
  ]

  const nodeOptions: Array<{ v: string; l: string }> = [
    { v: '', l: '全部节点' },
    { v: 'contract_signing', l: '租客签约' },
    { v: 'review', l: '租约审核' },
    { v: 'room_confirm', l: '房态确认' },
    { v: 'handover', l: '入住交接' },
    { v: 'archive', l: '复核归档' },
  ]

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false
      return
    }
    loadList()
  }, [page, filters.status, filters.isOverdue, filters.currentNode, filters.keyword, filters.hasOverdueBlocked])

  useEffect(() => {
    loadList()
  }, [])

  async function loadList() {
    setLoading(true)
    try {
      const res = await applicationApi.getList({
        page, pageSize,
        status: filters.status,
        keyword: filters.keyword,
        isOverdue: filters.isOverdue,
        currentNode: filters.currentNode,
        hasOverdueBlocked: filters.hasOverdueBlocked,
      })
      setList(res.items || [])
      setTotal(res.total || 0)
    } catch (err: any) {
      showToast(err.message || '加载列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    setPage(1)
    const params: any = {}
    if (filters.status) params.status = filters.status
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.isOverdue) params.isOverdue = filters.isOverdue
    if (filters.currentNode) params.currentNode = filters.currentNode
    if (filters.hasOverdueBlocked) params.hasOverdueBlocked = filters.hasOverdueBlocked
    setSearchParams(params)
    loadList()
  }

  function resetFilters() {
    setFilters({ status: '', keyword: '', isOverdue: '', currentNode: '', hasOverdueBlocked: '' })
    setPage(1)
    setSearchParams({})
  }

  function handleBatchRefresh() {
    loadList()
    showToast('列表已刷新', 'success')
  }

  function getActions(app: Partial<LeaseApplication>) {
    const actions: React.ReactNode[] = [
      <Link key="view" to={`/applications/${app.id}`} className="btn btn-sm btn-link">详情</Link>,
    ]

    if (hasRole('registrar')) {
      if (app.status === 'draft' || app.status === 'returned') {
        actions.push(
          <Link key="edit" to={`/applications/${app.id}/edit`} className="btn btn-sm btn-link">编辑</Link>
        )
        actions.push(
          <button
            key="submit"
            className="btn btn-sm btn-primary"
            onClick={() => handleSubmit(app)}
          >提交审核</button>
        )
      }
    }

    if (hasRole('auditor')) {
      if (app.status === 'pending_review') {
        actions.push(
          <Link key="review" to={`/applications/${app.id}`} className="btn btn-sm btn-success">去审核</Link>
        )
      }
      if (app.status === 'pending_confirm') {
        actions.push(
          <Link key="confirm" to={`/applications/${app.id}`} className="btn btn-sm btn-warning">房态确认</Link>
        )
      }
      if (app.status === 'pending_handover') {
        actions.push(
          <Link key="handover" to={`/applications/${app.id}`} className="btn btn-sm btn-warning">入住交接</Link>
        )
      }
    }

    if (hasRole('reviewer')) {
      if (app.status === 'pending_handover') {
        actions.push(
          <Link key="handover" to={`/applications/${app.id}`} className="btn btn-sm btn-warning">入住交接</Link>
        )
      }
      if (app.status === 'room_confirmed') {
        actions.push(
          <Link key="archive" to={`/applications/${app.id}`} className="btn btn-sm btn-success">复核归档</Link>
        )
      }
    }

    return actions
  }

  async function handleSubmit(app: Partial<LeaseApplication>) {
    if (!confirm(`确定提交申请【${app.applicationNo}】至审核环节？`)) return
    try {
      await applicationApi.submit(app.id!)
      showToast('提交审核成功', 'success')
      loadList()
    } catch (err: any) {
      showToast(err.message || '提交失败', 'error')
    }
  }

  return (
    <div>
      {hasRole('registrar') && (
        <div className="filter-bar">
          <div className="filter-item">
            <label className="filter-label">状态</label>
            <select className="form-control" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              {statusOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">当前节点</label>
            <select className="form-control" value={filters.currentNode} onChange={e => setFilters({ ...filters, currentNode: e.target.value })}>
              {nodeOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">超时</label>
            <select className="form-control" value={filters.isOverdue} onChange={e => setFilters({ ...filters, isOverdue: e.target.value })}>
              <option value="">全部</option>
              <option value="true">已超时</option>
              <option value="false">正常</option>
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">审计拦截</label>
            <select className="form-control" value={filters.hasOverdueBlocked} onChange={e => setFilters({ ...filters, hasOverdueBlocked: e.target.value })}>
              <option value="">全部</option>
              <option value="true">有拦截记录</option>
              <option value="false">无拦截记录</option>
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">关键字搜索</label>
            <input
              type="text"
              className="form-control"
              placeholder="申请编号/租客/房号"
              value={filters.keyword}
              onChange={e => setFilters({ ...filters, keyword: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ width: '240px' }}
            />
          </div>
          <div className="filter-actions">
            <button className="btn" onClick={resetFilters}>重置</button>
            <button className="btn btn-primary" onClick={handleSearch}>查询</button>
            <button className="btn" onClick={handleBatchRefresh}>🔄 刷新</button>
          </div>
        </div>
      )}

      {!hasRole('registrar') && (
        <div className="filter-bar">
          <div className="filter-item">
            <label className="filter-label">状态</label>
            <select className="form-control" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              {statusOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">超时</label>
            <select className="form-control" value={filters.isOverdue} onChange={e => setFilters({ ...filters, isOverdue: e.target.value })}>
              <option value="">全部</option>
              <option value="true">已超时</option>
              <option value="false">正常</option>
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">审计拦截</label>
            <select className="form-control" value={filters.hasOverdueBlocked} onChange={e => setFilters({ ...filters, hasOverdueBlocked: e.target.value })}>
              <option value="">全部</option>
              <option value="true">有拦截记录</option>
              <option value="false">无拦截记录</option>
            </select>
          </div>
          <div className="filter-item">
            <label className="filter-label">关键字搜索</label>
            <input
              type="text"
              className="form-control"
              placeholder="申请编号/租客/房号"
              value={filters.keyword}
              onChange={e => setFilters({ ...filters, keyword: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ width: '240px' }}
            />
          </div>
          <div className="filter-actions">
            <button className="btn" onClick={resetFilters}>重置</button>
            <button className="btn btn-primary" onClick={handleSearch}>查询</button>
            <button className="btn" onClick={handleBatchRefresh}>🔄 刷新</button>
            {hasRole('registrar') && (
              <button className="btn btn-success" onClick={() => navigate('/applications/new')}>➕ 新建申请</button>
            )}
          </div>
        </div>
      )}

      {hasRole('registrar') && (
        <div className="mb-16">
          <button className="btn btn-success" onClick={() => navigate('/applications/new')}>
            ➕ 新建租约申请
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 租约申请列表 <span className="badge badge-blue ml-8">{total} 条</span></div>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="center-loading"><Loading size="lg" /></div>
          ) : list.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>申请编号</th>
                  <th>租客姓名</th>
                  <th>公寓/房号</th>
                  <th>月租金</th>
                  <th>租期</th>
                  <th>当前节点</th>
                  <th>状态</th>
                  <th>超时</th>
                  <th>审计</th>
                  <th>登记人</th>
                  <th>创建时间</th>
                  <th style={{ width: '240px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map(app => (
                  <tr key={app.id}>
                    <td>
                      <Link to={`/applications/${app.id}`} style={{ fontWeight: 600 }}>
                        {app.applicationNo}
                      </Link>
                    </td>
                    <td>{app.tenantName}<br /><span style={{ fontSize: '12px', color: '#6b7280' }}>{app.tenantPhone}</span></td>
                    <td>{app.apartmentName} <b>{app.roomNo}</b></td>
                    <td>¥{app.monthlyRent?.toLocaleString()}</td>
                    <td style={{ fontSize: '12px' }}>{app.leaseStartDate}<br />~ {app.leaseEndDate}</td>
                    <td><NodeBadge nodeType={app.currentNode || ''} nodeName={app.currentNodeName} /></td>
                    <td><StatusBadge status={app.status || ''} statusName={app.statusName} /></td>
                    <td>
                      {app.isOverdue ? (
                        <span className="badge badge-red" title={app.overdueReason}>⚠️ 已超时</span>
                      ) : (
                        <span className="badge badge-green">正常</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                        {(app.overdueBlockedCount || 0) > 0 ? (
                          <span className="badge badge-red" title={`该申请已被拦截 ${app.overdueBlockedCount} 次`}>
                            🚫 拦截 {app.overdueBlockedCount}
                          </span>
                        ) : (
                          <span className="badge" style={{ background: '#f3f4f6', color: '#9ca3af' }}>🚫 拦截 0</span>
                        )}
                        {(app.overdueSupplementedCount || 0) > 0 ? (
                          <span className="badge badge-green" title={`该申请已补录超时记录 ${app.overdueSupplementedCount} 次`}>
                            ✅ 补录 {app.overdueSupplementedCount}
                          </span>
                        ) : (
                          <span className="badge" style={{ background: '#f3f4f6', color: '#9ca3af' }}>✅ 补录 0</span>
                        )}
                      </div>
                    </td>
                    <td>{app.createdByName}</td>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {app.createdAt ? new Date(app.createdAt).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-') : '-'}
                    </td>
                    <td>
                      <div className="actions">
                        {getActions(app)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {list.length > 0 && !loading && (
          <Pagination total={total} page={page} pageSize={pageSize} onChange={setPage} />
        )}
      </div>
    </div>
  )
}
