import { createSignal, createEffect, Show, For } from 'solid-js'
import { useApi } from '../utils/api.js'
import {
  statusNames, riskNames, stageNames, formatDate, getPriorityClass, roleNames } from '../utils/constants.js'

export default function DetailPage(props) {
  const api = useApi()
  const [data, setData] = useState(null)
  const [showAction, setShowAction] = useState('')
  const [opinion, setOpinion] = useState('')
  const [evidences, setEvidences] = useState([])
  const [masterName, setMasterName] = useState('')
  const [masterPhone, setMasterPhone] = useState('')
  const [newRiskLevel, setNewRiskLevel] = useState('')
  const [conflictNote, setConflictNote] = useState('')
  const [processing, setProcessing] = useState(false)

  function useState(initial) {
    const [s, setS] = createSignal(initial)
    return [s, setS]
  }

  const loadDetail = async () => {
    try {
      const d = await api.get(`/orders/${props.orderId}`)
      setData(d)
      setNewRiskLevel(d.order.risk_level)
    } catch (err) {
      alert('加载详情失败: ' + err.message)
    }
  }

  createEffect(() => {
    if (props.orderId) {
      loadDetail()
    }
  }, [props.orderId])

  const addEvidence = () => {
    setEvidences([...evidences(), { type: '', description: '' }])
  }

  const removeEvidence = (idx) => {
    const arr = [...evidences()]
    arr.splice(idx, 1)
    setEvidences(arr)
  }

  const updateEvidence = (idx, field, value) => {
    const arr = [...evidences()]
    arr[idx][field] = value
    setEvidences(arr)
  }

  const processOrder = async () => {
    if (!showAction()) {
      alert('请选择操作类型')
      return
    }
    if (processing()) return

    setProcessing(true)
    try {
      const evList = evidences().filter((e) => e.type)
      const body = {
        action: showAction(),
        opinion: opinion(),
        version: data().order.version,
        evidence_types: evList.map((e) => e.type),
        evidence_descs: evList.map((e) => e.description || ''),
        master_name: masterName(),
        master_phone: masterPhone(),
        new_risk_level: newRiskLevel(),
        conflict_note: conflictNote(),
      }

      const result = await api.post(`/orders/${props.orderId}/process`, body)
      alert(result.message || result.action_label + '成功')
      setShowAction('')
      setOpinion('')
      setEvidences([])
      setProcessing(false)
      if (props.onProcessed) {
        props.onProcessed()
      } else {
        loadDetail()
      }
    } catch (err) {
      setProcessing(false)
      const msg = err.message
      if (msg.includes('版本') || msg.includes('冲突')) {
        alert(msg + '，即将刷新')
        setTimeout(loadDetail, 1000)
      } else {
        alert(msg)
      }
    }
  }

  const getAvailableActions = () => {
    if (!data()) return []
    return data().available_actions || []
  }

  const getLogClass = (action) => {
    if (action.includes('退回') || action.includes('return')) return 'return'
    if (action.includes('创建')) return 'create'
    if (action.includes('派单') || action.includes('dispatch')) return 'dispatch'
    if (action.includes('完工') || action.includes('complete')) return 'complete'
    if (action.includes('归档') || action.includes('archive')) return 'archive'
    return ''
  }

  if (!data()) {
    return <div class="empty-state">加载中...</div>
  }

  const { order, evidences: existingEvidences, operation_logs, prev_handler, prev_opinion, prev_role, can_process } = data()

  return (
    <div>
      <button class="back-btn" onClick={props.onBack}>
        ← 返回队列
      </button>

      <div class="detail-container">
        <div>
          <div class="detail-card">
            <h3>工单基本信息</h3>
            <div class="detail-row">
              <span class="label">工单号：</span>
              <span class="value">{order.order_no}</span>
            </div>
            <div class="detail-row">
              <span class="label">标题：</span>
              <span class="value">{order.title}</span>
            </div>
            <div class="detail-row">
              <span class="label">描述：</span>
              <span class="value">{order.description}</span>
            </div>
            <div class="form-row">
              <div class="detail-row">
                <span class="label">联系人：</span>
                <span class="value">{order.contact_name}</span>
              </div>
              <div class="detail-row">
                <span class="label">联系电话：</span>
                <span class="value">{order.contact_phone}</span>
              </div>
            </div>
            <div class="detail-row">
              <span class="label">地址：</span>
              <span class="value">{order.address}</span>
            </div>
            <div class="form-row">
              <div class="detail-row">
                <span class="label">风险等级：</span>
                <span class="value">
                  <span class={`risk-tag risk-${order.risk_level}`}>
                    {riskNames[order.risk_level]}
                  </span>
                </span>
              </div>
              <div class="detail-row">
                <span class="label">当前状态：</span>
                <span class="value">
                  <span class={`status-tag status-${order.status}`}>
                    {statusNames[order.status]}
                  </span>
                </span>
              </div>
            </div>
            <div class="form-row">
              <div class="detail-row">
                <span class="label">当前阶段：</span>
                <span class="value">{stageNames[order.current_stage]}</span>
              </div>
              <div class="detail-row">
                <span class="label">优先级：</span>
                <span class="value">
                  <div class="priority-bar" style="width: 100px; display: inline-block; vertical-align: middle; margin-right: 0.5rem;">
                    <div class={`priority-fill ${getPriorityClass(order.priority)}`} style={`width: ${Math.min(order.priority, 100)}%`} />
                  </div>
                  {order.priority} 分
                </span>
              </div>
            </div>
            <div class="form-row">
              <div class="detail-row">
                <span class="label">截止日期：</span>
                <span class="value">{formatDate(order.due_date)}</span>
              </div>
              <div class="detail-row">
                <span class="label">版本：</span>
                <span class="value">v{order.version}</span>
              </div>
            </div>

            <Show when={order.master_name}>
              <div class="form-row">
                <div class="detail-row">
                  <span class="label">维修师傅：</span>
                  <span class="value">{order.master_name}</span>
                </div>
                <div class="detail-row">
                  <span class="label">师傅电话：</span>
                  <span class="value">{order.master_phone}</span>
                </div>
              </div>
            </Show>

            <div class="detail-row">
              <span class="label">当前处理人：</span>
              <span class="value">{order.current_handler}</span>
            </div>

            <div class="detail-row">
              <span class="label">证据：</span>
              <span class="value">
                {order.evidence_count} / {order.required_evidences} 份
                <Show when={order.evidence_count < order.required_evidences}>
                  <span class="badge badge-evidence" style="margin-left: 0.5rem;">
                    还差 {order.required_evidences - order.evidence_count} 份
                  </span>
                </Show>
              </span>
            </div>

            <Show when={order.conflict_note}>
              <div class="conflict-note">
                ⚠️ 状态冲突说明：{order.conflict_note}
              </div>
            </Show>
          </div>

          <Show when={prev_opinion}>
            <div class="prev-opinion">
              <div class="title">
                上一处理人意见
                （{roleNames[prev_role] || prev_role} {prev_handler} 的处理意见）：
              </div>
              <div class="content">{prev_opinion}</div>
            </div>
          </Show>

          <Show when={can_process && getAvailableActions().length > 0}>
            <div class="detail-card">
              <h3>办理操作</h3>

              <div class="form-group">
                <label>选择操作</label>
                <select value={showAction()} onChange={(e) => setShowAction(e.target.value)}>
                  <option value="">请选择操作</option>
                  <For each={getAvailableActions()}>
                    {(a) => (
                      <option value={a.value}>{a.label}</option>
                    )}
                  </For>
                </select>
              </div>

              <Show when={showAction()}>
                <div class="form-group">
                  <label>处理意见</label>
                  <textarea
                    value={opinion()}
                    onChange={(e) => setOpinion(e.target.value)}
                    placeholder="请输入处理意见..."
                  />
                </div>

                <Show when={getAvailableActions().find(a => a.value === showAction())?.requiresMaster}>
                  <div class="form-row">
                    <div class="form-group">
                      <label>师傅姓名</label>
                      <input
                        value={masterName()}
                        onChange={(e) => setMasterName(e.target.value)}
                        placeholder="请输入师傅姓名"
                      />
                    </div>
                    <div class="form-group">
                      <label>师傅电话</label>
                      <input
                        value={masterPhone()}
                        onChange={(e) => setMasterPhone(e.target.value)}
                        placeholder="请输入师傅电话"
                      />
                    </div>
                  </div>
                </Show>

                <Show when={getAvailableActions().find(a => a.value === showAction())?.requiresConflict}>
                  <div class="form-group">
                    <label>冲突说明</label>
                    <textarea
                      value={conflictNote()}
                      onChange={(e) => setConflictNote(e.target.value)}
                      placeholder="请详细描述状态冲突的具体情况..."
                    />
                  </div>
                </Show>

                <div class="form-group">
                  <label>调整风险等级</label>
                  <select
                    value={newRiskLevel()}
                    onChange={(e) => setNewRiskLevel(e.target.value)}>
                    <option value="high">高风险</option>
                    <option value="medium">中风险</option>
                    <option value="low">低风险</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>
                    上传证据 ({evidences().length} 份已添加
                    <button
                      type="button"
                      class="btn btn-secondary"
                      style="margin-left: 0.5rem;"
                      onClick={addEvidence}
                    >
                      + 添加证据
                    </button>
                  </label>
                  <For each={evidences()}>
                    {(ev, idx) => (
                      <div class="evidence-input-row">
                        <select
                          value={ev.type}
                          onChange={(e) => updateEvidence(idx(), 'type', e.target.value)}
                        >
                          <option value="">证据类型</option>
                          <option value="现场照片">现场照片</option>
                          <option value="维修工单">维修工单</option>
                          <option value="检测报告">检测报告</option>
                          <option value="验收单">验收单</option>
                          <option value="费用清单">费用清单</option>
                        </select>
                        <input
                          value={ev.description}
                          onChange={(e) => updateEvidence(idx(), 'description', e.target.value)}
                          placeholder="证据说明"
                        />
                        <button
                          type="button"
                          class="btn btn-danger"
                          onClick={() => removeEvidence(idx())}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </For>
                </div>

                <div class="action-buttons">
                  <For each={getAvailableActions()}>
                    {(a) => (
                      <Show when={a.value === showAction()}>
                        <button
                          class={`btn ${a.class}`}
                          onClick={processOrder}
                          disabled={processing()}
                        >
                          {processing() ? '处理中...' : a.label}
                        </button>
                      </Show>
                    )}
                  </For>
                  <button
                    class="btn btn-secondary"
                    onClick={() => {
                      setShowAction('')
                      setOpinion('')
                      setEvidences([])
                    }}
                  >
                    取消
                  </button>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={!can_process && order.status !== 'archived'}>
            <div class="detail-card">
              <h3>办理操作</h3>
              <p style="color: #6b7280; font-size: 0.9rem;">
                此工单当前处理人为 <strong>{order.current_handler}</strong>，您无权操作。
              </p>
            </div>
          </Show>
        </div>

        <div>
          <div class="detail-card">
            <h3>已上传证据</h3>
            <div class="evidence-list">
              <For each={existingEvidences} fallback={<div style="color: #6b7280; font-size: 0.875rem;">暂无证据</div>}>
                {(ev) => (
                  <div class="evidence-item">
                    <div>
                      <span class="evidence-type">{ev.type}</span>
                      <span style="color: #9ca3af; margin: 0 0.5rem;">·</span>
                      <span class="evidence-desc">{ev.description}</span>
                    </div>
                    <span style="font-size: 0.75rem; color: #9ca3af;">
                      {new Date(ev.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>

          <div class="detail-card">
            <h3>操作记录</h3>
            <div class="log-list">
              <For each={operation_logs}>
                {(log) => (
                  <div class={`log-item ${getLogClass(log.action)}`}>
                    <div class="log-header">
                      <span class="log-operator">
                        {log.operator_name}
                        <span class="tag" style="margin-left: 0.25rem;">
                          {roleNames[log.operator_role]}
                        </span>
                      </span>
                      <span class="log-time">
                        {new Date(log.created_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div class="log-action">
                      <span class="log-status">{log.action}</span>
                      <Show when={log.from_status && log.to_status}>
                        <span style="color: #6b7280; font-size: 0.8rem;">
                          {statusNames[log.from_status]} → {statusNames[log.to_status]}
                        </span>
                      </Show>
                    </div>
                    <div class="log-opinion">意见：{log.opinion}
                    </div>
                    <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;">
                      版本 v{log.version_before} → v{log.version_after}

                      <Show when={log.risk_level}>
                        <span style="margin-left: 0.5rem;">
                          风险：{riskNames[log.risk_level]}
                        </span>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
