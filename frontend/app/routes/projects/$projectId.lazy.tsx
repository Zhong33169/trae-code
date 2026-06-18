import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
import type {
  TrainingProject,
  User,
  SubmitData,
  ReviewData,
  ReturnForCorrectionData,
  CorrectData,
  AppealSubmitData,
  AppealReviewData,
  EvidenceCreate,
} from "../../lib/types";
import {
  getStatusBadgeClass,
  getRoleBadgeClass,
  formatDateTime,
  formatCurrency,
  getMissingEvidences,
  isEvidenceRequired,
} from "../../lib/utils";
import { useToast } from "../../hooks/useToast";

export const Route = createLazyFileRoute("/projects/$projectId")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show, ToastComponent } = useToast();

  const [activeTab, setActiveTab] = useState<"info" | "evidences" | "logs" | "appeals">(
    "info"
  );
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [showSubmit, setShowSubmit] = useState(false);
  const [submitComment, setSubmitComment] = useState("");

  const [showApprove, setShowApprove] = useState(false);
  const [approveOpinion, setApproveOpinion] = useState("");

  const [showReject, setShowReject] = useState(false);
  const [rejectOpinion, setRejectOpinion] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const [showReturn, setShowReturn] = useState(false);
  const [returnOpinion, setReturnOpinion] = useState("");
  const [returnReason, setReturnReason] = useState("");

  const [showCorrect, setShowCorrect] = useState(false);
  const [correctComment, setCorrectComment] = useState("");

  const [showAppeal, setShowAppeal] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealOpinion, setAppealOpinion] = useState("");

  const [showAppealReview, setShowAppealReview] = useState(false);
  const [appealReviewOpinion, setAppealReviewOpinion] = useState("");
  const [appealReviewResult, setAppealReviewResult] = useState<"approved" | "rejected">(
    "approved"
  );

  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [newEvidenceName, setNewEvidenceName] = useState("");
  const [newEvidenceType, setNewEvidenceType] = useState("need_document");
  const [newEvidenceDesc, setNewEvidenceDesc] = useState("");

  const { data: labels } = useQuery({
    queryKey: ["labels"],
    queryFn: () => api.getLabels(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(),
  });

  const { data: project, refetch } = useQuery<TrainingProject>({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id),
    refetchInterval: 3000,
  });

  if (users.length > 0 && currentUserId === null) {
    setCurrentUserId(users[0].id);
  }

  const currentUser = users.find((u: User) => u.id === currentUserId) || null;

  const invalidateAll = () => {
    queryClient.invalidateQueries();
    refetch();
  };

  const submitMutation = useMutation({
    mutationFn: (data: SubmitData) =>
      api.submitProject(id, data, project?.version),
    onSuccess: () => {
      show("success", "项目已提交");
      setShowSubmit(false);
      setSubmitComment("");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  const approveMutation = useMutation({
    mutationFn: (data: ReviewData) =>
      api.approveProject(id, data, project?.version),
    onSuccess: () => {
      show("success", "审核通过");
      setShowApprove(false);
      setApproveOpinion("");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (data: ReviewData) =>
      api.rejectProject(id, data, project?.version),
    onSuccess: () => {
      show("success", "已驳回");
      setShowReject(false);
      setRejectOpinion("");
      setRejectReason("");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  const returnMutation = useMutation({
    mutationFn: (data: ReturnForCorrectionData) =>
      api.returnProject(id, data, project?.version),
    onSuccess: () => {
      show("success", "已退回补正");
      setShowReturn(false);
      setReturnOpinion("");
      setReturnReason("");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  const correctMutation = useMutation({
    mutationFn: (data: CorrectData) =>
      api.correctProject(id, data, project?.version),
    onSuccess: () => {
      show("success", "补正已提交");
      setShowCorrect(false);
      setCorrectComment("");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  const appealMutation = useMutation({
    mutationFn: (data: AppealSubmitData) =>
      api.submitAppeal(id, data, project?.version),
    onSuccess: () => {
      show("success", "申诉已提交");
      setShowAppeal(false);
      setAppealReason("");
      setAppealOpinion("");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  const appealReviewMutation = useMutation({
    mutationFn: (data: AppealReviewData) =>
      api.reviewAppeal(id, data, project?.version),
    onSuccess: () => {
      show("success", "申诉复核完成");
      setShowAppealReview(false);
      setAppealReviewOpinion("");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (uid: number) => api.archiveProject(id, uid, project?.version),
    onSuccess: () => {
      show("success", "项目已归档");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  const receiveMutation = useMutation({
    mutationFn: (uid: number) => api.receiveProject(id, uid, project?.version),
    onSuccess: () => {
      show("success", "已接收项目");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  const addEvidenceMutation = useMutation({
    mutationFn: (data: EvidenceCreate) => api.addEvidence(id, data),
    onSuccess: () => {
      show("success", "证据已添加");
      setShowAddEvidence(false);
      setNewEvidenceName("");
      setNewEvidenceType("need_document");
      setNewEvidenceDesc("");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  const deleteEvidenceMutation = useMutation({
    mutationFn: (eid: number) => api.deleteEvidence(id, eid),
    onSuccess: () => {
      show("success", "证据已删除");
      invalidateAll();
    },
    onError: (e: any) => show("error", e.message),
  });

  if (!project || !labels || !currentUser) {
    return (
      <div className="container">
        <div className="empty-state">加载中...</div>
      </div>
    );
  }

  const isHandler = project.current_handler_id === currentUser.id;
  const isCreator = project.created_by_id === currentUser.id;

  const canSubmit =
    currentUser.role === "registrar" &&
    isHandler &&
    (project.status === "draft" || project.status === "returned");

  const canReviewApprove =
    (currentUser.role === "supervisor" || currentUser.role === "reviewer") &&
    isHandler &&
    (project.status === "submitted" || project.status === "under_review");

  const canReviewReject = canReviewApprove;

  const canReturn =
    (currentUser.role === "supervisor" || currentUser.role === "reviewer") &&
    isHandler &&
    (project.status === "submitted" ||
      project.status === "under_review" ||
      project.status === "appeal_under_review");

  const canCorrect =
    currentUser.role === "registrar" &&
    isHandler &&
    project.status === "returned";

  const canAppeal =
    currentUser.role === "registrar" &&
    isCreator &&
    project.status === "rejected";

  const canReviewAppeal =
    currentUser.role === "reviewer" &&
    isHandler &&
    (project.status === "appeal_submitted" || project.status === "appeal_under_review");

  const canArchive =
    currentUser.role === "reviewer" &&
    ["approved", "appeal_approved", "appeal_rejected", "rejected"].includes(
      project.status
    );

  const canReceive =
    (currentUser.role === "supervisor" || currentUser.role === "reviewer") &&
    isHandler &&
    project.status === "submitted";

  const canManageEvidence =
    (currentUser.role === "registrar" &&
      (project.status === "draft" || project.status === "returned")) ||
    currentUser.role === "supervisor" ||
    currentUser.role === "reviewer";

  const missingEvidences = getMissingEvidences(project.stage, project.evidences);

  const lastOpinion = (() => {
    const reviewLogs = project.operation_logs
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .filter((log) =>
        [
          "review_approve",
          "review_reject",
          "return_for_correction",
          "appeal_review",
          "appeal_approve",
          "appeal_reject",
        ].includes(log.action)
      );
    if (reviewLogs.length === 0) return null;
    const last = reviewLogs[0];
    return {
      user_name: last.user_name,
      user_role: last.user_role,
      opinion: last.opinion,
      reject_reason: last.reject_reason,
      action: last.action,
      created_at: last.created_at,
      from_status: last.from_status,
      to_status: last.to_status,
    };
  })();

  return (
    <div className="container">
      {ToastComponent}

      <div className="page-header">
        <div>
          <Link to="/" className="btn btn-secondary" style={{ marginBottom: "0.75rem" }}>
            ← 返回列表
          </Link>
          <h1 className="page-title">
            <code
              style={{
                background: "#eef2ff",
                color: "#4338ca",
                padding: "2px 8px",
                borderRadius: 4,
                marginRight: "0.75rem",
              }}
            >
              {project.project_no}
            </code>
            {project.project_name}
          </h1>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <span className="badge badge-blue">{labels.stages[project.stage]}</span>
            <span className={`badge ${getStatusBadgeClass(project.status)}`}>
              {labels.statuses[project.status]}
            </span>
            <span className="badge badge-gray">版本 v{project.version}</span>
            {project.is_overdue && <span className="badge badge-red">已逾期</span>}
            <span style={{ color: "#6b7280", fontSize: "0.875rem", marginLeft: "0.5rem" }}>
              当前视图用户：
            </span>
            <select
              className="form-select"
              style={{ maxWidth: 220 }}
              value={currentUserId ?? ""}
              onChange={(e) => setCurrentUserId(Number(e.target.value))}
            >
              {users.map((u: User) => (
                <option key={u.id} value={u.id}>
                  {u.name} - {labels.roles[u.role]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {lastOpinion && (
        <div className="card last-opinion">
          <div className="last-opinion-header">
            <div>
              <span className="last-opinion-user">
                上一处理人：{lastOpinion.user_name}
              </span>
              <span
                className={`badge ${getRoleBadgeClass(lastOpinion.user_role as any)}`}
                style={{ marginLeft: "0.5rem" }}
              >
                {labels.roles[lastOpinion.user_role]}
              </span>
            </div>
            <span className="last-opinion-time">
              {formatDateTime(lastOpinion.created_at)}
            </span>
          </div>
          {lastOpinion.from_status && (
            <div style={{ fontSize: "0.875rem", color: "#78350f", marginBottom: "0.5rem" }}>
              状态变更：
              <span className={`badge ${getStatusBadgeClass(lastOpinion.from_status as any)}`} style={{ margin: "0 0.25rem" }}>
                {labels.statuses[lastOpinion.from_status]}
              </span>
              →
              <span className={`badge ${getStatusBadgeClass(lastOpinion.to_status as any)}`} style={{ margin: "0 0.25rem" }}>
                {labels.statuses[lastOpinion.to_status]}
              </span>
            </div>
          )}
          {lastOpinion.opinion && (
            <div style={{ fontSize: "0.875rem", color: "#78350f" }}>
              <strong>处理意见：</strong>
              {lastOpinion.opinion}
            </div>
          )}
          {lastOpinion.reject_reason && (
            <div
              style={{
                fontSize: "0.875rem",
                color: "#92400e",
                marginTop: "0.375rem",
              }}
            >
              <strong>驳回/退回原因：</strong>
              {lastOpinion.reject_reason}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          {canReceive && (
            <button
              className="btn btn-primary"
              onClick={() => receiveMutation.mutate(currentUser.id)}
            >
              接收办理
            </button>
          )}
          {canSubmit && (
            <button className="btn btn-primary" onClick={() => setShowSubmit(true)}>
              提交审核
            </button>
          )}
          {canReviewApprove && (
            <button
              className="btn btn-success"
              onClick={() => setShowApprove(true)}
            >
              审核通过
            </button>
          )}
          {canReviewReject && (
            <button
              className="btn btn-danger"
              onClick={() => setShowReject(true)}
            >
              审核驳回
            </button>
          )}
          {canReturn && (
            <button
              className="btn btn-warning"
              onClick={() => setShowReturn(true)}
            >
              退回补正
            </button>
          )}
          {canCorrect && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCorrect(true)}
            >
              补正提交
            </button>
          )}
          {canAppeal && (
            <button
              className="btn btn-warning"
              onClick={() => setShowAppeal(true)}
            >
              提交申诉
            </button>
          )}
          {canReviewAppeal && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAppealReview(true)}
            >
              复核申诉
            </button>
          )}
          {canArchive && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (confirm("确定要归档该项目吗？")) {
                  archiveMutation.mutate(currentUser.id);
                }
              }}
            >
              归档
            </button>
          )}
          {!canSubmit &&
            !canReviewApprove &&
            !canReviewReject &&
            !canReturn &&
            !canCorrect &&
            !canAppeal &&
            !canReviewAppeal &&
            !canReceive &&
            !canArchive && (
              <span style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
                当前用户无可用操作
              </span>
            )}
        </div>

        {missingEvidences.length > 0 && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: "0.75rem 1rem",
              borderRadius: 6,
              marginBottom: "1rem",
              fontSize: "0.875rem",
            }}
          >
            ⚠️ 当前阶段缺少必填证据：
            {missingEvidences.map((et) => (
              <code
                key={et}
                style={{
                  background: "#fee2e2",
                  padding: "1px 6px",
                  borderRadius: 4,
                  margin: "0 0.25rem",
                }}
              >
                {labels.evidence_types[et]}
              </code>
            ))}
          </div>
        )}

        <div className="tabs">
          <div
            className={`tab ${activeTab === "info" ? "active" : ""}`}
            onClick={() => setActiveTab("info")}
          >
            项目信息
          </div>
          <div
            className={`tab ${activeTab === "evidences" ? "active" : ""}`}
            onClick={() => setActiveTab("evidences")}
          >
            证据材料 ({project.evidences.length})
          </div>
          <div
            className={`tab ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            操作记录 ({project.operation_logs.length})
          </div>
          <div
            className={`tab ${activeTab === "appeals" ? "active" : ""}`}
            onClick={() => setActiveTab("appeals")}
          >
            申诉记录 ({project.appeals.length})
          </div>
        </div>

        {activeTab === "info" && (
          <div className="grid grid-2">
            <div>
              <h3 className="section-title">基本信息</h3>
              <div className="detail-row">
                <div className="detail-label">项目编号</div>
                <div className="detail-value">
                  <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
                    {project.project_no}
                  </code>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">项目名称</div>
                <div className="detail-value">{project.project_name}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">客户公司</div>
                <div className="detail-value">{project.client_company}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">流程阶段</div>
                <div className="detail-value">
                  <span className="badge badge-blue">{labels.stages[project.stage]}</span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">当前状态</div>
                <div className="detail-value">
                  <span className={`badge ${getStatusBadgeClass(project.status)}`}>
                    {labels.statuses[project.status]}
                  </span>
                  <span className="badge badge-gray" style={{ marginLeft: "0.5rem" }}>
                    v{project.version}
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">项目预算</div>
                <div className="detail-value">{formatCurrency(project.budget)}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">截止时间</div>
                <div className="detail-value">
                  {formatDateTime(project.deadline)}
                  {project.is_overdue && (
                    <span className="badge badge-red" style={{ marginLeft: "0.5rem" }}>
                      已逾期
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <h3 className="section-title">人员信息</h3>
              <div className="detail-row">
                <div className="detail-label">创建人</div>
                <div className="detail-value">
                  {project.created_by?.name}
                  {project.created_by && (
                    <span
                      className={`badge ${getRoleBadgeClass(project.created_by.role)}`}
                      style={{ marginLeft: "0.5rem" }}
                    >
                      {labels.roles[project.created_by.role]}
                    </span>
                  )}
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">当前处理人</div>
                <div className="detail-value">
                  {project.current_handler ? (
                    <>
                      {project.current_handler.name}
                      <span
                        className={`badge ${getRoleBadgeClass(project.current_handler.role)}`}
                        style={{ marginLeft: "0.5rem" }}
                      >
                        {labels.roles[project.current_handler.role]}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: "#9ca3af" }}>-</span>
                  )}
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-label">创建时间</div>
                <div className="detail-value">{formatDateTime(project.created_at)}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">更新时间</div>
                <div className="detail-value">{formatDateTime(project.updated_at)}</div>
              </div>
              <h3 className="section-title" style={{ marginTop: "1.5rem" }}>
                项目描述
              </h3>
              <div
                style={{
                  background: "#f9fafb",
                  padding: "0.875rem 1rem",
                  borderRadius: 6,
                  color: "#374151",
                  fontSize: "0.875rem",
                  whiteSpace: "pre-wrap",
                  minHeight: 80,
                }}
              >
                {project.description || "（暂无描述）"}
              </div>
            </div>
          </div>
        )}

        {activeTab === "evidences" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 className="section-title" style={{ marginBottom: 0 }}>
                证据材料
              </h3>
              {canManageEvidence && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddEvidence(true)}
                >
                  + 添加证据
                </button>
              )}
            </div>
            {project.evidences.length === 0 ? (
              <div className="empty-state">暂无证据材料</div>
            ) : (
              <div className="evidence-list">
                {project.evidences.map((ev) => (
                  <div key={ev.id} className="evidence-item">
                    <div className="evidence-info">
                      <span className={`badge ${getRoleBadgeClass("registrar")}`}>
                        {labels.evidence_types[ev.evidence_type]}
                      </span>
                      <strong>{ev.name}</strong>
                      {isEvidenceRequired(project.stage, ev.evidence_type) && (
                        <span className="evidence-required">★ 必填</span>
                      )}
                      {ev.description && (
                        <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                          {ev.description}
                        </span>
                      )}
                      <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                        上传于 {formatDateTime(ev.uploaded_at)}
                      </span>
                    </div>
                    {canManageEvidence && (
                      <button
                        className="btn btn-danger"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                        onClick={() => {
                          if (confirm("确定删除该证据？")) {
                            deleteEvidenceMutation.mutate(ev.id);
                          }
                        }}
                      >
                        删除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div>
            <h3 className="section-title">操作记录</h3>
            {project.operation_logs.length === 0 ? (
              <div className="empty-state">暂无操作记录</div>
            ) : (
              <div className="timeline">
                {[...project.operation_logs]
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  )
                  .map((log) => (
                    <div key={log.id} className="timeline-item">
                      <div className="log-header">
                        <div className="log-user">
                          {log.user_name}
                          <span
                            className={`badge ${getRoleBadgeClass(log.user_role as any)}`}
                            style={{ marginLeft: "0.5rem" }}
                          >
                            {labels.roles[log.user_role]}
                          </span>
                        </div>
                        <div className="log-time">{formatDateTime(log.created_at)}</div>
                      </div>
                      <div className="log-action">
                        <strong>
                          {log.action === "create" && "创建项目"}
                          {log.action === "submit" && "提交审核"}
                          {log.action === "review_approve" && "审核通过"}
                          {log.action === "review_reject" && "审核驳回"}
                          {log.action === "return_for_correction" && "退回补正"}
                          {log.action === "correct" && "补正提交"}
                          {log.action === "appeal_submit" && "提交申诉"}
                          {log.action === "appeal_review" && "申诉复核"}
                          {log.action === "appeal_approve" && "申诉通过"}
                          {log.action === "appeal_reject" && "申诉驳回"}
                          {log.action === "archive" && "归档"}
                          {log.action === "mark_overdue" && "标记逾期"}
                          {log.action === "state_conflict" && "状态冲突"}
                        </strong>
                        {log.stage && (
                          <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                            · {labels.stages[log.stage]}
                          </span>
                        )}
                        {log.version && (
                          <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                            · v{log.version}
                          </span>
                        )}
                      </div>
                      {log.from_status && log.to_status && (
                        <div style={{ fontSize: "0.875rem", color: "#374151", margin: "0.25rem 0" }}>
                          状态：
                          <span
                            className={`badge ${getStatusBadgeClass(log.from_status as any)}`}
                            style={{ margin: "0 0.25rem" }}
                          >
                            {labels.statuses[log.from_status]}
                          </span>
                          →
                          <span
                            className={`badge ${getStatusBadgeClass(log.to_status as any)}`}
                            style={{ margin: "0 0.25rem" }}
                          >
                            {labels.statuses[log.to_status]}
                          </span>
                        </div>
                      )}
                      {log.comment && <div className="log-comment">备注：{log.comment}</div>}
                      {log.opinion && <div className="log-comment">意见：{log.opinion}</div>}
                      {log.reject_reason && (
                        <div className="log-comment">驳回/退回原因：{log.reject_reason}</div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "appeals" && (
          <div>
            <h3 className="section-title">申诉记录</h3>
            {project.appeals.length === 0 ? (
              <div className="empty-state">暂无申诉记录</div>
            ) : (
              [...project.appeals]
                .sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                .map((ap) => (
                  <div
                    key={ap.id}
                    className={`appeal-item ${ap.result}`}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <strong>
                        {ap.submitter_name} 提交申诉
                        <span className="badge badge-gray" style={{ marginLeft: "0.5rem" }}>
                          v{ap.version}
                        </span>
                      </strong>
                      <div>
                        <span
                          className={`badge ${
                            ap.result === "approved"
                              ? "badge-green"
                              : ap.result === "rejected"
                              ? "badge-red"
                              : "badge-yellow"
                          }`}
                        >
                          {ap.result === "approved"
                            ? "申诉通过"
                            : ap.result === "rejected"
                            ? "申诉驳回"
                            : "待处理"}
                        </span>
                        <span style={{ color: "#6b7280", fontSize: "0.75rem", marginLeft: "0.75rem" }}>
                          {formatDateTime(ap.created_at)}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                      <strong>申诉理由：</strong>
                      {ap.appeal_reason}
                    </div>
                    {ap.submitter_opinion && (
                      <div style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                        <strong>申诉意见：</strong>
                        {ap.submitter_opinion}
                      </div>
                    )}
                    {ap.result !== "pending" && (
                      <div
                        style={{
                          borderTop: "1px solid #e5e7eb",
                          paddingTop: "0.75rem",
                          marginTop: "0.75rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                          <strong>{ap.reviewer_name} 复核</strong>
                          <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>
                            {formatDateTime(ap.reviewed_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.875rem" }}>
                          <strong>复核意见：</strong>
                          {ap.reviewer_opinion}
                        </div>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      {showSubmit && (
        <div className="modal-overlay" onClick={() => setShowSubmit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">提交审核</h3>
              <button className="modal-close" onClick={() => setShowSubmit(false)}>
                ×
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">备注（可选）</label>
              <textarea
                className="form-textarea"
                value={submitComment}
                onChange={(e) => setSubmitComment(e.target.value)}
                placeholder="请输入备注信息..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSubmit(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  submitMutation.mutate({
                    current_user_id: currentUser.id,
                    comment: submitComment || undefined,
                  })
                }
                disabled={submitMutation.isPending}
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {showApprove && (
        <div className="modal-overlay" onClick={() => setShowApprove(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">审核通过</h3>
              <button className="modal-close" onClick={() => setShowApprove(false)}>
                ×
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">审核意见</label>
              <textarea
                className="form-textarea"
                value={approveOpinion}
                onChange={(e) => setApproveOpinion(e.target.value)}
                placeholder="请输入审核意见..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowApprove(false)}>
                取消
              </button>
              <button
                className="btn btn-success"
                onClick={() =>
                  approveMutation.mutate({
                    current_user_id: currentUser.id,
                    opinion: approveOpinion || undefined,
                  })
                }
                disabled={approveMutation.isPending}
              >
                确认通过
              </button>
            </div>
          </div>
        </div>
      )}

      {showReject && (
        <div className="modal-overlay" onClick={() => setShowReject(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">审核驳回</h3>
              <button className="modal-close" onClick={() => setShowReject(false)}>
                ×
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">
                驳回原因 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                className="form-textarea"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="请输入驳回原因..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">审核意见</label>
              <textarea
                className="form-textarea"
                value={rejectOpinion}
                onChange={(e) => setRejectOpinion(e.target.value)}
                placeholder="请输入审核意见..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReject(false)}>
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={() =>
                  rejectMutation.mutate({
                    current_user_id: currentUser.id,
                    opinion: rejectOpinion || undefined,
                    reject_reason: rejectReason || undefined,
                  })
                }
                disabled={rejectMutation.isPending || !rejectReason}
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}

      {showReturn && (
        <div className="modal-overlay" onClick={() => setShowReturn(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">退回补正</h3>
              <button className="modal-close" onClick={() => setShowReturn(false)}>
                ×
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">
                退回原因 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                className="form-textarea"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="请输入退回补正的原因..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">补充意见</label>
              <textarea
                className="form-textarea"
                value={returnOpinion}
                onChange={(e) => setReturnOpinion(e.target.value)}
                placeholder="请输入补充意见..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReturn(false)}>
                取消
              </button>
              <button
                className="btn btn-warning"
                onClick={() =>
                  returnMutation.mutate({
                    current_user_id: currentUser.id,
                    reject_reason: returnReason,
                    opinion: returnOpinion || undefined,
                  })
                }
                disabled={returnMutation.isPending || !returnReason}
              >
                确认退回
              </button>
            </div>
          </div>
        </div>
      )}

      {showCorrect && (
        <div className="modal-overlay" onClick={() => setShowCorrect(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">补正提交</h3>
              <button className="modal-close" onClick={() => setShowCorrect(false)}>
                ×
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">补正说明</label>
              <textarea
                className="form-textarea"
                value={correctComment}
                onChange={(e) => setCorrectComment(e.target.value)}
                placeholder="请输入补正说明..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCorrect(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  correctMutation.mutate({
                    current_user_id: currentUser.id,
                    comment: correctComment || undefined,
                  })
                }
                disabled={correctMutation.isPending}
              >
                提交补正
              </button>
            </div>
          </div>
        </div>
      )}

      {showAppeal && (
        <div className="modal-overlay" onClick={() => setShowAppeal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">提交申诉</h3>
              <button className="modal-close" onClick={() => setShowAppeal(false)}>
                ×
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">
                申诉理由 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                className="form-textarea"
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="请详细描述申诉理由..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">申诉意见</label>
              <textarea
                className="form-textarea"
                value={appealOpinion}
                onChange={(e) => setAppealOpinion(e.target.value)}
                placeholder="请输入申诉意见..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAppeal(false)}>
                取消
              </button>
              <button
                className="btn btn-warning"
                onClick={() =>
                  appealMutation.mutate({
                    current_user_id: currentUser.id,
                    appeal_reason: appealReason,
                    submitter_opinion: appealOpinion || undefined,
                  })
                }
                disabled={appealMutation.isPending || !appealReason}
              >
                提交申诉
              </button>
            </div>
          </div>
        </div>
      )}

      {showAppealReview && (
        <div className="modal-overlay" onClick={() => setShowAppealReview(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">复核申诉</h3>
              <button className="modal-close" onClick={() => setShowAppealReview(false)}>
                ×
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">
                复核结果 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                className="form-select"
                value={appealReviewResult}
                onChange={(e) => setAppealReviewResult(e.target.value as any)}
              >
                <option value="approved">申诉通过</option>
                <option value="rejected">申诉驳回</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                复核意见 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                className="form-textarea"
                value={appealReviewOpinion}
                onChange={(e) => setAppealReviewOpinion(e.target.value)}
                placeholder="请输入复核意见..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAppealReview(false)}>
                取消
              </button>
              <button
                className={appealReviewResult === "approved" ? "btn btn-success" : "btn btn-danger"}
                onClick={() =>
                  appealReviewMutation.mutate({
                    current_user_id: currentUser.id,
                    reviewer_opinion: appealReviewOpinion,
                    result: appealReviewResult,
                  })
                }
                disabled={appealReviewMutation.isPending || !appealReviewOpinion}
              >
                确认复核
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddEvidence && (
        <div className="modal-overlay" onClick={() => setShowAddEvidence(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">添加证据材料</h3>
              <button className="modal-close" onClick={() => setShowAddEvidence(false)}>
                ×
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">
                证据名称 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={newEvidenceName}
                onChange={(e) => setNewEvidenceName(e.target.value)}
                placeholder="请输入证据名称..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                证据类型 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                className="form-select"
                value={newEvidenceType}
                onChange={(e) => setNewEvidenceType(e.target.value)}
              >
                {labels &&
                  Object.entries(labels.evidence_types).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                      {isEvidenceRequired(project.stage, k) ? " ★" : ""}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">描述</label>
              <textarea
                className="form-textarea"
                value={newEvidenceDesc}
                onChange={(e) => setNewEvidenceDesc(e.target.value)}
                placeholder="请输入证据描述..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddEvidence(false)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  addEvidenceMutation.mutate({
                    name: newEvidenceName,
                    evidence_type: newEvidenceType as any,
                    description: newEvidenceDesc || undefined,
                    uploaded_by_id: currentUser.id,
                  })
                }
                disabled={addEvidenceMutation.isPending || !newEvidenceName}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
