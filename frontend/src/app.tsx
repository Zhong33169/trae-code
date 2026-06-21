// @refresh reload
import { createSignal, onMount, Suspense, Show, ParentProps, ErrorBoundary, createEffect } from 'solid-js';
import { MetaProvider, Title, Meta, Link } from '@solidjs/meta';
import { Router, useNavigate, useLocation } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { isServer } from 'solid-js/web';
import { AuthProvider, useAuth } from './auth';
import { api } from './api';
import { ROLE_LABELS } from './types';
import './index.css';

function NavBar() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    api.logout();
    setUser(null);
    navigate('/login', { replace: true });
  };

  const linkClass = (href: string) => {
    const path = location.pathname;
    const active = href === '/events' ? (path === '/events' || path.startsWith('/events/')) : path === href;
    return active ? 'active' : '';
  };

  return (
    <nav class="nav-bar">
      <div class="nav-brand">
        <a href="/events">医疗事件管理系统</a>
      </div>
      <div class="nav-links">
        <a href="/events" class={linkClass('/events')}>医疗事件</a>
        <a href="/scan" class={linkClass('/scan')}>扫码核验</a>
        <a href="/batch" class={linkClass('/batch')}>批量处理</a>
        <a href="/statistics" class={linkClass('/statistics')}>统计</a>
        <a href="/audit" class={linkClass('/audit')}>审计</a>
      </div>
      <div class="nav-user">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 13px; color: var(--gray-500);">
            {user()?.name}
          </span>
          <span class="badge badge-blue">
            {ROLE_LABELS[user()?.role || ''] || user()?.role}
          </span>
          <button class="btn btn-outline btn-sm" onClick={handleLogout}>退出</button>
        </div>
      </div>
    </nav>
  );
}

function AuthGuard(props: ParentProps) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [initialized, setInitialized] = createSignal(false);

  onMount(async () => {
    const stored = api.getStoredUser();
    if (stored) {
      try {
        const data = await api.getMe();
        setUser(data.user);
      } catch (err) {
        api.logout();
        setUser(null);
      }
    }
    setInitialized(true);
  });

  createEffect(() => {
    if (!initialized()) return;
    const u = user();
    const path = location.pathname;
    const isPublic = path === '/login' || path === '/';
    if (!u && !isPublic) {
      navigate('/login', { replace: true });
    } else if (u && isPublic) {
      navigate('/events', { replace: true });
    }
  });

  return (
    <Show when={initialized()} fallback={
      <div class="loading">加载中...</div>
    }>
      <Show when={user()} fallback={
        <div class="page-container">
          {props.children}
        </div>
      }>
        <NavBar />
        <div class="page-container">
          <ErrorBoundary fallback={(err, reset) => (
            <div class="alert alert-error">
              <strong>页面错误</strong>：{String(err)}
              <button class="btn btn-outline btn-sm" onClick={() => reset()} style="margin-left: 10px;">重试</button>
            </div>
          )}>
            <Suspense fallback={<div class="loading">加载中...</div>}>
              {props.children}
            </Suspense>
          </ErrorBoundary>
        </div>
      </Show>
    </Show>
  );
}

interface DocumentProps {
  assets?: any;
  scripts?: any;
}

export default function App(props: DocumentProps) {
  return (
    <MetaProvider>
      <html lang="zh-CN">
        <head>
          <Meta charset="utf-8" />
          <Meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta name="description" content="医疗事件管理系统" />
          <Title>医疗事件管理系统</Title>
          <Link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8F%A5%3C/text%3E%3C/svg%3E" />
          {props.assets}
        </head>
        <body>
          <Show when={!isServer} fallback={null}>
            <AuthProvider>
              <ErrorBoundary fallback={(err) => (
                <div class="alert alert-error">
                  <strong>应用错误</strong>：{String(err)}
                </div>
              )}>
                <Router>
                  <AuthGuard>
                    <ErrorBoundary fallback={(err) => (
                      <div class="alert alert-error">
                        <strong>路由错误</strong>：{String(err)}
                      </div>
                    )}>
                      <FileRoutes />
                    </ErrorBoundary>
                  </AuthGuard>
                </Router>
              </ErrorBoundary>
            </AuthProvider>
          </Show>
          {props.scripts}
        </body>
      </html>
    </MetaProvider>
  );
}
