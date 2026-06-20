import { component$, useStore, $, useOnMount } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { User, UserRole } from "~/types";
import { api } from "~/services/api";
import { roleLabels } from "~/utils/format";

interface AppState {
  currentUser: User | null;
  users: User[];
  loading: boolean;
}

export default component$(() => {
  const loc = useLocation();
  const state = useStore<AppState>({
    currentUser: null,
    users: [],
    loading: true,
  });

  useOnMount$(async () => {
    try {
      const response = await api.getUsers();
      if (response.success && response.data.length > 0) {
        state.users = response.data;
        state.currentUser = response.data[0];
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      state.loading = false;
    }
  });

  const handleUserChange = $((e: Event) => {
    const target = e.target as HTMLSelectElement;
    const userId = parseInt(target.value, 10);
    const user = state.users.find((u) => u.id === userId);
    if (user) {
      state.currentUser = user;
    }
  });

  const navLinks = [
    { href: "/", label: "首页", icon: "🏠" },
    { href: "/inspections", label: "巡检单列表", icon: "📋" },
    { href: "/inspections/high-risk", label: "高风险单", icon: "⚠️" },
  ];

  return (
    <div>
      <nav class="nav">
        <div class="nav-container">
          <div class="nav-logo">🏋️ 社区健身房器械巡检系统</div>
          <div class="nav-links">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                class={{
                  "nav-link": true,
                  active:
                    loc.url.pathname === link.href ||
                    (link.href !== "/" &&
                      loc.url.pathname.startsWith(link.href)),
                }}
              >
                <span style="margin-right: 0.25rem;">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
          <div class="user-selector">
            <label class="form-label" style="margin-bottom: 0;">
              当前用户：
            </label>
            <select
              class="form-select"
              style="width: 200px;"
              onChange$={handleUserChange}
              value={state.currentUser?.id || ""}
            >
              {state.loading && <option>加载中...</option>}
              {state.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.real_name} ({roleLabels[user.role as UserRole]})
                </option>
              ))}
            </select>
          </div>
        </div>
      </nav>
      <main class="container">
        <slot />
      </main>
    </div>
  );
});
