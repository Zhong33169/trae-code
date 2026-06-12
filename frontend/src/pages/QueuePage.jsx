import { createSignal, createEffect, For, Show } from 'solid-js'
import { useApi } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  statusNames,
  riskNames,
  stageNames,
  formatDate,
  getPriorityClass,
  roleNames,
} from '../utils/constants.js'

export default function QueuePage(props) {
  const api = useApi()
  const { currentUser, roleNames: rn } = useAuth()
  const [orders, setOrders] = createSignal([])
  const [statusFilter, setStatusFilter] = createSignal('')
  const [riskFilter, setRiskFilter] = createSignal('')
  const [stageFilter, setStageFilter] = createSignal('')
  const [myTasks, setMyTasks] = createSignal({})

  const loadOrders = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter()) params.append('status', statusFilter())
      if (riskFilter()) params.append('risk', riskFilter())
      if (stageFilter()) params.append('stage', stageFilter())

      const url = '/orders' + (params.toString() ? `?${params.toString()}` : '')
      const data = await api.get(url)
      setOrders(data)

      const stats = await api.get('/statistics')
      setMyTasks(stats.my_tasks || {})
    } catch (err) {
      alert('加载订单列表失败: ' + err.message)
    }
  }

  createEffect(() => {
    loadOrders()
  }, [statusFilter(), riskFilter(), stageFilter(), props.refreshKey, currentUser().id])

  return (
    <div>
      <h2 class="page-title">工单队列</h2>

      <div class="my-tasks">
        <h3>我的待办 - {rn[currentUser().role]} {currentUser().name}</h3>
        <div class="my-task-list">
          <For each={Object.entries(myTasks())}>
            {([status, count]) => (
              <span class="my-task-item">
                {statusNames[status] || status}
                <span class="count">{count}</span>
              </span>
            )}
          </For>
          <Show when={Object.keys(myTasks()).length === 0}>
            <span style="color: #6b7280; font-size: 0.875rem;">暂无待办</span>
          </Show>
        </div>
      </div>

      <div class="filters">
        <div class="filter-group">
          <label>状态：</label>
          <select value={statusFilter()} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">全部</option>
            {Object.entries(statusNames).map(([k, v]) => (
              <option value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div class="filter-group">
          <label>风险：</label>
          <select value={riskFilter()} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="">全部</option>
            {Object.entries(riskNames).map(([k, v]) => (
              <option value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div class="filter-group">
          <label>阶段：</label>
          <select value={stageFilter()} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="">全部</option>
            {Object.entries(stageNames).map(([k, v]) => (
              <option value={k}>{v}</option>
            ))}
          </select>
        </div>
        <button class="btn btn-secondary" onClick={loadOrders}>🔄 刷新</button>
      </div>

      <div class="order-list">
        <For each={orders()} fallback={<div class="empty-state">暂无工单</div>}>
          {(order) => (
            <div class="order-item" onClick={() => props.onSelectOrder(order.id)}>
              <div class="order-info">
                <h4>{order.title}</h4>
                <div class="order-no">{order.order_no} · {stageNames[order.current_stage]}</div>
                <div class="desc">{order.description}</div>
              </div>
              <div>
                <span class={`risk-tag risk-${order.risk_level}`}>
                  {riskNames[order.risk_level]}
                </span>
              </div>
              <div>
                <span class={`status-tag status-${order.status}`}>
                  {statusNames[order.status]}
                </span>
                <Show when={order.is_overdue}>
                  <div style="margin-top: 0.25rem;">
                    <span class="badge badge-overdue">逾期</span>
                  </div>
                </Show>
                <Show when={order.evidence_count < order.required_evidences}>
                  <div style="margin-top: 0.25rem;">
                    <span class="badge badge-evidence">缺证据</span>
                  </div>
                </Show>
              </div>
              <div>
                <div style="font-size: 0.8rem; margin-bottom: 0.25rem;">
                  优先级 {order.priority}
                </div>
                <div class="priority-bar">
                  <div
                    class={`priority-fill ${getPriorityClass(order.priority)}`}
                    style={{ width: `${Math.min(order.priority, 100)}%` }}
                  />
                </div>
                <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">
                  证据 {order.evidence_count}/{order.required_evidences}
                </div>
              </div>
              <div style="font-size: 0.8rem;">
                <div style="margin-bottom: 0.25rem;">
                  📅 {formatDate(order.due_date)}
                </div>
                <div style="color: #6b7280;">
                  处理人：{order.current_handler || '未分配'}
                </div>
                <div style="color: #6b7280; margin-top: 0.25rem;">
                  v{order.version}
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
