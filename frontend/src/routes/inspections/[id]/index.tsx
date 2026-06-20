// ============================================================
// Inspection Order Detail Page
// The hub for handling, review, returns, risk changes, fault reports, recovery
// All forms match the backend request schemas 1:1
// ============================================================

import { component$, useStore, $, useTask$, useVisibleTask$ } from "@builder.io/qwik";
import { useNavigate, routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import api from "~/services/api";
import { useCurrentUser, useRefreshSignal } from "~/state/app";
import type {
  InspectionOrderDetail,
  InspectionOrderHandleRequest,
  InspectionOrderReviewRequest,
  InspectionOrderReturnRequest,
  FaultReportCreateRequest,
  RecoveryConfirmCreateRequest,
  RiskLevelChangeRequest,
  CheckItemValue,
  RiskLevel,
  OperationRecord,
} from "~/types";
import {
  StatusBadge,
  RiskBadge,
  ResultBadge,
  OperationBadge,
} from "~/components/Badges";
import {
  formatDate,
  formatShortDate,
  riskLabels,
  operationLabels,
  checkItems,
  canHandle,
  canReview,
  statusLabels,
  riskColors,
} from "~/utils/format";

type TabKey =
  | "info"
  | "handle"
  | "review"
  | "risk"
  | "fault"
  | "records";

// ---------- Load the order via routeLoader$ ----------
export const useOrderLoader = routeLoader$(async (event) => {
  const id = Number(event.params.id);
  if (!id || isNaN(id)) return null;
  try {
    const res = await api.getInspectionDetail(id);
    return res.success ? res.data : null;
  } catch {
    return null;
  }
});

export const head: DocumentHead = ({ resolveValue }) => {
  const order = resolveValue(useOrderLoader);
  return {
    title: order
      ? `巡检单 ${order.order_no} - 器械巡检管理系统`
      : "巡检单详情",
  };
};

// ---------- Main Component ----------
export default component$(() => {
  const nav = useNavigate();
  const userCtx = useCurrentUser();
  const refreshSig = useRefreshSignal();
  const loaderOrder = useOrderLoader();

  const state = useStore<{
    detail: InspectionOrderDetail | null;
    activeTab: TabKey;
    loading: boolean;
    submitting: boolean;
    error: string | null;
    flash: string | null;
    // Handle form state
    handleForm: {
      appearance_check: CheckItemValue;
      appearance_evidence: string;
      appearance_remark: string;
      function_check: CheckItemValue;
      function_evidence: string;
      function_remark: string;
      safety_check: CheckItemValue;
      safety_evidence: string;
      safety_remark: string;
      maintenance_check: CheckItemValue;
      maintenance_evidence: string;
      maintenance_remark: string;
      handler_opinion: string;
      handler_result: "normal" | "abnormal";
      new_risk_level: RiskLevel | "";
      risk_change_reason: string;
    };
    // Review form
    reviewForm: {
      reviewer_opinion: string;
      reviewer_result: "normal" | "abnormal";
      is_approved: boolean;
    };
    // Return form
    returnForm: {
      opinion: string;
    };
    // Risk change form
    riskForm: {
      new_risk_level: RiskLevel | "";
      reason: string;
    };
    // Fault form
    faultForm: {
      fault_description: string;
      fault_level: RiskLevel;
      selected_fault_for_recovery: number | null;
    };
    // Recovery form
    recoveryForm: {
      confirmation_remark: string;
      is_successful: boolean;
      evidence_path: string;
    };
  }>({
    detail: null,
    activeTab: "info",
    loading: true,
    submitting: false,
    error: null,
    flash: null,
    handleForm: {
      appearance_check: true,
      appearance_evidence: "",
      appearance_remark: "",
      function_check: true,
      function_evidence: "",
      function_remark: "",
      safety_check: true,
      safety_evidence: "",
      safety_remark: "",
      maintenance_check: true,
      maintenance_evidence: "",
      maintenance_remark: "",
      handler_opinion: "",
      handler_result: "normal",
      new_risk_level: "",
      risk_change_reason: "",
    },
    reviewForm: {
      reviewer_opinion: "",
      reviewer_result: "normal",
      is_approved: true,
    },
    returnForm: {
      opinion: "",
    },
    riskForm: {
      new_risk_level: "",
      reason: "",
    },
    faultForm: {
      fault_description: "",
      fault_level: "medium",
      selected_fault_for_recovery: null,
    },
    recoveryForm: {
      confirmation_remark: "",
      is_successful: true,
      evidence_path: "",
    },
  });

  // ---------- Helpers ----------
  const loadDetail = $(async () => {
    const id = loaderOrder.value?.id ?? Number(location.pathname.match(/inspections\/(\d+)/)?.[1] ?? 0);
    if (!id) return;
    state.loading = true;
    state.error = null;
    try {
      const res = await api.getInspectionDetail(id);
      if (res.success && res.data) {
        state.detail = res.data;
        // Sync handle form defaults from detail
        if (res.data.appearance_check !== undefined)
          state.handleForm.appearance_check = res.data.appearance_check;
        if (res.data.appearance_evidence)
          state.handleForm.appearance_evidence = res.data.appearance_evidence;
        if (res.data.appearance_remark)
          state.handleForm.appearance_remark = res.data.appearance_remark;
        if (res.data.function_check !== undefined)
          state.handleForm.function_check = res.data.function_check;
        if (res.data.function_evidence)
          state.handleForm.function_evidence = res.data.function_evidence;
        if (res.data.function_remark)
          state.handleForm.function_remark = res.data.function_remark;
        if (res.data.safety_check !== undefined)
          state.handleForm.safety_check = res.data.safety_check;
        if (res.data.safety_evidence)
          state.handleForm.safety_evidence = res.data.safety_evidence;
        if (res.data.safety_remark)
          state.handleForm.safety_remark = res.data.safety_remark;
        if (res.data.maintenance_check !== undefined)
          state.handleForm.maintenance_check = res.data.maintenance_check;
        if (res.data.maintenance_evidence)
          state.handleForm.maintenance_evidence = res.data.maintenance_evidence;
        if (res.data.maintenance_remark)
          state.handleForm.maintenance_remark = res.data.maintenance_remark;
      } else {
        state.error = res.message || "加载失败";
      }
    } catch (e) {
      state.error = "加载失败：" + (e as Error).message;
    } finally {
      state.loading = false;
    }
  });

  useTask$(async ({ track }) => {
    track(() => refreshSig.tick);
    track(() => userCtx.user?.id);
    track(() => loaderOrder.value);
    if (loaderOrder.value) {
      state.detail = loaderOrder.value;
      state.loading = false;
    } else {
      await loadDetail();
    }
  });

  // Clear flash after a delay
  useVisibleTask$(({ track }) => {
    track(() => state.flash);
    if (state.flash) {
      const t = setTimeout(() => (state.flash = null), 3500);
      return () => clearTimeout(t);
    }
  });

  const order = state.detail;

  // Role-based UI state
  const isHandler = userCtx.user?.role === "handler";
  const isReviewer = userCtx.user?.role === "reviewer";
  const canHandleForm =
    order && isHandler && canHandle(order.status);
  const canReviewForm =
    order && isReviewer && canReview(order.status);
  const canReturnForm =
    order && isReviewer && canReview(order.status);
  const canChangeRisk =
    order && (isHandler || isReviewer) && order.status !== "archived";

  // ---------- Submit Handlers ----------
  const onSubmitHandle = $(async () => {
    if (!order || !userCtx.user) return;
    state.submitting = true;
    state.error = null;
    try {
      const body: InspectionOrderHandleRequest = {
        version: order.version,
        handler_opinion: state.handleForm.handler_opinion,
        handler_result: state.handleForm.handler_result,
        appearance_check: state.handleForm.appearance_check,
        appearance_evidence: state.handleForm.appearance_evidence || undefined,
        appearance_remark: state.handleForm.appearance_remark || undefined,
        function_check: state.handleForm.function_check,
        function_evidence: state.handleForm.function_evidence || undefined,
        function_remark: state.handleForm.function_remark || undefined,
        safety_check: state.handleForm.safety_check,
        safety_evidence: state.handleForm.safety_evidence || undefined,
        safety_remark: state.handleForm.safety_remark || undefined,
        maintenance_check: state.handleForm.maintenance_check,
        maintenance_evidence: state.handleForm.maintenance_evidence || undefined,
        maintenance_remark: state.handleForm.maintenance_remark || undefined,
      };
      if (state.handleForm.new_risk_level) {
        body.new_risk_level = state.handleForm.new_risk_level;
        body.risk_change_reason = state.handleForm.risk_change_reason;
      }
      const res = await api.handleInspection(order.id, body, userCtx.user.id);
      if (res.success && res.data) {
        state.detail = res.data;
        state.flash = "✅ 办理成功，已提交到待复核";
        state.activeTab = "info";
        refreshSig.bump();
      } else {
        state.error = res.message;
      }
    } catch (e) {
      state.error = (e as Error).message;
    } finally {
      state.submitting = false;
    }
  });

  const onSubmitReview = $(async (isApprove: boolean) => {
    if (!order || !userCtx.user) return;
    state.submitting = true;
    state.error = null;
    try {
      if (isApprove) {
        const body: InspectionOrderReviewRequest = {
          version: order.version,
          reviewer_opinion: state.reviewForm.reviewer_opinion,
          reviewer_result: state.reviewForm.reviewer_result,
          is_approved: true,
        };
        const res = await api.reviewInspection(order.id, body, userCtx.user.id);
        if (res.success && res.data) {
          state.detail = res.data;
          state.flash = "✅ 复核通过，已归档";
          state.activeTab = "info";
          refreshSig.bump();
        } else state.error = res.message;
      } else {
        // Return
        const body: InspectionOrderReturnRequest = {
          version: order.version,
          opinion: state.returnForm.opinion,
        };
        const res = await api.returnInspection(order.id, body, userCtx.user.id);
        if (res.success && res.data) {
          state.detail = res.data;
          state.flash = "↩️ 已退回给办理人补正";
          state.activeTab = "info";
          refreshSig.bump();
        } else state.error = res.message;
      }
    } catch (e) {
      state.error = (e as Error).message;
    } finally {
      state.submitting = false;
    }
  });

  const onChangeRisk = $(async () => {
    if (!order || !userCtx.user) return;
    if (!state.riskForm.new_risk_level) {
      state.error = "请选择目标风险等级";
      return;
    }
    if (!state.riskForm.reason.trim()) {
      state.error = "请填写变更原因";
      return;
    }
    state.submitting = true;
    state.error = null;
    try {
      const body: RiskLevelChangeRequest = {
        version: order.version,
        new_risk_level: state.riskForm.new_risk_level,
        reason: state.riskForm.reason,
      };
      const res = await api.changeRiskLevel(order.id, body, userCtx.user.id);
      if (res.success && res.data) {
        state.detail = res.data;
        state.flash = `⚠️ 风险已变更为 ${riskLabels[res.data.risk_level]}`;
        state.riskForm.reason = "";
        refreshSig.bump();
      } else state.error = res.message;
    } catch (e) {
      state.error = (e as Error).message;
    } finally {
      state.submitting = false;
    }
  });

  const onSubmitFault = $(async () => {
    if (!order || !userCtx.user) return;
    if (!state.faultForm.fault_description.trim()) {
      state.error = "请填写故障描述";
      return;
    }
    state.submitting = true;
    state.error = null;
    try {
      const body: FaultReportCreateRequest = {
        inspection_order_id: order.id,
        fault_description: state.faultForm.fault_description,
        fault_level: state.faultForm.fault_level,
        version: order.version,
      };
      const res = await api.createFaultReport(body, userCtx.user.id);
      if (res.success) {
        state.flash = "🔧 故障报修已提交";
        state.faultForm.fault_description = "";
        state.faultForm.fault_level = "medium";
        await loadDetail();
        refreshSig.bump();
      } else state.error = res.message;
    } catch (e) {
      state.error = (e as Error).message;
    } finally {
      state.submitting = false;
    }
  });

  const onSubmitRecovery = $(async (faultId: number) => {
    if (!order || !userCtx.user) return;
    if (!state.recoveryForm.confirmation_remark.trim()) {
      state.error = "请填写恢复确认说明";
      return;
    }
    state.submitting = true;
    state.error = null;
    try {
      const body: RecoveryConfirmCreateRequest = {
        fault_report_id: faultId,
        inspection_order_id: order.id,
        confirmation_remark: state.recoveryForm.confirmation_remark,
        is_successful: state.recoveryForm.is_successful,
        evidence_path: state.recoveryForm.evidence_path || undefined,
        version: order.version,
      };
      const res = await api.confirmRecovery(body, userCtx.user.id);
      if (res.success) {
        state.flash = "✅ 恢复确认已完成";
        state.faultForm.selected_fault_for_recovery = null;
        state.recoveryForm.confirmation_remark = "";
        state.recoveryForm.evidence_path = "";
        await loadDetail();
        refreshSig.bump();
      } else state.error = res.message;
    } catch (e) {
      state.error = (e as Error).message;
    } finally {
      state.submitting = false;
    }
  });

  // ---------- Tabs ----------
  const tabList: { key: TabKey; label: string; icon: string; showBadge?: number }[] = [
    { key: "info", label: "基本信息", icon: "📄" },
    ...(canHandleForm ? [{ key: "handle" as TabKey, label: "办理", icon: "🛠️" }] : []),
    ...(canReviewForm ? [{ key: "review" as TabKey, label: "复核归档", icon: "✅" }] : []),
    { key: "risk", label: "风险变更", icon: "⚠️", showBadge: (order?.risk_changes?.length ?? 0) || undefined },
    { key: "fault", label: "故障 / 恢复", icon: "🔧", showBadge: (order?.fault_reports?.length ?? 0) || undefined },
    { key: "records", label: "操作记录", icon: "📋", showBadge: (order?.operation_records?.length ?? 0) || undefined },
  ];

  // ---------- Render ----------
  if (state.loading && !state.detail) {
    return (
      <div class="card text-center py-16 text-gray-500">加载巡检单详情中...</div>
    );
  }

  if (!state.detail) {
    return (
      <div>
        <div class="mb-3">
          <a href="/inspections" class="text-sm text-blue-600 hover:underline">
            ← 返回列表
          </a>
        </div>
        <div class="card text-center py-16 text-red-600">
          {state.error || "巡检单不存在或已被删除"}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div class="mb-4 flex items-center justify-between">
        <a href="/inspections" class="text-sm text-blue-600 hover:underline">
          ← 返回列表
        </a>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <span>🔑 v{order.version}</span>
          <span>·</span>
          <span>最后更新 {formatDate(order.updated_at)}</span>
        </div>
      </div>

      {/* Flash message */}
      {state.flash && (
        <div class="mb-4 p-3 rounded bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
          {state.flash}
        </div>
      )}
      {state.error && (
        <div class="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm">
          ⛔ {state.error}
        </div>
      )}

      {/* Header banner */}
      <div
        class={`card mb-5 border-l-8 ${
          order.risk_level === "high"
            ? "border-red-500"
            : order.risk_level === "medium"
            ? "border-yellow-400"
            : "border-green-400"
        }`}
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex-1 min-w-[320px]">
            <div class="flex flex-wrap items-center gap-3 mb-3">
              <h1 class="text-2xl font-bold text-gray-800">{order.order_no}</h1>
              <StatusBadge status={order.status} withDot />
              <RiskBadge level={order.risk_level} showIcon size="md" />
              <ResultBadge result={order.inspection_result} />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span class="text-gray-500">器械：</span>
                <span class="font-semibold text-gray-800">
                  {order.equipment_name}
                </span>
                <span class="ml-2 text-xs text-gray-500">
                  [{order.equipment_code}]
                </span>
              </div>
              <div>
                <span class="text-gray-500">规格型号：</span>
                <span class="text-gray-700">
                  {order.equipment_model || order.equipment_specification || "-"}
                </span>
              </div>
              <div>
                <span class="text-gray-500">所在区域：</span>
                <span class="text-gray-700">{order.equipment_location}</span>
              </div>
              <div>
                <span class="text-gray-500">放置位置：</span>
                <span class="text-gray-700">{order.location_detail || "-"}</span>
              </div>
              <div>
                <span class="text-gray-500">巡检日期：</span>
                <span class="text-gray-700">
                  {formatShortDate(order.inspection_date)}
                </span>
              </div>
              <div>
                <span class="text-gray-500">截止日期：</span>
                <span
                  class={
                    order.due_date && new Date(order.due_date) < new Date()
                      ? "text-red-700 font-bold"
                      : "text-gray-700"
                  }
                >
                  {formatShortDate(order.due_date)}
                  {order.due_date &&
                    new Date(order.due_date) < new Date() &&
                    " ⏰逾期"}
                </span>
              </div>
              <div>
                <span class="text-gray-500">巡检员：</span>
                <span class="text-gray-700">{order.inspector_name}</span>
              </div>
              <div>
                <span class="text-gray-500">办理员：</span>
                <span class="text-gray-700">{order.handler_name}</span>
              </div>
              <div>
                <span class="text-gray-500">复核员：</span>
                <span class="text-gray-700">{order.reviewer_name}</span>
              </div>
              <div>
                <span class="text-gray-500">创建时间：</span>
                <span class="text-gray-700">{formatDate(order.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Stats mini */}
          <div class="grid grid-cols-3 gap-2 w-full md:w-auto">
            <div class="p-3 rounded bg-gray-50 border text-center">
              <div class="text-xl font-bold text-gray-700">
                {order.risk_change_count || 0}
              </div>
              <div class="text-xs text-gray-500">风险变更</div>
            </div>
            <div class="p-3 rounded bg-red-50 border border-red-100 text-center">
              <div class="text-xl font-bold text-red-700">
                {order.fault_report_count || 0}
              </div>
              <div class="text-xs text-gray-500">故障报修</div>
            </div>
            <div class="p-3 rounded bg-green-50 border border-green-100 text-center">
              <div class="text-xl font-bold text-green-700">
                {order.recovery_confirm_count || 0}
              </div>
              <div class="text-xs text-gray-500">恢复确认</div>
            </div>
          </div>
        </div>

        {/* Last handler opinion banner */}
        {(order.last_handler_opinion || order.last_reviewer_opinion) && (
          <div class="mt-5 pt-5 border-t border-gray-200 space-y-3">
            {order.last_handler_opinion && (
              <div class="p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-sm font-bold text-blue-800">
                    📝 上一办理人意见
                  </span>
                  {order.last_handler_result && (
                    <span class="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                      {order.last_handler_result}
                    </span>
                  )}
                </div>
                <div class="text-sm text-gray-800">
                  {order.last_handler_opinion}
                </div>
              </div>
            )}
            {order.last_reviewer_opinion && (
              <div class="p-4 rounded-lg bg-purple-50 border border-purple-100">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-sm font-bold text-purple-800">
                    📝 上一复核员意见
                  </span>
                  {order.last_reviewer_result && (
                    <span class="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                      {order.last_reviewer_result}
                    </span>
                  )}
                </div>
                <div class="text-sm text-gray-800">
                  {order.last_reviewer_opinion}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div class="flex flex-wrap items-center gap-1 mb-4 border-b border-gray-200">
        {tabList.map((t) => {
          const active = state.activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick$={() => (state.activeTab = t.key)}
              class={`px-4 py-2.5 -mb-px border-b-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                active
                  ? "border-blue-500 text-blue-700"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50/60"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
              {t.showBadge && (
                <span class="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                  {t.showBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Info */}
      {state.activeTab === "info" && (
        <div class="space-y-5">
          {/* Check items summary */}
          <div class="card">
            <h2 class="text-lg font-semibold text-gray-800 mb-4">
              🔍 四项检查内容
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checkItems.map((it) => {
                const fieldKey = it.field as
                  | "appearance"
                  | "function"
                  | "safety"
                  | "maintenance";
                const checkVal = (order as any)[`${fieldKey}_check`] as
                  | CheckItemValue
                  | undefined;
                const evidenceVal = (order as any)[`${fieldKey}_evidence`] as
                  | string
                  | undefined;
                const remarkVal = (order as any)[`${fieldKey}_remark`] as
                  | string
                  | undefined;
                return (
                  <div
                    key={it.field}
                    class={`p-4 rounded-lg border ${
                      checkVal === false
                        ? "bg-red-50 border-red-200"
                        : checkVal === true
                        ? "bg-green-50/40 border-green-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div class="flex items-center justify-between mb-3">
                      <div class="font-semibold text-gray-800 flex items-center gap-1.5">
                        <span>{it.icon}</span>
                        {it.label}
                      </div>
                      <span
                        class={`px-2 py-0.5 rounded text-xs font-semibold ${
                          checkVal === false
                            ? "bg-red-100 text-red-800"
                            : checkVal === true
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {checkVal === true
                          ? "✅ 通过"
                          : checkVal === false
                          ? "❌ 不通过"
                          : "未填写"}
                      </span>
                    </div>
                    {remarkVal && (
                      <div class="text-sm text-gray-700 mb-2">
                        <span class="text-gray-500 text-xs">备注：</span>
                        {remarkVal}
                      </div>
                    )}
                    {evidenceVal ? (
                      <div class="text-xs">
                        <span class="text-gray-500">证据：</span>
                        <span class="text-blue-600 break-all">
                          📎 {evidenceVal}
                        </span>
                      </div>
                    ) : (
                      checkVal === false && (
                        <div class="text-xs text-red-600 font-medium mt-1">
                          ⚠️ 缺少证据
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Opinions */}
          {(order.handler_opinion ||
            order.reviewer_opinion ||
            order.inspection_remark) && (
            <div class="card">
              <h2 class="text-lg font-semibold text-gray-800 mb-4">
                💬 各阶段意见
              </h2>
              <div class="space-y-3">
                {order.inspection_remark && (
                  <div class="p-3 rounded bg-gray-50 border border-gray-200">
                    <div class="text-xs font-semibold text-gray-600 mb-1">
                      巡检备注
                    </div>
                    <div class="text-sm text-gray-800">
                      {order.inspection_remark}
                    </div>
                  </div>
                )}
                {order.handler_opinion && (
                  <div class="p-3 rounded bg-blue-50 border border-blue-200">
                    <div class="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-2">
                      办理员意见
                      {order.handler_result && (
                        <span class="bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                          {order.handler_result}
                        </span>
                      )}
                    </div>
                    <div class="text-sm text-gray-800">
                      {order.handler_opinion}
                    </div>
                  </div>
                )}
                {order.reviewer_opinion && (
                  <div class="p-3 rounded bg-purple-50 border border-purple-200">
                    <div class="text-xs font-semibold text-purple-700 mb-1 flex items-center gap-2">
                      复核员意见
                      {order.reviewer_result && (
                        <span class="bg-purple-100 px-1.5 py-0.5 rounded text-[11px]">
                          {order.reviewer_result}
                        </span>
                      )}
                    </div>
                    <div class="text-sm text-gray-800">
                      {order.reviewer_opinion}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recovery confirms */}
          {order.recovery_confirms && order.recovery_confirms.length > 0 && (
            <div class="card">
              <h2 class="text-lg font-semibold text-gray-800 mb-4">
                ✅ 恢复确认记录 ({order.recovery_confirms.length})
              </h2>
              <ul class="space-y-2">
                {order.recovery_confirms.map((r) => (
                  <li
                    key={r.id}
                    class={`p-3 rounded border ${
                      r.is_successful
                        ? "bg-green-50/60 border-green-200"
                        : "bg-orange-50/60 border-orange-200"
                    }`}
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <span
                            class={`text-xs font-semibold ${
                              r.is_successful
                                ? "text-green-700"
                                : "text-orange-700"
                            }`}
                          >
                            {r.is_successful
                              ? "✅ 已成功恢复"
                              : "⚠️ 恢复未成功"}
                          </span>
                          <span class="text-xs text-gray-500">
                            报修单 #{r.fault_report_id}
                          </span>
                        </div>
                        <div class="text-sm text-gray-800">
                          {r.confirmation_remark}
                        </div>
                        {r.evidence_path && (
                          <div class="text-xs text-blue-600 mt-1">
                            📎 证据：{r.evidence_path}
                          </div>
                        )}
                      </div>
                      <div class="text-right">
                        <div class="text-xs text-gray-600">
                          {r.confirmed_by_name}
                        </div>
                        <div class="text-xs text-gray-500">
                          {formatDate(r.confirmed_at)}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab: Handle */}
      {state.activeTab === "handle" && canHandleForm && (
        <div class="card">
          <h2 class="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
            🛠️ 办理巡检单
            <span class="text-sm font-normal text-gray-500">
              · 当前版本 v{order.version}
            </span>
          </h2>

          <div class="space-y-5">
            {/* Four check items */}
            {checkItems.map((it) => {
              const fieldKey = it.field as
                | "appearance"
                | "function"
                | "safety"
                | "maintenance";
              const checkVal = (state.handleForm as any)[
                `${fieldKey}_check`
              ] as CheckItemValue;
              const evidenceVal = (state.handleForm as any)[
                `${fieldKey}_evidence`
              ] as string;
              const needsEvidence = checkVal === false;
              return (
                <div
                  key={it.field}
                  class={`p-4 rounded-lg border ${
                    needsEvidence
                      ? "border-orange-300 bg-orange-50/30"
                      : "border-gray-200 bg-gray-50/30"
                  }`}
                >
                  <div class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span>{it.icon}</span>
                    {it.label}
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        检查结果 <span class="text-red-500">*</span>
                      </label>
                      <select
                        class="form-select"
                        value={checkVal === true ? "1" : checkVal === false ? "0" : ""}
                        onChange$={(e) => {
                          const v = (e.target as HTMLSelectElement).value;
                          (state.handleForm as any)[`${fieldKey}_check`] =
                            v === "1" ? true : v === "0" ? false : null;
                        }}
                      >
                        <option value="1">✅ 通过</option>
                        <option value="0">❌ 不通过</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        证据
                        {needsEvidence && (
                          <span class="text-red-500"> *必填</span>
                        )}
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        placeholder={needsEvidence ? "必填：证据文件路径或链接" : "选填"}
                        value={evidenceVal}
                        onInput$={(e) =>
                          ((state.handleForm as any)[`${fieldKey}_evidence`] = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        备注
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        placeholder="选填"
                        value={(state.handleForm as any)[`${fieldKey}_remark`]}
                        onInput$={(e) =>
                          ((state.handleForm as any)[`${fieldKey}_remark`] = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </div>
                  </div>
                  {needsEvidence && !evidenceVal && (
                    <div class="text-xs text-red-600 font-medium">
                      ⚠️ 不通过时必须提供证据！
                    </div>
                  )}
                </div>
              );
            })}

            {/* Risk change during handle */}
            <div class="p-4 rounded-lg border border-gray-200 bg-gray-50/40">
              <div class="font-semibold text-gray-800 mb-3">
                🎚️ 风险等级变更（选填）
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    变更为
                  </label>
                  <select
                    class="form-select"
                    value={state.handleForm.new_risk_level}
                    onChange$={(e) =>
                      (state.handleForm.new_risk_level = (
                        e.target as HTMLSelectElement
                      ).value as RiskLevel | "")
                    }
                  >
                    <option value="">（不变更）当前：{riskLabels[order.risk_level]}</option>
                    <option value="low">低风险</option>
                    <option value="medium">中风险</option>
                    <option value="high">高风险</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    变更原因
                    {state.handleForm.new_risk_level && (
                      <span class="text-red-500"> *</span>
                    )}
                  </label>
                  <input
                    type="text"
                    class="form-input"
                    placeholder="选填；若选择了新风险等级则必填"
                    value={state.handleForm.risk_change_reason}
                    onInput$={(e) =>
                      (state.handleForm.risk_change_reason = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>
              </div>
            </div>

            {/* Opinion + Result */}
            <div class="p-4 rounded-lg border border-gray-200 bg-gray-50/40">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    办理结果 <span class="text-red-500">*</span>
                  </label>
                  <select
                    class="form-select"
                    value={state.handleForm.handler_result}
                    onChange$={(e) =>
                      (state.handleForm.handler_result = (
                        e.target as HTMLSelectElement
                      ).value as "normal" | "abnormal")
                    }
                  >
                    <option value="normal">正常</option>
                    <option value="abnormal">异常</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    办理意见 <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    class="form-input"
                    placeholder="请填写办理意见"
                    value={state.handleForm.handler_opinion}
                    onInput$={(e) =>
                      (state.handleForm.handler_opinion = (
                        e.target as HTMLInputElement
                      ).value)
                    }
                  />
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div class="text-xs text-gray-500">
                提交后：状态将从{" "}
                <span class="font-semibold text-gray-700">
                  {statusLabels[order.status]}
                </span>{" "}
                →{" "}
                <span class="font-semibold text-purple-700">待复核</span>
                ，版本号会从 v{order.version} → v{order.version + 1}
              </div>
              <div class="flex gap-2">
                <button
                  class="btn btn-outline"
                  onClick$={() => (state.activeTab = "info")}
                  disabled={state.submitting}
                >
                  取消
                </button>
                <button
                  class="btn btn-primary"
                  disabled={state.submitting}
                  onClick$={async () => await onSubmitHandle()}
                >
                  {state.submitting ? "提交中..." : "提交办理"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Review */}
      {state.activeTab === "review" && canReviewForm && (
        <div class="card">
          <h2 class="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
            ✅ 复核归档
            <span class="text-sm font-normal text-gray-500">
              · 当前版本 v{order.version}
            </span>
          </h2>
          <div class="space-y-5">
            <div class="p-4 rounded-lg bg-blue-50/60 border border-blue-200">
              <div class="text-xs font-semibold text-blue-800 mb-1">
                📝 办理员意见（供复核参考）
              </div>
              <div class="flex items-center gap-2 mb-2">
                {order.handler_result && (
                  <span class="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    办理结果：{order.handler_result}
                  </span>
                )}
              </div>
              <div class="text-sm text-gray-800">
                {order.handler_opinion || "（办理员未填写意见）"}
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">
                  复核结果 <span class="text-red-500">*</span>
                </label>
                <select
                  class="form-select"
                  value={state.reviewForm.reviewer_result}
                  onChange$={(e) =>
                    (state.reviewForm.reviewer_result = (
                      e.target as HTMLSelectElement
                    ).value as "normal" | "abnormal")
                  }
                >
                  <option value="normal">正常</option>
                  <option value="abnormal">异常</option>
                </select>
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-gray-600 mb-1">
                  复核意见（归档用）
                </label>
                <input
                  type="text"
                  class="form-input"
                  placeholder="复核意见，归档时必填"
                  value={state.reviewForm.reviewer_opinion}
                  onInput$={(e) =>
                    (state.reviewForm.reviewer_opinion = (
                      e.target as HTMLInputElement
                    ).value)
                  }
                />
              </div>
            </div>

            <div class="p-4 rounded-lg border border-gray-200 bg-gray-50/30">
              <label class="block text-xs font-medium text-gray-600 mb-2">
                退回原因（若退回给办理人补正）
              </label>
              <textarea
                rows={2}
                class="form-input"
                placeholder="退回补正的理由，点击『退回』时使用"
                value={state.returnForm.opinion}
                onInput$={(e) =>
                  (state.returnForm.opinion = (
                    e.target as HTMLTextAreaElement
                  ).value)
                }
              />
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div class="text-xs text-gray-500 space-y-1">
                <div>
                  ✅ 通过归档：v{order.version} → v{order.version + 1}，状态 → 已归档
                </div>
                <div>
                  ↩️ 退回补正：v{order.version} → v{order.version + 1}，状态 → 已退回
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  class="btn btn-outline"
                  onClick$={() => (state.activeTab = "info")}
                  disabled={state.submitting}
                >
                  取消
                </button>
                <button
                  class="btn btn-warning"
                  disabled={
                    state.submitting || !state.returnForm.opinion.trim()
                  }
                  onClick$={async () => await onSubmitReview(false)}
                  title="退回给办理人，需先填写退回原因"
                >
                  ↩️ 退回补正
                </button>
                <button
                  class="btn btn-success"
                  disabled={
                    state.submitting ||
                    !state.reviewForm.reviewer_opinion.trim()
                  }
                  onClick$={async () => await onSubmitReview(true)}
                  title="通过时需填写复核意见"
                >
                  ✅ 通过归档
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Risk */}
      {state.activeTab === "risk" && (
        <div class="space-y-5">
          <div class="card">
            <h2 class="text-lg font-semibold text-gray-800 mb-4">
              ⚠️ 风险等级变更
            </h2>
            <div class="p-4 rounded-lg border border-gray-200 bg-gray-50/40 mb-4">
              <div class="flex items-center gap-3 mb-3">
                <span class="text-sm text-gray-600">当前：</span>
                <RiskBadge level={order.risk_level} showIcon size="md" />
                <span class="text-xs text-gray-400">
                  · 共 {order.risk_change_count || 0} 次变更
                </span>
              </div>
              {canChangeRisk ? (
                <>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        目标风险等级 <span class="text-red-500">*</span>
                      </label>
                      <select
                        class="form-select"
                        value={state.riskForm.new_risk_level}
                        onChange$={(e) =>
                          (state.riskForm.new_risk_level = (
                            e.target as HTMLSelectElement
                          ).value as RiskLevel | "")
                        }
                      >
                        <option value="">请选择...</option>
                        <option value="low">低风险</option>
                        <option value="medium">中风险</option>
                        <option value="high">高风险</option>
                      </select>
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        变更原因 <span class="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        placeholder="详细说明变更原因"
                        value={state.riskForm.reason}
                        onInput$={(e) =>
                          (state.riskForm.reason = (
                            e.target as HTMLInputElement
                          ).value)
                        }
                      />
                    </div>
                  </div>
                  <div class="flex gap-2 justify-end">
                    <button
                      class="btn btn-primary"
                      disabled={
                        state.submitting ||
                        !state.riskForm.new_risk_level ||
                        !state.riskForm.reason.trim()
                      }
                      onClick$={async () => await onChangeRisk()}
                    >
                      提交变更
                    </button>
                  </div>
                </>
              ) : (
                <div class="text-sm text-orange-600 p-3 rounded bg-orange-50 border border-orange-100">
                  仅办理员 / 复核员可变更风险，且当前状态不能为已归档
                </div>
              )}
            </div>
          </div>

          {/* Risk change history */}
          <div class="card">
            <h3 class="text-md font-semibold text-gray-800 mb-3">
              📜 风险等级变更历史
            </h3>
            {order.risk_changes && order.risk_changes.length > 0 ? (
              <ul class="space-y-2">
                {order.risk_changes.map((r, idx) => (
                  <li
                    key={idx}
                    class="p-3 rounded border border-gray-200 bg-gray-50/40"
                  >
                    <div class="flex flex-wrap items-center gap-3 mb-1">
                      <RiskBadge level={r.from_level} />
                      <span class="text-gray-400">→</span>
                      <RiskBadge level={r.to_level} showIcon />
                      <span class="text-xs text-gray-500 ml-auto">
                        {formatDate(r.changed_at)}
                      </span>
                    </div>
                    <div class="text-xs text-gray-600">
                      <span class="font-semibold">{r.operator_name || `用户#${r.operator_id}`}</span>
                      {r.reason && ` · 原因：${r.reason}`}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div class="text-sm text-gray-500 text-center py-6">
                暂无风险变更历史
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Fault / Recovery */}
      {state.activeTab === "fault" && (
        <div class="space-y-5">
          <div class="card">
            <h2 class="text-lg font-semibold text-gray-800 mb-4">
              🔧 故障报修
            </h2>
            {order.status !== "archived" && userCtx.user ? (
              <>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <div class="md:col-span-1">
                    <label class="block text-xs font-medium text-gray-600 mb-1">
                      故障等级 <span class="text-red-500">*</span>
                    </label>
                    <select
                      class="form-select"
                      value={state.faultForm.fault_level}
                      onChange$={(e) =>
                        (state.faultForm.fault_level = (
                          e.target as HTMLSelectElement
                        ).value as RiskLevel)
                      }
                    >
                      <option value="low">低风险</option>
                      <option value="medium">中风险</option>
                      <option value="high">高风险</option>
                    </select>
                  </div>
                  <div class="md:col-span-3">
                    <label class="block text-xs font-medium text-gray-600 mb-1">
                      故障描述 <span class="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      class="form-input"
                      placeholder="详细描述故障现象和部位"
                      value={state.faultForm.fault_description}
                      onInput$={(e) =>
                        (state.faultForm.fault_description = (
                          e.target as HTMLInputElement
                        ).value)
                      }
                    />
                  </div>
                </div>
                <div class="flex justify-end gap-2">
                  <div class="flex-1 text-xs text-gray-500 self-center">
                    提交故障报修后，将自动把风险升级为高风险
                    （若当前不是高风险）
                  </div>
                  <button
                    class="btn btn-danger"
                    disabled={
                      state.submitting ||
                      !state.faultForm.fault_description.trim()
                    }
                    onClick$={async () => await onSubmitFault()}
                  >
                    ⚠️ 提交故障报修
                  </button>
                </div>
              </>
            ) : (
              <div class="text-sm text-gray-500 p-3 rounded bg-gray-50 border">
                登录后可提交故障报修；已归档的巡检单不再接受故障报修
              </div>
            )}
          </div>

          {/* Fault list */}
          <div class="card">
            <h3 class="text-md font-semibold text-gray-800 mb-3">
              📋 故障报修列表（{order.fault_reports?.length ?? 0}）
            </h3>
            {order.fault_reports && order.fault_reports.length > 0 ? (
              <ul class="space-y-3">
                {order.fault_reports.map((f) => {
                  const isExpanded =
                    state.faultForm.selected_fault_for_recovery === f.id;
                  return (
                    <li
                      key={f.id}
                      class={`p-4 rounded-lg border ${
                        f.is_resolved
                          ? "bg-green-50/50 border-green-200"
                          : "bg-red-50/40 border-red-200"
                      }`}
                    >
                      <div class="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div class="flex items-center gap-2">
                          <RiskBadge level={f.fault_level} size="sm" showIcon />
                          <span class="text-xs text-gray-500">
                            报修单 #{f.id}
                          </span>
                          {f.is_resolved ? (
                            <span class="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                              ✅ 已解决
                            </span>
                          ) : (
                            <span class="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                              ⏳ 未解决
                            </span>
                          )}
                        </div>
                        <span class="text-xs text-gray-500">
                          {formatDate(f.reported_at)}
                        </span>
                      </div>
                      <div class="text-sm text-gray-800 mb-2">
                        {f.fault_description}
                      </div>
                      <div class="text-xs text-gray-600 mb-3">
                        报修人：
                        <span class="font-semibold">
                          {f.reported_by_name || `用户 #${f.reported_by}`}
                        </span>
                        {f.resolution && (
                          <span>
                            {" "}· 解决：{f.resolution}（
                            {f.resolved_by_name || `用户 #${f.resolved_by}`}）
                          </span>
                        )}
                      </div>

                      {/* Recovery expand */}
                      {!f.is_resolved &&
                        (isHandler || isReviewer) &&
                        order.status !== "archived" && (
                          <div>
                            <button
                              class="text-xs font-medium text-blue-600 hover:underline"
                              onClick$={() =>
                                (state.faultForm.selected_fault_for_recovery =
                                  isExpanded ? null : f.id)
                              }
                            >
                              {isExpanded
                                ? "收起 ▲"
                                : "➕ 确认此故障已恢复"}
                            </button>
                            {isExpanded && (
                              <div class="mt-3 p-3 rounded bg-white border border-blue-200">
                                <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                  <div class="md:col-span-1">
                                    <label class="block text-xs font-medium text-gray-600 mb-1">
                                      恢复结果
                                    </label>
                                    <select
                                      class="form-select"
                                      value={
                                        state.recoveryForm.is_successful
                                          ? "1"
                                          : "0"
                                      }
                                      onChange$={(e) =>
                                        (state.recoveryForm.is_successful =
                                          (e.target as HTMLSelectElement)
                                            .value === "1")
                                      }
                                    >
                                      <option value="1">✅ 成功恢复</option>
                                      <option value="0">⚠️ 未完全恢复</option>
                                    </select>
                                  </div>
                                  <div class="md:col-span-2">
                                    <label class="block text-xs font-medium text-gray-600 mb-1">
                                      确认说明{" "}
                                      <span class="text-red-500">*</span>
                                    </label>
                                    <input
                                      type="text"
                                      class="form-input"
                                      placeholder="请说明恢复情况"
                                      value={
                                        state.recoveryForm.confirmation_remark
                                      }
                                      onInput$={(e) =>
                                        (state.recoveryForm.confirmation_remark =
                                          (
                                            e.target as HTMLInputElement
                                          ).value)
                                      }
                                    />
                                  </div>
                                  <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">
                                      证据（选填）
                                    </label>
                                    <input
                                      type="text"
                                      class="form-input"
                                      placeholder="证据文件链接"
                                      value={state.recoveryForm.evidence_path}
                                      onInput$={(e) =>
                                        (state.recoveryForm.evidence_path = (
                                          e.target as HTMLInputElement
                                        ).value)
                                      }
                                    />
                                  </div>
                                </div>
                                <div class="flex justify-end gap-2">
                                  <button
                                    class="btn btn-outline text-sm"
                                    onClick$={() =>
                                      (state.faultForm.selected_fault_for_recovery =
                                        null)
                                    }
                                  >
                                    取消
                                  </button>
                                  <button
                                    class="btn btn-success text-sm"
                                    disabled={
                                      state.submitting ||
                                      !state.recoveryForm.confirmation_remark.trim()
                                    }
                                    onClick$={async () =>
                                      await onSubmitRecovery(f.id)
                                    }
                                  >
                                    确认恢复
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div class="text-sm text-gray-500 text-center py-6">
                暂无故障报修
              </div>
            )}
          </div>

          {/* Recovery confirms */}
          {order.recovery_confirms && order.recovery_confirms.length > 0 && (
            <div class="card">
              <h3 class="text-md font-semibold text-gray-800 mb-3">
                ✅ 恢复确认记录（{order.recovery_confirms.length}）
              </h3>
              <ul class="space-y-2">
                {order.recovery_confirms.map((r) => (
                  <li
                    key={r.id}
                    class={`p-3 rounded border ${
                      r.is_successful
                        ? "bg-green-50/60 border-green-200"
                        : "bg-orange-50/60 border-orange-200"
                    }`}
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <span
                            class={`text-xs font-semibold ${
                              r.is_successful
                                ? "text-green-700"
                                : "text-orange-700"
                            }`}
                          >
                            {r.is_successful
                              ? "✅ 成功恢复"
                              : "⚠️ 未完全恢复"}
                          </span>
                          <span class="text-xs text-gray-500">
                            报修单 #{r.fault_report_id}
                          </span>
                        </div>
                        <div class="text-sm text-gray-800">
                          {r.confirmation_remark}
                        </div>
                        {r.evidence_path && (
                          <div class="text-xs text-blue-600 mt-1">
                            📎 {r.evidence_path}
                          </div>
                        )}
                      </div>
                      <div class="text-right text-xs">
                        <div class="font-semibold text-gray-700">
                          {r.confirmed_by_name || `用户 #${r.confirmed_by}`}
                        </div>
                        <div class="text-gray-500">
                          {formatDate(r.confirmed_at)}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab: Operation Records */}
      {state.activeTab === "records" && (
        <div class="card">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">
            📋 操作记录（全量审计轨迹）
          </h2>
          {order.operation_records && order.operation_records.length > 0 ? (
            <ul class="relative border-l-2 border-gray-200 ml-3 space-y-4">
              {order.operation_records
                .slice()
                .sort(
                  (a, b) =>
                    new Date(a.operated_at).getTime() -
                    new Date(b.operated_at).getTime()
                )
                .map((r: OperationRecord, idx: number) => {
                  const isError = !r.result || r.result === "failed";
                  return (
                    <li key={r.id} class="ml-6 relative">
                      <span
                        class={`absolute -left-[30px] top-1.5 w-5 h-5 rounded-full border-2 border-white shadow ${
                          isError
                            ? "bg-red-400"
                            : r.operation_type === "risk_upgrade" ||
                              r.operation_type === "report_fault"
                            ? "bg-red-500"
                            : r.operation_type === "archive" ||
                              r.operation_type === "confirm_recovery" ||
                              r.operation_type === "risk_downgrade"
                            ? "bg-green-500"
                            : r.operation_type === "return"
                            ? "bg-orange-500"
                            : "bg-blue-500"
                        }`}
                      ></span>
                      <div
                        class={`p-3 rounded border ${
                          isError
                            ? "bg-red-50 border-red-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                          <OperationBadge type={r.operation_type} />
                          <span class="text-xs font-semibold text-gray-700">
                            {r.operator_name || `用户#${r.operator_id}`}
                          </span>
                          {r.result && r.result !== "success" && (
                            <span class="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                              ⛔ {r.result}
                            </span>
                          )}
                          <span class="ml-auto text-xs text-gray-500">
                            {formatDate(r.operated_at)} · v{r.version}
                          </span>
                        </div>
                        <div class="text-xs text-gray-600 space-y-0.5">
                          {r.from_status && r.to_status && (
                            <div>
                              状态：
                              <span class="font-medium">
                                {statusLabels[r.from_status]}
                              </span>
                              <span class="mx-1 text-gray-400">→</span>
                              <span class="font-medium">
                                {statusLabels[r.to_status]}
                              </span>
                            </div>
                          )}
                          {r.from_risk_level && r.to_risk_level && (
                            <div>
                              风险：
                              <span class="font-medium">
                                {riskLabels[r.from_risk_level]}
                              </span>
                              <span class="mx-1 text-gray-400">→</span>
                              <span class="font-medium">
                                {riskLabels[r.to_risk_level]}
                              </span>
                            </div>
                          )}
                          {r.remark && (
                            <div class="mt-1 pt-1 border-t border-gray-200/70 text-gray-700">
                              <span class="text-gray-500">备注：</span>
                              {r.remark}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <div class="text-sm text-gray-500 text-center py-6">
              暂无操作记录
            </div>
          )}
        </div>
      )}
    </div>
  );
});
