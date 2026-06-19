import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { api, auth, SeedRecord } from '~/app/api'
import { formatTime, nodeLabel, statusColor, statusLabel } from '~/app/constants'

export const Route = createFileRoute('/')({
  component: RecordsPage,
})

function RecordsPage() {
  const nav = useNavigate()
  const user = auth.getUser()
  const [status, setStatus] = useState<string>('')
  const [node, setNode] = useState<string>('')
  const [keyword, setKeyword] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{ items: SeedRecord[]; total: number; timeout_count: number } | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    setMsg(null)
    const r = await api.listRecords({
      status: status || undefined,
      node: node || undefined,
      keyword: keyword || undefined,
      page,
      page_size: pageSize,
    })
    setLoading(false)
    if (r.success && r.data) setData(r.data)
    else setMsg({ type: 'err', text: r.message })
  }

  useEffect(() => { load() }, [status, node, page, pageSize])

  const refresh = () => { load() }

  const doBatch = async (action: string) => {
    if (selected.size === 0) {
      setMsg({ type: 'err', text: '请先选择需要批量处理的苗种记录' })
      return
    }
    setLoading(true)
    const r = await api.batchAction({ record_ids: Array.from(selected), action })
    setLoading(false)
    if (r.success) {
      setMsg({ type: 'ok', text: r.message })
      setSelected(new Set())
      load()
    } else {
      setMsg({ type: 'err', text: r.message })
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / pageSize))

  const canBatchApprove = user?.role === 'auditor'
  const canBatchArchive = user?.role === 'reviewer'
  const canCreate = user?.role === 'registrar'

  const timeoutCount = data?.timeout_count || 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>苗种记录</h2>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            共 {data?.total ?? 0} 条记录
            {timeoutCount > 0 && (
              <span style={{ marginLeft: 12, color: '#b91c1c', fontWeight: 600 }}>
                ⚠ 超时节点记录：{timeoutCount} 条
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canBatchApprove && (
            <button onClick={() => doBatch('approve-audit')} style={btnPrimary}>批量审核通过</button>
          )}
          {canBatchArchive && (
            <button onClick={() => doBatch('archive')} style={btnPrimary}>批量归档复核</button>
          )}
          <button onClick={refresh} style={btnGhost}>刷新</button>
          {canCreate && (
            <button onClick={() => nav({ to: '/records/new' })} style={btnPrimary}>
              ＋ 发起苗种记录
            </button>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#475569', fontSize: 13 }}>状态</span>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={selectStyle}>
              <option value="">全部</option>
              <option value="pending">待处理</option>
              <option value="processing">处理中</option>
              <option value="approved">审核通过</option>
              <option value="correction">待补正</option>
              <option value="completed">已完成</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#475569', fontSize: 13 }}>当前节点</span>
            <select value={node} onChange={e => { setNode(e.target.value); setPage(1) }} style={selectStyle}>
              <option value="">全部</option>
              <option value="registration">苗种登记</option>
              <option value="audit">苗种审核</option>
              <option value="pond_entry">苗种入塘</option>
              <option value="survival_observe">成活观察</option>
              <option value="archive_review">批次归档复核</option>
              <option value="done">已完成</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 240 }}>
            <input value={keyword} onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }}
              placeholder="搜索批次号/苗种/供应商"
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => { setPage(1); load() }} style={btnGhost}>搜索</button>
          </div>
        </div>

        {msg && (
          <div style={{
            padding: '10px 12px', borderRadius: 6, marginBottom: 14,
            background: msg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
            color: msg.type === 'ok' ? '#047857' : '#b91c1c', fontSize: 14,
          }}>{msg.text}</div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: '#334155' }}>
                <th style={th}>
                  <input type="checkbox"
                    checked={(data?.items?.length || 0) > 0 && selected.size === (data?.items?.length || 0)}
                    onChange={e => {
                      if (e.target.checked) setSelected(new Set(data?.items?.map(i => i.id) || []))
                      else setSelected(new Set())
                    }} />
                </th>
                <th style={th}>批次号</th>
                <th style={th}>苗种类型/品种</th>
                <th style={th}>数量</th>
                <th style={th}>来源/供应商</th>
                <th style={th}>登记员</th>
                <th style={th}>登记时间</th>
                <th style={th}>当前节点</th>
                <th style={th}>状态</th>
                <th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>加载中...</td></tr>
              )}
              {!loading && (!data?.items || data.items.length === 0) && (
                <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>暂无苗种记录</td></tr>
              )}
              {!loading && data?.items?.map((r: any) => {
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={td}>
                      <input type="checkbox" checked={selected.has(r.id)}
                        onChange={e => {
                          const s = new Set(selected)
                          if (e.target.checked) s.add(r.id); else s.delete(r.id)
                          setSelected(s)
                        }} />
                    </td>
                    <td style={td}>
                      <a onClick={() => nav({ to: '/records/$id', params: { id: r.id } })}
                        style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>
                        {r.batch_no}
                      </a>
                    </td>
                    <td style={td}>
                      <div>{r.seed_type}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{r.seed_species}</div>
                    </td>
                    <td style={td}>{r.quantity} {r.unit}</td>
                    <td style={td}>
                      <div>{r.source}</div>
                      {r.supplier && <div style={{ color: '#64748b', fontSize: 12 }}>{r.supplier}</div>}
                    </td>
                    <td style={td}>{r.register_name}</td>
                    <td style={td}>{formatTime(r.register_time)}</td>
                    <td style={td}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 10,
                        fontSize: 12,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                      }}>{nodeLabel(r.current_node)}</span>
                    </td>
                    <td style={td}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 10, fontSize: 12,
                        background: statusColor(r.overall_status) + '1a',
                        color: statusColor(r.overall_status),
                        fontWeight: 600,
                      }}>{statusLabel(r.overall_status)}</span>
                    </td>
                    <td style={td}>
                      <a onClick={() => nav({ to: '/records/$id', params: { id: r.id } })}
                        style={{ color: '#2563eb', cursor: 'pointer', marginRight: 10 }}>查看</a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div style={{ color: '#64748b', fontSize: 13 }}>
            已选 {selected.size} 条 / 共 {data?.total || 0} 条
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={btnGhost}>上一页</button>
            <span style={{ padding: '8px 12px', fontSize: 13, color: '#475569' }}>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={btnGhost}>下一页</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  border: '1px solid #e2e8f0',
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 13,
  fontWeight: 600,
  borderBottom: '1px solid #e2e8f0',
}

const td: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: '#1e293b',
  verticalAlign: 'middle',
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  background: '#fff',
  outline: 'none',
  minWidth: 120,
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: '#047857',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
}

const btnGhost: React.CSSProperties = {
  padding: '8px 16px',
  background: '#fff',
  color: '#334155',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
}
