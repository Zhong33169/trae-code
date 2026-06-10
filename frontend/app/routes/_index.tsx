import React, { useState, useEffect } from "react";
import { Link } from "@remix-run/react";
import { useAuth } from "~/hooks/useAuth";
import { useToast } from "~/hooks/useToast";
import { getInspectionOrders } from "~/services/inspection";
import { getAuditStatistics } from "~/services/audit";
import { formatDate, formatDateOnly } from "~/utils/helpers";
import { StatusBadge } from "~/components/StatusBadge";
import { INSPECTION_TYPE_LABELS, ROLE_LABELS } from "~/config";
import { AuditStatistics } from "~/services/audit";
import { InspectionOrder } from "~/services/inspection";

export function meta() {
  return [{ title: "首页 - 充电桩巡检系统" }];
}

function IndexPage() {
  const { user, hasRole } = useAuth();
  const { error } = useToast();
  const [loading, setLoading] = useState(true);
  const [recentInspections, setRecentInspections] = useState<InspectionOrder[]>([]);
  const [statistics, setStatistics] = useState<AuditStatistics | null>(null);
  const [queueStats, setQueueStats] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inspectionsRes, auditStats] = await Promise.all([
        getInspectionOrders({ page: 1, page_size: 5 }),
        getAuditStatistics(),
      ]);
      setRecentInspections(inspectionsRes.items);
      setStatistics(auditStats);
      setQueueStats(inspectionsRes.statistics);
    } catch (err) {
      error("加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const queueLabels: Record<string, string> = {
    pending_my: "待我处理",
    my_created: "我发起的",
    all: "全部",
    pending_review: "待审核",
    pending_fault: "待故障处理",
    pending_repair: "待修复",
    pending_acceptance: "待验收",
    pending_final: "待复核",
    archived: "已归档",
  };

  const getQueueIcon = (key: string) => {
    const icons: Record<string, string> = {
      pending_my: "⏳",
      my_created: "📝",
      all: "📋",
      pending_review: "🔍",
      pending_fault: "⚠️",
      pending_repair: "🔧",
      pending_acceptance: "✅",
      pending_final: "📦",
      archived: "🗄️",
    };
    return icons[key] || "📄";
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            width: "32px",
            height: "32px",
            border: "3px solid #e5e7eb",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div style={{ marginTop: "12px", color: "#6b7280" }}>加载中...</div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ fontSize: "14px", opacity: 0.9, marginBottom: "4px" }}>
              欢迎回来
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>
              {user?.full_name}
            </div>
            <div style={{ fontSize: "14px", opacity: 0.8 }}>
              {ROLE_LABELS[user?.role || ""] || user?.role}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {hasRole("registrar") && (
              <Link
                to="/inspections/new"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#fff",
                  color: "#667eea",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
                }}
              >
                ➕ 创建巡检单
              </Link>
            )}
            <Link
              to="/scan"
              style={{
                padding: "10px 20px",
                backgroundColor: "rgba(255,255,255,0.2)",
                color: "#fff",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                border: "1px solid rgba(255,255,255,0.3)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "rgba(255,255,255,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "rgba(255,255,255,0.2)";
              }}
            >
              📱 扫码核验
            </Link>
          </div>
        </div>
      </div>

      {statistics && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <StatCard
            icon="📋"
            label="今日操作"
            value={statistics.operations_today}
            color="#3b82f6"
          />
          <StatCard
            icon="📊"
            label="本周操作"
            value={statistics.operations_this_week}
            color="#10b981"
          />
          <StatCard
            icon="📝"
            label="总操作数"
            value={statistics.total_operations}
            color="#8b5cf6"
          />
          <StatCard
            icon="⏱️"
            label="平均处理时长"
            value={
              statistics.average_processing_time
                ? `${statistics.average_processing_time.toFixed(1)}小时`
                : "-"
            }
            color="#f59e0b"
          />
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#111827" }}>
              📊 我的队列
            </h2>
            <Link
              to="/inspections"
              style={{ fontSize: "13px", color: "#3b82f6" }}
            >
              查看全部 →
            </Link>
          </div>
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            {Object.entries(queueStats).map(([key, value], index) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  borderBottom:
                    index < Object.entries(queueStats).length - 1
                      ? "1px solid #f3f4f6"
                      : "none",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onClick={() => (window.location.href = `/inspections?queue=${key}`)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = "#fff";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "24px" }}>{getQueueIcon(key)}</span>
                  <span style={{ fontSize: "14px", color: "#374151" }}>
                    {queueLabels[key] || key}
                  </span>
                </div>
                <span
                  style={{
                    padding: "4px 12px",
                    backgroundColor: value > 0 ? "#eff6ff" : "#f3f4f6",
                    color: value > 0 ? "#2563eb" : "#6b7280",
                    borderRadius: "20px",
                    fontWeight: 600,
                    fontSize: "13px",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#111827" }}>
              📜 最近巡检单
            </h2>
            <Link
              to="/inspections"
              style={{ fontSize: "13px", color: "#3b82f6" }}
            >
              查看全部 →
            </Link>
          </div>
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            {recentInspections.length === 0 ? (
              <div
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "#9ca3af",
                }}
              >
                暂无数据
              </div>
            ) : (
              recentInspections.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    padding: "16px",
                    borderBottom:
                      index < recentInspections.length - 1
                        ? "1px solid #f3f4f6"
                        : "none",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                  }}
                  onClick={() =>
                    (window.location.href = `/inspections/${item.id}`)
                  }
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = "#f9fafb";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = "#fff";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 500,
                        color: "#111827",
                        fontSize: "14px",
                      }}
                    >
                      {item.order_no}
                    </span>
                    <StatusBadge
                      status={item.status}
                      label={item.status_label}
                      size="sm"
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    <span>
                      {item.charging_pile?.pile_name || "-"}
                    </span>
                    <span>{formatDateOnly(item.created_at)}</span>
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "12px", color: "#9ca3af" }}>
                    类型：{INSPECTION_TYPE_LABELS[item.type] || item.type}
                    {" · "}
                    巡检员：{item.inspector_name}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: string;
  label: string;
  value: number | string;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "12px",
          backgroundColor: `${color}15`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>
          {label}
        </div>
        <div
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

export default IndexPage;
