import { useState, useEffect } from 'preact/hooks'
import { Link } from 'react-router-dom'
import { User, PolicyOrder, api } from '../api/client'

interface Props {
  user: User
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING_REVIEW', label: '待审核' },
  { value: 'PENDING_CORRECTION', label: '待补正' },
  { value: 'REVIEWED', label: '审核通过' },
  { value: 'APPROVED', label: '复核通过' },
  { value: 'ARCHIVED', label: '已归档' },
  { value: 'REJECTED', label: '已退回' }
]

const ABNORMAL_OPTIONS = [
  { value: 'ALL', label: '全部' },
  { value: 'NORMAL', label: '正常' },
  { value: 'MISSING_ATTACHMENT', label: '缺材料' },
  { value: 'TIMEOUT', label: '超时' },
  { value: 'REJECTED', label: '已退回' }
]

function OrderList({ user }: Props) {
  const [orders, setOrders] = useState<PolicyOrder[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [abnormalFilter, setAbnormalFilter] = useState('ALL')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showBatchResult, setShowBatchResult] = useState(false)
  const [batchResult, setBatchResult] = useState<any>(null)
  const [formData, setFormData] = useState({ title: '', applicant: '', amount: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadOrders()
  }, [statusFilter, abnormalFilter, user.role])

  const loadOrders = async () => {
    try {
      const res = await api.orders.list({
        status: statusFilter,
        abnormal: abnormalFilter,
        role: user.role
      })
      setOrders(res.orders)
      setSelectedIds([])
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleSelectAll = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked
    if (checked) {
      setSelectedIds(orders.map(o => o.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelect = (id: number, e: Event) => {
    const checked = (e.target as HTMLInputElement).checked
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter(x => x !== id))
    }
  }

  const handleCreate = async (e: Event) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.orders.create({
        title: formData.title,
        applicant: formData.applicant,
        amount: parseFloat(formData.amount),
        userId: user.id
      })
      setShowCreateModal(false)
      setFormData({ title: '', applicant: '', amount: '' })
      loadOrders()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchSubmit = async () => {
    if (selectedIds.length === 0) {
      alert('请先选择要操作的兑现单')
      return
    }
    try {
      const res = await api.orders.batchResult({
        orderIds: selectedIds,
        action: 'BATCH_SUBMIT',
        userId: user.id,
        remark: '批量提交审核'
      })
      setBatchResult(res)
      setShowBatchResult(true)
      loadOrders()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const canCreate = user.role === 'REGISTRAR'
  const canBatchSubmit = user.role === 'REGISTRAR' && selectedIds.some(id => {
    const order = orders.find(o => o.id === id)
    return order?.status === 'DRAFT'
  })

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div>
      <h2 class="page-title">政策兑现单列表</h2>

      <div class="card">
        <div class="filter-bar">
          <div class="filter-group">
            <label>状态：</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div class="filter-group">
            <label>异常：</label>
            <select value={abnormalFilter} onChange={(e) => setAbnormalFilter((e.target as HTMLSelectElement).value)}>
              {ABNORMAL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}></div>
          {canCreate && (
            <button class="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              ➕ 新建兑现单
            </button>
          )}
          {canBatchSubmit && (
            <button class="btn btn-success" onClick={handleBatchSubmit}>
              📤 批量提交审核 ({selectedIds.length})
            </button>
          )}
        </div>

        {orders.length === 0 ? (
          <div class="empty">暂无数据</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th class="checkbox-col">
                  {user.role === 'REGISTRAR' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.length === orders.length && orders.length > 0}
                      onInput={handleSelectAll}
                    />
                  )}
                </th>
                <th>兑现单号</th>
                <th>标题</th>
                <th>申请单位</th>
                <th>金额（元）</th>
                <th>状态</th>
                <th>异常</th>
                <th>附件</th>
                <th>创建人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td class="checkbox-col">
                    {user.role === 'REGISTRAR' && order.status === 'DRAFT' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onInput={(e) => handleSelect(order.id, e)}
                      />
                    )}
                  </td>
                  <td><b>{order.order_no}</b></td>
                  <td>{order.title}</td>
                  <td>{order.applicant}</td>
                  <td class="amount">¥{order.amount.toLocaleString()}</td>
                  <td>
                    <span class={`status-tag status-${order.status}`}>
                      {order.statusLabel}
                    </span>
                  </td>
                  <td>
                    {order.abnormal_type ? (
                      <span class={`abnormal-tag abnormal-${order.abnormal_type}`}>
                        {order.abnormalLabel}
                        {order.isTimeout && order.abnormal_type !== 'TIMEOUT' && '（超时）'}
                      </span>
                    ) : order.isTimeout ? (
                      <span class="abnormal-tag abnormal-TIMEOUT">超时</span>
                    ) : (
                      <span style={{ color: '#52c41a', fontSize: '12px' }}>正常</span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: order.hasAllAttachments ? '#52c41a' : '#faad14' }}>
                      {order.valid_attachments}/{order.required_attachments}
                    </span>
                    {!order.hasAllAttachments && order.required_attachments > 0 && (
                      <span style={{ color: '#ff4d4f', fontSize: '12px' }}> 缺件</span>
                    )}
                  </td>
                  <td>{order.creator_name}</td>
                  <td style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    {formatDate(order.created_at)}
                  </td>
                  <td>
                    <Link to={`/orders/${order.id}`} class="link-btn">
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <div class="modal-mask" onClick={() => setShowCreateModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">新建政策兑现单</h3>
            <form onSubmit={handleCreate}>
              <div class="form-group">
                <label>兑现项目名称</label>
                <input
                  type="text"
                  value={formData.title}
                  onInput={(e) => setFormData({ ...formData, title: (e.target as HTMLInputElement).value })}
                  placeholder="如：高新技术企业认定奖励"
                  required
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>申请单位</label>
                  <input
                    type="text"
                    value={formData.applicant}
                    onInput={(e) => setFormData({ ...formData, applicant: (e.target as HTMLInputElement).value })}
                    placeholder="请输入申请单位名称"
                    required
                  />
                </div>
                <div class="form-group">
                  <label>申请金额（元）</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onInput={(e) => setFormData({ ...formData, amount: (e.target as HTMLInputElement).value })}
                    placeholder="请输入申请金额"
                    required
                  />
                </div>
              </div>
              <div class="alert alert-info">
                创建后为草稿状态，可在详情页添加附件后提交审核
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-default" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button type="submit" class="btn btn-primary" disabled={loading}>
                  {loading ? '创建中...' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBatchResult && batchResult && (
        <div class="modal-mask" onClick={() => setShowBatchResult(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">批量操作结果</h3>
            <div class="alert alert-info">
              📊 {batchResult.summary}
            </div>
            <div class="batch-result">
              {batchResult.results.map((r: any, idx: number) => (
                <div key={idx} class={`batch-result-item ${r.success ? 'success' : 'fail'}`}>
                  <b>{r.orderNo || '#' + r.orderId}</b> - 
                  {r.success ? `✅ ${r.action}` : `❌ ${r.reason}`}
                  {r.detail && <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>{r.detail}</div>}
                </div>
              ))}
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary" onClick={() => setShowBatchResult(false)}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderList
