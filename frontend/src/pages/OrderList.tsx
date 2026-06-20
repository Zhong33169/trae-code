import { useState, useEffect } from 'preact/hooks'
import { Link } from 'react-router-dom'
import { User, PolicyOrder, RequiredAttachmentDef, api } from '../api/client'

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

interface FormState {
  title: string
  applicant: string
  amount: string
  requiredAttachmentNames: string[]
}

function buildDefaultForm(): FormState {
  return {
    title: '',
    applicant: '',
    amount: '',
    requiredAttachmentNames: ['营业执照', '资质证明文件']
  }
}

function OrderList({ user }: Props) {
  const [orders, setOrders] = useState<PolicyOrder[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [abnormalFilter, setAbnormalFilter] = useState('ALL')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null)
  const [editOrder, setEditOrder] = useState<{ id: number; defs: RequiredAttachmentDef[] } | null>(null)
  const [showBatchResult, setShowBatchResult] = useState(false)
  const [batchResult, setBatchResult] = useState<any>(null)
  const [formData, setFormData] = useState<FormState>(buildDefaultForm())
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

  const openCreate = () => {
    setFormData(buildDefaultForm())
    setEditOrder(null)
    setShowModal('create')
  }

  const openEdit = async (order: PolicyOrder) => {
    setLoading(true)
    try {
      const res = await api.orders.get(order.id)
      const defs = (res.requiredDefs || []).slice().sort((a, b) => a.sort_order - b.sort_order)
      setFormData({
        title: res.order.title,
        applicant: res.order.applicant,
        amount: String(res.order.amount),
        requiredAttachmentNames: defs.map(d => d.name)
      })
      setEditOrder({ id: order.id, defs })
      setShowModal('edit')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const addRequiredItem = () => {
    setFormData({
      ...formData,
      requiredAttachmentNames: [...formData.requiredAttachmentNames, '']
    })
  }

  const removeRequiredItem = (idx: number) => {
    if (editOrder) {
      const def = editOrder.defs[idx]
      if (def) {
        const hasActiveDef = (def as any).has_active
        if (hasActiveDef || formData.requiredAttachmentNames[idx].trim()) {
          if (hasActiveDef) {
            alert(`「${def.name}」已上传有效附件，无法删除。请先删除对应附件。`)
            return
          }
        }
      }
    }
    const next = formData.requiredAttachmentNames.slice()
    next.splice(idx, 1)
    setFormData({ ...formData, requiredAttachmentNames: next })
  }

  const updateRequiredItem = (idx: number, value: string) => {
    const next = formData.requiredAttachmentNames.slice()
    next[idx] = value
    setFormData({ ...formData, requiredAttachmentNames: next })
  }

  const handleCreate = async (e: Event) => {
    e.preventDefault()
    const names = formData.requiredAttachmentNames.filter(n => n.trim())
    if (names.length === 0) {
      alert('请至少添加 1 项必备附件清单')
      return
    }
    setLoading(true)
    try {
      await api.orders.create({
        title: formData.title.trim(),
        applicant: formData.applicant.trim(),
        amount: parseFloat(formData.amount),
        requiredAttachmentNames: names,
        userId: user.id
      })
      setShowModal(null)
      setFormData(buildDefaultForm())
      loadOrders()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: Event) => {
    e.preventDefault()
    if (!editOrder) return
    const names = formData.requiredAttachmentNames.filter(n => n.trim())
    if (names.length === 0) {
      alert('请至少保留 1 项必备附件清单')
      return
    }
    setLoading(true)
    try {
      await api.orders.update(editOrder.id, {
        title: formData.title.trim(),
        applicant: formData.applicant.trim(),
        amount: parseFloat(formData.amount),
        requiredAttachmentNames: names
      })
      setShowModal(null)
      setEditOrder(null)
      setFormData(buildDefaultForm())
      loadOrders()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const closeModal = () => {
    setShowModal(null)
    setEditOrder(null)
    setFormData(buildDefaultForm())
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

  const isRegistrar = user.role === 'REGISTRAR'
  const canCreate = isRegistrar
  const canBatchSubmit = isRegistrar && selectedIds.some(id => {
    const order = orders.find(o => o.id === id)
    return order?.status === 'DRAFT'
  })

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const canEditOrder = (order: PolicyOrder) =>
    isRegistrar && ['DRAFT', 'PENDING_CORRECTION'].includes(order.status)

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
            <button class="btn btn-primary" onClick={openCreate}>
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
                  {isRegistrar && (
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
                <th>必备附件</th>
                <th>创建人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td class="checkbox-col">
                    {isRegistrar && order.status === 'DRAFT' && (
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
                  <td style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Link to={`/orders/${order.id}`} class="link-btn">
                      详情
                    </Link>
                    {canEditOrder(order) && (
                      <button
                        class="link-btn"
                        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                        onClick={() => openEdit(order)}
                        disabled={loading}
                      >
                        编辑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div class="modal-mask" onClick={closeModal}>
          <div class="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">
              {showModal === 'create' ? '新建政策兑现单' : '编辑政策兑现单'}
            </h3>
            <form onSubmit={showModal === 'create' ? handleCreate : handleUpdate}>
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

              <div class="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ marginBottom: 0 }}>📋 必备附件清单</label>
                  <button
                    type="button"
                    class="link-btn"
                    onClick={addRequiredItem}
                    style={{ fontSize: '13px' }}
                  >
                    ➕ 新增一项
                  </button>
                </div>
                <div class="def-editor-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {formData.requiredAttachmentNames.map((name, idx) => (
                    <div key={idx} class="def-editor-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#8c8c8c', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        第 {idx + 1} 项：
                      </span>
                      <input
                        type="text"
                        value={name}
                        onInput={(e) => updateRequiredItem(idx, (e.target as HTMLInputElement).value)}
                        placeholder="如：营业执照、研发费用专项审计报告"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        onClick={() => removeRequiredItem(idx)}
                        disabled={formData.requiredAttachmentNames.length <= 1}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
                {showModal === 'edit' && editOrder && (
                  <div class="alert alert-info" style={{ fontSize: '12px', marginTop: 10 }}>
                    💡 已上传有效附件的清单项不能删除，只能改名。
                  </div>
                )}
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-default" onClick={closeModal}>
                  取消
                </button>
                <button type="submit" class="btn btn-primary" disabled={loading}>
                  {loading
                    ? '保存中...'
                    : (showModal === 'create' ? '创建（草稿）' : '保存修改')}
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
