import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api, Statistics } from '~/app/api'
import { nodeLabel, statusLabel } from '~/app/constants'

export const Route = createFileRoute('/stats')({
  component: StatsPage,
})

function StatsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Statistics | null>(null)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true); setErr('')
    const r = await api.stats()
    setLoading(false)
    if (r.success && r.data) setData(r.data)
    else setErr(r.message)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div style={{ padding: 40 }}>加载中...</div>
  if (err) return <div style={{ padding: 40, color: '#b91c1c' }}>{err}</div>
  if (!data) return null

  const cards = [
    { label: '全部苗种记录', value: data.total_records, color: '#0ea5e9', bg: '#e0f2fe' },
    { label: '待处理', value: data.pending_count, color: '#f59e0b', bg: '#fef3c7' },
    { label: '处理中', value: data.processing_count, color: '#3b82f6', bg: '#dbeafe' },
    { label: '已完成', value: data.completed_count, color: '#10b981', bg: '#d1fae5' },
    { label: '待补正', value: data.rejected_count, color: '#ef4444', bg: '#fee2e2' },
    { label: '节点超时', value: data.timeout_count, color: '#b91c1c', bg: '#fee2e2' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>统计看板</h2>
        <button onClick={load} style={btnGhost}>刷新</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18,
          }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>{c.label}</div>
            <div style={{
              fontSize: 28, fontWeight: 700, color: c.color,
              background: c.bg, display: 'inline-block', padding: '2px 12px', borderRadius: 8,
            }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>按记录状态统计</div>
          {data.by_status.map(s => (
            <Bar key={s.status} label={s.status_label} value={s.count}
              max={Math.max(1, ...data.by_status.map(x => x.count))}
              color={'#3b82f6'} />
          ))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>按节点分布统计（含超时）</div>
          {data.by_node.map(n => (
            <div key={n.node} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: '#334155' }}>{nodeLabel(n.node)}</span>
                <span>
                  <b style={{ color: '#0f172a' }}>{n.count}</b>
                  {n.timeout_count > 0 && (
                    <span style={{ color: '#dc2626', marginLeft: 8 }}>⚠ 超时 {n.timeout_count}</span>
                  )}
                </span>
              </div>
              <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                <div style={{
                  height: '100%',
                  width: `${(n.count / Math.max(1, ...data.by_node.map(x => x.count))) * 100}%`,
                  background: n.timeout_count > 0 ? '#dc2626' : '#10b981',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>近 7 日 新增 / 完成 趋势（数据来源与列表、详情一致）</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.recent_trend.length}, 1fr)`, gap: 8, height: 200, alignItems: 'flex-end' }}>
          {data.recent_trend.map(t => (
            <div key={t.date} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                <div>新 {t.new_count}</div>
                <div>完 {t.completed_count}</div>
              </div>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'flex-end', height: 140 }}>
                <div style={{
                  width: 16,
                  height: `${(t.new_count / Math.max(1, ...data.recent_trend.map(x => x.new_count))) * 100}%`,
                  background: '#3b82f6', borderRadius: 3, minHeight: t.new_count > 0 ? 4 : 0,
                }} />
                <div style={{
                  width: 16,
                  height: `${(t.completed_count / Math.max(1, ...data.recent_trend.map(x => x.completed_count + 1))) * 100}%`,
                  background: '#10b981', borderRadius: 3, minHeight: t.completed_count > 0 ? 4 : 0,
                }} />
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{t.date.slice(5)}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#3b82f6', marginRight: 6 }}></span>新增
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#10b981', marginLeft: 18, marginRight: 6 }}></span>完成
        </div>
      </div>
    </div>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: '#334155' }}>{label}</span>
        <b style={{ color: '#0f172a' }}>{value}</b>
      </div>
      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: color, borderRadius: 4 }} />
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10, padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0',
}
const btnGhost: React.CSSProperties = {
  padding: '8px 16px', background: '#fff', color: '#334155',
  border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13,
}
