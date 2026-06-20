import { component$, Slot, $ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import { AppStateProvider, useCurrentUser } from "~/state/app";
import { roleLabels } from "~/utils/format";

// The user selector component
const UserSelector = component$(() => {
  const ctx = useCurrentUser();
  const onSelect = $((e: Event) => {
    const v = parseInt((e.target as HTMLSelectElement).value, 10);
    if (!isNaN(v)) ctx.setUser(v);
  });
  return (
    <div class="flex items-center gap-2">
      <label class="text-sm text-gray-600 font-medium">当前用户：</label>
      <select
        disabled={ctx.loading || ctx.users.length === 0}
        value={ctx.user?.id ?? ""}
        onChange$={onSelect}
        class="form-select"
        style="width: 220px;"
      >
        {ctx.loading && <option value="">加载用户...</option>}
        {!ctx.loading && ctx.users.length === 0 && (
          <option value="">无用户</option>
        )}
        {ctx.users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}（{roleLabels[u.role]}）
          </option>
        ))}
      </select>
      {ctx.user && (
        <span
          class={`inline-block px-2 py-0.5 rounded text-xs font-medium
            ${
              ctx.user.role === "inspector"
                ? "bg-sky-100 text-sky-800"
                : ctx.user.role === "handler"
                ? "bg-indigo-100 text-indigo-800"
                : "bg-violet-100 text-violet-800"
            }`}
        >
          {roleLabels[ctx.user.role]}
        </span>
      )}
    </div>
  );
});

// The shell navigation bar
const NavBar = component$(() => {
  const loc = useLocation();
  const navLinks = [
    { href: "/", label: "工作台", icon: "📊" },
    { href: "/inspections", label: "巡检单列表", icon: "📋" },
    { href: "/inspections/high-risk", label: "高风险单", icon: "🚨" },
  ];
  return (
    <header class="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div class="max-w-[1280px] mx-auto px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/" class="flex items-center gap-2 font-bold text-lg text-gray-800">
          <span class="text-2xl">🏋️</span>
          <span>社区健身房器械巡检系统</span>
        </Link>
        <nav class="flex items-center gap-1 flex-1 min-w-[260px]">
          {navLinks.map((l) => {
            const active =
              l.href === "/"
                ? loc.url.pathname === "/"
                : loc.url.pathname === l.href ||
                  loc.url.pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                class={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span class="mr-1">{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <UserSelector />
      </div>
    </header>
  );
});

export default component$(() => {
  return (
    <AppStateProvider>
      <div class="min-h-screen bg-gray-50">
        <NavBar />
        <main class="max-w-[1280px] mx-auto px-5 py-6">
          <Slot />
        </main>
      </div>
    </AppStateProvider>
  );
});
