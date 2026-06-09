import { ROLE_MAP } from "../utils/types.ts";
import type { User } from "../utils/types.ts";

interface NavbarProps {
  user: User | null;
  currentPath: string;
}

export function Navbar({ user, currentPath }: NavbarProps) {
  const navItems = [
    { path: "/", label: "处方流转", icon: "📋" },
    { path: "/batch", label: "批量操作", icon: "📦" },
    { path: "/audit", label: "审计日志", icon: "📝" },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-blue-600">💊 处方流转系统</span>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
              {navItems.map((item) => {
                const isActive = currentPath === item.path || 
                  (item.path !== "/" && currentPath.startsWith(item.path));
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
          <div className="flex items-center">
            {user && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{user.name}</p>
                  <p className="text-xs text-gray-500">{ROLE_MAP[user.role] || user.role}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-medium">
                    {user.name.charAt(0)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem("auth_token");
                    localStorage.removeItem("auth_user");
                    window.location.href = "/login";
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  退出
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
