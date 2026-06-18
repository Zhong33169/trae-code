import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../lib/api";
import type { Stage, EvidenceType, EvidenceCreate, ProjectCreate } from "../../lib/types";
import {
  getRoleBadgeClass,
  formatCurrency,
  isEvidenceRequired,
} from "../../lib/utils";
import { useToast } from "../../hooks/useToast";

export const Route = createLazyFileRoute("/projects/new")({
  component: NewProject,
});

interface EvidenceDraft {
  name: string;
  evidence_type: EvidenceType;
  description: string;
}

function NewProject() {
  const navigate = useNavigate();
  const { show, ToastComponent } = useToast();

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [projectName, setProjectName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [stage, setStage] = useState<Stage>("need");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");

  const [evidences, setEvidences] = useState<EvidenceDraft[]>([]);

  const { data: labels } = useQuery({
    queryKey: ["labels"],
    queryFn: () => api.getLabels(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers(),
  });

  if (users.length > 0 && currentUserId === null) {
    const firstRegistrar = users.find((u) => u.role === "registrar");
    setCurrentUserId(firstRegistrar ? firstRegistrar.id : users[0].id);
  }

  const currentUser = users.find((u) => u.id === currentUserId) || null;
  const registrars = users.filter((u) => u.role === "registrar");

  const createMutation = useMutation({
    mutationFn: async (input: {
      project: ProjectCreate;
      evidences: EvidenceDraft[];
    }) => {
      const created = await api.createProject(input.project);
      for (const ev of input.evidences) {
        if (!ev.name.trim()) continue;
        const payload: EvidenceCreate = {
          name: ev.name.trim(),
          evidence_type: ev.evidence_type,
          description: ev.description.trim() || undefined,
          uploaded_by_id: input.project.created_by_id,
        };
        await api.addEvidence(created.id, payload);
      }
      return created;
    },
    onSuccess: (created) => {
      show("success", `项目 ${created.project_no} 已创建`);
      navigate({ to: "/projects/$projectId", params: { projectId: String(created.id) } });
    },
    onError: (e: any) => show("error", e.message),
  });

  function addEvidenceRow() {
    setEvidences((prev) => [
      ...prev,
      { name: "", evidence_type: "need_document", description: "" },
    ]);
  }

  function updateEvidence(idx: number, patch: Partial<EvidenceDraft>) {
    setEvidences((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e))
    );
  }

  function removeEvidence(idx: number) {
    setEvidences((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!currentUser) {
      show("error", "请先选择登记员");
      return;
    }
    if (currentUser.role !== "registrar") {
      show("error", "只有培训项目登记员可以发起项目");
      return;
    }
    if (!projectName.trim() || !clientCompany.trim()) {
      show("error", "项目名称和客户公司为必填项");
      return;
    }

    const project: ProjectCreate = {
      project_name: projectName.trim(),
      client_company: clientCompany.trim(),
      stage,
      description: description.trim() || undefined,
      budget: budget ? Number(budget) : undefined,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      created_by_id: currentUser.id,
    };

    createMutation.mutate({ project, evidences });
  }

  if (!labels || !currentUser) {
    return (
      <div className="container">
        <div className="empty-state">加载中...</div>
      </div>
    );
  }

  const parsedBudget = budget ? Number(budget) : undefined;

  return (
    <div className="container">
      {ToastComponent}

      <div className="page-header">
        <div>
          <Link to="/" className="btn btn-secondary" style={{ marginBottom: "0.75rem" }}>
            ← 返回列表
          </Link>
          <h1 className="page-title">发起培训项目单</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            登记员现场办理入口：填写项目信息并上传初始证据材料，创建后可在详情页提交审核
          </p>
        </div>
      </div>

      <div className="card">
        <div className="toolbar" style={{ marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>登记员：</span>
          <select
            className="form-select"
            style={{ maxWidth: 260 }}
            value={currentUserId ?? ""}
            onChange={(e) => setCurrentUserId(Number(e.target.value))}
          >
            {registrars.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} - {labels.roles[u.role]}
              </option>
            ))}
          </select>
          <span
            className={`badge ${getRoleBadgeClass(currentUser.role)}`}
            style={{ marginLeft: "0.5rem" }}
          >
            {labels.roles[currentUser.role]}
          </span>
        </div>

        <div className="grid grid-2">
          <div>
            <h3 className="section-title">项目基本信息</h3>
            <div className="form-group">
              <label className="form-label">
                项目名称 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="如：新员工入职技能培训项目"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                客户公司 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                placeholder="如：北京科技有限公司"
              />
            </div>
            <div className="form-group">
              <label className="form-label">流程阶段</label>
              <select
                className="form-select"
                value={stage}
                onChange={(e) => setStage(e.target.value as Stage)}
              >
                {Object.entries(labels.stages).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">项目预算（元）</label>
              <input
                type="number"
                className="form-input"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="如：150000"
              />
              {parsedBudget !== undefined && (
                <span style={{ color: "#6b7280", fontSize: "0.8125rem" }}>
                  预览：{formatCurrency(parsedBudget)}
                </span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">截止时间</label>
              <input
                type="datetime-local"
                className="form-input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div>
            <h3 className="section-title">项目描述</h3>
            <div className="form-group">
              <textarea
                className="form-textarea"
                style={{ minHeight: 160 }}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述培训目标、对象、周期等..."
              />
            </div>

            <h3 className="section-title" style={{ marginTop: "1.5rem" }}>
              初始证据材料（可选）
            </h3>
            <p style={{ color: "#6b7280", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
              当前阶段（{labels.stages[stage]}）必填证据：
              {(["need_document", "quotation_sheet", "contract"] as EvidenceType[])
                .filter((et) => isEvidenceRequired(stage, et))
                .map((et) => (
                  <code
                    key={et}
                    style={{
                      background: "#fef3c7",
                      padding: "1px 6px",
                      borderRadius: 4,
                      margin: "0 0.25rem",
                    }}
                  >
                    {labels.evidence_types[et]}
                  </code>
                ))}
              ；提交审核前需补齐，否则后端会保留草稿并写状态冲突记录。
            </p>

            {evidences.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: "0.75rem" }}>
                暂未添加证据
              </div>
            ) : (
              evidences.map((ev, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: "0.75rem",
                    marginBottom: "0.75rem",
                    background: "#f9fafb",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={ev.name}
                      onChange={(e) => updateEvidence(idx, { name: e.target.value })}
                      placeholder="证据名称，如：培训需求确认书.pdf"
                    />
                    <select
                      className="form-select"
                      style={{ maxWidth: 160 }}
                      value={ev.evidence_type}
                      onChange={(e) =>
                        updateEvidence(idx, {
                          evidence_type: e.target.value as EvidenceType,
                        })
                      }
                    >
                      {Object.entries(labels.evidence_types).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                          {isEvidenceRequired(stage, k as EvidenceType) ? " ★" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-danger"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => removeEvidence(idx)}
                    >
                      删除
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    value={ev.description}
                    onChange={(e) => updateEvidence(idx, { description: e.target.value })}
                    placeholder="证据描述（可选）"
                  />
                </div>
              ))
            )}
            <button className="btn btn-secondary" onClick={addEvidenceRow}>
              + 添加证据
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            marginTop: "1.5rem",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "1rem",
          }}
        >
          <Link to="/" className="btn btn-secondary">
            取消
          </Link>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={
              createMutation.isPending ||
              !projectName.trim() ||
              !clientCompany.trim()
            }
          >
            {createMutation.isPending ? "创建中..." : "创建项目"}
          </button>
        </div>
      </div>
    </div>
  );
}
