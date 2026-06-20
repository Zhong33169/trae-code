import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from '@tanstack/react-router';
import { useAuthStore } from '~/store/auth';
import { ROLE_MENUS, ROLE_LABELS, type UserRole } from '~/lib/constants';

const ROLE_ACCESS_MAP: Record<string, UserRole[]> = {
  '/dashboard': ['registrar', 'auditor', 'reviewer'],
  '/accounts-receivable': ['registrar', 'reviewer'],
  '/accounts-receivable/$id': ['registrar', 'reviewer'],
  '/confirmation-orders': ['registrar', 'auditor', 'reviewer'],
  '/confirmation-orders/$id': ['registrar', 'auditor', 'reviewer'],
  '/payment-verifications': ['reviewer'],
  '/operation-logs': ['registrar', 'auditor', 'reviewer'],
};

function canAccess(path: string, role: UserRole | undefined): boolean {
  if (!role) return false;
  const normalizedPath = path.replace(/\/\d+[^/]*/g, '/$id');
  const allowed = ROLE_ACCESS_MAP[normalizedPath];
  if (!allowed) return true;
  return allowed.includes(role);
}

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ location }) => {
    const authState = useAuthStore.getState();
    if (!authState.user) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }
    if (!canAccess(location.pathname, authState.user.role)) {
      throw redirect({ to: '/dashboard' });
    }
    authState.init();
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate({ from: Route.fullPath });
  const routerState = useRouterState();

  const handleLogout = () => {
    logout();
    navigate({ to: '/login', replace: true });
  };

  const menus = user ? ROLE_MENUS[user.role] : [];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">供应链金融平台</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {menus.map((menu) => {
            const isActive = routerState.location.pathname === menu.path || 
                           routerState.location.pathname.startsWith(menu.path + '/');
            return (
              <Link
                key={menu.key}
                to={menu.path}
                className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {menu.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
          <div className="text-gray-600 text-sm">
            欢迎使用供应链金融业务管理系统
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-600">{user?.real_name || user?.username}</span>
              <span className="ml-2 px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                {user ? ROLE_LABELS[user.role] : ''}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-red-600 transition-colors"
            >
              退出登录
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
