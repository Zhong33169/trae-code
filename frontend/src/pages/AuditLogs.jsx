import { createSignal, For, onMount, createEffect } from 'solid-js'
import { A } from '@solidjs/router'
import { api } from '../api'
import { formatTime, getUser, ROLE_LABELS } from '../utils'

export default function AuditLogs() {
  const [data, setData] = createSignal({ items: [], total: 0 })
  const [page, setPage] = createSignal(1)
  const [size] = createSignal(50)
  const [filter, setFilter] = createSignal({ ticket_id: '', is_success: '' })
  const [user, setUserState] = createSignal(null)

  onMount(() => {
    setUserState(getUser())
    refresh()
  })

  const refresh = async () => {
    const params = { page: page(), size: size() }
    if (filter().ticket_id) params.ticket_id = filter().ticket_id
    if (filter().is_success !== '') params.is_success = filter().is_success
    const res = await api.listAuditLogs(params)
    setData(res || { items: [], total: 0 })
  }

  createEffect(() => { refresh() })

  const onFilter = (k, v) => {
    setPage(1)
    setFilter({ ...filter(), [k]: v })
  }

  const successCount = () => data().items.filter(i => i.is_success).length
  const failCount = () => data().items.filter(i => !i.is_success).length

  const pageCount = () => Math.max(1, Math.ceil(data().total / size()))

  return (
    <div>
      <div class="stats-row">
        <div class="stat-card sc-total">
          <div class="stat-num">{data().total}</div>
          <div class="stat-label">审计日志总数</div>
        </div>
        <div class="stat-card sc-archived">
          <div class="stat-num">{successCount()}</div>
          <div class="stat-label">成功操作</div>
        </div>
        <div class="stat-card sc-overdue">
          <div class="stat-num">{failCount()}</div>
          <div class="stat-label">失败 / 异常（可查失败原因）</div>
        </div>
        <div class="stat-card sc-pending">
          <div class="stat-num">{new Set(data().items.map(i => i.user_id).filter(Boolean)).size}</div>
          <div class="stat-label">涉及操作员</div>
        </div>
        <div class="stat-card sc-ip">
          <div class="stat-num">{new Set(data().items.map(i => i.ticket_id).filter(Boolean)).size}</div>
          <div class="stat-label">涉及工单</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">
          审计日志（操作留痕 · 失败可查原因）
          <button class="btn btn-sm" onClick={refresh}>刷新</button>
        </div>

        <div class="alert-box alert-info">
          <b>说明：</b>所有角色的操作都会在此记录。标为「失败」的条目（红色）会详细记录<b>是谁（{user()?.full_name || '-'}）、什么时间、为什么没处理成功</b>。
          可直接定位到具体工单。
        </div>

        <div class="filter-bar">
          <div class="form-item">
            <label>工单ID</label>
            <input type="number" value={filter().ticket_id}
              onInput={e => onFilter('ticket_id', e.target.value)} placeholder="输入工单ID" />
          </div>
          <div class="form-item">
            <label>结果</label>
            <select value={filter().is_success} onInput={e => onFilter('is_success', e.target.value)}>
              <option value="">全部</option>
              <option value="true">成功</option>
              <option value="false">失败 / 异常</option>
            </select>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作员</th>
              <th>模块</th>
              <th>操作</th>
              <th>结果</th>
              <th>关联工单</th>
              <th>详情 / 失败原因</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            <For each={data().items}>
              {log => (
                <tr style={log.is_success ? '' : 'background:#fff5f5'}>
                  <td style="font-size:12px;white-space:nowrap">{formatTime(log.created_at)}</td>
                  <td>
                    <div style="font-weight:600">{log.user_name || '-'}</div>
                  </td>
                  <td><span class="tag tag-default">{log.module || '-'}</span></td>
                  <td style="font-weight:600">{log.action}</td>
                  <td>
                    {log.is_success
                      ? <span class="tag tag-success">成功</span>
                      : <span class="tag tag-danger">失败</span>}
                  </td>
                  <td>
                    {log.ticket_id
                      ? <A href={`/tickets/${log.ticket_id}`} class="link-btn">查看工单 #{log.ticket_id}</A>
                      : '-'}
                  </td>
                  <td style="max-width:380px">
                    <div style="font-size:12px;color:#606266;line-height:1.5">
                      {log.detail && <div>📝 {log.detail}</div>}
                      {log.failure_reason && (
                        <div style="color:#f56c6c;margin-top:4px">
                          ❌ <b>失败原因：</b>{log.failure_reason}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style="font-size:12px;color:#909399;font-family:monospace">{log.ip_address || '-'}</td>
                </tr>
              )}
            </For>
            {data().items.length === 0 && (
              <tr><td colspan="8" class="no-data">暂无日志</td></tr>
            )}
          </tbody>
        </table>

        <div class="pagination">
          <div>共 {data().total} 条，第 {page()}/{pageCount()} 页</div>
          <div class="page-btns">
            <button disabled={page()<=1} onClick={() => setPage(page()-1)}>上一页</button>
            <For each={Array.from({length:Math.min(5,pageCount())},(_,i)=>i+1)}>
              {p => (
                <button class={p===page()?'active':''} onClick={() => setPage(p)}>{p}</button>
              )}
            </For>
            <button disabled={page()>=pageCount()} onClick={() => setPage(page()+1)}>下一页</button>
          </div>
        </div>
      </div>
    </div>
  )
}
