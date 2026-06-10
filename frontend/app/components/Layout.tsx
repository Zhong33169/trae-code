import React from "react";
import { NavLink, useLocation } from "@remix-run/react";
import { useAuth } from "~/hooks/useAuth";
import { ROLE_LABELS } from "~/config";
import { getInitials } from "~/utils/helpers";

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles?: string[];
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const navItems: NavItem[] = [
    { path: "/", label: "首页", icon: "🏠" },
    { path: "/inspections", label: "巡检单", icon: "📋" },
    { path: "/inspections/new", label: "创建巡检", icon: "➕", roles: ["registrar"] },
    { path: "/scan", label: "扫码核验", icon: "📱" },
    { path: "/piles", label: "充电桩", icon: "🔌" },
    { path: "/audit", label: "审计日志", icon: "📜", roles: ["supervisor", "reviewer"] },
  ];

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
      <aside
        style={{
          width: "240px",
          backgroundColor: "#1f2937",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "20px 16px",
            borderBottom: "1px solid #374151",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>
            ⚡ 充电桩巡检系统
          </div>
          <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
            Charging Pile Inspection
          </div>
        </div>

        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 12px",
                borderRadius: "6px",
                color: isActive(item.path) ? "#fff" : "#d1d5db",
                backgroundColor: isActive(item.path) ? "#3b82f6" : "transparent",
                textDecoration: "none",
                fontSize: "14px",
                marginBottom: "4px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  (e.target as HTMLAnchorElement).style.backgroundColor = "#374151";
                  (e.target as HTMLAnchorElement).style.color = "#fff";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  (e.target as HTMLAnchorElement).style.backgroundColor = "transparent";
                  (e.target as HTMLAnchorElement).style.color = "#d1d5db";
                }
              }}
            >
              <span style={{ fontSize: "18px" }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {user && (
          <div
            style={{
              padding: "16px",
              borderTop: "1px solid #374151",
              backgroundColor: "#111827",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                padding: "8px",
                borderRadius: "6px",
              }}
              onClick={() => setShowUserMenu(!showUserMenu)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = "#374151";
              }}
              onMouseLeave={(e) => {
                if (!showUserMenu) {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                }
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: "16px",
                }}
              >
                {getInitials(user.full_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.full_name}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#9ca3af",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ROLE_LABELS[user.role] || user.role}
                </div>
              </div>
              <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                {showUserMenu ? "▲" : "▼"}
              </span>
            </div>

            {showUserMenu && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "4px",
                  backgroundColor: "#374151",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    fontSize: "13px",
                    color: "#d1d5db",
                    borderBottom: "1px solid #4b5563",
                    marginBottom: "4px",
                  }}
                >
                  <div style={{ marginBottom: "4px" }}>
                    <span style={{ color: "#9ca3af" }}>用户名：</span>
                    {user.username}
                  </div>
                  {user.station_code && (
                    <div>
                      <span style={{ color: "#9ca3af" }}>充电站：</span>
                      {user.station_code}
                    </div>
                  )}
                </div>
                <button
                  onClick={logout}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    textAlign: "left",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#fca5a5",
                    cursor: "pointer",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = "#4b5563";
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor = "transparent";
                  }}
                >
                  🚪 退出登录
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header
          style={{
            height: "60px",
            backgroundColor: "#fff",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#111827" }}>
            {filteredNavItems.find((item) => isActive(item.path))?.label || "系统"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {user && (
              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                <span style={{ marginRight: "8px" }}>👋</span>
                欢迎回来，{user.full_name}
              </div>
            )}
          </div>
        </header>

        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>{children}</div>
      </main>
    </div>
  );
}
