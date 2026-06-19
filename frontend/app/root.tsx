import type { LinksFunction } from "@remix-run/node";
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useNavigate, useLocation } from "@remix-run/react";
import { useEffect, useState } from "react";

export const links: LinksFunction = () => [];

const ROLES: Record<string, string> = {
  breeder: "饲养员",
  vet_supervisor: "兽医主管",
  farm_manager: "场长",
};

const NAV_ITEMS = [
  { path: "/", label: "总览" },
  { path: "/plans", label: "免疫计划" },
  { path: "/records", label: "接种登记" },
  { path: "/rechecks", label: "异常复查" },
  { path: "/audit", label: "审计日志" },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState("1");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch("http://localhost:8002/api/users")
      .then(r => r.json())
      .then(setUsers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("currentUserId") || "1";
    setCurrentUserId(saved);
    const u = users.find((u: any) => u.id === Number(saved));
    setCurrentUser(u || null);
  }, [users, currentUserId]);

  const switchUser = (id: string) => {
    localStorage.setItem("currentUserId", id);
    setCurrentUserId(id);
    window.location.reload();
  };

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <style>{globalStyles}</style>
      </head>
      <body>
        <div className="app-layout">
          <header className="app-header">
            <div className="header-left">
              <h1 className="app-title">🐄 畜牧免疫记录管理</h1>
              <nav className="app-nav">
                {NAV_ITEMS.map(item => (
                  <button
                    key={item.path}
                    className={`nav-btn ${location.pathname === item.path ? "active" : ""}`}
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="header-right">
              {currentUser && (
                <div className="user-switcher">
                  <span className={`role-badge role-${currentUser.role}`}>
                    {ROLES[currentUser.role] || currentUser.role}
                  </span>
                  <span className="user-name">{currentUser.display_name}</span>
                  <select
                    value={currentUserId}
                    onChange={(e) => switchUser(e.target.value)}
                    className="user-select"
                  >
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name}（{ROLES[u.role]}）
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </header>
          <main className="app-main">
            <Outlet context={{ currentUser }} />
          </main>
        </div>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

const globalStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0f2f5; color: #333; }
  .app-layout { min-height: 100vh; display: flex; flex-direction: column; }
  .app-header { background: linear-gradient(135deg, #1a5c2a, #2d8a4e); color: white; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 60px; box-shadow: 0 2px 8px rgba(0,0,0,.15); position: sticky; top: 0; z-index: 100; }
  .header-left { display: flex; align-items: center; gap: 24px; }
  .app-title { font-size: 18px; font-weight: 700; white-space: nowrap; }
  .app-nav { display: flex; gap: 4px; }
  .nav-btn { background: transparent; border: none; color: rgba(255,255,255,.8); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all .2s; }
  .nav-btn:hover { background: rgba(255,255,255,.15); color: white; }
  .nav-btn.active { background: rgba(255,255,255,.2); color: white; font-weight: 600; }
  .header-right { display: flex; align-items: center; }
  .user-switcher { display: flex; align-items: center; gap: 10px; }
  .user-name { font-size: 14px; }
  .user-select { background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.3); color: white; border-radius: 6px; padding: 4px 8px; font-size: 13px; cursor: pointer; }
  .user-select option { color: #333; background: white; }
  .role-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .role-breeder { background: #e6f7ff; color: #0050b3; }
  .role-vet_supervisor { background: #f6ffed; color: #389e0d; }
  .role-farm_manager { background: #fff7e6; color: #d46b08; }
  .app-main { flex: 1; padding: 24px; max-width: 1400px; width: 100%; margin: 0 auto; }

  .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08); padding: 20px; margin-bottom: 16px; }
  .card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #1a1a1a; display: flex; align-items: center; gap: 8px; }

  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); text-align: center; }
  .stat-value { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
  .stat-label { font-size: 13px; color: #666; }
  .stat-card.danger .stat-value { color: #cf1322; }
  .stat-card.warning .stat-value { color: #d46b08; }
  .stat-card.success .stat-value { color: #389e0d; }

  .filter-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .filter-bar select, .filter-bar input { padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 14px; background: white; }
  .filter-bar select:focus, .filter-bar input:focus { outline: none; border-color: #2d8a4e; box-shadow: 0 0 0 2px rgba(45,138,78,.2); }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #f0f0f0; font-size: 13px; color: #666; font-weight: 600; }
  td { padding: 12px 8px; border-bottom: 1px solid #f5f5f5; font-size: 14px; }
  tr:hover { background: #fafafa; }

  .status-tag { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .status-draft { background: #f5f5f5; color: #666; }
  .status-submitted { background: #e6f7ff; color: #0050b3; }
  .status-under_review { background: #fff7e6; color: #d46b08; }
  .status-approved { background: #f6ffed; color: #389e0d; }
  .status-returned { background: #fff1f0; color: #cf1322; }
  .status-timeout { background: #fff1f0; color: #cf1322; }

  .recheck-status-pending { background: #fff7e6; color: #d46b08; }
  .recheck-status-rechecked { background: #e6f7ff; color: #0050b3; }
  .recheck-status-resolved { background: #f6ffed; color: #389e0d; }
  .recheck-status-escalated { background: #fff1f0; color: #cf1322; }

  .att-type-required { background: #fff7e6; color: #d46b08; }
  .att-type-supplementary { background: #e6f7ff; color: #0050b3; }
  .att-type-rejected { background: #fff1f0; color: #cf1322; }

  .btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 16px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; transition: all .2s; }
  .btn-primary { background: #2d8a4e; color: white; }
  .btn-primary:hover { background: #1a5c2a; }
  .btn-warning { background: #fa8c16; color: white; }
  .btn-warning:hover { background: #d46b08; }
  .btn-danger { background: #ff4d4f; color: white; }
  .btn-danger:hover { background: #cf1322; }
  .btn-default { background: white; border: 1px solid #d9d9d9; color: #333; }
  .btn-default:hover { border-color: #2d8a4e; color: #2d8a4e; }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .btn-sm { padding: 4px 10px; font-size: 12px; }

  .action-group { display: flex; gap: 8px; flex-wrap: wrap; }

  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .detail-item { display: flex; flex-direction: column; gap: 4px; }
  .detail-label { font-size: 12px; color: #999; font-weight: 500; }
  .detail-value { font-size: 14px; color: #333; }

  .attachment-list { display: flex; flex-direction: column; gap: 8px; }
  .attachment-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid #f0f0f0; border-radius: 8px; background: #fafafa; }
  .attachment-item.missing { border-color: #ffa39e; background: #fff1f0; }
  .attachment-item.rejected { border-color: #ff7875; background: #fff1f0; }
  .att-info { display: flex; align-items: center; gap: 8px; }
  .att-icon { font-size: 18px; }
  .att-name { font-weight: 500; font-size: 14px; }
  .att-reason { font-size: 12px; color: #cf1322; margin-top: 2px; }

  .audit-timeline { position: relative; padding-left: 24px; }
  .audit-item { position: relative; padding-bottom: 16px; padding-left: 16px; border-left: 2px solid #f0f0f0; }
  .audit-item:last-child { border-left-color: transparent; }
  .audit-dot { position: absolute; left: -7px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: #2d8a4e; border: 2px solid white; }
  .audit-item.failure .audit-dot { background: #cf1322; }
  .audit-time { font-size: 12px; color: #999; }
  .audit-action { font-size: 14px; font-weight: 500; margin: 2px 0; }
  .audit-detail { font-size: 13px; color: #666; }
  .audit-failure { font-size: 13px; color: #cf1322; margin-top: 4px; background: #fff1f0; padding: 6px 10px; border-radius: 4px; }
  .audit-suggestion { font-size: 13px; color: #d46b08; margin-top: 4px; background: #fff7e6; padding: 6px 10px; border-radius: 4px; }

  .batch-result-list { display: flex; flex-direction: column; gap: 8px; }
  .batch-result-item { padding: 10px 14px; border-radius: 8px; border: 1px solid #f0f0f0; }
  .batch-result-item.success { border-color: #b7eb8f; background: #f6ffed; }
  .batch-result-item.fail { border-color: #ffa39e; background: #fff1f0; }
  .batch-code { font-weight: 600; }
  .batch-reason { font-size: 13px; color: #cf1322; margin-top: 4px; }
  .batch-next { font-size: 13px; color: #d46b08; margin-top: 2px; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 1000; display: flex; align-items: center; justify-content: center; }
  .modal { background: white; border-radius: 12px; padding: 24px; width: 480px; max-width: 90vw; max-height: 80vh; overflow-y: auto; }
  .modal-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }

  .form-group { margin-bottom: 14px; }
  .form-label { display: block; font-size: 13px; color: #666; margin-bottom: 4px; font-weight: 500; }
  .form-input, .form-textarea, .form-select { width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 14px; }
  .form-input:focus, .form-textarea:focus, .form-select:focus { outline: none; border-color: #2d8a4e; box-shadow: 0 0 0 2px rgba(45,138,78,.2); }
  .form-textarea { min-height: 80px; resize: vertical; }

  .empty-state { text-align: center; padding: 40px; color: #999; }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }

  .overdue-badge { display: inline-block; background: #cf1322; color: white; font-size: 11px; padding: 1px 8px; border-radius: 10px; margin-left: 6px; font-weight: 600; }
  .missing-badge { display: inline-block; background: #d46b08; color: white; font-size: 11px; padding: 1px 8px; border-radius: 10px; margin-left: 6px; font-weight: 600; }

  .link-btn { background: none; border: none; color: #2d8a4e; cursor: pointer; padding: 0; font-size: 14px; text-decoration: underline; }
  .link-btn:hover { color: #1a5c2a; }

  .section-divider { border: none; border-top: 1px solid #f0f0f0; margin: 20px 0; }

  @media (max-width: 768px) {
    .app-header { flex-direction: column; height: auto; padding: 12px; gap: 8px; }
    .header-left { flex-direction: column; gap: 8px; }
    .detail-grid { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
`;
