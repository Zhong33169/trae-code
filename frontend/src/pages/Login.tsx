import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Shield, Archive } from 'lucide-react'
import { useStore, DEMO_ACCOUNTS } from '@/store'
import type { Role } from '@/types'

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  registrar: <User className="w-5 h-5" />,
  reviewer: <Shield className="w-5 h-5" />,
  archivist: <Archive className="w-5 h-5" />,
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const login = useStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    const ok = await login(username, password)
    setSubmitting(false)
    if (ok) navigate('/workspace')
  }

  const handleQuickLogin = async (role: Role) => {
    const account = DEMO_ACCOUNTS[role]
    setUsername(account.username)
    setPassword(account.password)
    setSubmitting(true)
    const ok = await login(account.username, account.password)
    setSubmitting(false)
    if (ok) navigate('/workspace')
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-navy text-center mb-2">展会预约管理系统</h1>
        <p className="text-gray-500 text-center mb-8">请登录以继续</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
              placeholder="请输入用户名"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
              placeholder="请输入密码"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-navy text-white py-2.5 rounded-md font-medium hover:bg-navy/90 transition-colors disabled:opacity-50"
          >
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-6">
          <p className="text-xs text-gray-400 text-center mb-3">快速演示登录</p>
          <div className="flex gap-2">
            {(Object.keys(DEMO_ACCOUNTS) as Role[]).map((role) => (
              <button
                key={role}
                onClick={() => handleQuickLogin(role)}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 rounded-md py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {ROLE_ICONS[role]}
                {DEMO_ACCOUNTS[role].display_name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
