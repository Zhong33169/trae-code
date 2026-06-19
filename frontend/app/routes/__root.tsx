import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { auth, User } from '~/app/api'
import { roleLabel } from '~/app/constants'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const [user, setUser] = useState<User | null>(null)
  const nav = useNavigate()
  const state = useRouterState()

  useEffect(() => {
    setUser(auth.getUser())
  }, [state.location.href])

  const isLogin = state.location.pathname === '/login'

  const doLogout = () => {
    auth.clear()
    setUser(null)
    nav({ to: '/login' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        a { color: inherit; text-decoration: none; }
        button { cursor: pointer; }
        input, select, textarea, button { font-family: inherit; font-size: 14px; }
      `}</style>

      {!isLogin && user && (
        <header style={{
          background: 'linear-gradient(90deg, #065f46, #047857)',
          color: '#fff',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
              🐟 水产养殖基地 · 苗种记录节点超时追踪系统
            </div>
            <nav style={{ display: 'flex', gap: 4 }}>
              <NavLink to="/" label="苗种记录首页" />
              <NavLink to="/stats" label="统计看板" />
              <NavLink to="/logs" label="操作记录" />
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 14, opacity: 0.92 }}>
              {user.real_name}（{roleLabel(user.role)}）
            </span>
            <button onClick={doLogout} style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 6,
            }}>退出登录</button>
          </div>
        </header>
      )}

      <main style={{ padding: isLogin ? 0 : 24, maxWidth: 1440, margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({ to, label }: { to: string; label: string }) {
  const state = useRouterState()
  const active = state.location.pathname === to
  return (
    <Link to={to} style={{
      padding: '8px 16px',
      borderRadius: 6,
      fontSize: 14,
      background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
      fontWeight: active ? 600 : 400,
    }}>{label}</Link>
  )
}
