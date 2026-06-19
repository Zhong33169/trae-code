import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api, OperationLog } from '~/app/api'
import { formatTime, roleLabel, statusLabel } from '~/app/constants'

export const Route = createFileRoute('/logs')({
  component: LogsPage,
})

function LogsPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<OperationLog[]>([])
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [recordId, setRecordId] = useState('')

  const load = async () => {
    setLoading(true)
    const r = await api.listLogs({
      record_id: recordId || undefined,
      action: keyword || undefined,
      page, page_size: pageSize,
    })
    setLoading(false)
    if (r.success && r.data) {
      setItems(r.data.items || [])
      setTotal(r.data.total || 0)
    }
  }

  useEffect(() => { load() }, [page, pageSize])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>操作记录</h2>
        <button onClick={load} style={btnGhost}>刷新</button>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <input placeholder="搜索动作关键词（如：审核、超时、归档）"
            value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }}
            style={{ ...inputStyle, width: 280 }} />
          <input placeholder="按记录 ID 精确筛选（可选）"
            value={recordId} onChange={e => setRecordId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }}
            style={{ ...inputStyle, width: 280 }} />
          <button onClick={() => { setPage(1); load() }} style={btnGhost}>查询</button>
          <button onClick={() => { setKeyword(''); setRecordId(''); setPage(1); setTimeout(load, 0) }} style={btnGhost}>清空</button>
        </div>

        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>加载中...</div>}
        {!loading && items.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>暂无操作记录</div>
        )}

        {!loading && items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: '#334155' }}>
                <th style={th}>时间</th>
                <th style={th}>操作人</th>
                <th style={th}>岗位</th>
                <th style={th}>动作</th>
                <th style={th}>对象</th>
                <th style={th}>状态流转</th>
                <th style={th}>详情/证据</th>
              </tr>
            </thead>
            <tbody>
              {items.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>{formatTime(l.created_at)}</td>
                  <td style={td}>{l.user_name}</td>
                  <td style={td}>{roleLabel(l.user_role)}</td>
                  <td style={td}><b>{l.action}</b></td>
                  <td style={td}>{l.action_target}</td>
                  <td style={td}>
                    {l.old_status || l.new_status ? (
                      <>
                        {l.old_status ? statusLabel(l.old_status) : ''}
                        {l.old_status && l.new_status ? ' → ' : ''}
                        {l.new_status ? <b style={{ color: '#047857' }}>{statusLabel(l.new_status)}</b> : ''}
                      </>
                    ) : '-'}
                  </td>
                  <td style={{ ...td, maxWidth: 360 }}>
                    {l.detail && <div>{l.detail}</div>}
                    {l.evidence_note && (
                      <div style={{ color: '#0f766e', marginTop: 2 }}>证据：{l.evidence_note}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div style={{ color: '#64748b', fontSize: 13 }}>共 {total} 条</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={btnGhost}>上一页</button>
            <span style={{ padding: '8px 12px', fontSize: 13 }}>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={btnGhost}>下一页</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10, padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0',
}
const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600,
  borderBottom: '1px solid #e2e8f0',
}
const td: React.CSSProperties = {
  padding: '10px 12px', fontSize: 13, color: '#1e293b', verticalAlign: 'top',
}
const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, outline: 'none',
}
const btnGhost: React.CSSProperties = {
  padding: '8px 16px', background: '#fff', color: '#334155',
  border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13,
}
