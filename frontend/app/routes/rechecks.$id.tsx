import { useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { fetchRecheck, processRecheck, resolveRecheck } from "../api";

export async function loader({ params }: any) {
  return fetchRecheck(Number(params.id));
}

const RECHECK_STATUS_LABELS: Record<string, string> = {
  pending: "待复查", rechecked: "已复查", resolved: "已解决", escalated: "已升级",
};

const ROLE_LABELS: Record<string, string> = {
  breeder: "饲养员", vet_supervisor: "兽医主管", farm_manager: "场长",
};

const ABNORMAL_LABELS: Record<string, string> = {
  adverse_reaction: "不良反应", ineffective: "无效", incomplete: "未完成",
};

export default function RecheckDetail() {
  const initialData = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [recheck, setRecheck] = useState(initialData);
  const [error, setError] = useState("");
  const [showRecheck, setShowRecheck] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [recheckForm, setRecheckForm] = useState({ recheck_result: "" });
  const [resolveForm, setResolveForm] = useState({ resolution: "" });

  const currentUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("currentUser") || "null") : null;
  const currentRole = currentUser?.role || "breeder";

  const refresh = () => fetchRecheck(recheck.id).then(setRecheck);

  const handleRecheck = async () => {
    try {
      await processRecheck(recheck.id, recheckForm);
      setShowRecheck(false);
      refresh();
    } catch (e: any) {
      setError(e.error || JSON.stringify(e));
    }
  };

  const handleResolve = async () => {
    try {
      await resolveRecheck(recheck.id, resolveForm);
      setShowResolve(false);
      refresh();
    } catch (e: any) {
      setError(e.error || JSON.stringify(e));
    }
  };

  const canRecheck = recheck.status === "pending" && currentRole === "vet_supervisor";
  const canResolve = recheck.status === "rechecked" && currentRole === "farm_manager";

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-default" onClick={() => navigate("/rechecks")}>← 返回复查列表</button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: "#fff1f0", border: "1px solid #ffa39e", borderRadius: 8, color: "#cf1322" }}>
          ⚠️ {error}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          🔄 异常复查详情
          <span className={`status-tag recheck-status-${recheck.status}`} style={{ marginLeft: 8 }}>{RECHECK_STATUS_LABELS[recheck.status]}</span>
          {recheck.is_overdue && <span className="overdue-badge">超时</span>}
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">关联单号</span>
            <span className="detail-value">
              <button className="link-btn" onClick={() => navigate(`/records/${recheck.record_id}`)}>{recheck.record_code}</button>
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">动物编号</span>
            <span className="detail-value">{recheck.animal_id}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">异常类型</span>
            <span className="detail-value" style={{ color: "#cf1322" }}>{ABNORMAL_LABELS[recheck.abnormal_type] || recheck.abnormal_type}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">描述</span>
            <span className="detail-value">{recheck.description}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">复查人</span>
            <span className="detail-value">{recheck.rechecker_name || "待复查"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">截止日期</span>
            <span className="detail-value">
              {recheck.deadline_at ? new Date(recheck.deadline_at).toLocaleString("zh-CN") : "-"}
              {recheck.is_overdue && <span style={{ color: "#cf1322", marginLeft: 4 }}>已超时</span>}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">复查结果</span>
            <span className="detail-value">{recheck.recheck_result || "待复查"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">解决方案</span>
            <span className="detail-value">{recheck.resolution || "待解决"}</span>
          </div>
        </div>

        <hr className="section-divider" />

        <div style={{ marginBottom: 12 }}><strong>操作</strong>（当前角色: {ROLE_LABELS[currentRole] || currentRole}）</div>
        <div className="action-group">
          {canRecheck && <button className="btn btn-warning" onClick={() => setShowRecheck(true)}>🔍 执行复查（兽医主管）</button>}
          {canResolve && <button className="btn btn-primary" onClick={() => setShowResolve(true)}>✅ 解决复查（场长）</button>}
          {!canRecheck && !canResolve && (
            <span style={{ color: "#999", fontSize: 13 }}>
              当前角色 {ROLE_LABELS[currentRole] || currentRole} 在 {RECHECK_STATUS_LABELS[recheck.status]} 状态下无可用操作
            </span>
          )}
        </div>
      </div>

      {recheck.record && (
        <div className="card">
          <div className="card-title">📋 关联免疫记录</div>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">单号</span>
              <span className="detail-value">{recheck.record.record_code}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">动物编号</span>
              <span className="detail-value">{recheck.record.animal_id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">状态</span>
              <span className="detail-value">{recheck.record.status}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">结果</span>
              <span className="detail-value">{recheck.record.result}</span>
            </div>
          </div>
        </div>
      )}

      {recheck.audit_logs?.length > 0 && (
        <div className="card">
          <div className="card-title">📜 审计日志</div>
          <div className="audit-timeline">
            {recheck.audit_logs.map((log: any) => (
              <div key={log.id} className={`audit-item ${log.failure_reason ? "failure" : ""}`}>
                <div className="audit-dot" />
                <div className="audit-time">{log.actor_name}（{ROLE_LABELS[log.actor_role] || log.actor_role}）· {new Date(log.created_at).toLocaleString("zh-CN")}</div>
                <div className="audit-action">{log.action}</div>
                <div className="audit-detail">{log.detail}</div>
                {log.failure_reason && <div className="audit-failure">❌ 失败原因: {log.failure_reason}</div>}
                {log.next_step_suggestion && <div className="audit-suggestion">💡 下一步建议: {log.next_step_suggestion}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showRecheck && (
        <div className="modal-overlay" onClick={() => setShowRecheck(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🔍 执行复查（兽医主管）</div>
            <div className="form-group">
              <label className="form-label">复查结果</label>
              <textarea className="form-textarea" value={recheckForm.recheck_result} onChange={e => setRecheckForm({...recheckForm, recheck_result: e.target.value})} placeholder="描述复查情况..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowRecheck(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleRecheck}>确认复查</button>
            </div>
          </div>
        </div>
      )}

      {showResolve && (
        <div className="modal-overlay" onClick={() => setShowResolve(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">✅ 解决复查（场长）</div>
            <div className="form-group">
              <label className="form-label">解决方案</label>
              <textarea className="form-textarea" value={resolveForm.resolution} onChange={e => setResolveForm({...resolveForm, resolution: e.target.value})} placeholder="描述解决方案..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowResolve(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleResolve}>确认解决</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
