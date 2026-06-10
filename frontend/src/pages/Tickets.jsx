import { createSignal, createEffect, For, onMount, useContext } from 'solid-js'
import { A, useNavigate } from '@solidjs/router'
import { api } from '../api'
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  formatTime, REPAIR_TYPES, ROLE_LABELS
} from '../utils'
import { UserContext } from '../App'

export default function Tickets() {
  const nav = useNavigate()
  const [data, setData] = createSignal({ items: [], total: 0 })
  const [page, setPage] = createSignal(1)
  const [size] = createSignal(20)
  const [filter, setFilter] = createSignal({
    status: '', is_overdue: '', priority: '', repair_type: '', keyword: ''
  })
  const [showCreate, setShowCreate] = createSignal(false)
  const [form, setForm] = createSignal({
    title: '', owner_name: '', owner_phone: '', address: '',
    repair_type: '水电维修', priority: 'normal', description: '',
    deadline_at: '', attachments: []
  })
  const [formError, setFormError] = createSignal('')
  const [stats, setStats] = createSignal({ total: 0, pending: 0, ip: 0, overdue: 0, archived: 0 })
  const { user } = useContext(UserContext)

  onMount(() => {
    refresh()
    refreshStats()
  })

  const refreshStats = async () => {
    const res = await api.listTickets({ size: 9999 })
    const items = res?.items || []
    setStats({
      total: items.length,
      pending: items.filter(i => i.status === 'pending_review' || i.status === 'revision_required' || i.status === 'review_passed').length,
      ip: items.filter(i => i.status === 'assigned' || i.status === 'in_progress').length,
      overdue: items.filter(i => i.is_overdue).length,
      archived: items.filter(i => i.status === 'archived').length,
    })
  }

  const refresh = async () => {
    const res = await api.listTickets({
      page: page(), size: size(),
      ...filter()
    })
    setData(res || { items: [], total: 0 })
  }

  createEffect(() => { refresh() })

  const onFilter = (key, val) => {
    setPage(1)
    setFilter({ ...filter(), [key]: val })
  }

  const onSubmitCreate = async (e) => {
    e.preventDefault(); setFormError('')
    if (!form().title || !form().owner_name || !form().owner_phone || !form().address || !form().description) {
      setFormError('请填写所有必填字段')
      return
    }
    const req = {
      title: form().title,
      owner_name: form().owner_name,
      owner_phone: form().owner_phone,
      address: form().address,
      repair_type: form().repair_type,
      priority: form().priority,
      description: form().description,
      deadline_at: form().deadline_at ? new Date(form().deadline_at).toISOString() : null,
      attachments: form().attachments,
    }
    try {
      const t = await api.createTicket(req)
      alert('工单创建成功')
      setShowCreate(false)
      setForm({ title:'', owner_name:'', owner_phone:'', address:'', repair_type:'水电维修', priority:'normal', description:'', deadline_at:'', attachments:[] })
      nav(`/tickets/${t.id}`)
    } catch (e) {
      setFormError(e.message)
    }
  }

  const addMockAttachment = () => {
    const ts = Date.now()
    const newAtt = {
      file_name: `现场照片_${ts}.jpg`,
      file_path: `/uploads/mock_${ts}.jpg`,
      file_size: 500000 + Math.floor(Math.random()*1000000),
      mime_type: 'image/jpeg',
      attachment_type: 'required',
      is_required: true,
    }
    setForm({ ...form(), attachments: [...form().attachments, newAtt] })
  }

  const removeMockAttachment = (idx) => {
    const arr = [...form().attachments]; arr.splice(idx, 1)
    setForm({ ...form(), attachments: arr })
  }

  const pageCount = () => Math.max(1, Math.ceil(data().total / size()))

  const canCreate = () => user()?.role === 'registrar'

  return (
    <div>
      <div class="stats-row">
        <div class="stat-card sc-total">
          <div class="stat-num">{stats().total}</div>
          <div class="stat-label">工单总数</div>
        </div>
        <div class="stat-card sc-pending">
          <div class="stat-num">{stats().pending}</div>
          <div class="stat-label">待处理（审核/补正/派单）</div>
        </div>
        <div class="stat-card sc-ip">
          <div class="stat-num">{stats().ip}</div>
          <div class="stat-label">处理中（派单/维修）</div>
        </div>
        <div class="stat-card sc-overdue">
          <div class="stat-num">{stats().overdue}</div>
          <div class="stat-label">超时工单</div>
        </div>
        <div class="stat-card sc-archived">
          <div class="stat-num">{stats().archived}</div>
          <div class="stat-label">已归档</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          报修工单列表
          <div>
            <button class="btn btn-sm" onClick={() => { refreshStats(); refresh() }}>刷新</button>
            {canCreate() && (
              <button class="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ 新建工单</button>
            )}
          </div>
        </div>

        <div class="alert-box alert-info">
          <b>当前身份：</b>{ROLE_LABELS[user()?.role]} - {user()?.full_name}（角色切换见右上角）
        </div>

        <div class="filter-bar">
          <div class="form-item">
            <label>工单状态</label>
            <select value={filter().status} onInput={e => onFilter('status', e.target.value)}>
              <option value="">全部</option>
              <For each={Object.entries(STATUS_LABELS)}>{([k,v]) => <option value={k}>{v}</option>}</For>
            </select>
          </div>
          <div class="form-item">
            <label>是否超时</label>
            <select value={filter().is_overdue} onInput={e => onFilter('is_overdue', e.target.value)}>
              <option value="">全部</option>
              <option value="true">已超时</option>
              <option value="false">未超时</option>
            </select>
          </div>
          <div class="form-item">
            <label>优先级</label>
            <select value={filter().priority} onInput={e => onFilter('priority', e.target.value)}>
              <option value="">全部</option>
              <For each={Object.entries(PRIORITY_LABELS)}>{([k,v]) => <option value={k}>{v}</option>}</For>
            </select>
          </div>
          <div class="form-item">
            <label>维修类型</label>
            <select value={filter().repair_type} onInput={e => onFilter('repair_type', e.target.value)}>
              <option value="">全部</option>
              <For each={REPAIR_TYPES}>{t => <option value={t}>{t}</option>}</For>
            </select>
          </div>
          <div class="form-item" style="flex:1;min-width:200px">
            <label>搜索（编号/标题/业主/地址）</label>
            <input value={filter().keyword} onInput={e => onFilter('keyword', e.target.value)} placeholder="输入关键词" />
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>工单编号</th>
              <th>标题 / 地址</th>
              <th>业主</th>
              <th>类型</th>
              <th>优先级</th>
              <th>状态</th>
              <th>异常</th>
              <th>处理人</th>
              <th>截止时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <For each={data().items}>
              {t => (
                <tr>
                  <td style="font-family:monospace;color:#409eff">{t.ticket_no}</td>
                  <td>
                    <div style="font-weight:600">{t.title}</div>
                    <div style="font-size:12px;color:#909399;margin-top:2px">{t.address}</div>
                  </td>
                  <td>
                    <div>{t.owner_name}</div>
                    <div style="font-size:12px;color:#909399">{t.owner_phone}</div>
                  </td>
                  <td>{t.repair_type}</td>
                  <td>
                    <span class="tag" style={`color:${PRIORITY_COLORS[t.priority]};background:${PRIORITY_COLORS[t.priority]}15;border-color:${PRIORITY_COLORS[t.priority]}40`}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>
                  </td>
                  <td>
                    <span class="tag" style={`color:${STATUS_COLORS[t.status]};background:${STATUS_COLORS[t.status]}15;border-color:${STATUS_COLORS[t.status]}40`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </td>
                  <td>
                    {t.is_overdue
                      ? <span class="tag tag-danger">超时</span>
                      : t.status === 'revision_required'
                      ? <span class="tag tag-warning">缺材料</span>
                      : t.status === 'rejected'
                      ? <span class="tag tag-danger">已驳回</span>
                      : <span class="tag tag-default">正常</span>}
                  </td>
                  <td style="font-size:12px">
                    <div>创建：{t.created_by_name}</div>
                    {t.handled_by_name && <div>处理：{t.handled_by_name}</div>}
                    {t.reviewed_by_name && <div>复核：{t.reviewed_by_name}</div>}
                  </td>
                  <td style="font-size:12px;white-space:nowrap">
                    {t.deadline_at
                      ? <span style={t.is_overdue ? 'color:#f56c6c;font-weight:600' : ''}>{formatTime(t.deadline_at)}</span>
                      : '-'}
                  </td>
                  <td>
                    <A href={`/tickets/${t.id}`} class="link-btn">详情</A>
                  </td>
                </tr>
              )}
            </For>
            {data().items.length === 0 && (
              <tr><td colspan="10" class="no-data">暂无工单数据</td></tr>
            )}
          </tbody>
        </table>

        <div class="pagination">
          <div>共 {data().total} 条，第 {page()}/{pageCount()} 页</div>
          <div class="page-btns">
            <button disabled={page()<=1} onClick={() => setPage(page()-1)}>上一页</button>
            <For each={Array.from({length:pageCount()},(_,i)=>i+1)}>
              {p => (
                <button class={p===page()?'active':''} onClick={() => setPage(p)}>{p}</button>
              )}
            </For>
            <button disabled={page()>=pageCount()} onClick={() => setPage(page()+1)}>下一页</button>
          </div>
        </div>
      </div>

      {showCreate() && (
        <div class="modal-backdrop" onClick={() => { setShowCreate(false); setFormError('') }}>
          <div class="modal-box" style="width:680px" onClick={e => e.stopPropagation()}>
            <form onSubmit={onSubmitCreate}>
              <div class="modal-head">
                <h3>新建报修工单（报修登记员）</h3>
                <button type="button" onClick={() => { setShowCreate(false); setFormError('') }}>×</button>
              </div>
              <div class="modal-body">
                <div class="form-row">
                  <div class="form-item">
                    <label class="req">标题</label>
                    <input value={form().title} onInput={e => setForm({...form(), title:e.target.value})} placeholder="简要描述故障" />
                  </div>
                  <div class="form-item">
                    <label class="req">维修类型</label>
                    <select value={form().repair_type} onInput={e => setForm({...form(), repair_type:e.target.value})}>
                      <For each={REPAIR_TYPES}>{t => <option value={t}>{t}</option>}</For>
                    </select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-item">
                    <label class="req">业主姓名</label>
                    <input value={form().owner_name} onInput={e => setForm({...form(), owner_name:e.target.value})} />
                  </div>
                  <div class="form-item">
                    <label class="req">业主电话</label>
                    <input value={form().owner_phone} onInput={e => setForm({...form(), owner_phone:e.target.value})} />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-item">
                    <label class="req">地址</label>
                    <input value={form().address} onInput={e => setForm({...form(), address:e.target.value})} placeholder="例如：阳光花园A栋3单元302" />
                  </div>
                  <div class="form-item">
                    <label>优先级</label>
                    <select value={form().priority} onInput={e => setForm({...form(), priority:e.target.value})}>
                      <For each={Object.entries(PRIORITY_LABELS)}>{([k,v]) => <option value={k}>{v}</option>}</For>
                    </select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-item">
                    <label>截止处理时间</label>
                    <input type="datetime-local" value={form().deadline_at} onInput={e => setForm({...form(), deadline_at:e.target.value})} />
                  </div>
                </div>
                <div class="form-row full">
                  <div class="form-item">
                    <label class="req">故障描述</label>
                    <textarea value={form().description} onInput={e => setForm({...form(), description:e.target.value})} placeholder="详细说明故障情况" />
                  </div>
                </div>
                <div class="form-row full">
                  <div class="form-item">
                    <label>附件（模拟上传 - 演示）</label>
                    <div style="padding:8px;border:1px dashed #dcdfe6;border-radius:4px;margin-bottom:8px">
                      <button type="button" class="btn btn-sm" onClick={addMockAttachment}>+ 模拟添加附件</button>
                      <span class="form-hint" style="margin-left:10px">共 {form().attachments.length} 个</span>
                    </div>
                    {form().attachments.length > 0 && (
                      <div style="display:flex;flex-direction:column;gap:6px">
                        <For each={form().attachments}>
                          {(a, i) => (
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#f5f7fa;border-radius:4px">
                              <span>{a.file_name}</span>
                              <button type="button" class="link-btn danger" onClick={() => removeMockAttachment(i())}>移除</button>
                            </div>
                          )}
                        </For>
                      </div>
                    )}
                  </div>
                </div>
                {formError() && <div class="form-error" style="margin-bottom:6px">{formError()}</div>}
              </div>
              <div class="modal-foot">
                <button type="button" class="btn" onClick={() => { setShowCreate(false); setFormError('') }}>取消</button>
                <button type="submit" class="btn btn-primary">创建工单草稿</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
