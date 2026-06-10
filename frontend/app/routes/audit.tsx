import React, { useState, useEffect } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useToast } from "~/hooks/useToast";
import { formatDate, debounce } from "~/utils/helpers";
import { Table } from "~/components/Table";
import { Pagination } from "~/components/Pagination";
import { AuditTimeline } from "~/components/AuditTimeline";
import {
  getAuditLogs,
  getAuditStatistics,
  type AuditLog,
  type AuditStatistics,
} from "~/services/audit";
import { ROLE_LABELS } from "~/config";

const ACTION_COLORS: Record<string, string> = {
  create: "#3b82f6",
  update: "#f59e0b",
  submit: "#10b981",
  review: "#8b5cf6",
  approve: "#10b981",
  reject: "#ef4444",
  fault_report: "#f97316",
  repair_complete: "#8b5cf6",
  acceptance: "#0ea5e9",
  final_review: "#0ea5e9",
  archive: "#10b981",
  cancel: "#6b7280",
  qr_scan: "#06b6d4",
  login: "#3b82f6",
  logout: "#6b7280",
};

const ACTION_LABELS: Record<string, string> = {
  create: "创建",
  update: "更新",
  submit: "提交",
  review: "审核",
  approve: "通过",
  reject: "驳回",
  fault_report: "报故障",
  repair_complete: "修复完成",
  acceptance: "验收",
  final_review: "复核",
  archive: "归档",
  cancel: "取消",
  qr_scan: "扫码",
  login: "登录",
  logout: "登出",
};

