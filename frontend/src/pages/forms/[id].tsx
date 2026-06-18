import { createSignal, onMount, Show, createEffect } from "solid-js";
import { useParams, useNavigate, A } from "@solidjs/router";
import { useAuth } from "~/lib/auth";
import { apiFetch, statusLabel, statusClass, formatDateTime, shiftMap } from "~/lib/api";

interface FormDetail {
  id: string;
  form_no: string;
  corporate_id: string;
  corporate_name: string;
  year: number;
  status: string;
  registrant_id: string;
  registrant_name: string;
  auditor_id: string | null;
  auditor_name: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  current_handover_id: string | null;
  business_license: string | null;
  annual_report: string | null;
  tax_certificate: string | null;
  other_materials: string | null;
  audit_opinion: string | null;
  review_opinion: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  audited_at: string | null;
  reviewed_at: string | null;
  archived_at: string | null;
}

interface HandoverRecord {
  id: string;
  form_id: string;
  shift: string;
  handover_person_id: string;
  handover_person_name: string;
  receiver_person_id: string;
  receiver_person_name: string;
  confirm_time: string | null;
  remark: string | null;
  created_at: string;
  is_confirmed: boolean;
}

interface LogItem {
  id: string;
  form_id: string | null;
  form_no: string | null;
  operator_id: string;
  operator_name: string;
  action: string;
  action_display: string;
  detail: string | null;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  role: string;
  username: string;
}

