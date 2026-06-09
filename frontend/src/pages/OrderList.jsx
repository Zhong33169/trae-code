import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import QueueStats from '../components/QueueStats'
import FilterBar from '../components/FilterBar'
import OrderTable from '../components/OrderTable'
import Modal from '../components/Modal'
import { getRoleInfo } from '../utils/constants'

export default function OrderList({ currentRole, currentUser }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [filters, setFilters] = useState({
    status: '',
    anomaly_type: '',
    search: '',
    is_overdue: '',
    role_view: '',
  })
  const [batchResult, setBatchResult] = useState(null)
  const [showBatchResult, setShowBatchResult] = useState(false)
  const [message, setMessage] = useState(null)

  const roleInfo = getRoleInfo(currentRole)

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getQueueStats()
      setStats(data)
    } catch (err) {
      console.error('获取队列统计失败:', err)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        ...filters,
        role_view: filters.role_view || currentRole,
      }
      const data = await api.listOrders(params)
      setOrders(data)
      setSelectedIds([])
    } catch (err) {
      showMessage(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, currentRole])

  useEffect(() => {
    fetchStats()
    fetchOrders()
  }, [fetchStats, fetchOrders])

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
  }

  const handleFilterClick = (filter) => {
    const newFilters = {
      ...filters,
      ...filter,
    }
    setFilters(newFilters)
  }

  const handleResetFilters = () => {
    setFilters({
      status: '',
      anomaly_type: '',
      search: '',
      is_overdue: '',
      role_view: '',
    })
  }

  const handleBatchSubmit = async () => {
    if (selectedIds.length === 0) {
      showMessage('请先选择订单', 'error')
      return
    }
    try {
      const result = await api.batchSubmit(selectedIds)
      setBatchResult(result)
      setShowBatchResult(true)
      fetchStats()
      fetchOrders()
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  const handleBatchReview = async () => {
    if (selectedIds.length === 0) {
      showMessage('请先选择订单', 'error')
      return
    }
    try {
      const result = await api.batchReview(selectedIds)
      setBatchResult(result)
      setShowBatchResult(true)
      fetchStats()
      fetchOrders()
    } catch (err) {
      showMessage(err.message, 'error')
    }
  }

  const handleCreateOrder = () => {
    navigate('/orders/new')
  }

  const getBatchActions = () => {
    const actions = []
    if (currentRole === 'registrar') {
      actions.push({ label: '批量提交审核', onClick: handleBatchSubmit, type: 'primary' })
    }
    if (currentRole === 'supervisor') {
      actions.push({ label: '批量审核通过', onClick: handleBatchReview, type: 'primary' })
    }
    return actions
  }

  const batchActions = getBatchActions()

  return (
    <div className="order-list-page">
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>配镜订单管理</h2>
          <p className="page-desc">
            当前角色：<span style={{ color: roleInfo.color, fontWeight: 500 }}>{roleInfo.label}</span>
            （{currentUser}）
          </p>
        </div>
        {currentRole === 'registrar' && (
          <button className="btn btn-primary" onClick={handleCreateOrder}>
            + 新建订单
          </button>
        )}
      </div>

      <QueueStats stats={stats} onFilterClick={handleFilterClick} />

      <div className="list-section">
        <div className="list-header">
          <h3>订单列表</h3>
          {selectedIds.length > 0 && (
            <span className="selected-count">
              已选择 <strong>{selectedIds.length}</strong> 条
            </span>
          )}
        </div>

        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          currentRole={currentRole}
        />

        {batchActions.length > 0 && selectedIds.length > 0 && (
          <div className="batch-actions">
            {batchActions.map((action, idx) => (
              <button
                key={idx}
                className={`btn ${action.type === 'primary' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="loading">加载中...</div>
        ) : (
          <OrderTable
            orders={orders}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            currentRole={currentRole}
          />
        )}
      </div>

      <Modal
        title="批量操作结果"
        visible={showBatchResult}
        onClose={() => setShowBatchResult(false)}
        okText="知道了"
        onOk={() => setShowBatchResult(false)}
        width={600}
      >
        {batchResult && (
          <div className="batch-result">
            <div className="batch-result-summary">
              <span>共处理 <strong>{batchResult.total}</strong> 条</span>
              <span className="success">成功 <strong>{batchResult.success_count}</strong> 条</span>
              <span className="failure">失败 <strong>{batchResult.failure_count}</strong> 条</span>
            </div>
            <div className="batch-result-list">
              <h4>逐条说明：</h4>
              <ul>
                {batchResult.results.map((item, idx) => (
                  <li key={idx} className={item.success ? 'success' : 'failure'}>
                    <span className="order-no">{item.order_no}</span>
                    <span className="result-status">{item.success ? '成功' : '失败'}</span>
                    <span className="result-msg">{item.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
