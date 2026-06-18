import { A, useLocation } from "@solidjs/router";
import { useAuth, roleNames } from "~/lib/auth";
import { Show } from "solid-js";

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <nav class="navbar">
      <div class="navbar-inner">
        <A href="/" class="navbar-brand">
          银行网点资料年检单系统
        </A>

        <Show when={user()}>
          <div class="navbar-nav">
            <A href="/" class={`navbar-link ${isActive("/") && location.pathname === "/" ? "active" : ""}`}>
              首页
            </A>
            <A href="/forms" class={`navbar-link ${isActive("/forms") ? "active" : ""}`}>
              年检单
            </A>
            <A href="/reminders" class={`navbar-link ${isActive("/reminders") ? "active" : ""}`}>
              年检提醒
            </A>
            <A href="/corporates" class={`navbar-link ${isActive("/corporates") ? "active" : ""}`}>
              对公资料
            </A>
            <A href="/stats" class={`navbar-link ${isActive("/stats") ? "active" : ""}`}>
              统计
            </A>
            <A href="/logs" class={`navbar-link ${isActive("/logs") ? "active" : ""}`}>
              操作日志
            </A>
          </div>

          <div class="navbar-user">
            <div class="text-right">
              <div class="navbar-user-name">{user()?.name}</div>
              <div class="navbar-user-role">{roleNames[user()?.role || ""] || user()?.role}</div>
            </div>
            <button
              class="btn btn-secondary btn-sm"
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
            >
              退出
            </button>
          </div>
        </Show>
      </div>
    </nav>
  );
}
