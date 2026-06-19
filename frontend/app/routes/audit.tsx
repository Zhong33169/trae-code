import type { MetaFunction } from "@remix-run/node";
import { useEffect, useState } from "react";
import { fetchAuditLogs } from "../api";

export const meta: MetaFunction = () => [{ title: "审计日志 - 畜牧免疫记录管理" }];

const ROLE_LABELS: Record<string, string> = {
  breeder: "饲养员", vet_supervisor: "兽医主管", farm_manager: "场长",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [hasFailure, setHasFailure] = useState("");
  const [recordId, setRecordId] = useState("");

  useEffect(() => {
    const filters: any = {};
    if (hasFailure) filters.has_failure = hasFailure;
    if (recordId) filters.record_id = recordId;
    fetchAuditLogs(filters).then(setLogs).catch(() => {});
  }, [hasFailure, recordId]);

  return (
    <div>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>📜 审计日志</h2>

      <div className="filter-bar">
        <select value={hasFailure} onChange={e => setHasFailure(e.target.value)}>
          <option value="">全部类型</option>
          <option value="true">仅失败记录</option>
        </select>
        <input
          type="number"
          placeholder="按记录ID筛选"
          value={recordId}
          onChange={e => setRecordId(e.target.value)}
          style={{ width: 160 }}
        />
      </div>

      <div className="card">
        <div className="audit-timeline" style={{ paddingLeft: 0 }}>
          {logs.map((log: any) => (
            <div key={log.id} className={`audit-item ${log.failure_reason ? "failure" : ""}`} style={{ paddingLeft: 24, borderLeftWidth: 2 }}>
              <div className="audit-dot" />
              <div className="audit-time">
                {log.actor_name}（{ROLE_LABELS[log.actor_role] || log.actor_role}）
                {" · "}
                {new Date(log.created_at).toLocaleString("zh-CN")}
                {log.record_id && <span> · 记录ID: {log.record_id}</span>}
              </div>
              <div className="audit-action" style={{ color: log.failure_reason ? "#cf1322" : "#333" }}>
                {log.action}
              </div>
              <div className="audit-detail">{log.detail}</div>
              {log.failure_reason && (
                <div className="audit-failure">
                  ❌ 失败原因: {log.failure_reason}
                </div>
              )}
              {log.next_step_suggestion && (
                <div className="audit-suggestion">
                  💡 下一步建议: {log.next_step_suggestion}
                </div>
              )}
            </div>
          ))}
        </div>
        {logs.length === 0 && <div className="empty-state"><div className="empty-icon">📜</div><div>暂无审计日志</div></div>}
      </div>
    </div>
  );
}
