import { Navigate, useLocation, useNavigate, A } from "@solidjs/router";
import { Component, Show, onMount } from "solid-js";
import { useApp, roleLabels } from "../lib/store";
import { api } from "../lib/api";

interface LayoutProps {
  children: any;
}

export const Layout: Component<LayoutProps> = (props) => {
  const app = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  onMount(async () => {
    if (app.token() && !app.user()) {
      try {
        const user = await api.getMe();
        app.setUser(user);
      } catch (e) {
        app.logout();
        navigate("/login");
      }
    }
  });

  const handleLogout = () => {
    app.logout();
    navigate("/login");
  };

  if (!app.token()) {
    return <Navigate href="/login" />;
  }

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div class="layout">
      <aside class="sidebar">
        <div class="logo">⚡ 能耗账单管理</div>
        <div class="user-info">
          <div class="name">{app.user()?.real_name || "加载中..."}</div>
          <div class="role">{roleLabels[app.user()?.role || ""] || ""}</div>
        </div>
        <nav>
          <A href="/bills" class={isActive("/bills") ? "active" : ""}>
            📋 账单列表
          </A>
          <A href="/stats" class={isActive("/stats") ? "active" : ""}>
            📊 统计概览
          </A>
        </nav>
        <button class="logout-btn" onClick={handleLogout}>
          🚪 退出登录
        </button>
      </aside>
      <main class="main-content">{props.children}</main>
    </div>
  );
};
