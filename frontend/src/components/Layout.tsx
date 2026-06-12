import { Show } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';
import { user, logout } from '../stores/auth';

const NAV_ITEMS = [
  { path: '/dashboard', label: '工作台', icon: '📊' },
  { path: '/queue', label: '待办队列', icon: '📋' },
  { path: '/scan', label: '扫码核验', icon: '📷' },
  { path: '/batch', label: '批量处理', icon: '⚡' },
];

const ROLE_LABELS: Record<string, string> = {
  community_worker: '社区专干',
  clerk: '街道科员',
  leader: '分管领导',
};

export default function Layout(props: { children: any }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isLoginPage = () => location.pathname === '/';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Show
      when={!isLoginPage()}
      fallback={<>{props.children}</>}
    >
      <div style={{ display: 'flex', height: '100vh' }}>
        <aside style={{
          width: '240px',
          background: 'var(--primary)',
          color: 'var(--white)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          <div style={{
            padding: '20px 16px',
            fontSize: '18px',
            fontWeight: 700,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            帮扶申请系统
          </div>
          <nav style={{ flex: 1, padding: '8px 0' }}>
            {NAV_ITEMS.map(item => (
              <div
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  background: location.pathname.startsWith(item.path)
                    ? 'rgba(255,255,255,0.15)'
                    : 'transparent',
                  color: location.pathname.startsWith(item.path)
                    ? '#fff'
                    : 'rgba(255,255,255,0.7)',
                  transition: 'all 0.2s',
                  fontSize: '14px',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </nav>
          <Show when={user()}>
            <div style={{
              padding: '16px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                {user().username}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: '11px',
                  background: 'rgba(255,255,255,0.2)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}>
                  {ROLE_LABELS[user().role] || user().role}
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '12px',
                    padding: '2px 4px',
                  }}
                >
                  退出
                </button>
              </div>
            </div>
          </Show>
        </aside>
        <main style={{
          flex: 1,
          background: 'var(--bg)',
          overflow: 'auto',
          padding: '24px',
        }}>
          {props.children}
        </main>
      </div>
    </Show>
  );
}
