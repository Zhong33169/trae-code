import { A, Body, FileRoutes, Head, Html, Meta, Scripts, Title, useLocation } from "@solidjs/start";
import { createContext, createSignal, onMount, Show, Switch, Match, Suspense, useContext } from "solid-js";
import "./app.css";

const UserContext = createContext();

export default function Root() {
  const [user, setUser] = createSignal(null);
  const location = useLocation();

  onMount(() => {
    try {
      const saved = localStorage.getItem("credit_user");
      if (saved) setUser(JSON.parse(saved));
    } catch {}
  });

  const doLogout = () => {
    localStorage.removeItem("credit_user");
    setUser(null);
    if (location.pathname !== "/login") window.location.href = "/login";
  };

  const isLogin = () => location.pathname === "/login";
  const roleLabel = (r) => ({registrar:"授信登记员",auditor:"授信审核主管",reviewer:"B2B复核负责人"}[r] || r);

  return (
    <UserContext.Provider value={{ user, setUser, doLogout }}>
      <Html lang="zh-CN">
        <Head>
          <Title>授信申请审批系统</Title>
          <Meta charset="utf-8" />
          <Meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <Body>
          <Suspense fallback={<div class="loading">加载中...</div>}>
            <Switch>
              <Match when={isLogin()}>
                <FileRoutes />
              </Match>
              <Match when={!user()}>
                {typeof window !== "undefined" && (window.location.href = "/login")}
                <div class="loading">正在跳转登录页...</div>
              </Match>
              <Match when={true}>
                <div class="app-shell">
                  <aside class="sidebar">
                    <div class="logo">
                      <div class="logo-icon">CR</div>
                      <div class="logo-text">授信审批</div>
                    </div>
                    <nav class="nav">
                      <A href="/" class="nav-item" activeClass="active">
                        <span class="nav-ico">▤</span>工作台
                      </A>
                      <A href="/applications" class="nav-item" activeClass="active">
                        <span class="nav-ico">☰</span>授信申请
                      </A>
                      <A href="/stats" class="nav-item" activeClass="active">
                        <span class="nav-ico">◫</span>统计分析
                      </A>
                    </nav>
                    <div class="sidebar-footer">
                      <div class="user-card">
                        <div class="avatar">{(user()?.name || "U").slice(0,1)}</div>
                        <div class="user-info">
                          <div class="user-name">{user()?.name}</div>
                          <div class="user-role">{roleLabel(user()?.role)}</div>
                        </div>
                      </div>
                      <button class="logout-btn" onClick={doLogout}>退出</button>
                    </div>
                  </aside>
                  <main class="main">
                    <FileRoutes />
                  </main>
                </div>
              </Match>
            </Switch>
          </Suspense>
          <Scripts />
        </Body>
      </Html>
    </UserContext.Provider>
  );
}
