import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { api, auth } from '~/app/api'
import { roleLabel } from '~/app/constants'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const [username, setUsername] = useState('registrar')
  const [password, setPassword] = useState('registrar123')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const nav = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setMsg({ type: 'err', text: '请输入账号和密码' })
      return
    }
    setLoading(true)
    setMsg(null)
    const r = await api.login(username.trim(), password)
    setLoading(false)
    if (r.success && r.data) {
      auth.saveToken(r.data.token, r.data.user)
      setMsg({ type: 'ok', text: r.data.message || '登录成功' })
      setTimeout(() => nav({ to: '/' }), 500)
    } else {
      setMsg({ type: 'err', text: r.message || '登录失败' })
    }
  }

  const quickLogin = (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
    }}>
      <div style={{
        width: 440,
        background: '#fff',
        borderRadius: 12,
        padding: 36,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#065f46' }}>🐟 苗种记录系统</div>
          <div style={{ color: '#6b7280', marginTop: 6, fontSize: 14 }}>水产养殖基地 · 节点超时追踪</div>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#374151', fontWeight: 500 }}>账号</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              style={inputStyle} placeholder="请输入账号" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#374151', fontWeight: 500 }}>密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle} placeholder="请输入密码" />
          </div>
          {msg && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 6,
              marginBottom: 14,
              fontSize: 14,
              background: msg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
              color: msg.type === 'ok' ? '#047857' : '#b91c1c',
            }}>{msg.text}</div>
          )}
          <button type="submit" disabled={loading}
            style={{
              width: '100%',
              padding: '12px 0',
              background: '#047857',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              opacity: loading ? 0.6 : 1,
            }}>{loading ? '登录中...' : '登 录'}</button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>样例账号（一键登录）：</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <QuickBtn label={`登记员：registrar / registrar123（${roleLabel('registrar')}）`}
              onClick={() => quickLogin('registrar', 'registrar123')} />
            <QuickBtn label={`审核主管：auditor / auditor123（${roleLabel('auditor')}）`}
              onClick={() => quickLogin('auditor', 'auditor123')} />
            <QuickBtn label={`复核负责人：reviewer / reviewer123（${roleLabel('reviewer')}）`}
              onClick={() => quickLogin('reviewer', 'reviewer123')} />
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 14,
  outline: 'none',
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '8px 12px',
      textAlign: 'left',
      background: '#f1f5f9',
      border: '1px solid #e2e8f0',
      borderRadius: 6,
      fontSize: 13,
      color: '#334155',
    }}>{label}</button>
  )
}
