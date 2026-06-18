import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { Status, Stage, User } from "../lib/types";
import {
  getStatusBadgeClass,
  getRoleBadgeClass,
  formatDateTime,
  formatCurrency,
} from "../lib/utils";
import { useToast } from "../hooks/useToast";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

function Index() {
  const queryClient = useQueryClient();
  const { show, ToastComponent } = useToast();

  const [filterStatus, setFilterStatus] = useState<Status | "">("");
  const [filterStage, setFilterStage] = useState<Stage | "">("");
  const [filterHandlerId, setFilterHandlerId] = useState<number | "">("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const { data: labels } = useQuery({
    queryKey: ["labels"],
    queryFn: () => api.getLabels(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(),
  });

  const { data: statistics } = useQuery({
    queryKey: ["statistics"],
    queryFn: () => api.getStatistics(),
    refetchInterval: 5000,
  });

  const { data: projects = [], refetch } = useQuery({
    queryKey: ["projects", filterStatus, filterStage, filterHandlerId],
    queryFn: () =>
      api.getProjects({
        status: filterStatus || undefined,
        stage: filterStage || undefined,
        handler_id: filterHandlerId || undefined,
      }),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (users.length > 0 && !currentUserId) {
      setCurrentUserId(users[0].id);
    }
  }, [users, currentUserId]);

  const currentUser = users.find((u) => u.id === currentUserId) || null;

  async function refreshAll() {
    await queryClient.invalidateQueries();
    refetch();
  }

  return (
    <div className="container">
      {ToastComponent}

      <div className="page-header">
        <div>
          <h1 className="page-title">培训项目单管理</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            当前视图用户：
            {currentUser && (
              <span
                className={`badge ${getRoleBadgeClass(currentUser.role)}`}
                style={{ marginLeft: "0.5rem" }}
              >
                {currentUser.name} - {labels?.roles[currentUser.role]}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link to="/projects/new" className="btn btn-primary">
            + 发起项目
          </Link>
          <button className="btn btn-secondary" onClick={refreshAll}>
            刷新数据
          </button>
        </div>
      </div>

      <div className="user-selector">
        <span style={{ fontSize: "0.875rem", color: "#6b7280", alignSelf: "center" }}>
          切换用户角色：
        </span>
        {users.map((user: User) => (
          <span
            key={user.id}
            className={`user-chip ${currentUserId === user.id ? "active" : ""}`}
            onClick={() => setCurrentUserId(user.id)}
          >
            {user.name} ({labels?.roles[user.role]})
          </span>
        ))}
      </div>

      {statistics && (
        <div className="grid grid-4" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card">
            <div className="stat-value">{statistics.total}</div>
            <div className="stat-label">项目总数</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-value">
              {statistics.submitted + statistics.under_review}
            </div>
            <div className="stat-label">待处理</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-value">{statistics.returned}</div>
            <div className="stat-label">退回补正</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-value">
              {statistics.appeal_submitted + statistics.appeal_under_review}
            </div>
            <div className="stat-label">申诉中</div>
          </div>
          <div className="stat-card green">
            <div className="stat-value">{statistics.approved}</div>
            <div className="stat-label">已通过</div>
          </div>
          <div className="stat-card red">
            <div className="stat-value">{statistics.rejected}</div>
            <div className="stat-label">已驳回</div>
          </div>
          <div className="stat-card red">
            <div className="stat-value">{statistics.overdue}</div>
            <div className="stat-label">逾期</div>
          </div>
          <div className="stat-card gray">
            <div className="stat-value">{statistics.archived}</div>
            <div className="stat-label">已归档</div>
          </div>
          <div className="stat-card" style={{ background: "#fff7ed", borderTop: "3px solid #f97316" }}>
            <div className="stat-value" style={{ color: "#c2410c" }}>
              {statistics.pending_conflict}
            </div>
            <div className="stat-label" style={{ color: "#9a3412" }}>
              待补救（冲突）
            </div>
          </div>
          <div className="stat-card" style={{ background: "#f0fdf4", borderTop: "3px solid #22c55e" }}>
            <div className="stat-value" style={{ color: "#166534" }}>
              {statistics.conflict_recovered}
            </div>
            <div className="stat-label" style={{ color: "#166534" }}>
              已恢复（冲突）
            </div>
          </div>
        </div>
      )}

      {statistics && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3 className="section-title">按阶段分布</h3>
          <div className="grid grid-3">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 500 }}>培训需求</span>
                <span style={{ color: "#2563eb", fontWeight: 600 }}>
                  {statistics.by_stage_need}
                </span>
              </div>
              <div
                style={{
                  height: "8px",
                  background: "#e5e7eb",
                  borderRadius: "4px",
                  marginTop: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: `${statistics.total ? (statistics.by_stage_need / statistics.total) * 100 : 0}%`,
                    height: "100%",
                    background: "#3b82f6",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 500 }}>方案报价</span>
                <span style={{ color: "#8b5cf6", fontWeight: 600 }}>
                  {statistics.by_stage_quotation}
                </span>
              </div>
              <div
                style={{
                  height: "8px",
                  background: "#e5e7eb",
                  borderRadius: "4px",
                  marginTop: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: `${statistics.total ? (statistics.by_stage_quotation / statistics.total) * 100 : 0}%`,
                    height: "100%",
                    background: "#8b5cf6",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 500 }}>合同确认</span>
                <span style={{ color: "#059669", fontWeight: 600 }}>
                  {statistics.by_stage_contract}
                </span>
              </div>
              <div
                style={{
                  height: "8px",
                  background: "#e5e7eb",
                  borderRadius: "4px",
                  marginTop: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: `${statistics.total ? (statistics.by_stage_contract / statistics.total) * 100 : 0}%`,
                    height: "100%",
                    background: "#059669",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="filter-bar">
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as Status | "")}
          >
            <option value="">全部状态</option>
            {labels &&
              Object.entries(labels.statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
          <select
            className="form-select"
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value as Stage | "")}
          >
            <option value="">全部阶段</option>
            {labels &&
              Object.entries(labels.stages).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
          <select
            className="form-select"
            value={filterHandlerId}
            onChange={(e) =>
              setFilterHandlerId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">全部处理人</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} - {labels?.roles[u.role]}
              </option>
            ))}
          </select>
          {(filterStatus || filterStage || filterHandlerId) && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setFilterStatus("");
                setFilterStage("");
                setFilterHandlerId("");
              }}
            >
              清除筛选
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">暂无项目数据</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>项目编号</th>
                  <th>项目名称</th>
                  <th>客户公司</th>
                  <th>阶段</th>
                  <th>状态</th>
                  <th>版本</th>
                  <th>当前处理人</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
                        {p.project_no}
                      </code>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {p.project_name}
                      {p.is_overdue && (
                        <span
                          className="badge badge-red"
                          style={{ marginLeft: "0.5rem" }}
                        >
                          已逾期
                        </span>
                      )}
                    </td>
                    <td>{p.client_company}</td>
                    <td>{labels?.stages[p.stage]}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(p.status)}`}>
                        {labels?.statuses[p.status]}
                      </span>
                    </td>
                    <td>v{p.version}</td>
                    <td>
                      {p.current_handler_name ? (
                        <>
                          {p.current_handler_name}
                          {p.current_handler_role && (
                            <span
                              className={`badge ${getRoleBadgeClass(p.current_handler_role)}`}
                              style={{ marginLeft: "0.5rem" }}
                            >
                              {labels?.roles[p.current_handler_role]}
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>-</span>
                      )}
                    </td>
                    <td>{formatDateTime(p.updated_at)}</td>
                    <td>
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: String(p.id) }}
                        className="btn btn-primary"
                        style={{ padding: "0.25rem 0.75rem", fontSize: "0.8125rem" }}
                      >
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
