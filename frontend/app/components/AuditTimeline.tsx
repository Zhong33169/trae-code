import React from "react";
import { AuditLog } from "~/services/audit";
import { formatDate } from "~/utils/helpers";
import { STATUS_COLORS } from "~/config";

interface AuditTimelineProps {
  logs: AuditLog[];
  loading?: boolean;
}

export function AuditTimeline({ logs, loading = false }: AuditTimelineProps) {
  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      create: "📝",
      update: "✏️",
      submit: "📤",
      review: "🔍",
      approve: "✅",
      reject: "❌",
      fault_report: "⚠️",
      repair: "🔧",
      acceptance: "📋",
      archive: "📦",
      cancel: "🚫",
      qr_scan: "📱",
      status_change: "🔄",
      batch_process: "📊",
    };
    return icons[action] || "📌";
  };

  const getTimelineColor = (log: AuditLog) => {
    if (log.to_status && STATUS_COLORS[log.to_status]) {
      return STATUS_COLORS[log.to_status];
    }
    const colors: Record<string, string> = {
      create: "#10b981",
      submit: "#3b82f6",
      approve: "#10b981",
      reject: "#ef4444",
      fault_report: "#f97316",
      archive: "#6b7280",
      cancel: "#6b7280",
    };
    return colors[log.action] || "#9ca3af";
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
        <div
          style={{
            display: "inline-block",
            width: "24px",
            height: "24px",
            border: "2px solid #e5e7eb",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div style={{ marginTop: "8px" }}>加载中...</div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: "#9ca3af",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "8px" }}>📜</div>
        暂无审计日志
      </div>
    );
  }

  return (
    <div style={{ position: "relative", padding: "8px 0" }}>
      <div
        style={{
          position: "absolute",
          left: "20px",
          top: "0",
          bottom: "0",
          width: "2px",
          backgroundColor: "#e5e7eb",
        }}
      />

      {logs.map((log, index) => {
        const color = getTimelineColor(log);
        const isLast = index === logs.length - 1;

        return (
          <div
            key={log.id}
            style={{
              display: "flex",
              gap: "16px",
              marginBottom: isLast ? "0" : "20px",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                backgroundColor: "#fff",
                border: `2px solid ${color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                flexShrink: 0,
                zIndex: 1,
              }}
            >
              {getActionIcon(log.action)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  padding: "16px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontWeight: 600,
                        color: "#111827",
                        fontSize: "14px",
                      }}
                    >
                      {log.action_label || log.action}
                    </span>
                    {log.order_no && (
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                          backgroundColor: "#e5e7eb",
                          padding: "2px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        {log.order_no}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                    {formatDate(log.created_at)}
                  </span>
                </div>

                <div style={{ marginBottom: "8px", fontSize: "13px", color: "#374151" }}>
                  <span style={{ color: "#6b7280" }}>操作人：</span>
                  <strong>{log.operator_name || `ID: ${log.operator_id}`}</strong>
                  {log.operator_role && (
                    <span style={{ color: "#6b7280", marginLeft: "8px" }}>
                      ({log.operator_role})
                    </span>
                  )}
                </div>

                {(log.from_status || log.to_status) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                      fontSize: "13px",
                    }}
                  >
                    {log.from_status && (
                      <span
                        style={{
                          padding: "2px 8px",
                          backgroundColor: `${STATUS_COLORS[log.from_status] || "#9ca3af"}15`,
                          color: STATUS_COLORS[log.from_status] || "#6b7280",
                          borderRadius: "4px",
                          fontSize: "12px",
                          border: `1px solid ${STATUS_COLORS[log.from_status] || "#9ca3af"}30`,
                        }}
                      >
                        {log.from_status}
                      </span>
                    )}
                    {log.from_status && log.to_status && (
                      <span style={{ color: "#9ca3af" }}>→</span>
                    )}
                    {log.to_status && (
                      <span
                        style={{
                          padding: "2px 8px",
                          backgroundColor: `${color}15`,
                          color: color,
                          borderRadius: "4px",
                          fontSize: "12px",
                          border: `1px solid ${color}30`,
                          fontWeight: 500,
                        }}
                      >
                        {log.to_status}
                      </span>
                    )}
                  </div>
                )}

                {log.detail && (
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#6b7280",
                      lineHeight: 1.6,
                      backgroundColor: "#fff",
                      padding: "12px",
                      borderRadius: "6px",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    {log.detail}
                  </div>
                )}

                {log.ip_address && (
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "8px" }}>
                    IP地址：{log.ip_address}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
