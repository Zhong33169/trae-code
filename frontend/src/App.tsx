import React, { useState, useEffect, useCallback } from "react";
import {
  getCurrentUser,
  setCurrentUser,
  login,
  fetchForms,
  fetchFormDetail,
  createForm,
  submitFormAction,
  addEvidence,
  addSupplement,
  batchAction,
  fetchStats,
} from "./api";

const STATUS_MAP: Record<string, string> = {
  draft: "草稿",
  pending_review: "待审核",
  pending_archive: "待归档",
  archived: "已归档",
  rejected: "已驳回",
  returned: "被退回",
};

const TYPE_MAP: Record<string, string> = {
  increase: "追加",
  decrease: "调减",
  transfer: "划转",
};

const ROLE_MAP: Record<string, string> = {
  registrar: "预算调整登记员",
  supervisor: "预算调整审核主管",
  reviewer: "复核负责人",
};

const EVIDENCE_TYPE_MAP: Record<string, string> = {
  budget_adjustment: "预算调整",
  department_confirm: "部门确认",
  approval_effective: "审批生效",
};

const SUPPLEMENT_TYPE_MAP: Record<string, string> = {
  correction: "补正",
  evidence_add: "补充证据",
  note: "备注",
};

const DEMO_ACCOUNTS = [
  { id: "registrar1", name: "张登记", role: "registrar", password: "123456" },
  { id: "registrar2", name: "李登记", role: "registrar", password: "123456" },
  { id: "supervisor1", name: "王审核", role: "supervisor", password: "123456" },
  { id: "supervisor2", name: "赵审核", role: "supervisor", password: "123456" },
  { id: "reviewer1", name: "孙复核", role: "reviewer", password: "123456" },
  { id: "reviewer2", name: "周复核", role: "reviewer", password: "123456" },
];

interface Form {
  id: string;
  title: string;
  department: string;
  adjustment_type: string;
  amount: number;
  reason: string;
  status: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  supplement_count?: number;
}

interface Evidence {
  id: string;
  form_id: string;
  evidence_type: string;
  description: string;
  file_name: string | null;
  uploaded_by: string;
  uploaded_at: string;
  uploader_name?: string;
}

interface Action {
  id: string;
  form_id: string;
  action: string;
  actor_id: string;
  actor_role: string;
  comment: string | null;
  from_status: string;
  to_status: string;
  version: number;
  acted_at: string;
  actor_name?: string;
}

interface Supplement {
  id: string;
  form_id: string;
  supplement_type: string;
  content: string;
  reason: string;
  supplemented_by: string;
  supplemented_at: string;
  supplementer_name?: string;
}

interface FormDetail extends Form {
  evidences: Evidence[];
  actions: Action[];
  supplements: Supplement[];
}

