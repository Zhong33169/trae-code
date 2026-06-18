import { Router, Route, Routes, A, Navigate, useNavigate, useLocation } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Suspense, createContext, useContext, createSignal, onMount, Show, JSX } from 'solid-js';
import { getCurrentUser, logout } from './api/auth';
import type { UserInfo } from './api/client';
import './style.css';

type EventBusListener = (...args: any[]) => void;
class EventBus {
  private map = new Map<string, Set<EventBusListener>>();
  on(name: string, fn: EventBusListener) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name)!.add(fn);
    return () => this.off(name, fn);
  }
  off(name: string, fn: EventBusListener) { this.map.get(name)?.delete(fn); }
  emit(name: string, ...args: any[]) { this.map.get(name)?.forEach((fn) => fn(...args)); }
}
const bus = new EventBus();

const UserCtx = createContext<{
  user: () => UserInfo | null;
  setUser: (u: UserInfo | null) => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  toast: () => { msg: string; type: string } | null;
  bus: EventBus;
}>(null as any);

export function useUser() { return useContext(UserCtx); }

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#909399', PENDING_AUDIT: '#e6a23c', NEED_CORRECT: '#f56c6c',
  AUDIT_PASSED: '#67c23a', MATERIAL_PENDING: '#e6a23c', MATERIAL_REJECTED: '#f56c6c',
  MATERIAL_APPROVED: '#67c23a', DELIVERY_PENDING: '#e6a23c',
  DELIVERY_CONFIRMED: '#67c23a', ARCHIVED: '#409eff',
};
export { STATUS_COLOR };

export function Badge(props: { status: string; label: string }) {
  return (
    <span class="badge" style={{ background: STATUS_COLOR[props.status] || '#999' }}>{props.label}</span>
  );
}

function Toast() {
  const { toast } = useUser();
  const t = toast();
  return (
    <Show when={t}>
      <div class={`toast toast-${t!.type}`}>{t!.msg}</div>
    </Show>
  );
}

function Header() {
  const { user, setUser } = useUser();
  const nav = useNavigate();
  const loc = useLocation();
  const path = loc.pathname;
  return (
    <header class="app-header">
      <div class="logo">📣 公关传播计划管理系统</div>
      <nav class="nav">
        <A href="/plans" class={path.startsWith('/plans') && !path.startsWith('/plans/stat') ? 'active' : ''}>传播计划</A>
        <A href="/plans/stat" class={path.startsWith('/plans/stat') ? 'active' : ''}>统计看板</A>
      </nav>
      <div class="user-box">
        <span class="role-chip">{user()?.roleName}</span>
        <span class="real-name">{user()?.realName}</span>
        <button class="btn-text" onClick={() => { logout(); setUser(null); nav('/login'); }}>退出登录</button>
      </div>
    </header>
  );
}

function Layout(props: { children: JSX.Element }) {
  const { user, setUser } = useUser();
  const loc = useLocation();
  onMount(() => {
    if (!user()) setUser(getCurrentUser());
  });
  if (loc.pathname === '/login') return <>{props.children}</>;
  if (!user()) return <Navigate href="/login" />;
  return (
    <div class="app">
      <Header />
      <main class="main">{props.children}</main>
      <Toast />
    </div>
  );
}

export default function App() {
  const [user, setUser] = createSignal<UserInfo | null>(getCurrentUser());
  const [toast, setToast] = createSignal<{ msg: string; type: string } | null>(null);
  let timer: any;
  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    clearTimeout(timer);
    timer = setTimeout(() => setToast(null), 2800);
  };
  return (
    <UserCtx.Provider value={{ user, setUser, notify, toast, bus }}>
      <Router root={(props) => <Suspense><Layout>{props.children}</Layout></Suspense>}>
        <FileRoutes />
      </Router>
    </UserCtx.Provider>
  );
}
