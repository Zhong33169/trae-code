import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigate,
  useLocation,
} from "react-router";
import type { LinksFunction } from "react-router";
import { ClipboardList, FilePlus, BarChart3, ChevronDown } from "lucide-react";
import { useState } from "react";
import { UserProvider, useUser, USERS } from "./utils/store";
import { ROLE_LABELS } from "./utils/types";

import stylesheet from "~/app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, setCurrentUser } = useUser();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navItems = [
    { label: "申诉队列", icon: ClipboardList, path: "/" },
    { label: "发起申诉", icon: FilePlus, path: "/appeals/new" },
    { label: "统计面板", icon: BarChart3, path: "#" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="w-60 min-h-screen flex flex-col" style={{ backgroundColor: "#1e3a5f" }}>
      <div className="px-5 py-5 border-b border-white/10">
        <h1 className="text-white text-lg font-serif font-bold tracking-wide">
          申诉管理系统
        </h1>
      </div>

      <div className="px-3 py-4 border-b border-white/10">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 transition-colors"
          >
            <div className="flex flex-col items-start">
              <span className="font-medium">{currentUser.name}</span>
              <span className="text-xs text-white/60">
                {ROLE_LABELS[currentUser.role]}
              </span>
            </div>
            <ChevronDown size={16} className={`transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {userMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg overflow-hidden z-50">
              {USERS.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u);
                    setUserMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                    u.id === currentUser.id ? "bg-blue-50 text-blue-700" : "text-gray-700"
                  }`}
                >
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-gray-500">{ROLE_LABELS[u.role]}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive(item.path)
                ? "bg-white/20 text-white font-medium"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-5 py-4 text-xs text-white/40">
        申诉管理系统 v1.0
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Meta />
        <Links />
      </head>
      <body className="bg-gray-50 antialiased">
        <UserProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </UserProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