export default function App() {
  const [user, setUser] = useState(getCurrentUser());
  const [forms, setForms] = useState<Form[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [selectedForm, setSelectedForm] = useState<FormDetail | null>(null);
  const [hoveredForm, setHoveredForm] = useState<Form | null>(null);
  const [sidebarEvidences, setSidebarEvidences] = useState<Evidence[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDept, setFilterDept] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [showSupplement, setShowSupplement] = useState(false);
  const [showEvidenceAdd, setShowEvidenceAdd] = useState(false);
  const [actionComment, setActionComment] = useState("");
  const [supplementForm, setSupplementForm] = useState({
    supplement_type: "note",
    content: "",
    reason: "",
  });
  const [evidenceForm, setEvidenceForm] = useState({
    evidence_type: "budget_adjustment" as string,
    description: "",
    file_name: "",
  });
  const [createForm_, setCreateForm] = useState({
    title: "",
    department: "",
    adjustment_type: "increase",
    amount: 0,
    reason: "",
  });

  const loadForms = useCallback(async () => {
    if (!user) return;
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterDept) params.department = filterDept;
      if (filterType) params.type = filterType;
      if (searchText) params.search = searchText;
      const data = await fetchForms(params);
      setForms(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, [user, filterStatus, filterDept, filterType, searchText]);

  const loadStats = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchStats();
      setStats(data);
    } catch {}
  }, [user]);

  useEffect(() => {
    loadForms();
    loadStats();
  }, [loadForms, loadStats]);

  const handleLogin = async (accountId: string) => {
    const acc = DEMO_ACCOUNTS.find((a) => a.id === accountId);
    if (!acc) return;
    try {
      setError("");
      const data = await login(acc.id, acc.password);
      setUser(data);
      setCurrentUser(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentUser(null);
    setSelectedForm(null);
    setForms([]);
    setStats({});
  };

  const handleSelectForm = async (formId: string) => {
    try {
      setError("");
      const data = await fetchFormDetail(formId);
      setSelectedForm(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleHoverForm = (form: Form) => {
    setHoveredForm(form);
  };

  const handleAction = async (action: string) => {
    if (!selectedForm) return;
    try {
      setError("");
      const result = await submitFormAction(selectedForm.id, action, actionComment);
      setSuccess(result.message);
      setActionComment("");
      await handleSelectForm(selectedForm.id);
      await loadForms();
      await loadStats();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreate = async () => {
    try {
      setError("");
      const result = await createForm(createForm_);
      setSuccess(`预算调整单创建成功：${result.id}`);
      setShowCreate(false);
      setCreateForm({ title: "", department: "", adjustment_type: "increase", amount: 0, reason: "" });
      await loadForms();
      await loadStats();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAddEvidence = async () => {
    if (!selectedForm) return;
    try {
      setError("");
      const result = await addEvidence(
        selectedForm.id,
        evidenceForm.evidence_type,
        evidenceForm.description,
        evidenceForm.file_name
      );
      setSuccess(result.message);
      setShowEvidenceAdd(false);
      setEvidenceForm({ evidence_type: "budget_adjustment", description: "", file_name: "" });
      await handleSelectForm(selectedForm.id);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAddSupplement = async () => {
    if (!selectedForm) return;
    try {
      setError("");
      const result = await addSupplement(
        selectedForm.id,
        supplementForm.supplement_type,
        supplementForm.content,
        supplementForm.reason
      );
      setSuccess(result.message);
      setShowSupplement(false);
      setSupplementForm({ supplement_type: "note", content: "", reason: "" });
      await handleSelectForm(selectedForm.id);
      await loadForms();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleBatchAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    try {
      setError("");
      const result = await batchAction(Array.from(selectedIds), action, actionComment);
      const failed = result.results.filter((r: any) => !r.success);
      if (failed.length > 0) {
        setError(failed.map((f: any) => `${f.formId}: ${f.error}`).join("\n"));
      } else {
        setSuccess(`批量操作成功：${result.results.length}条`);
      }
      setSelectedIds(new Set());
      setActionComment("");
      await loadForms();
      await loadStats();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === forms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(forms.map((f) => f.id)));
    }
  };

  const getAvailableActions = (status: string, role: string): { action: string; label: string }[] => {
    const actions: { action: string; label: string }[] = [];
    if (role === "registrar") {
      if (status === "draft" || status === "returned") {
        actions.push({ action: "submit", label: "提交审核" });
      }
      if (status === "returned") {
        actions.push({ action: "correct", label: "补正" });
      }
    }
    if (role === "supervisor") {
      if (status === "pending_review") {
        actions.push({ action: "review_approve", label: "审核通过" });
        actions.push({ action: "review_reject", label: "驳回" });
        actions.push({ action: "review_return", label: "退回补正" });
      }
    }
    if (role === "reviewer") {
      if (status === "pending_archive") {
        actions.push({ action: "archive", label: "复核归档" });
      }
    }
    return actions;
  };

  if (!user) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>财务共享中心</h1>
          <h2 style={styles.loginSubtitle}>预算调整单管理系统</h2>
          <p style={styles.loginHint}>请选择角色登录</p>
          <div style={styles.roleGrid}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.id}
                style={{
                  ...styles.roleBtn,
                  borderColor: acc.role === "registrar" ? "#e67e22" : acc.role === "supervisor" ? "#3498db" : "#27ae60",
                }}
                onClick={() => handleLogin(acc.id)}
              >
                <span style={styles.roleBtnName}>{acc.name}</span>
                <span style={styles.roleBtnRole}>{ROLE_MAP[acc.role]}</span>
              </button>
            ))}
          </div>
          {error && <div style={styles.errorBox}>{error}</div>}
        </div>
      </div>
    );
  }

  const departments = [...new Set(forms.map((f) => f.department))];
  const availableBatchActions = getAvailableActions(
    forms.find((f) => selectedIds.has(f.id))?.status || "",
    user.role
  );

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>财务共享中心 · 预算调整单</h1>
          <div style={styles.stats}>
            {Object.entries(stats).map(([k, v]) => (
              <span key={k} style={styles.statBadge}>
                {STATUS_MAP[k] || k}: <b>{v}</b>
              </span>
            ))}
          </div>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.userInfo}>
            {user.name}（{ROLE_MAP[user.role]}）
          </span>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            退出
          </button>
        </div>
      </header>

      {error && (
        <div style={styles.errorBar}>
          {error}
          <button style={styles.closeBtn} onClick={() => setError("")}>✕</button>
        </div>
      )}
      {success && (
        <div style={styles.successBar}>
          {success}
          <button style={styles.closeBtn} onClick={() => setSuccess("")}>✕</button>
        </div>
      )}

      <div style={styles.toolbar}>
        <div style={styles.filterRow}>
          <select style={styles.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">全部状态</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select style={styles.select} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">全部部门</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select style={styles.select} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">全部类型</option>
            {Object.entries(TYPE_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            style={styles.searchInput}
            placeholder="搜索单号/标题..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div style={styles.actionRow}>
          {user.role === "registrar" && (
            <button style={styles.primaryBtn} onClick={() => setShowCreate(true)}>
              + 新建调整单
            </button>
          )}
          {selectedIds.size > 0 && availableBatchActions.length > 0 && (
            <div style={styles.batchGroup}>
              <span style={styles.batchLabel}>已选 {selectedIds.size} 项</span>
              {availableBatchActions.map((a) => (
                <button
                  key={a.action}
                  style={styles.batchBtn}
                  onClick={() => handleBatchAction(a.action)}
                >
                  {a.label}
                </button>
              ))}
              <button style={styles.cancelBtn} onClick={() => setSelectedIds(new Set())}>
                取消选择
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={styles.mainContent}>
        <div style={styles.queuePanel}>
          <div style={styles.tableHeader}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedIds.size === forms.length && forms.length > 0}
                onChange={toggleSelectAll}
              />
            </label>
            <span style={{ ...styles.th, width: 130 }}>单号</span>
            <span style={{ ...styles.th, flex: 2 }}>标题</span>
            <span style={{ ...styles.th, width: 80 }}>部门</span>
            <span style={{ ...styles.th, width: 70 }}>类型</span>
            <span style={{ ...styles.th, width: 100 }}>金额</span>
            <span style={{ ...styles.th, width: 90 }}>状态</span>
            <span style={{ ...styles.th, width: 60 }}>版本</span>
            <span style={{ ...styles.th, width: 60 }}>补录</span>
          </div>
          {forms.map((form) => (
            <div
              key={form.id}
              style={{
                ...styles.tableRow,
                backgroundColor:
                  selectedForm?.id === form.id
                    ? "#e3f2fd"
                    : selectedIds.has(form.id)
                    ? "#fff3e0"
                    : hoveredForm?.id === form.id
                    ? "#f5f5f5"
                    : "#fff",
              }}
              onClick={() => handleSelectForm(form.id)}
              onMouseEnter={() => handleHoverForm(form)}
              onMouseLeave={() => setHoveredForm(null)}
            >
              <label style={styles.checkboxLabel} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(form.id)}
                  onChange={() => toggleSelect(form.id)}
                />
              </label>
              <span style={{ ...styles.td, width: 130, color: "#1565c0", fontWeight: 600 }}>{form.id}</span>
              <span style={{ ...styles.td, flex: 2 }}>{form.title}</span>
              <span style={{ ...styles.td, width: 80 }}>{form.department}</span>
              <span style={{ ...styles.td, width: 70 }}>{TYPE_MAP[form.adjustment_type]}</span>
              <span style={{ ...styles.td, width: 100, textAlign: "right" }}>
                {form.amount.toLocaleString()}
              </span>
              <span style={{ ...styles.td, width: 90 }}>
                <span style={statusBadgeStyle(form.status)}>{STATUS_MAP[form.status]}</span>
              </span>
              <span style={{ ...styles.td, width: 60, textAlign: "center" }}>v{form.version}</span>
              <span style={{ ...styles.td, width: 60, textAlign: "center" }}>
                {form.supplement_count || 0}
              </span>
            </div>
          ))}
          {forms.length === 0 && (
            <div style={styles.emptyState}>暂无符合条件的预算调整单</div>
          )}
        </div>

        <div style={styles.sidebar}>
          {hoveredForm ? (
            <HoveredFormInfo form={hoveredForm} />
          ) : selectedForm ? (
            <SidebarEvidence form={selectedForm} />
          ) : (
            <div style={styles.sidebarPlaceholder}>
              <p>悬停或点击调整单</p>
              <p>查看关键证据</p>
            </div>
          )}
        </div>
      </div>

      {selectedForm && (
        <div style={styles.detailOverlay} onClick={() => setSelectedForm(null)}>
          <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.detailHeader}>
              <h2>
                {selectedForm.id} - {selectedForm.title}
              </h2>
              <button style={styles.closeModalBtn} onClick={() => setSelectedForm(null)}>
                ✕
              </button>
            </div>

            <div style={styles.detailBody}>
              <div style={styles.detailGrid}>
                <div style={styles.detailField}>
                  <label>部门</label>
                  <span>{selectedForm.department}</span>
                </div>
                <div style={styles.detailField}>
                  <label>调整类型</label>
                  <span>{TYPE_MAP[selectedForm.adjustment_type]}</span>
                </div>
                <div style={styles.detailField}>
                  <label>金额</label>
                  <span style={{ fontWeight: 700, fontSize: 18 }}>
                    ¥{selectedForm.amount.toLocaleString()}
                  </span>
                </div>
                <div style={styles.detailField}>
                  <label>状态</label>
                  <span style={statusBadgeStyle(selectedForm.status)}>
                    {STATUS_MAP[selectedForm.status]}
                  </span>
                </div>
                <div style={styles.detailField}>
                  <label>版本</label>
                  <span>v{selectedForm.version}</span>
                </div>
                <div style={styles.detailField}>
                  <label>创建人</label>
                  <span>{selectedForm.creator_name}</span>
                </div>
                <div style={styles.detailField}>
                  <label>创建时间</label>
                  <span>{selectedForm.created_at}</span>
                </div>
                <div style={styles.detailField}>
                  <label>更新时间</label>
                  <span>{selectedForm.updated_at}</span>
                </div>
              </div>
              <div style={styles.detailField}>
                <label>调整原因</label>
                <span>{selectedForm.reason}</span>
              </div>

              <h3 style={styles.sectionTitle}>证据材料</h3>
              {selectedForm.evidences.length === 0 ? (
                <p style={styles.emptyText}>暂无证据材料</p>
              ) : (
                <div style={styles.evidenceGrid}>
                  {selectedForm.evidences.map((ev) => (
                    <div key={ev.id} style={evidenceCardStyle(ev.evidence_type)}>
                      <div style={styles.evidenceIcon}>
                        {ev.evidence_type === "budget_adjustment"
                          ? "📋"
                          : ev.evidence_type === "department_confirm"
                          ? "🏢"
                          : "✅"}
                      </div>
                      <div style={styles.evidenceInfo}>
                        <div style={{ fontWeight: 600 }}>
                          {EVIDENCE_TYPE_MAP[ev.evidence_type]}
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>{ev.description}</div>
                        <div style={{ fontSize: 11, color: "#999" }}>
                          {ev.uploader_name} · {ev.uploaded_at}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {user.role === "registrar" && ["draft", "returned"].includes(selectedForm.status) && (
                <button style={styles.smallBtn} onClick={() => setShowEvidenceAdd(true)}>
                  + 添加证据
                </button>
              )}

              <h3 style={styles.sectionTitle}>
                补录记录
                {selectedForm.supplements.length > 0 && (
                  <span style={styles.supplementCount}>
                    {selectedForm.supplements.length}条
                  </span>
                )}
              </h3>
              {selectedForm.supplements.length === 0 ? (
                <p style={styles.emptyText}>暂无补录</p>
              ) : (
                <div style={styles.supplementList}>
                  {selectedForm.supplements.map((sup) => (
                    <div key={sup.id} style={styles.supplementCard}>
                      <div style={styles.supplementHeader}>
                        <span style={supplementTypeBadge(sup.supplement_type)}>
                          {SUPPLEMENT_TYPE_MAP[sup.supplement_type]}
                        </span>
                        <span style={styles.supplementMeta}>
                          {sup.supplementer_name} · {sup.supplemented_at}
                        </span>
                      </div>
                      <div style={styles.supplementContent}>{sup.content}</div>
                      <div style={styles.supplementReason}>原因：{sup.reason}</div>
                    </div>
                  ))}
                </div>
              )}
              {(() => {
                const canSupplement =
                  (user.role === "registrar" && ["draft", "returned"].includes(selectedForm.status)) ||
                  (user.role === "supervisor" && selectedForm.status === "pending_review") ||
                  (user.role === "reviewer" && selectedForm.status === "pending_archive");
                return canSupplement ? (
                  <button style={styles.smallBtn} onClick={() => setShowSupplement(true)}>
                    + 补录
                  </button>
                ) : null;
              })()}

              <h3 style={styles.sectionTitle}>操作记录</h3>
              <div style={styles.timeline}>
                {selectedForm.actions.map((act) => (
                  <div key={act.id} style={styles.timelineItem}>
                    <div style={styles.timelineDot} />
                    <div style={styles.timelineContent}>
                      <div style={styles.timelineHeader}>
                        <span style={styles.timelineActor}>
                          {act.actor_name}（{ROLE_MAP[act.actor_role]}）
                        </span>
                        <span style={styles.timelineAction}>{act.action}</span>
                        <span style={styles.timelineStatus}>
                          {STATUS_MAP[act.from_status]} → {STATUS_MAP[act.to_status]}
                        </span>
                      </div>
                      {act.comment && (
                        <div style={styles.timelineComment}>{act.comment}</div>
                      )}
                      <div style={styles.timelineTime}>{act.acted_at} (v{act.version})</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.detailFooter}>
              {getAvailableActions(selectedForm.status, user.role).map((a) => (
                <button
                  key={a.action}
                  style={{
                    ...styles.actionBtn,
                    backgroundColor:
                      a.action === "review_reject"
                        ? "#e74c3c"
                        : a.action === "review_return"
                        ? "#e67e22"
                        : a.action === "archive"
                        ? "#27ae60"
                        : "#1565c0",
                  }}
                  onClick={() => handleAction(a.action)}
                >
                  {a.label}
                </button>
              ))}
              <input
                style={styles.commentInput}
                placeholder="操作意见（可选）"
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div style={styles.detailOverlay} onClick={() => setShowCreate(false)}>
          <div style={styles.createModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 16 }}>新建预算调整单</h2>
            <div style={styles.formGroup}>
              <label>标题</label>
              <input
                style={styles.input}
                value={createForm_.title}
                onChange={(e) => setCreateForm({ ...createForm_, title: e.target.value })}
              />
            </div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label>部门</label>
                <input
                  style={styles.input}
                  value={createForm_.department}
                  onChange={(e) => setCreateForm({ ...createForm_, department: e.target.value })}
                />
              </div>
              <div style={styles.formGroup}>
                <label>调整类型</label>
                <select
                  style={styles.input}
                  value={createForm_.adjustment_type}
                  onChange={(e) => setCreateForm({ ...createForm_, adjustment_type: e.target.value })}
                >
                  <option value="increase">追加</option>
                  <option value="decrease">调减</option>
                  <option value="transfer">划转</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label>金额</label>
                <input
                  style={styles.input}
                  type="number"
                  value={createForm_.amount}
                  onChange={(e) => setCreateForm({ ...createForm_, amount: Number(e.target.value) })}
                />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label>调整原因</label>
              <textarea
                style={{ ...styles.input, minHeight: 80 }}
                value={createForm_.reason}
                onChange={(e) => setCreateForm({ ...createForm_, reason: e.target.value })}
              />
            </div>
            <div style={styles.modalActions}>
              <button style={styles.primaryBtn} onClick={handleCreate}>
                创建
              </button>
              <button style={styles.cancelBtn} onClick={() => setShowCreate(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showSupplement && selectedForm && (
        <div style={styles.detailOverlay} onClick={() => setShowSupplement(false)}>
          <div style={styles.createModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 16 }}>补录信息</h2>
            <div style={styles.formGroup}>
              <label>补录类型</label>
              <select
                style={styles.input}
                value={supplementForm.supplement_type}
                onChange={(e) => setSupplementForm({ ...supplementForm, supplement_type: e.target.value })}
              >
                <option value="correction">补正</option>
                <option value="evidence_add">补充证据</option>
                <option value="note">备注</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label>补录内容</label>
              <textarea
                style={{ ...styles.input, minHeight: 80 }}
                value={supplementForm.content}
                onChange={(e) => setSupplementForm({ ...supplementForm, content: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label>补录原因</label>
              <input
                style={styles.input}
                value={supplementForm.reason}
                onChange={(e) => setSupplementForm({ ...supplementForm, reason: e.target.value })}
              />
            </div>
            <div style={styles.modalActions}>
              <button style={styles.primaryBtn} onClick={handleAddSupplement}>
                确认补录
              </button>
              <button style={styles.cancelBtn} onClick={() => setShowSupplement(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showEvidenceAdd && selectedForm && (
        <div style={styles.detailOverlay} onClick={() => setShowEvidenceAdd(false)}>
          <div style={styles.createModal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 16 }}>添加证据</h2>
            <div style={styles.formGroup}>
              <label>证据类型</label>
              <select
                style={styles.input}
                value={evidenceForm.evidence_type}
                onChange={(e) => setEvidenceForm({ ...evidenceForm, evidence_type: e.target.value })}
              >
                <option value="budget_adjustment">预算调整</option>
                <option value="department_confirm">部门确认</option>
                <option value="approval_effective">审批生效</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label>证据描述</label>
              <input
                style={styles.input}
                value={evidenceForm.description}
                onChange={(e) => setEvidenceForm({ ...evidenceForm, description: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label>文件名（模拟）</label>
              <input
                style={styles.input}
                value={evidenceForm.file_name}
                onChange={(e) => setEvidenceForm({ ...evidenceForm, file_name: e.target.value })}
              />
            </div>
            <div style={styles.modalActions}>
              <button style={styles.primaryBtn} onClick={handleAddEvidence}>
                添加
              </button>
              <button style={styles.cancelBtn} onClick={() => setShowEvidenceAdd(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HoveredFormInfo({ form }: { form: Form }) {
  return (
    <div style={styles.sidebarContent}>
      <h3 style={styles.sidebarTitle}>快速预览</h3>
      <div style={styles.sidebarField}>
        <label>单号</label>
        <span>{form.id}</span>
      </div>
      <div style={styles.sidebarField}>
        <label>标题</label>
        <span>{form.title}</span>
      </div>
      <div style={styles.sidebarField}>
        <label>部门</label>
        <span>{form.department}</span>
      </div>
      <div style={styles.sidebarField}>
        <label>状态</label>
        <span style={statusBadgeStyle(form.status)}>{STATUS_MAP[form.status]}</span>
      </div>
      <div style={styles.sidebarField}>
        <label>金额</label>
        <span>¥{form.amount.toLocaleString()}</span>
      </div>
      <div style={styles.sidebarField}>
        <label>补录次数</label>
        <span>{form.supplement_count || 0}</span>
      </div>
      <p style={{ fontSize: 12, color: "#999", marginTop: 16, textAlign: "center" }}>
        点击查看完整详情
      </p>
    </div>
  );
}

function SidebarEvidence({ form }: { form: FormDetail }) {
  return (
    <div style={styles.sidebarContent}>
      <h3 style={styles.sidebarTitle}>关键证据</h3>
      {form.evidences.length === 0 ? (
        <p style={styles.emptyText}>暂无证据</p>
      ) : (
        form.evidences.map((ev) => (
          <div key={ev.id} style={styles.sidebarEvidence}>
            <span style={styles.sidebarEvidenceType}>
              {EVIDENCE_TYPE_MAP[ev.evidence_type]}
            </span>
            <span style={styles.sidebarEvidenceDesc}>{ev.description}</span>
          </div>
        ))
      )}
      <h4 style={{ marginTop: 16, color: "#333" }}>最近操作</h4>
      {form.actions.slice(-3).map((act) => (
        <div key={act.id} style={styles.sidebarAction}>
          <span>{act.actor_name}</span>
          <span>{STATUS_MAP[act.from_status]} → {STATUS_MAP[act.to_status]}</span>
        </div>
      ))}
    </div>
  );
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    draft: { bg: "#f5f5f5", color: "#666" },
    pending_review: { bg: "#e3f2fd", color: "#1565c0" },
    pending_archive: { bg: "#fff3e0", color: "#e65100" },
    archived: { bg: "#e8f5e9", color: "#2e7d32" },
    rejected: { bg: "#ffebee", color: "#c62828" },
    returned: { bg: "#fce4ec", color: "#880e4f" },
  };
  const c = colors[status] || { bg: "#f5f5f5", color: "#666" };
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: c.bg,
    color: c.color,
  };
}

function supplementTypeBadge(type: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    correction: { bg: "#fff3e0", color: "#e65100" },
    evidence_add: { bg: "#e3f2fd", color: "#1565c0" },
    note: { bg: "#f3e5f5", color: "#6a1b9a" },
  };
  const c = colors[type] || { bg: "#f5f5f5", color: "#666" };
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: c.bg,
    color: c.color,
  };
}

function evidenceCardStyle(type: string): React.CSSProperties {
  const colors: Record<string, string> = {
    budget_adjustment: "#e3f2fd",
    department_confirm: "#fff3e0",
    approval_effective: "#e8f5e9",
  };
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 8,
    backgroundColor: colors[type] || "#f5f5f5",
    border: "1px solid #e0e0e0",
  };
}

const styles: Record<string, React.CSSProperties> = {
  loginContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#1a237e",
    background: "linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)",
  },
  loginCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: "48px 40px",
    minWidth: 480,
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1a237e",
    textAlign: "center" as const,
    marginBottom: 4,
  },
  loginSubtitle: {
    fontSize: 16,
    color: "#5c6bc0",
    textAlign: "center" as const,
    marginBottom: 24,
  },
  loginHint: {
    fontSize: 14,
    color: "#999",
    textAlign: "center" as const,
    marginBottom: 20,
  },
  roleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  roleBtn: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "16px 8px",
    border: "2px solid",
    borderRadius: 10,
    backgroundColor: "#fafafa",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  roleBtnName: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 4,
  },
  roleBtnRole: {
    fontSize: 11,
    color: "#888",
  },
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#f0f2f5",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 24px",
    backgroundColor: "#1a237e",
    color: "#fff",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  stats: {
    display: "flex",
    gap: 8,
  },
  statBadge: {
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  userInfo: {
    fontSize: 14,
  },
  logoutBtn: {
    padding: "6px 16px",
    border: "1px solid rgba(255,255,255,0.5)",
    borderRadius: 6,
    backgroundColor: "transparent",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  errorBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 24px",
    backgroundColor: "#ffebee",
    color: "#c62828",
    fontSize: 13,
  },
  successBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 24px",
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
    fontSize: 13,
  },
  closeBtn: {
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 24px",
    backgroundColor: "#fff",
    borderBottom: "1px solid #e0e0e0",
  },
  filterRow: {
    display: "flex",
    gap: 8,
  },
  actionRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  select: {
    padding: "6px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 13,
    backgroundColor: "#fff",
  },
  searchInput: {
    padding: "6px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 13,
    width: 200,
  },
  primaryBtn: {
    padding: "8px 20px",
    backgroundColor: "#1565c0",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  batchGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  batchLabel: {
    fontSize: 12,
    color: "#e65100",
    fontWeight: 600,
  },
  batchBtn: {
    padding: "6px 14px",
    border: "1px solid #1565c0",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#1565c0",
    cursor: "pointer",
    fontSize: 12,
  },
  cancelBtn: {
    padding: "6px 14px",
    border: "1px solid #ccc",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#666",
    cursor: "pointer",
    fontSize: 12,
  },
  mainContent: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  queuePanel: {
    flex: 1,
    overflow: "auto",
    padding: "0 24px",
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    backgroundColor: "#fafafa",
    borderBottom: "2px solid #e0e0e0",
    fontSize: 12,
    fontWeight: 700,
    color: "#555",
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #f0f0f0",
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
  checkboxLabel: {
    width: 36,
    display: "flex",
    justifyContent: "center",
  },
  th: {
    fontSize: 12,
    fontWeight: 700,
  },
  td: {
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  emptyState: {
    textAlign: "center" as const,
    padding: 40,
    color: "#999",
  },
  sidebar: {
    width: 280,
    backgroundColor: "#fff",
    borderLeft: "1px solid #e0e0e0",
    overflow: "auto",
    padding: 16,
  },
  sidebarPlaceholder: {
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    color: "#bbb",
    fontSize: 14,
    textAlign: "center" as const,
    gap: 8,
  },
  sidebarContent: {},
  sidebarTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 12,
    color: "#1a237e",
  },
  sidebarField: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: 13,
    borderBottom: "1px solid #f5f5f5",
  },
  sidebarEvidence: {
    padding: "8px 0",
    borderBottom: "1px solid #f5f5f5",
  },
  sidebarEvidenceType: {
    display: "inline-block",
    padding: "1px 8px",
    borderRadius: 6,
    backgroundColor: "#e3f2fd",
    color: "#1565c0",
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 4,
  },
  sidebarEvidenceDesc: {
    display: "block",
    fontSize: 12,
    color: "#666",
  },
  sidebarAction: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    padding: "4px 0",
    color: "#666",
  },
  detailOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  detailModal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "90%",
    maxWidth: 900,
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column" as const,
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  createModal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    width: "90%",
    maxWidth: 600,
    maxHeight: "85vh",
    overflow: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    borderBottom: "1px solid #e0e0e0",
  },
  closeModalBtn: {
    border: "none",
    background: "none",
    fontSize: 20,
    cursor: "pointer",
    color: "#999",
  },
  detailBody: {
    flex: 1,
    overflow: "auto",
    padding: "24px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 16,
  },
  detailField: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1a237e",
    marginTop: 20,
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  supplementCount: {
    fontSize: 12,
    padding: "1px 8px",
    borderRadius: 8,
    backgroundColor: "#fff3e0",
    color: "#e65100",
    fontWeight: 600,
  },
  emptyText: {
    color: "#999",
    fontSize: 13,
    textAlign: "center" as const,
    padding: 16,
  },
  evidenceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  evidenceIcon: {
    fontSize: 24,
  },
  evidenceInfo: {
    flex: 1,
  },
  supplementList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  supplementCard: {
    padding: 12,
    backgroundColor: "#fafafa",
    borderRadius: 8,
    border: "1px solid #e0e0e0",
  },
  supplementHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  supplementMeta: {
    fontSize: 11,
    color: "#999",
  },
  supplementContent: {
    fontSize: 13,
    marginBottom: 4,
  },
  supplementReason: {
    fontSize: 12,
    color: "#e65100",
  },
  timeline: {
    position: "relative" as const,
    paddingLeft: 20,
  },
  timelineItem: {
    display: "flex",
    marginBottom: 16,
    position: "relative" as const,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    backgroundColor: "#1565c0",
    position: "absolute" as const,
    left: -20,
    top: 4,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 8,
  },
  timelineHeader: {
    display: "flex",
    gap: 12,
    fontSize: 13,
    alignItems: "center",
  },
  timelineActor: {
    fontWeight: 600,
  },
  timelineAction: {
    color: "#1565c0",
  },
  timelineStatus: {
    color: "#888",
    fontSize: 12,
  },
  timelineComment: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
  timelineTime: {
    fontSize: 11,
    color: "#aaa",
    marginTop: 2,
  },
  detailFooter: {
    display: "flex",
    gap: 8,
    padding: "16px 24px",
    borderTop: "1px solid #e0e0e0",
    alignItems: "center",
  },
  actionBtn: {
    padding: "8px 20px",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  commentInput: {
    flex: 1,
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 13,
  },
  smallBtn: {
    padding: "4px 12px",
    fontSize: 12,
    border: "1px solid #1565c0",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#1565c0",
    cursor: "pointer",
    marginTop: 8,
  },
  formGroup: {
    marginBottom: 14,
  },
  formRow: {
    display: "flex",
    gap: 12,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 13,
  },
  modalActions: {
    display: "flex",
    gap: 12,
    marginTop: 20,
  },
  errorBox: {
    marginTop: 16,
    padding: "12px 16px",
    backgroundColor: "#ffebee",
    color: "#c62828",
    borderRadius: 8,
    fontSize: 13,
  },
};