export default function FormDetail() {
  const params = useParams();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = createSignal<FormDetail | null>(null);
  const [handovers, setHandovers] = createSignal<HandoverRecord[]>([]);
  const [logs, setLogs] = createSignal<LogItem[]>([]);
  const [users, setUsers] = createSignal<User[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [success, setSuccess] = useState("");

  const [showHandoverModal, setShowHandoverModal] = createSignal(false);
  const [handoverShift, setHandoverShift] = createSignal("");
  const [handoverReceiver, setHandoverReceiver] = createSignal("");
  const [handoverRemark, setHandoverRemark] = createSignal("");
  const [handoverLoading, setHandoverLoading] = createSignal(false);
  const [handoverError, setHandoverError] = createSignal("");

  const [showAuditModal, setShowAuditModal] = createSignal(false);
  const [auditPass, setAuditPass] = createSignal(true);
  const [auditOpinion, setAuditOpinion] = createSignal("");
  const [auditLoading, setAuditLoading] = createSignal(false);
  const [auditError, setAuditError] = useState("");

  const [showReviewModal, setShowReviewModal] = createSignal(false);
  const [reviewPass, setReviewPass] = createSignal(true);
  const [reviewOpinion, setReviewOpinion] = createSignal("");
  const [reviewLoading, setReviewLoading] = createSignal(false);
  const [reviewError, setReviewError] = useState("");

  const [showEditModal, setShowEditModal] = createSignal(false);
  const [editForm, setEditForm] = createSignal({
    business_license: "",
    annual_report: "",
    tax_certificate: "",
    other_materials: "",
  });
  const [editLoading, setEditLoading] = createSignal(false);
  const [editError, setEditError] = useState("");

  const [confirmHandoverLoading, setConfirmHandoverLoading] = createSignal(false);

  onMount(() => {
    if (!isLoading() && !user()) {
      navigate("/login");
      return;
    }
    if (user()) {
      loadAll();
    }
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadForm(),
        loadHandovers(),
        loadLogs(),
        loadUsers(),
      ]);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadForm = async () => {
    try {
      const data = await apiFetch(`/api/forms/${params.id}`);
      setForm(data);
    } catch (err: any) {
      setError(err.message || "加载失败");
    }
  };

  const loadHandovers = async () => {
    try {
      const data = await apiFetch(`/api/handovers/form/${params.id}`);
      setHandovers(data);
    } catch (err) {
      console.error("Failed to load handovers:", err);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await apiFetch(`/api/logs?form_id=${params.id}&page_size=50`);
      setLogs(data.items || []);
    } catch (err) {
      console.error("Failed to load logs:", err);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await apiFetch("/api/users");
    } catch (err) {
    }
  };

  const canEdit = () => {
    if (!form() || !user()) return false;
    const isDraftOrRejected = ["draft", "audit_rejected", "review_rejected"].includes(form()!.status);
    const isRegistrarAndOwner = user()!.role === "registrar" && form()!.registrant_id === user()!.id;
    return isDraftOrRejected && isRegistrarAndOwner;
  };

  const canSubmit = () => {
    if (!form() || !user()) return false;
    const isDraftOrRejected = ["draft", "audit_rejected", "review_rejected"].includes(form()!.status);
    const isRegistrarAndOwner = user()!.role === "registrar" && form()!.registrant_id === user()!.id;
    return isDraftOrRejected && isRegistrarAndOwner;
  };

  const canAudit = () => {
    if (!form() || !user()) return false;
    return form()!.status === "pending_audit" && user()!.role === "auditor";
  };

  const canReview = () => {
    if (!form() || !user()) return false;
    return form()!.status === "pending_review" && user()!.role === "reviewer";
  };

  const canConfirmHandover = () => {
    if (!form() || !user() || !form()!.current_handover_id) return false;
    const currentHandover = handovers().find(h => h.id === form()!.current_handover_id);
    if (!currentHandover || currentHandover.is_confirmed) return false;
    return currentHandover.receiver_person_id === user()!.id;
  };

  const currentHandover = () => {
    if (!form()?.current_handover_id) return null;
    return handovers().find(h => h.id === form()?.current_handover_id) || null;
  };

  const openHandoverModal = () => {
    setHandoverShift("");
    setHandoverReceiver("");
    setHandoverRemark("");
    setHandoverError("");
    setShowHandoverModal(true);
  };

  const handleSubmitWithHandover = async () => {
    if (!handoverShift()) {
      setHandoverError("请选择班次");
      return;
    }
    if (!handoverReceiver()) {
      setHandoverError("请选择接收人");
      return;
    }

    setHandoverLoading(true);
    setHandoverError("");
    try {
      const data = await apiFetch(`/api/forms/${params.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          shift: handoverShift(),
          receiver_person_id: handoverReceiver(),
          remark: handoverRemark() || null,
        }),
      });
      setForm(data);
      setShowHandoverModal(false);
      setSuccess("提交成功，请等待接收人确认交接");
      setTimeout(() => setSuccess(""), 3000);
      await Promise.all([loadHandovers(), loadLogs()]);
    } catch (err: any) {
      setHandoverError(err.message || "提交失败");
    } finally {
      setHandoverLoading(false);
    }
  };

  const handleConfirmHandover = async () => {
    if (!form()?.current_handover_id) return;

    setConfirmHandoverLoading(true);
    try {
      await apiFetch(`/api/handovers/${form()!.current_handover_id}/confirm`, {
        method: "POST",
      });
      setSuccess("交接确认成功");
      setTimeout(() => setSuccess(""), 3000);
      await Promise.all([loadForm(), loadHandovers(), loadLogs()]);
    } catch (err: any) {
      setError(err.message || "确认失败");
      setTimeout(() => setError(""), 3000);
    } finally {
      setConfirmHandoverLoading(false);
    }
  };

  const openAuditModal = () => {
    setAuditPass(true);
    setAuditOpinion("");
    setAuditError("");
    setShowAuditModal(true);
  };

  const handleAudit = async () => {
    if (!auditPass() && !auditOpinion().trim()) {
      setAuditError("审核退回必须填写意见");
      return;
    }

    setAuditLoading(true);
    setAuditError("");
    try {
      const data = await apiFetch(`/api/forms/${params.id}/audit`, {
        method: "POST",
        body: JSON.stringify({
          pass: auditPass(),
          opinion: auditOpinion() || null,
        }),
      });
      setForm(data);
      setShowAuditModal(false);
      setSuccess(auditPass() ? "审核通过" : "审核退回");
      setTimeout(() => setSuccess(""), 3000);
      await loadLogs();
    } catch (err: any) {
      setAuditError(err.message || "审核失败");
    } finally {
      setAuditLoading(false);
    }
  };

  const openReviewModal = () => {
    setReviewPass(true);
    setReviewOpinion("");
    setReviewError("");
    setShowReviewModal(true);
  };

  const handleReview = async () => {
    if (!reviewPass() && !reviewOpinion().trim()) {
      setReviewError("复核退回必须填写意见");
      return;
    }

    setReviewLoading(true);
    setReviewError("");
    try {
      const data = await apiFetch(`/api/forms/${params.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          pass: reviewPass(),
          opinion: reviewOpinion() || null,
        }),
      });
      setForm(data);
      setShowReviewModal(false);
      setSuccess(reviewPass() ? "复核通过，已归档" : "复核退回");
      setTimeout(() => setSuccess(""), 3000);
      await loadLogs();
    } catch (err: any) {
      setReviewError(err.message || "复核失败");
    } finally {
      setReviewLoading(false);
    }
  };

  const openEditModal = () => {
    setEditForm({
      business_license: form()?.business_license || "",
      annual_report: form()?.annual_report || "",
      tax_certificate: form()?.tax_certificate || "",
      other_materials: form()?.other_materials || "",
    });
    setEditError("");
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    setEditLoading(true);
    setEditError("");
    try {
      const data = await apiFetch(`/api/forms/${params.id}`, {
        method: "PUT",
        body: JSON.stringify(editForm()),
      });
      setForm(data);
      setShowEditModal(false);
      setSuccess("更新成功");
      setTimeout(() => setSuccess(""), 3000);
      await loadLogs();
    } catch (err: any) {
      setEditError(err.message || "更新失败");
    } finally {
      setEditLoading(false);
    }
  };

  const auditorUsers = () => users().filter(u => u.role === "auditor");
  const reviewerUsers = () => users().filter(u => u.role === "reviewer");

  const availableReceivers = () => {
    if (!form()) return [];
    if (form()!.status === "draft" || form()!.status === "audit_rejected" || form()!.status === "review_rejected") {
      return users().filter(u => u.role === "auditor");
    }
    return [];
  };

  return (
    <div>
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <A href="/forms" class="text-sm text-gray-500">← 返回列表</A>
          <h1 class="text-xl font-semibold">年检单详情</h1>
        </div>
        <div class="flex gap-2">
          <Show when={canEdit()}>
            <button class="btn btn-secondary" onClick={openEditModal}>编辑</button>
          </Show>
          <Show when={canSubmit()}>
            <button class="btn btn-primary" onClick={openHandoverModal}>提交审核</button>
          </Show>
          <Show when={canConfirmHandover()}>
            <button class="btn btn-success" onClick={handleConfirmHandover} disabled={confirmHandoverLoading()}>
              {confirmHandoverLoading() ? "确认中..." : "确认交接"}
            </button>
          </Show>
          <Show when={canAudit()}>
            <button class="btn btn-primary" onClick={openAuditModal}>审核</button>
          </Show>
          <Show when={canReview()}>
            <button class="btn btn-primary" onClick={openReviewModal}>复核归档</button>
          </Show>
        </div>
      </div>

      <Show when={error()}>
        <div class="alert alert-error mb-4">{error()}</div>
      </Show>
      <Show when={success()}>
        <div class="alert alert-success mb-4">{success()}</div>
      </Show>

      <Show when={loading()}>
        <div class="text-center py-8 text-gray-500">加载中...</div>
      </Show>

      <Show when={form() && !loading()}>
        <div class="grid grid-3 gap-4">
          <div class="col-span-2">
            <div class="card mb-4">
              <div class="card-header flex justify-between items-center">
                <span>基本信息</span>
                <span class={`badge ${statusClass(form()!.status)}`}>
                  {statusLabel(form()!.status)}
                </span>
              </div>
              <div class="card-body">
                <div class="grid grid-2 gap-4">
                  <div>
                    <div class="text-sm text-gray-500 mb-1">年检单号</div>
                    <div class="font-medium">{form()!.form_no}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500 mb-1">年检年度</div>
                    <div class="font-medium">{form()!.year}年</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500 mb-1">企业名称</div>
                    <div class="font-medium">{form()!.corporate_name}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500 mb-1">登记人</div>
                    <div class="font-medium">{form()!.registrant_name}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500 mb-1">审核人</div>
                    <div class="font-medium">{form()!.auditor_name || "-"}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500 mb-1">复核人</div>
                    <div class="font-medium">{form()!.reviewer_name || "-"}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500 mb-1">创建时间</div>
                    <div class="font-medium text-sm">{formatDateTime(form()!.created_at)}</div>
                  </div>
                  <div>
                    <div class="text-sm text-gray-500 mb-1">提交时间</div>
                    <div class="font-medium text-sm">{form()!.submitted_at ? formatDateTime(form()!.submitted_at!) : "-"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card mb-4">
              <div class="card-header">年检资料</div>
              <div class="card-body">
                <div class="grid grid-2 gap-4">
                  <div class="form-group">
                    <div class="text-sm text-gray-500 mb-1">营业执照</div>
                    <div class="p-3 bg-gray-50 rounded text-sm min-h-[60px]">
                      {form()!.business_license || "暂无"}
                    </div>
                  </div>
                  <div class="form-group">
                    <div class="text-sm text-gray-500 mb-1">年度报告</div>
                    <div class="p-3 bg-gray-50 rounded text-sm min-h-[60px]">
                      {form()!.annual_report || "暂无"}
                    </div>
                  </div>
                  <div class="form-group">
                    <div class="text-sm text-gray-500 mb-1">税务证明</div>
                    <div class="p-3 bg-gray-50 rounded text-sm min-h-[60px]">
                      {form()!.tax_certificate || "暂无"}
                    </div>
                  </div>
                  <div class="form-group">
                    <div class="text-sm text-gray-500 mb-1">其他资料</div>
                    <div class="p-3 bg-gray-50 rounded text-sm min-h-[60px]">
                      {form()!.other_materials || "暂无"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Show when={form()!.audit_opinion || form()!.audited_at}>
              <div class="card mb-4">
                <div class="card-header">审核意见</div>
                <div class="card-body">
                  <div class="p-3 bg-gray-50 rounded text-sm">
                    {form()!.audit_opinion || "无"}
                  </div>
                  <div class="text-xs text-gray-500 mt-2">
                    审核时间：{form()!.audited_at ? formatDateTime(form()!.audited_at!) : "-"}
                  </div>
                </div>
              </div>
            </Show>

            <Show when={form()!.review_opinion || form()!.reviewed_at}>
              <div class="card mb-4">
                <div class="card-header">复核意见</div>
                <div class="card-body">
                  <div class="p-3 bg-gray-50 rounded text-sm">
                    {form()!.review_opinion || "无"}
                  </div>
                  <div class="text-xs text-gray-500 mt-2">
                    复核时间：{form()!.reviewed_at ? formatDateTime(form()!.reviewed_at!) : "-"}
                  </div>
                </div>
              </div>
            </Show>

            <div class="card">
              <div class="card-header">交接记录</div>
              <div class="card-body">
                <Show when={handovers().length > 0} fallback={
                  <div class="text-center py-4 text-gray-500 text-sm">暂无交接记录</div>
                }>
                  <div class="space-y-3">
                    {handovers().map((handover) => (
                      <div class="p-3 border border-gray-200 rounded-lg">
                        <div class="flex justify-between items-start mb-2">
                          <div>
                            <span class={`badge ${handover.is_confirmed ? "badge-green" : "badge-yellow"}`}>
                              {handover.is_confirmed ? "已确认" : "待确认"}
                            </span>
                            <span class="ml-2 text-sm font-medium">
                              {shiftMap[handover.shift] || handover.shift}
                            </span>
                          </div>
                          <div class="text-xs text-gray-500">
                            {formatDateTime(handover.created_at)}
                          </div>
                        </div>
                        <div class="grid grid-2 gap-2 text-sm">
                          <div>
                            <span class="text-gray-500">交出人：</span>
                            <span>{handover.handover_person_name}</span>
                          </div>
                          <div>
                            <span class="text-gray-500">接收人：</span>
                            <span>{handover.receiver_person_name}</span>
                          </div>
                        </div>
                        <Show when={handover.remark}>
                          <div class="text-sm mt-2">
                            <span class="text-gray-500">备注：</span>
                            <span>{handover.remark}</span>
                          </div>
                        </Show>
                        <Show when={handover.confirm_time}>
                          <div class="text-xs text-gray-500 mt-2">
                            确认时间：{formatDateTime(handover.confirm_time!)}
                          </div>
                        </Show>
                      </div>
                    ))}
                  </div>
                </Show>
              </div>
            </div>
          </div>

          <div>
            <div class="card">
              <div class="card-header">操作日志</div>
              <div class="card-body p-0">
                <Show when={logs().length > 0} fallback={
                  <div class="text-center py-4 text-gray-500 text-sm">暂无操作日志</div>
                }>
                  <div class="timeline p-4">
                    {logs().map((log) => (
                      <div class="timeline-item">
                        <div class="timeline-action">{log.action_display}</div>
                        <div class="timeline-time">{formatDateTime(log.created_at)}</div>
                        <div class="timeline-detail">操作人：{log.operator_name}</div>
                        <Show when={log.detail}>
                          <div class="timeline-detail">{log.detail}</div>
                        </Show>
                      </div>
                    ))}
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </div>

        <Show when={showHandoverModal()}>
          <div class="modal-overlay" onClick={() => setShowHandoverModal(false)}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <span>提交审核 - 交接确认</span>
                <button onClick={() => setShowHandoverModal(false)} class="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleSubmitWithHandover(); }}>
                <div class="modal-body">
                  <Show when={handoverError()}>
                    <div class="alert alert-error mb-4">{handoverError()}</div>
                  </Show>
                  <div class="alert alert-info mb-4">
                    提交审核前需完成跨班组交接，请填写交接信息。
                  </div>
                  <div class="form-group">
                    <label class="form-label required">班次</label>
                    <select
                      class="form-select"
                      value={handoverShift()}
                      onChange={(e) => setHandoverShift(e.target.value)}
                      required
                    >
                      <option value="">请选择班次</option>
                      <option value="morning">早班</option>
                      <option value="afternoon">午班</option>
                      <option value="night">夜班</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label required">接收人</label>
                    <select
                      class="form-select"
                      value={handoverReceiver()}
                      onChange={(e) => setHandoverReceiver(e.target.value)}
                      required
                    >
                      <option value="">请选择接收人</option>
                      <option value="auditor1">王审核</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">备注</label>
                    <textarea
                      class="form-textarea"
                      value={handoverRemark()}
                      onInput={(e) => setHandoverRemark(e.target.value)}
                      placeholder="请输入交接备注（可选）"
                      rows={3}
                    />
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" onClick={() => setShowHandoverModal(false)}>
                    取消
                  </button>
                  <button type="submit" class="btn btn-primary" disabled={handoverLoading()}>
                    {handoverLoading() ? "提交中..." : "提交审核"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Show>

        <Show when={showEditModal()}>
          <div class="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <span>编辑年检单</span>
                <button onClick={() => setShowEditModal(false)} class="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleEdit(); }}>
                <div class="modal-body">
                  <Show when={editError()}>
                    <div class="alert alert-error mb-4">{editError()}</div>
                  </Show>
                  <div class="form-group">
                    <label class="form-label">营业执照</label>
                    <textarea
                      class="form-textarea"
                      value={editForm().business_license}
                      onInput={(e) => setEditForm({ ...editForm(), business_license: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">年度报告</label>
                    <textarea
                      class="form-textarea"
                      value={editForm().annual_report}
                      onInput={(e) => setEditForm({ ...editForm(), annual_report: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">税务证明</label>
                    <textarea
                      class="form-textarea"
                      value={editForm().tax_certificate}
                      onInput={(e) => setEditForm({ ...editForm(), tax_certificate: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">其他资料</label>
                    <textarea
                      class="form-textarea"
                      value={editForm().other_materials}
                      onInput={(e) => setEditForm({ ...editForm(), other_materials: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                    取消
                  </button>
                  <button type="submit" class="btn btn-primary" disabled={editLoading()}>
                    {editLoading() ? "保存中..." : "保存"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Show>

        <Show when={showAuditModal()}>
          <div class="modal-overlay" onClick={() => setShowAuditModal(false)}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <span>审核年检单</span>
                <button onClick={() => setShowAuditModal(false)} class="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleAudit(); }}>
                <div class="modal-body">
                  <Show when={auditError()}>
                    <div class="alert alert-error mb-4">{auditError()}</div>
                  </Show>
                  <div class="form-group">
                    <label class="form-label required">审核结果</label>
                    <div class="flex gap-4">
                      <label class="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={auditPass()}
                          onChange={() => setAuditPass(true)}
                        />
                        <span>通过</span>
                      </label>
                      <label class="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={!auditPass()}
                          onChange={() => setAuditPass(false)}
                        />
                        <span>退回</span>
                      </label>
                    </div>
                  </div>
                  <div class="form-group">
                    <label class={`form-label ${!auditPass() ? "required" : ""}`}>审核意见</label>
                    <textarea
                      class="form-textarea"
                      value={auditOpinion()}
                      onInput={(e) => setAuditOpinion(e.target.value)}
                      placeholder={!auditPass() ? "请填写退回原因" : "请输入审核意见（可选）"}
                      rows={4}
                    />
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" onClick={() => setShowAuditModal(false)}>
                    取消
                  </button>
                  <button type="submit" class={`btn ${auditPass() ? "btn-success" : "btn-danger"}`} disabled={auditLoading()}>
                    {auditLoading() ? "提交中..." : (auditPass() ? "通过" : "退回")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Show>

        <Show when={showReviewModal()}>
          <div class="modal-overlay" onClick={() => setShowReviewModal(false)}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <span>复核年检单</span>
                <button onClick={() => setShowReviewModal(false)} class="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleReview(); }}>
                <div class="modal-body">
                  <Show when={reviewError()}>
                    <div class="alert alert-error mb-4">{reviewError()}</div>
                  </Show>
                  <div class="form-group">
                    <label class="form-label required">复核结果</label>
                    <div class="flex gap-4">
                      <label class="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={reviewPass()}
                          onChange={() => setReviewPass(true)}
                        />
                        <span>通过归档</span>
                      </label>
                      <label class="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={!reviewPass()}
                          onChange={() => setReviewPass(false)}
                        />
                        <span>退回</span>
                      </label>
                    </div>
                  </div>
                  <div class="form-group">
                    <label class={`form-label ${!reviewPass() ? "required" : ""}`}>复核意见</label>
                    <textarea
                      class="form-textarea"
                      value={reviewOpinion()}
                      onInput={(e) => setReviewOpinion(e.target.value)}
                      placeholder={!reviewPass() ? "请填写退回原因" : "请输入复核意见（可选）"}
                      rows={4}
                    />
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" onClick={() => setShowReviewModal(false)}>
                    取消
                  </button>
                  <button type="submit" class={`btn ${reviewPass() ? "btn-success" : "btn-danger"}`} disabled={reviewLoading()}>
                    {reviewLoading() ? "提交中..." : (reviewPass() ? "通过归档" : "退回")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}

function useState(initial: string) {
  const [value, setValue] = createSignal(initial);
  return [value, setValue] as const;
}
