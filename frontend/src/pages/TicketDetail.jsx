import { createSignal, createEffect, For, onMount, Show } from 'solid-js'
import { useNavigate, useParams } from '@solidjs/router'
import { api } from '../api'
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  formatTime, formatFileSize, getUser, ROLE_LABELS
} from '../utils'

export default function TicketDetail() {
  const nav = useNavigate()
  const params = useParams()
  const [ticket, setTicket] = createSignal(null)
  const [user, setUserState] = createSignal(null)
  const [loading, setLoading] = createSignal(true)
  const [tab, setTab] = createSignal('info')
  const [modal, setModal] = createSignal(null)
  const [form, setForm] = createSignal({})
  const [formError, setFormError] = createSignal('')

  onMount(() => {
    setUserState(getUser())
    refresh()
  })

  const refresh = async () => {
    setLoading(true)
    try {
      const t = await api.getTicket(params.id)
      setTicket(t)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (type, extra = {}) => {
    setModal(type)
    setForm({ remark: '', reject_reason: '', review_note: '', repair_result: '', visit_feedback: '', visit_remark: '', ...extra })
    setFormError('')
  }

  const closeModal = () => { setModal(null); setForm({}); setFormError('') }

  const runAction = async (runner, successMsg) => {
    try {
      const t = await runner()
      setTicket(t)
      closeModal()
      alert(successMsg || '操作成功')
    } catch (e) {
      setFormError(e.message)
    }
  }

  // ===== 附件操作 =====
  const updateAttachment = async (attId, patch) => {
    try {
      await api.updateAttachment(attId, patch)
      alert('附件状态已更新')
      refresh()
    } catch (e) {
      alert(e.message)
    }
  }

  const openAddAttachment = () => {
    setModal('addAttachment')
    setForm({ file_name: '', is_required: true, is_supplementary: false, review_note: '' })
  }

  const addAttachment = async () => {
    if (!form().file_name) { setFormError('请输入文件名'); return }
    const ts = Date.now()
    try {
      await api.addAttachment(ticket().id, {
        file_name: form().file_name,
        file_path: `/uploads/mock_${ts}.jpg`,
        file_size: 300000 + Math.floor(Math.random() * 1200000),
        mime_type: form().file_name.match(/\.(pdf|doc)$/i) ? 'application/pdf' : 'image/jpeg',
        attachment_type: form().is_supplementary ? 'supplementary' : (form().is_required ? 'required' : 'supplementary'),
        is_required: !!form().is_required,
        is_supplementary: !!form().is_supplementary,
        review_note: form().review_note,
      })
      alert('附件已添加')
      closeModal()
      refresh()
    } catch (e) {
      setFormError(e.message)
    }
  }

  // ===== 可用操作按角色 + 状态判断 =====
  const can = (action) => {
    if (!ticket() || !user()) return false
    const r = user().role
    const s = ticket().status
    if (action === 'submit') return r === 'registrar' && (s === 'draft' || s === 'revision_required')
    if (action === 'addAttachment') return (r === 'registrar' && (s === 'draft' || s === 'revision_required')) || r === 'supervisor'
    if (action === 'approve') return r === 'supervisor' && s === 'pending_review'
    if (action === 'return') return r === 'supervisor' && s === 'pending_review'
    if (action === 'reject') return r === 'supervisor' && s === 'pending_review'
    if (action === 'assign') return r === 'supervisor' && s === 'review_passed'
    if (action === 'start') return r === 'supervisor' && s === 'assigned'
    if (action === 'complete') return r === 'supervisor' && s === 'in_progress'
    if (action === 'markAttachment') return r === 'supervisor' && (s === 'pending_review' || s === 'revision_required')
    if (action === 'review') return r === 'reviewer' && s === 'completed'
    return false
  }

  const atts = () => ticket()?.attachments || []
  const requiredAtts = () => atts().filter(a => a.is_required && !a.is_rejected)
  const supplementaryAtts = () => atts().filter(a => a.is_supplementary)
  const rejectedAtts = () => atts().filter(a => a.is_rejected)
  const missingRequired = () => Math.max(0, 1 - requiredAtts().length)

  const attSummary = () => {
    const total = atts().length
    return `共 ${total} 个 · 必填 ${requiredAtts().length} 个 · 补传 ${supplementaryAtts().length} 个 · 驳回 ${rejectedAtts().length} 个`
  }

  if (loading()) return <div class="card">加载中...</div>
  if (!ticket()) return <div class="card">工单不存在 <button class="btn btn-sm" onClick={() => nav('/tickets')}>返回列表</button></div>

  return (
    <div>
      <div class="card">
        <div class="card-title">
          <div>
            <span style="font-family:monospace;color:#409eff;margin-right:12px">{ticket().ticket_no}</span>
            {ticket().title}
            <span class="tag" style={`margin-left:12px;color:${STATUS_COLORS[ticket().status]};background:${STATUS_COLORS[ticket().status]}15;border-color:${STATUS_COLORS[ticket().status]}40`}>
              {STATUS_LABELS[ticket().status]}
            </span>
            {ticket().is_overdue && <span class="tag tag-danger" style="margin-left:6px">超时</span>}
            <span class="tag" style={`margin-left:6px;color:${PRIORITY_COLORS[ticket().priority]};background:${PRIORITY_COLORS[ticket().priority]}15;border-color:${PRIORITY_COLORS[ticket().priority]}40`}>
              优先级：{PRIORITY_LABELS[ticket().priority]}
            </span>
          </div>
          <button class="btn btn-sm" onClick={() => nav('/tickets')}>← 返回列表</button>
        </div>

        <div class="alert-box alert-info">
          <b>当前操作身份：</b>
          <span class="current" style="margin-left:6px">{ROLE_LABELS[user()?.role]}</span>
          <span style="margin:0 10px;color:#e4e7ed">|</span>
          <span>操作员：{user()?.full_name}</span>
          <span style="margin:0 10px;color:#e4e7ed">|</span>
          <button class="link-btn" onClick={() => location.reload()}>刷新</button>
        </div>

        {ticket().status === 'revision_required' && can('submit') && (
          <div class="alert-box alert-warn">
            <b>退回补正：</b>{ticket().reject_reason}
            <span style="margin-left:10px;color:#f56c6c">请补齐材料后重新提交审核</span>
          </div>
        )}
        {ticket().status === 'rejected' && (
          <div class="alert-box alert-error">
            <b>已驳回：</b>{ticket().reject_reason}
          </div>
        )}

        <div class="action-bar">
          <span class="tip">
            可执行操作：{
              can('submit') ? '提交审核' :
              can('approve') ? '审核通过 / 退回 / 驳回' :
              can('assign') ? '派单' :
              can('start') ? '开始维修' :
              can('complete') ? '登记完工' :
              can('review') ? '复核归档' :
              '（当前状态无可用操作）'
            }
          </span>
          {can('submit') && (
            <button class="btn btn-primary" onClick={() => openModal('submit')}>
              {ticket().status === 'revision_required' ? '补正后重新提交审核' : '提交审核'}
            </button>
          )}
          {can('addAttachment') && (
            <button class="btn btn-success" onClick={openAddAttachment}>+ 上传/补传附件</button>
          )}
          {can('approve') && (
            <>
              <button class="btn btn-primary" onClick={() => openModal('approve')}>审核通过</button>
              <button class="btn btn-warning" onClick={() => openModal('return')}>退回补正（缺材料）</button>
              <button class="btn btn-danger" onClick={() => openModal('reject')}>驳回工单</button>
            </>
          )}
          {can('assign') && <button class="btn btn-primary" onClick={() => openModal('assign')}>派单处理</button>}
          {can('start') && <button class="btn btn-primary" onClick={() => openModal('start')}>开始维修</button>}
          {can('complete') && <button class="btn btn-success" onClick={() => openModal('complete')}>登记完工</button>}
          {can('review') && <button class="btn btn-primary" onClick={() => openModal('review')}>复核归档</button>}
        </div>

        <div class="tabs">
          <div class={`tab-item ${tab()==='info'?'active':''}`} onClick={() => setTab('info')}>业主报修信息</div>
          <div class={`tab-item ${tab()==='attach'?'active':''}`} onClick={() => setTab('attach')}>
            附件管理 <span class="count">{atts().length}</span>
          </div>
          <div class={`tab-item ${tab()==='process'?'active':''}`} onClick={() => setTab('process')}>维修派单/完工</div>
          <div class={`tab-item ${tab()==='logs'?'active':''}`} onClick={() => setTab('logs')}>
            流转记录 <span class="count">{ticket().work_logs?.length || 0}</span>
          </div>
        </div>

        {tab() === 'info' && (
          <div class="card" style="box-shadow:none;padding:0;margin:0">
            <div class="section-title">业主与报修信息</div>
            <div class="detail-grid">
              <div class="item"><div class="label">业主姓名</div><div class="value">{ticket().owner_name}</div></div>
              <div class="item"><div class="label">联系电话</div><div class="value">{ticket().owner_phone}</div></div>
              <div class="item"><div class="label">维修类型</div><div class="value">{ticket().repair_type}</div></div>
              <div class="item wide"><div class="label">报修地址</div><div class="value">{ticket().address}</div></div>
              <div class="item"><div class="label">优先级</div><div class="value">
                <span class="tag" style={`color:${PRIORITY_COLORS[ticket().priority]};background:${PRIORITY_COLORS[ticket().priority]}15;border-color:${PRIORITY_COLORS[ticket().priority]}40`}>
                  {PRIORITY_LABELS[ticket().priority]}
                </span>
              </div></div>
              <div class="item"><div class="label">工单状态</div><div class="value">
                <span class="tag" style={`color:${STATUS_COLORS[ticket().status]};background:${STATUS_COLORS[ticket().status]}15;border-color:${STATUS_COLORS[ticket().status]}40`}>
                  {STATUS_LABELS[ticket().status]}
                </span>
              </div></div>
              <div class="item"><div class="label">是否超时</div><div class="value">
                {ticket().is_overdue ? <span class="tag tag-danger">已超时</span> : <span class="tag tag-success">正常</span>}
              </div></div>
              <div class="item"><div class="label">创建时间</div><div class="value">{formatTime(ticket().created_at)}</div></div>
              <div class="item"><div class="label">截止时间</div><div class="value">{formatTime(ticket().deadline_at)}</div></div>
              <div class="item"><div class="label">派单时间</div><div class="value">{formatTime(ticket().assigned_at)}</div></div>
              <div class="item"><div class="label">完工时间</div><div class="value">{formatTime(ticket().completed_at)}</div></div>
              <div class="item"><div class="label">归档时间</div><div class="value">{formatTime(ticket().archived_at)}</div></div>
              <div class="item"><div class="label">登记员</div><div class="value">{ticket().created_by_name || '-'}</div></div>
              <div class="item"><div class="label">处理主管</div><div class="value">{ticket().handled_by_name || '-'}</div></div>
              <div class="item"><div class="label">复核人</div><div class="value">{ticket().reviewed_by_name || '-'}</div></div>
              <div class="item full">
                <div class="label">故障描述</div>
                <div class="value" style="background:#f5f7fa;padding:10px;border-radius:4px;white-space:pre-wrap">{ticket().description}</div>
              </div>
            </div>
          </div>
        )}

        {tab() === 'attach' && (
          <div class="card" style="box-shadow:none;padding:0;margin:0">
            <div class="section-title">
              附件管理（{attSummary()}）
              {missingRequired() > 0 && <span class="tag tag-danger" style="margin-left:10px">缺少至少 {missingRequired()} 个必填附件</span>}
            </div>

            <div class="alert-box alert-info">
              <b>说明：</b>附件按类型标记：
              <span class="tag tag-primary" style="margin:0 6px">必填</span>
              表示必须提交的报修材料；
              <span class="tag tag-warning" style="margin:0 6px">补传</span>
              表示退回补正后补充的材料；
              <span class="tag tag-danger" style="margin:0 6px">驳回</span>
              表示主管审核时认为不合格的附件。
            </div>

            {atts().length === 0 ? (
              <div class="no-data" style="padding:40px;text-align:center;color:#909399">暂无附件</div>
            ) : (
              <div class="attach-list">
                <For each={atts()}>
                  {a => (
                    <div class={`attach-item ${a.is_rejected?'rejected':a.is_supplementary?'supplement':''}`}>
                      <div class="attach-head">
                        <div>
                          <div class="attach-name">📎 {a.file_name}</div>
                          <div class="attach-badges" style="margin-top:4px">
                            {a.is_required && !a.is_rejected && <span class="tag tag-primary">必填</span>}
                            {a.is_supplementary && <span class="tag tag-warning">补传</span>}
                            {a.is_rejected && <span class="tag tag-danger">驳回</span>}
                          </div>
                        </div>
                        <div style="text-align:right;font-size:12px;color:#909399">
                          <div>{formatFileSize(a.file_size)}</div>
                          <div>上传：{a.uploaded_by_name || '-'}</div>
                          <div>{formatTime(a.uploaded_at)}</div>
                        </div>
                      </div>
                      <div class="attach-meta">
                        <span>类型：{a.attachment_type}</span>
                        <span>MIME：{a.mime_type || '-'}</span>
                      </div>
                      {a.reject_reason && (
                        <div class="attach-reason">
                          <b>驳回原因：</b>{a.reject_reason}
                        </div>
                      )}
                      {a.review_note && (
                        <div style="background:#ecf5ff;border:1px solid #d9ecff;padding:6px 8px;border-radius:4px;font-size:12px;color:#409eff">
                          <b>审核备注：</b>{a.review_note}
                        </div>
                      )}
                      {can('markAttachment') && (
                        <div class="attach-actions">
                          {!a.is_required && !a.is_rejected && (
                            <button class="btn btn-sm btn-primary" onClick={() => updateAttachment(a.id, { is_required: true, attachment_type: 'required' })}>标记必填</button>
                          )}
                          {!a.is_supplementary && !a.is_rejected && (
                            <button class="btn btn-sm btn-warning" onClick={() => updateAttachment(a.id, { is_supplementary: true, attachment_type: 'supplementary', is_required: false })}>标记补传</button>
                          )}
                          {!a.is_rejected && (
                            <button class="btn btn-sm btn-danger" onClick={() => {
                              const reason = prompt('请输入驳回该附件的原因：')
                              if (reason) updateAttachment(a.id, { is_rejected: true, attachment_type: 'rejected', reject_reason: reason })
                            }}>驳回附件</button>
                          )}
                          {a.is_rejected && (
                            <button class="btn btn-sm btn-success" onClick={() => updateAttachment(a.id, { is_rejected: false, reject_reason: '', is_required: true, attachment_type: 'required' })}>解除驳回</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </For>
              </div>
            )}
          </div>
        )}

        {tab() === 'process' && (
          <div class="card" style="box-shadow:none;padding:0;margin:0">
            <div class="section-title">维修派单 / 完工回访信息</div>
            <div class="detail-grid" style="margin-bottom:20px">
              <div class="item"><div class="label">派单状态</div><div class="value">
                {['assigned','in_progress','completed','archived'].includes(ticket().status)
                  ? <span class="tag tag-success">已派单</span>
                  : <span class="tag tag-default">未派单</span>}
              </div></div>
              <div class="item"><div class="label">维修状态</div><div class="value">
                {ticket().status === 'in_progress' ? <span class="tag tag-primary">维修中</span>
                  : ticket().status === 'completed' ? <span class="tag tag-warning">待复核</span>
                  : ticket().status === 'archived' ? <span class="tag tag-success">已完成</span>
                  : <span class="tag tag-default">未开始</span>}
              </div></div>
              <div class="item"><div class="label">处理主管</div><div class="value">{ticket().handled_by_name || '-'}</div></div>
              <div class="item"><div class="label">派单时间</div><div class="value">{formatTime(ticket().assigned_at)}</div></div>
              <div class="item"><div class="label">完工时间</div><div class="value">{formatTime(ticket().completed_at)}</div></div>
              <div class="item"><div class="label">归档时间</div><div class="value">{formatTime(ticket().archived_at)}</div></div>
            </div>

            {ticket().repair_result && (
              <div style="margin-bottom:14px">
                <div class="section-title">维修结果</div>
                <div style="background:#f0f9eb;border:1px solid #e1f3d8;padding:12px;border-radius:4px;white-space:pre-wrap;color:#67c23a">
                  {ticket().repair_result}
                </div>
              </div>
            )}

            {ticket().reject_reason && (
              <div style="margin-bottom:14px">
                <div class="section-title">退回 / 驳回原因</div>
                <div style="background:#fef0f0;border:1px solid #fde2e2;padding:12px;border-radius:4px;white-space:pre-wrap;color:#f56c6c">
                  {ticket().reject_reason}
                </div>
              </div>
            )}

            {ticket().review_note && (
              <div style="margin-bottom:14px">
                <div class="section-title">复核意见 / 审计备注</div>
                <div style="background:#ecf5ff;border:1px solid #d9ecff;padding:12px;border-radius:4px;white-space:pre-wrap;color:#409eff">
                  {ticket().review_note}
                </div>
              </div>
            )}

            {ticket().visit_feedback && (
              <div>
                <div class="section-title">完工回访</div>
                <div class="detail-grid">
                  <div class="item"><div class="label">回访评价</div><div class="value">
                    <span class="tag tag-success">{ticket().visit_feedback}</span>
                  </div></div>
                  <div class="item wide"><div class="label">回访备注</div><div class="value">{ticket().visit_remark || '-'}</div></div>
                  <div class="item"><div class="label">复核人</div><div class="value">{ticket().reviewed_by_name || '-'}</div></div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab() === 'logs' && (
          <div class="card" style="box-shadow:none;padding:0;margin:0">
            <div class="section-title">工单流转记录</div>
            <div class="timeline">
              <For each={[...(ticket().work_logs || [])].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))}>
                {log => {
                  const actionColor =
                    log.action.includes('退回') || log.action.includes('驳回') ? 'danger' :
                    log.action.includes('补正') || log.action.includes('完工') ? 'warning' :
                    log.action.includes('归档') || log.action.includes('通过') ? 'success' : ''
                  return (
                    <div class={`timeline-item ${actionColor}`}>
                      <div class="tl-action">{log.action}</div>
                      <div class="tl-time">{formatTime(log.created_at)}</div>
                      <div class="tl-operator">
                        操作人：{log.operator_name || '-'}
                        {log.from_status && <span style="margin:0 8px;color:#909399">|</span>}
                        {log.from_status && `状态变更：${STATUS_LABELS[log.from_status] || log.from_status} → ${STATUS_LABELS[log.to_status] || log.to_status}`}
                      </div>
                      {log.remark && <div class="tl-remark">{log.remark}</div>}
                    </div>
                  )
                }}
              </For>
            </div>
          </div>
        )}
      </div>

      {/* ====== Modals ====== */}
      <Show when={modal()}>
        <div class="modal-backdrop" onClick={closeModal}>
          <div class="modal-box" style={modal()==='addAttachment'?'width:560px':''} onClick={e => e.stopPropagation()}>
            <div class="modal-head">
              <h3>
                {modal()==='submit' && '提交审核'}
                {modal()==='approve' && '审核通过'}
                {modal()==='return' && '退回补正（缺材料）'}
                {modal()==='reject' && '驳回工单'}
                {modal()==='assign' && '派单处理'}
                {modal()==='start' && '开始维修'}
                {modal()==='complete' && '登记完工'}
                {modal()==='review' && '复核归档'}
                {modal()==='addAttachment' && '上传/补传附件（模拟）'}
              </h3>
              <button type="button" onClick={closeModal}>×</button>
            </div>
            <div class="modal-body">
              {(modal()==='return' || modal()==='reject') && (
                <>
                  <div class="alert-box alert-warn" style="margin-bottom:12px">
                    请说明{modal()==='return'?'退回补正':'驳回'}原因，这将作为审计记录留档，并发送给登记员。
                  </div>
                  <div class="form-row full">
                    <div class="form-item">
                      <label class="req">{modal()==='return'?'退回原因':'驳回原因'}</label>
                      <textarea value={form().reject_reason || ''} onInput={e => setForm({...form(), reject_reason: e.target.value})}
                        placeholder={modal()==='return'
                          ? '例如：缺少空调铭牌清晰照片和购机发票扫描件，无法判断保修期限，请补正后重新提交。'
                          : '例如：经核实，该维修项目属于业主自行改造部分，不在物业服务范围内。'} />
                    </div>
                  </div>
                </>
              )}
              {(modal()==='submit' || modal()==='approve' || modal()==='assign' || modal()==='start') && (
                <div class="form-row full">
                  <div class="form-item">
                    <label>备注 / 操作说明（可选）</label>
                    <textarea value={form().remark || ''} onInput={e => setForm({...form(), remark: e.target.value})}
                      placeholder={modal()==='assign' ? '例如：已联系维修组李师傅，预计30分钟内到场' : ''} />
                  </div>
                </div>
              )}
              {modal()==='complete' && (
                <div class="form-row full">
                  <div class="form-item">
                    <label class="req">维修结果说明</label>
                    <textarea value={form().repair_result || ''} onInput={e => setForm({...form(), repair_result: e.target.value})}
                      placeholder="详细说明维修内容、更换零件、处理方案等" />
                  </div>
                </div>
              )}
              {modal()==='review' && (
                <>
                  <div class="form-row full">
                    <div class="form-item">
                      <label class="req">复核意见 / 审计备注</label>
                      <textarea value={form().review_note || ''} onInput={e => setForm({...form(), review_note: e.target.value})}
                        placeholder="说明复核过程、结果判定、是否符合规范等" />
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-item">
                      <label class="req">回访评价</label>
                      <select value={form().visit_feedback || ''} onInput={e => setForm({...form(), visit_feedback: e.target.value})}>
                        <option value="">请选择</option>
                        <option value="非常满意">非常满意</option>
                        <option value="满意">满意</option>
                        <option value="一般">一般</option>
                        <option value="不满意">不满意</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-row full">
                    <div class="form-item">
                      <label>回访备注（可选）</label>
                      <textarea value={form().visit_remark || ''} onInput={e => setForm({...form(), visit_remark: e.target.value})}
                        placeholder="业主反馈、表扬或投诉等" />
                    </div>
                  </div>
                </>
              )}
              {modal()==='addAttachment' && (
                <>
                  <div class="form-row full">
                    <div class="form-item">
                      <label class="req">文件名</label>
                      <input value={form().file_name || ''} onInput={e => setForm({...form(), file_name: e.target.value})}
                        placeholder="例如：空调铭牌补拍.jpg 或 维修合同.pdf" />
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-item">
                      <label><input type="checkbox" checked={!!form().is_required}
                        onInput={e => setForm({...form(), is_required: e.target.checked, is_supplementary: e.target.checked ? false : form().is_supplementary})} />
                        标记为必填附件
                      </label>
                    </div>
                    <div class="form-item">
                      <label><input type="checkbox" checked={!!form().is_supplementary}
                        onInput={e => setForm({...form(), is_supplementary: e.target.checked, is_required: e.target.checked ? false : form().is_required})} />
                        标记为补传附件
                      </label>
                    </div>
                  </div>
                  <div class="form-row full">
                    <div class="form-item">
                      <label>上传备注（可选）</label>
                      <input value={form().review_note || ''} onInput={e => setForm({...form(), review_note: e.target.value})}
                        placeholder="说明上传背景：补正/补传等" />
                    </div>
                  </div>
                </>
              )}
              {formError() && <div class="form-error" style="margin-bottom:8px">{formError()}</div>}
            </div>
            <div class="modal-foot">
              <button type="button" class="btn" onClick={closeModal}>取消</button>
              {modal()==='submit' && <button class="btn btn-primary" onClick={() => runAction(() => api.submitTicket(ticket().id, form()), '工单已提交审核')}>确认提交</button>}
              {modal()==='approve' && <button class="btn btn-primary" onClick={() => runAction(() => api.approveTicket(ticket().id, form()), '审核通过')}>确认通过</button>}
              {modal()==='return' && <button class="btn btn-warning" onClick={() => runAction(() => api.returnTicket(ticket().id, form()), '已退回补正，通知登记员处理')}>确认退回补正</button>}
              {modal()==='reject' && <button class="btn btn-danger" onClick={() => runAction(() => api.rejectTicket(ticket().id, form()), '工单已驳回')}>确认驳回</button>}
              {modal()==='assign' && <button class="btn btn-primary" onClick={() => runAction(() => api.assignTicket(ticket().id, form()), '已派单')}>确认派单</button>}
              {modal()==='start' && <button class="btn btn-primary" onClick={() => runAction(() => api.startTicket(ticket().id, form()), '已开始维修')}>确认开始</button>}
              {modal()==='complete' && <button class="btn btn-success" onClick={() => runAction(() => api.completeTicket(ticket().id, form()), '完工已登记，等待复核归档')}>确认完工</button>}
              {modal()==='review' && <button class="btn btn-primary" onClick={() => runAction(() => api.reviewTicket(ticket().id, form()), '复核完成，工单已归档')}>确认归档</button>}
              {modal()==='addAttachment' && <button class="btn btn-success" onClick={addAttachment}>确认上传</button>}
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