export default function AuditPage() {
  const { user, loading: authLoading, hasRole } = useAuth();
  const { success, error, warning, info } = useToast();

  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    action: "",
    operator_id: "",
    start_date: "",
    end_date: "",
    keyword: "",
  });

  useEffect(() => {
    loadStatistics();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, pageSize, filters]);

  const debouncedSearch = React.useCallback(
    debounce((value: string) => {
      setFilters((prev) => ({ ...prev, keyword: value }));
      setPage(1);
    }, 300),
    []
  );

  async function loadStatistics() {
    try {
      setLoadingStats(true);
      const stats = await getAuditStatistics();
      setStatistics(stats);
    } catch (err: any) {
      error("加载统计数据失败：" + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingStats(false);
    }
  }

  async function loadLogs() {
    try {
      setLoadingLogs(true);
      const params: any = {
        page,
        page_size: pageSize,
      };
      if (filters.action) params.action = filters.action;
      if (filters.operator_id) params.operator_id = parseInt(filters.operator_id);
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.keyword) params.keyword = filters.keyword;

      const response = await getAuditLogs(params);
      setLogs(response.items);
      setTotal(response.total);
    } catch (err: any) {
      error("加载审计日志失败：" + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingLogs(false);
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleResetFilters() {
    setFilters({
      action: "",
      operator_id: "",
      start_date: "",
      end_date: "",
      keyword: "",
    });
    setPage(1);
  }

  const columns = [
    {
      key: "id",
      title: "ID",
      width: 60,
    },
    {
      key: "action",
      title: "操作类型",
      render: (record: AuditLog) => (
        <span
          style={{
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: `${ACTION_COLORS[record.action] || "#6b7280"}15`,
            color: ACTION_COLORS[record.action] || "#6b7280",
          }}
        >
          {record.action_label || ACTION_LABELS[record.action] || record.action}
        </span>
      ),
    },
    {
      key: "order_no",
      title: "关联巡检单",
      render: (record: AuditLog) =>
        record.order_no ? (
          record.inspection_order_id ? (
            <a
              href={`/inspections/${record.inspection_order_id}`}
              style={{ color: "#3b82f6", textDecoration: "none", fontFamily: "monospace" }}
            >
              {record.order_no}
            </a>
          ) : (
            <span style={{ fontFamily: "monospace" }}>{record.order_no}</span>
          )
        ) : (
          <span style={{ color: "#9ca3af" }}>-</span>
        ),
    },
    {
      key: "operator_name",
      title: "操作人",
      render: (record: AuditLog) => (
        <div>
          <div style={{ fontSize: 14, color: "#111827" }}>
            {record.operator_name || "-"}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {record.operator_role
              ? ROLE_LABELS[record.operator_role] || record.operator_role
              : ""}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      title: "状态变更",
      render: (record: AuditLog) =>
        record.from_status || record.to_status ? (
          <div style={{ fontSize: 13 }}>
            {record.from_status && (
              <span style={{ color: "#6b7280" }}>{record.from_status}</span>
            )}
            {record.from_status && record.to_status && (
              <span style={{ margin: "0 8px", color: "#9ca3af" }}>→</span>
            )}
            {record.to_status && (
              <span style={{ color: "#3b82f6", fontWeight: 500 }}>
                {record.to_status}
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: "#9ca3af" }}>-</span>
        ),
    },
    {
      key: "detail",
      title: "详情",
      render: (record: AuditLog) => (
        <div style={{ fontSize: 13, color: "#374151", maxWidth: 300 }}>
          {record.detail || "-"}
        </div>
      ),
    },
    {
      key: "ip_address",
      title: "IP地址",
      render: (record: AuditLog) => (
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>
          {record.ip_address || "-"}
        </span>
      ),
    },
    {
      key: "created_at",
      title: "操作时间",
      render: (record: AuditLog) => formatDate(record.created_at),
    },
  ];

  if (authLoading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: 16, color: "#6b7280" }}>加载中...</p>
      </div>
    );
  }

  if (!hasRole("reviewer")) {
    return (
      <div style={styles.noPermission}>
        <div style={styles.noPermissionIcon}>🔒</div>
        <h2 style={styles.noPermissionTitle}>无访问权限</h2>
        <p style={styles.noPermissionText}>
          审计日志仅对新能源汽车充电站复核负责人开放
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>审计日志</h1>
          <p style={styles.subtitle}>查看系统操作记录和状态变更历史</p>
        </div>
      </div>

      {statistics && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>📊</div>
            <div>
              <div style={styles.statValue}>{statistics.total_operations}</div>
              <div style={styles.statLabel}>总操作数</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>📅</div>
            <div>
              <div style={styles.statValue}>{statistics.operations_today}</div>
              <div style={styles.statLabel}>今日操作</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>📆</div>
            <div>
              <div style={styles.statValue}>{statistics.operations_this_week}</div>
              <div style={styles.statLabel}>本周操作</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>⏱️</div>
            <div>
              <div style={styles.statValue}>
                {statistics.average_processing_time
                  ? `${statistics.average_processing_time.toFixed(1)}小时`
                  : "-"}
              </div>
              <div style={styles.statLabel}>平均处理时长</div>
            </div>
          </div>
        </div>
      )}

      <div style={styles.filtersSection}>
        <div style={styles.filtersRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>关键词</label>
            <input
              type="text"
              style={styles.filterInput}
              placeholder="搜索巡检单号、详情..."
              defaultValue={filters.keyword}
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>操作类型</label>
            <select
              style={styles.filterSelect}
              value={filters.action}
              onChange={(e) => handleFilterChange("action", e.target.value)}
            >
              <option value="">全部类型</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>操作人ID</label>
            <input
              type="text"
              style={styles.filterInput}
              placeholder="输入操作人ID"
              value={filters.operator_id}
              onChange={(e) => handleFilterChange("operator_id", e.target.value)}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>开始日期</label>
            <input
              type="date"
              style={styles.filterInput}
              value={filters.start_date}
              onChange={(e) => handleFilterChange("start_date", e.target.value)}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>结束日期</label>
            <input
              type="date"
              style={styles.filterInput}
              value={filters.end_date}
              onChange={(e) => handleFilterChange("end_date", e.target.value)}
            />
          </div>
          <div style={styles.filterActions}>
            <button style={styles.resetButton} onClick={handleResetFilters}>
              重置
            </button>
          </div>
        </div>

        <div style={styles.viewTabs}>
          <button
            style={{
              ...styles.viewTab,
              backgroundColor: viewMode === "table" ? "#3b82f6" : "#f3f4f6",
              color: viewMode === "table" ? "#fff" : "#374151",
            }}
            onClick={() => setViewMode("table")}
          >
            表格视图
          </button>
          <button
            style={{
              ...styles.viewTab,
              backgroundColor: viewMode === "timeline" ? "#3b82f6" : "#f3f4f6",
              color: viewMode === "timeline" ? "#fff" : "#374151",
            }}
            onClick={() => setViewMode("timeline")}
          >
            时间线视图
          </button>
        </div>
      </div>

      <div style={styles.contentSection}>
        {viewMode === "table" ? (
          <>
            <Table
              columns={columns}
              data={logs}
              loading={loadingLogs}
              rowKey="id"
              emptyText="暂无审计日志"
            />
            <div style={styles.paginationWrapper}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={(newPage, newPageSize) => {
                  setPage(newPage);
                  setPageSize(newPageSize);
                }}
              />
            </div>
          </>
        ) : (
          <div style={styles.timelineWrapper}>
            <AuditTimeline logs={logs} loading={loadingLogs} />
            <div style={styles.paginationWrapper}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={(newPage, newPageSize) => {
                  setPage(newPage);
                  setPageSize(newPageSize);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {statistics && statistics.operations_by_action && (
        <div style={styles.statsDetailSection}>
          <h3 style={styles.statsDetailTitle}>按操作类型统计</h3>
          <div style={styles.actionStatsGrid}>
            {Object.entries(statistics.operations_by_action).map(([action, count]) => (
              <div key={action} style={styles.actionStatItem}>
                <span
                  style={{
                    ...styles.actionStatDot,
                    backgroundColor: ACTION_COLORS[action] || "#6b7280",
                  }}
                />
                <span style={styles.actionStatLabel}>
                  {ACTION_LABELS[action] || action}
                </span>
                <span style={styles.actionStatCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {statistics && statistics.operations_by_role && (
        <div style={styles.statsDetailSection}>
          <h3 style={styles.statsDetailTitle}>按角色统计</h3>
          <div style={styles.roleStatsGrid}>
            {Object.entries(statistics.operations_by_role).map(([role, count]) => (
              <div key={role} style={styles.roleStatItem}>
                <span style={styles.roleStatLabel}>
                  {ROLE_LABELS[role] || role}
                </span>
                <div style={styles.roleStatBar}>
                  <div
                    style={{
                      ...styles.roleStatBarFill,
                      width: `${Math.min(
                        (count / (statistics?.total_operations || 1)) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <span style={styles.roleStatCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 24,
    maxWidth: 1400,
    margin: "0 auto",
  },
  loading: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 400,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #e5e7eb",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  noPermission: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 400,
    textAlign: "center" as const,
  },
  noPermissionIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  noPermissionTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: "#111827",
    margin: "0 0 8px 0",
  },
  noPermissionText: {
    fontSize: 14,
    color: "#6b7280",
    margin: 0,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    color: "#111827",
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  statIcon: {
    fontSize: 32,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 600,
    color: "#111827",
  },
  statLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  filtersSection: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  filtersRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap" as const,
    alignItems: "flex-end",
    marginBottom: 16,
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    minWidth: 150,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
  },
  filterInput: {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
  },
  filterSelect: {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    backgroundColor: "#fff",
  },
  filterActions: {
    display: "flex",
    gap: 8,
  },
  resetButton: {
    padding: "8px 16px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#374151",
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  viewTabs: {
    display: "flex",
    gap: 8,
    paddingTop: 16,
    borderTop: "1px solid #e5e7eb",
  },
  viewTab: {
    padding: "8px 20px",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  contentSection: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  timelineWrapper: {
    minHeight: 400,
  },
  paginationWrapper: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
  },
  statsDetailSection: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  statsDetailTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#111827",
    margin: "0 0 16px 0",
  },
  actionStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
  },
  actionStatItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    backgroundColor: "#f9fafb",
    borderRadius: 6,
  },
  actionStatDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
  actionStatLabel: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  actionStatCount: {
    fontSize: 16,
    fontWeight: 600,
    color: "#111827",
  },
  roleStatsGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  roleStatItem: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  roleStatLabel: {
    width: 200,
    fontSize: 14,
    color: "#374151",
  },
  roleStatBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  roleStatBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 4,
    transition: "width 0.3s",
  },
  roleStatCount: {
    width: 60,
    textAlign: "right" as const,
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
  },
};
