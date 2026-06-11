import { Component, onMount, onCleanup } from "solid-js";
import { A, useNavigate, useLocation } from "@solidjs/router";
import { authStore, roleNames } from "~/store/auth";
import { toastStore } from "~/store/toast";

const Layout: Component = (props) => {
  const navigate = useNavigate();
  const location = useLocation();

  onMount(() => {
    authStore.initFromStorage();
    if (!authStore.token()) {
      navigate("/login", { replace: true });
    }
  });

  const handleLogout = () => {
    authStore.clearAuth();
    navigate("/login", { replace: true });
  };

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const user = authStore.user();

  return (
    <div class="page-layout">
      <header class="page-header">
        <div class="container header-content">
          <h1>🌾 农业合作社 - 种植任务管理系统</h1>
          <div class="user-info">
            {user && (
              <>
                <span>{user.name}</span>
                <span class="role-badge">{roleNames[user.role]}</span>
                <button class="btn btn-default btn-sm" onClick={handleLogout}>
                  退出
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <nav class="page-nav">
        <div class="container">
          <ul class="nav-list">
            <li class={`nav-item ${isActive("/tasks") ? "active" : ""}`}>
              <A href="/tasks">种植任务列表</A>
            </li>
            {authStore.hasRole("registrar") && (
              <li class={`nav-item ${isActive("/tasks/create") ? "active" : ""}`}>
                <A href="/tasks/create">新建任务</A>
              </li>
            )}
            <li class={`nav-item ${isActive("/statistics") ? "active" : ""}`}>
              <A href="/statistics">数据统计</A>
            </li>
          </ul>
        </div>
      </nav>

      <main class="page-content">
        <div class="container">{props.children}</div>
      </main>

      <div class="toast-container">
        {toastStore.toasts().map((toast) => (
          <div class={`toast toast-${toast.type}`}>{toast.message}</div>
        ))}
      </div>
    </div>
  );
};

export default Layout;
