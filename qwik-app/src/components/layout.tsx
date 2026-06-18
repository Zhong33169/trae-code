import { component$, Slot } from '@builder.io/qwik';
import { useLocation, useNavigate } from '@builder.io/qwik-city';
import type { User } from '~/types';
import { roleLabels } from '~/utils/api';
import { clearAuth } from '~/utils/api';

interface LayoutProps {
  user: User;
}

export default component$<LayoutProps>(({ user }) => {
  const loc = useLocation();
  const nav = useNavigate();

  const handleLogout = () => {
    clearAuth();
    nav('/login');
  };

  const menuItems = [
    { path: '/applications', label: '申请列表', icon: '📋' },
    { path: '/statistics', label: '统计概览', icon: '📊' },
  ];

  return (
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-logo">展商申请管理</div>
        <nav class="sidebar-menu">
          {menuItems.map((item) => (
            <div
              key={item.path}
              class={[
                'sidebar-item',
                loc.url.pathname.startsWith(item.path) ? 'active' : '',
              ]}
              onClick$={() => nav(item.path)}
            >
              <span style={{ marginRight: '8px' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>
      </aside>

      <main class="main">
        <header class="header">
          <div class="header-title">
            {loc.url.pathname.startsWith('/applications/')
              ? '申请详情'
              : loc.url.pathname === '/applications'
                ? '展商申请列表'
                : '首页'}
          </div>
          <div class="header-right">
            <div class="user-info">
              <span>👤 {user.full_name}</span>
              <span class="user-role">{roleLabels[user.role]}</span>
            </div>
            <button class="btn btn-default btn-sm" onClick$={handleLogout}>
              退出
            </button>
          </div>
        </header>

        <div class="content">
          <Slot />
        </div>
      </main>
    </div>
  );
});
