import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { api, auth } from '~/app/api'
import { roleLabel } from '~/app/constants'

export const Route = createFileRoute('/records/new')({
  component: NewRecordPage,
})

function NewRecordPage() {
  const user = auth.getUser()
  const nav = useNavigate()
  const [form, setForm] = useState({
    seed_type: '鱼苗',
    seed_species: '',
    quantity: 10000,
    unit: '尾',
    source: '外购',
    supplier: '',
    deadline_hours: 24,
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  if (user?.role !== 'registrar') {
    return (
      <div style={card}>
        <div style={{ color: '#b91c1c', padding: 20 }}>
          当前岗位为「{roleLabel(user?.role || '')}」，仅「苗种登记员」可发起苗种记录。
        </div>
        <button onClick={() => nav({ to: '/' })} style={btnGhost}>返回列表</button>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.seed_type.trim() || !form.seed_species.trim() || form.quantity <= 0 || !form.source.trim()) {
      setMsg({ type: 'err', text: '苗种类型、品种、数量（>0）、来源均为必填项' })
      return
    }
    setLoading(true)
    setMsg(null)
    const r = await api.createRecord(form)
    setLoading(false)
    if (r.success && r.data) {
      setMsg({ type: 'ok', text: r.message })
      setTimeout(() => nav({ to: '/records/$id', params: { id: r.data!.record.id } }), 600)
    } else {
      setMsg({ type: 'err', text: r.message })
    }
  }

  const field = (label: string, child: React.ReactNode) => (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, color: '#334155', fontWeight: 500, marginBottom: 6 }}>{label}</label>
      {child}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>发起苗种记录</h2>
        <button onClick={() => nav({ to: '/' })} style={btnGhost}>返回列表</button>
      </div>
      <div style={card}>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {field('苗种类型', (
              <select value={form.seed_type}
                onChange={e => setForm({ ...form, seed_type: e.target.value })} style={inputStyle}>
                <option>鱼苗</option>
                <option>虾苗</option>
                <option>蟹苗</option>
                <option>贝苗</option>
                <option>藻苗</option>
                <option>其他</option>
              </select>
            ))}
            {field('苗种品种', (
              <input value={form.seed_species}
                onChange={e => setForm({ ...form, seed_species: e.target.value })}
                placeholder="如：草鱼夏花、南美白对虾P10" style={inputStyle} />
            ))}
            {field('数量', (
              <input type="number" min={1} value={form.quantity}
                onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                style={inputStyle} />
            ))}
            {field('计量单位', (
              <select value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })} style={inputStyle}>
                <option>尾</option>
                <option>只</option>
                <option>公斤</option>
                <option>万尾</option>
                <option>株</option>
              </select>
            ))}
            {field('来源', (
              <select value={form.source}
                onChange={e => setForm({ ...form, source: e.target.value })} style={inputStyle}>
                <option>外购</option>
                <option>自繁</option>
                <option>合作基地</option>
                <option>其他</option>
              </select>
            ))}
            {field('供应商（选填）', (
              <input value={form.supplier}
                onChange={e => setForm({ ...form, supplier: e.target.value })}
                placeholder="如：XX水产育苗有限公司" style={inputStyle} />
            ))}
            {field('节点时限（小时，从提交起算，默认 24）', (
              <input type="number" min={1} value={form.deadline_hours}
                onChange={e => setForm({ ...form, deadline_hours: Number(e.target.value) })}
                style={inputStyle} />
            ))}
          </div>
          {msg && (
            <div style={{
              padding: '10px 12px', borderRadius: 6, marginTop: 8, marginBottom: 14,
              background: msg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
              color: msg.type === 'ok' ? '#047857' : '#b91c1c', fontSize: 14,
            }}>{msg.text}</div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={loading} style={btnPrimary}>{loading ? '提交中...' : '提交审核'}</button>
            <button type="button" onClick={() => nav({ to: '/' })} style={btnGhost}>取消</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10, padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1',
  borderRadius: 6, fontSize: 14, outline: 'none', background: '#fff',
}
const btnPrimary: React.CSSProperties = {
  padding: '9px 20px', background: '#047857', color: '#fff', border: 'none',
  borderRadius: 6, fontSize: 14, fontWeight: 500,
}
const btnGhost: React.CSSProperties = {
  padding: '9px 20px', background: '#fff', color: '#334155',
  border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14,
}
