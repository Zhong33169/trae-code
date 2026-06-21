import type { JSX, ParentProps } from 'solid-js';
import { createContext, useContext, createSignal, Show, onMount } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { api } from './api';
import type { User } from './types';
import { ROLE_LABELS } from './types';

interface AuthCtx {
  user: () => User | null;
  setUser: (u: User | null) => void;
  isLoggedIn: () => boolean;
  doLogin: (username: string, password: string) => Promise<void>;
  doLogout: () => void;
}

const AuthContext = createContext<AuthCtx>();

export function useAuth() {
  return useContext(AuthContext)!;
}

export function App(props: ParentProps) {
  const [user, setUser] = createSignal<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isLoggedIn = () => !!user();

  onMount(() => {
    const stored = api.getStoredUser();
    if (stored) {
      setUser(stored);
    }
  });

  onMount(() => {
    if (!isLoggedIn() && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  });

  const doLogin = async (username: string, password: string) => {
    const data = await api.login(username, password);
    setUser(data.user);
    navigate('/events', { replace: true });
  };

  const doLogout = () => {
    api.logout();
    setUser(null);
    navigate('/login', { replace: true });
  };

  const ctx: AuthCtx = { user, setUser, isLoggedIn, doLogin, doLogout };

  const navLinks = [
    { path: '/events', label: '医疗事件' },
    { path: '/scan', label: '扫码核验' },
    { path: '/batch', label: '批量处理' },
    { path: '/statistics', label: '统计分析' },
    { path: '/audit', label: '审计日志' },
  ];

  const isActive = (path: string) => {
    const p = location.pathname;
    if (path === '/events') return p === '/events' || p.startsWith('/events/');
    return p === path;
  };

  return (
    <AuthContext.Provider value={ctx}>
      <Show
        when={isLoggedIn()}
        fallback={<>{props.children}</>}
      >
        <nav class="nav-bar">
          <div class="nav-brand">医疗事件管理系统</div>
          <div class="nav-links">
            {navLinks.map((l) => (
              <a
                href={l.path}
                class={isActive(l.path) ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(l.path);
                }}
              >
                {l.label}
              </a>
            ))}
          </div>
          <div class="nav-user">
            <span>{user()?.name} ({ROLE_LABELS[user()?.role || '']})</span>
            <button class="btn btn-outline btn-sm" onClick={doLogout}>退出</button>
          </div>
        </nav>
        <div class="page-container">
          {props.children}
        </div>
      </Show>
    </AuthContext.Provider>
  );
}
