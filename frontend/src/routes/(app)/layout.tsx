import { component$, Slot, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useLocation, useNavigate } from "@builder.io/qwik-city";
import { useAuth, doLogout } from "~/store/auth";

const navItems = [
  {
    key: 'booking',
    label: '订舱申请',
    icon: '📋',
    path: '/booking',
    desc: '订舱登记、审核、确认',
  },
  {
    key: 'loading',
    label: '装柜确认',
    icon: '🚛',
    path: '/loading',
    desc: '装柜安排、确认执行',
  },
  {
    key: 'bl',
    label: '提单回收',
    icon: '📄',
    path: '/bl',
    desc: '提单出单、回收归档',
  },
];

export default component$(() => {
  const auth = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const state = useStore({ showUserMenu: false });

  useVisibleTask$(() => {
    if (!auth.token && !auth.loading && loc.url.pathname !== '/') {
      window.location.href = '/';
    }
  });

  const activeKey = loc.url.pathname.startsWith('/bl') ? 'bl' : loc.url.pathname.startsWith('/loading') ? 'loading' : 'booking';

  const handleLogout = async () => {
    await doLogout();
    auth.user = null;
    auth.token = null;
    window.location.href = '/';
  };

  return (
    <div class="min-h-screen bg-gray-50 flex">
      <aside class="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-20 shadow-sm">
        <div class="p-5 border-b border-gray-100">
          <Link href={auth.token ? '/booking' : '/'} class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <div class="font-bold text-gray-900">订舱管理系统</div>
              <div class="text-xs text-gray-400">Booking Management</div>
            </div>
          </Link>
        </div>

        <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
          <div class="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">业务模块</div>
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.path}
              class={
                'flex items-start gap-3 px-4 py-3 rounded-xl transition-all ' +
                (activeKey === item.key
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm border border-blue-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
              }
            >
              <div class="text-xl">{item.icon}</div>
              <div class="flex-1 min-w-0">
                <div class="font-medium">{item.label}</div>
                <div class="text-xs mt-0.5 opacity-70">{item.desc}</div>
              </div>
            </Link>
          ))}
        </nav>

        <div class="p-4 border-t border-gray-100">
          <div class="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
            <div class="text-xs text-gray-500">系统版本</div>
            <div class="text-sm font-medium text-gray-700 mt-1">v1.0.0</div>
          </div>
        </div>
      </aside>

      <div class="flex-1 ml-64 flex flex-col min-h-screen">
        <header class="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div class="flex items-center justify-between px-6 py-4">
            <div class="flex items-center gap-3">
              <div>
                <h2 class="text-lg font-semibold text-gray-900">
                  {navItems.find((n) => n.key === activeKey)?.label || '工作台'}
                </h2>
                <p class="text-xs text-gray-500 mt-0.5">
                  {navItems.find((n) => n.key === activeKey)?.desc}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-4">
              {auth.user && (
                <div class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                  <div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                  <div class="text-sm">
                    <span class="text-amber-700 font-medium">{auth.user.real_name}</span>
                    <span class="text-amber-500 mx-2">·</span>
                    <span class="text-amber-600">{auth.user.role_label}</span>
                  </div>
                </div>
              )}

              <div class="relative">
                <button
                  onClick$={() => (state.showUserMenu = !state.showUserMenu)}
                  class="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div class="w-9 h-9 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-medium shadow-sm">
                    {auth.user?.real_name?.charAt(0) || 'U'}
                  </div>
                  <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {state.showUserMenu && (
                  <div
                    class="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-30"
                    onClick$={() => (state.showUserMenu = false)}
                  >
                    <div class="px-4 py-3 border-b border-gray-50">
                      <div class="font-medium text-gray-900">{auth.user?.real_name || '未登录'}</div>
                      <div class="text-xs text-gray-500 mt-0.5">@{auth.user?.username || '-'}</div>
                      <div class="inline-flex mt-2 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {auth.user?.role_label || '-'}
                      </div>
                    </div>
                    <div class="py-1">
                      <button
                        onClick$={handleLogout}
                        class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 p-6 overflow-x-hidden">
          <Slot />
        </main>
      </div>
    </div>
  );
});
