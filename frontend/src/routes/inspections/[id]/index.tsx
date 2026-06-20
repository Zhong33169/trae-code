import { component$, useStore, $, useOnMount } from "@builder.io/qwik";
import { useNavigate, routeLoader$ } from "@builder.io/qwik-city";
import type {
  InspectionOrderDetail,
  InspectionOrderHandleRequest,
  InspectionOrderReviewRequest,
  InspectionOrderReturnRequest,
  RiskLevelChangeRequest,
  FaultReportRequest,
  RecoveryConfirmRequest,
  InspectionResult,
  RiskLevel,
  OperationRecord,
  RiskLevelChange as RiskLevelChangeType,
  FaultReport,
  RecoveryConfirm,
  InspectionEvidence,
} from "~/types";
import { api } from "~/services/api";
import { StatusBadge, RiskBadge } from "~/components/StatusBadge";
import {
  formatDate,
  resultLabels,
  operationLabels,
  roleLabels,
  checkItemLabels,
} from "~/utils/format";

export const useInspectionId = routeLoader$((params) => {
  return params.id;
});

interface PageState {
  detail: InspectionOrderDetail | null;
  loading: boolean;
  error: string | null;
  success: string | null;
  activeTab: "info" | "handle" | "review" | "risk" | "fault";

  handleForm: {
    check_basic_safety: boolean;
    check_running_condition: boolean;
    check_emergency_stop: boolean;
    check_maintenance_record: boolean;
    check_environment: boolean;
    inspection_result: InspectionResult;
    handler_opinion: string;
    evidence_type: string;
    evidence_desc: string;
  };

  reviewForm: {
    inspection_result: InspectionResult;
    reviewer_opinion: string;
  };

  returnForm: {
    return_reason: string;
  };

  riskForm: {
    new_risk_level: RiskLevel;
    reason: string;
  };

  faultForm: {
    description: string;
    is_high_risk: boolean;
  };

  recoveryForm: {
    description: string;
  };
}

export default component$(() => {
  const nav = useNavigate();
  const id = useInspectionId();

  const state = useStore<PageState>({
    detail: null,
    loading: true,
    error: null,
    success: null,
    activeTab: "info",

    handleForm: {
      check_basic_safety: true,
      check_running_condition: true,
      check_emergency_stop: true,
      check_maintenance_record: true,
      check_environment: true,
      inspection_result: "NORMAL",
      handler_opinion: "",
      evidence_type: "photo",
      evidence_desc: "",
    },

    reviewForm: {
      inspection_result: "NORMAL",
      reviewer_opinion: "",
    },

    returnForm: {
      return_reason: "",
    },

    riskForm: {
      new_risk_level: "MEDIUM",
      reason: "",
    },

    faultForm: {
      description: "",
      is_high_risk: false,
    },

    recoveryForm: {
      description: "",
    },
  });

  useOnMount$(async () => {
    await loadDetail();
  });

  const loadDetail = $(async () => {
    state.loading = true;
    state.error = null;
    try {
      const response = await api.getInspectionDetail(parseInt(id, 10));
      if (response.success) {
        state.detail = response.data;
      }
    } catch (error) {
      state.error = "加载详情失败";
      console.error("Failed to load detail:", error);
    } finally {
      state.loading = false;
    }
  });

  const showSuccess = $((message: string) => {
    state.success = message;
    setTimeout(() => {
      state.success = null;
    }, 3000);
  });

  const showError = $((message: string) => {
    state.error = message;
    setTimeout(() => {
      state.error = null;
    }, 3000);
  });

  const handleSubmit = $(async () => {
    if (!state.detail) return;

    try {
      const evidences = state.handleForm.evidence_desc
        ? [
            {
              type: state.handleForm.evidence_type,
              description: state.handleForm.evidence_desc,
            },
          ]
        : [];

      const request: InspectionOrderHandleRequest = {
        handler_id: 2,
        handler_role: "handler",
        version: state.detail.version,
        check_basic_safety: state.handleForm.check_basic_safety,
        check_running_condition: state.handleForm.check_running_condition,
        check_emergency_stop: state.handleForm.check_emergency_stop,
        check_maintenance_record: state.handleForm.check_maintenance_record,
        check_environment: state.handleForm.check_environment,
        inspection_result: state.handleForm.inspection_result,
        handler_opinion: state.handleForm.handler_opinion,
        evidences,
      };

      const response = await api.handleInspection(state.detail.id, request);
      if (response.success) {
        state.detail = response.data;
        showSuccess("办理提交成功");
        state.activeTab = "info";
      }
    } catch (error: any) {
      showError(error.message || "提交失败");
    }
  });

  const reviewSubmit = $(async () => {
    if (!state.detail) return;

    try {
      const request: InspectionOrderReviewRequest = {
        reviewer_id: 3,
        reviewer_role: "reviewer",
        version: state.detail.version,
        inspection_result: state.reviewForm.inspection_result,
        reviewer_opinion: state.reviewForm.reviewer_opinion,
      };

      const response = await api.reviewInspection(state.detail.id, request);
      if (response.success) {
        state.detail = response.data;
        showSuccess("复核归档成功");
        state.activeTab = "info";
      }
    } catch (error: any) {
      showError(error.message || "提交失败");
    }
  });

  const returnSubmit = $(async () => {
    if (!state.detail) return;

    try {
      const request: InspectionOrderReturnRequest = {
        reviewer_id: 3,
        reviewer_role: "reviewer",
        version: state.detail.version,
        return_reason: state.returnForm.return_reason,
      };

      const response = await api.returnInspection(state.detail.id, request);
      if (response.success) {
        state.detail = response.data;
        showSuccess("退回成功");
        state.activeTab = "info";
      }
    } catch (error: any) {
      showError(error.message || "提交失败");
    }
  });

  const riskSubmit = $(async () => {
    if (!state.detail) return;

    try {
      const request: RiskLevelChangeRequest = {
        operator_id: 2,
        operator_role: "handler",
        version: state.detail.version,
        new_risk_level: state.riskForm.new_risk_level,
        reason: state.riskForm.reason,
      };

      const response = await api.changeRiskLevel(state.detail.id, request);
      if (response.success) {
        state.detail = response.data;
        showSuccess("风险等级变更成功");
        state.activeTab = "info";
      }
    } catch (error: any) {
      showError(error.message || "提交失败");
    }
  });

  const faultSubmit = $(async () => {
    if (!state.detail) return;

    try {
      const request: FaultReportRequest = {
        inspection_order_id: state.detail.id,
        reporter_id: 2,
        reporter_role: "handler",
        description: state.faultForm.description,
        is_high_risk: state.faultForm.is_high_risk,
      };

      const response = await api.createFaultReport(request);
      if (response.success) {
        await loadDetail();
        showSuccess("故障报修提交成功");
        state.activeTab = "info";
      }
    } catch (error: any) {
      showError(error.message || "提交失败");
    }
  });

  const recoverySubmit = $(async () => {
    if (!state.detail) return;

    try {
      const request: RecoveryConfirmRequest = {
        inspection_order_id: state.detail.id,
        confirmer_id: 3,
        confirmer_role: "reviewer",
        description: state.recoveryForm.description,
      };

      const response = await api.confirmRecovery(request);
      if (response.success) {
        await loadDetail();
        showSuccess("恢复确认成功");
        state.activeTab = "info";
      }
    } catch (error: any) {
      showError(error.message || "提交失败");
    }
  });

  if (state.loading) {
    return (
      <div class="card text-center py-12">
        <p class="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (!state.detail) {
    return (
      <div class="card text-center py-12">
        <p class="text-gray-500">未找到该巡检单</p>
        <button class="btn btn-primary mt-4" onClick$={() => nav("/inspections")}>
          返回列表
        </button>
      </div>
    );
  }

  const order = state.detail;

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">
            巡检单详情 - {order.order_no}
          </h1>
          <p class="text-sm text-gray-500 mt-1">
            版本号: {order.version} | 创建时间: {formatDate(order.created_at)}
          </p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-outline" onClick$={() => nav("/inspections")}>
            ← 返回列表
          </button>
          <button class="btn btn-primary" onClick$={loadDetail}>
            🔄 刷新
          </button>
        </div>
      </div>

      {state.success && <div class="alert alert-success">{state.success}</div>}
      {state.error && <div class="alert alert-error">{state.error}</div>}

      {order.is_overdue && (
        <div class="alert alert-warning mb-4">
          ⚠️ 该巡检单已逾期（截止日期：{formatDate(order.due_date)}）
        </div>
      )}

      {order.risk_level === "HIGH" && (
        <div class="alert alert-error mb-4">
          ⚠️ 该巡检单为高风险，请优先处理
        </div>
      )}

      <div class="card mb-6">
        <div class="grid-2 mb-4">
          <div>
            <div class="text-sm text-gray-500 mb-1">器械信息</div>
            <div class="font-medium">{order.equipment.name}</div>
            <div class="text-sm text-gray-600">
              {order.equipment.code} | {order.equipment.model}
            </div>
            <div class="text-sm text-gray-600">{order.equipment.location}</div>
          </div>
          <div class="text-right">
            <div class="mb-2">
              <StatusBadge status={order.status} />
            </div>
            <div>
              <RiskBadge level={order.risk_level} showIcon={true} />
            </div>
            {order.inspection_result && (
              <div class="mt-2">
                <span
                  class={`px-2 py-1 rounded-full text-xs font-medium ${
                    order.inspection_result === "NORMAL"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {resultLabels[order.inspection_result]}
                </span>
              </div>
            )}
          </div>
        </div>

        <div class="grid-3 text-sm pt-4 border-t border-gray-200">
          <div>
            <span class="text-gray-500">发起人：</span>
            <span class="font-medium">{order.initiator_name}</span>
          </div>
          <div>
            <span class="text-gray-500">当前处理人：</span>
            <span class="font-medium">
              {order.current_handler_name || "待分配"}
            </span>
          </div>
          <div>
            <span class="text-gray-500">截止日期：</span>
            <span class={order.is_overdue ? "text-red-600 font-medium" : ""}>
              {formatDate(order.due_date)}
            </span>
          </div>
        </div>

        {(order.last_opinion || order.last_result) && (
          <div class="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div class="text-sm font-medium text-blue-800 mb-2">
              上一处理人意见
            </div>
            {order.last_result && (
              <div class="text-sm text-blue-700 mb-1">
                结果：{resultLabels[order.last_result]}
              </div>
            )}
            {order.last_opinion && (
              <div class="text-sm text-blue-700">意见：{order.last_opinion}</div>
            )}
          </div>
        )}
      </div>

      <div class="card mb-6">
        <div class="flex border-b border-gray-200 mb-4">
          {[
            { key: "info", label: "基本信息" },
            { key: "handle", label: "办理", disabled: order.status !== "PENDING_HANDLING" && order.status !== "IN_PROGRESS" },
            { key: "review", label: "复核归档", disabled: order.status !== "PENDING_REVIEW" },
            { key: "risk", label: "风险变更" },
            { key: "fault", label: "故障/恢复" },
          ].map((tab) => (
            <button
              key={tab.key}
              disabled={tab.disabled}
              class={{
                "px-4 py-2 font-medium text-sm transition-colors": true,
                "text-blue-600 border-b-2 border-blue-600":
                  state.activeTab === tab.key,
                "text-gray-500 hover:text-gray-700":
                  state.activeTab !== tab.key && !tab.disabled,
                "text-gray-300 cursor-not-allowed": tab.disabled,
              }}
              onClick$={() => !tab.disabled && (state.activeTab = tab.key as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {state.activeTab === "info" && (
          <div>
            <h3 class="sub-section-title">检查项目</h3>
            <div class="grid-2 mb-6">
              {Object.entries(checkItemLabels).map(([key, label]) => {
                const value = (order as any)[key] as boolean | null;
                return (
                  <div key={key} class="checkbox-group">
                    <input
                      type="checkbox"
                      checked={value === true}
                      disabled
                    />
                    <span
                      class={{
                        "line-through text-gray-400": value === false,
                        "text-gray-800": value !== false,
                      }}
                    >
                      {label}
                    </span>
                    {value === false && (
                      <span class="text-xs text-red-600 ml-2">(不通过)</span>
                    )}
                    {value === null && (
                      <span class="text-xs text-gray-400 ml-2">(未检查)</span>
                    )}
                  </div>
                );
              })}
            </div>

            {order.check_result && (
              <div class="mb-6">
                <h3 class="sub-section-title">检查结论</h3>
                <div class="p-4 bg-gray-50 rounded text-gray-700">
                  {order.check_result}
                </div>
              </div>
            )}

            {order.handler_opinion && (
              <div class="mb-6">
                <h3 class="sub-section-title">办理员意见</h3>
                <div class="p-4 bg-blue-50 rounded text-blue-800">
                  {order.handler_opinion}
                </div>
              </div>
            )}

            {order.reviewer_opinion && (
              <div class="mb-6">
                <h3 class="sub-section-title">复核员意见</h3>
                <div class="p-4 bg-purple-50 rounded text-purple-800">
                  {order.reviewer_opinion}
                </div>
              </div>
            )}

            {order.evidences.length > 0 && (
              <div class="mb-6">
                <h3 class="sub-section-title">证据材料 ({order.evidences.length})</h3>
                <div class="space-y-2">
                  {order.evidences.map((ev: InspectionEvidence) => (
                    <div
                      key={ev.id}
                      class="p-3 bg-gray-50 rounded flex justify-between items-center"
                    >
                      <div>
                        <span class="text-sm font-medium text-gray-700">
                          {ev.type === "photo" ? "📷 照片" : ev.type === "video" ? "🎥 视频" : "📄 文档"}
                        </span>
                        <span class="text-sm text-gray-600 ml-2">
                          {ev.description}
                        </span>
                      </div>
                      <span class="text-xs text-gray-500">
                        {formatDate(ev.uploaded_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.risk_level_changes.length > 0 && (
              <div class="mb-6">
                <h3 class="sub-section-title">
                  风险等级变更记录 ({order.risk_level_changes.length})
                </h3>
                <div class="space-y-2">
                  {order.risk_level_changes.map((change: RiskLevelChangeType) => (
                    <div
                      key={change.id}
                      class="p-3 bg-yellow-50 rounded border-l-4 border-yellow-500"
                    >
                      <div class="flex justify-between items-start mb-1">
                        <div>
                          <RiskBadge level={change.from_level} />
                          <span class="mx-2 text-gray-400">→</span>
                          <RiskBadge level={change.to_level} />
                        </div>
                        <span class="text-xs text-gray-500">
                          {formatDate(change.created_at)}
                        </span>
                      </div>
                      <div class="text-sm text-gray-600">
                        <span class="font-medium">{change.changed_by_name}</span>：
                        {change.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.fault_reports.length > 0 && (
              <div class="mb-6">
                <h3 class="sub-section-title">
                  故障报修记录 ({order.fault_reports.length})
                </h3>
                <div class="space-y-2">
                  {order.fault_reports.map((fault: FaultReport) => (
                    <div
                      key={fault.id}
                      class="p-3 bg-red-50 rounded border-l-4 border-red-500"
                    >
                      <div class="flex justify-between items-start mb-1">
                        <span class="font-medium text-red-800">
                          🔧 {fault.description}
                        </span>
                        <span class="text-xs text-gray-500">
                          {formatDate(fault.created_at)}
                        </span>
                      </div>
                      <div class="text-sm text-red-700">
                        报修人：{fault.reported_by_name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.recovery_confirms.length > 0 && (
              <div class="mb-6">
                <h3 class="sub-section-title">
                  恢复确认记录 ({order.recovery_confirms.length})
                </h3>
                <div class="space-y-2">
                  {order.recovery_confirms.map((rc: RecoveryConfirm) => (
                    <div
                      key={rc.id}
                      class="p-3 bg-green-50 rounded border-l-4 border-green-500"
                    >
                      <div class="flex justify-between items-start mb-1">
                        <span class="font-medium text-green-800">
                          ✅ {rc.description}
                        </span>
                        <span class="text-xs text-gray-500">
                          {formatDate(rc.created_at)}
                        </span>
                      </div>
                      <div class="text-sm text-green-700">
                        确认人：{rc.confirmed_by_name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div class="mb-6">
              <h3 class="sub-section-title">
                操作记录 ({order.operation_records.length})
              </h3>
              <div class="timeline">
                {order.operation_records.map((record: OperationRecord) => (
                  <div key={record.id} class="timeline-item">
                    <div class="flex justify-between items-start mb-1">
                      <div>
                        <span class="font-medium text-gray-800">
                          {operationLabels[record.operation_type]}
                        </span>
                        <span class="text-sm text-gray-600 ml-2">
                          {record.operator_name} ({roleLabels[record.operator_role]})
                        </span>
                      </div>
                      <span class="text-xs text-gray-500">
                        {formatDate(record.created_at)}
                      </span>
                    </div>
                    {record.from_status && record.to_status && (
                      <div class="text-sm text-gray-500 mb-1">
                        状态变更：{record.from_status} → {record.to_status}
                      </div>
                    )}
                    {record.opinion && (
                      <div class="text-sm text-gray-600">
                        意见：{record.opinion}
                      </div>
                    )}
                    {record.details && (
                      <div class="text-sm text-red-600 mt-1">
                        备注：{record.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {state.activeTab === "handle" && (
          <div class="max-w-2xl">
            <h3 class="sub-section-title">巡检办理</h3>

            <div class="mb-4">
              <label class="form-label">检查项目</label>
              {Object.entries(checkItemLabels).map(([key, label]) => (
                <div key={key} class="checkbox-group">
                  <input
                    type="checkbox"
                    checked={(state.handleForm as any)[key]}
                    onChange$={(e) => {
                      (state.handleForm as any)[key] = (e.target as HTMLInputElement).checked;
                    }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div class="form-group">
              <label class="form-label">检查结果 *</label>
              <select
                class="form-select"
                value={state.handleForm.inspection_result}
                onChange$={(e) => {
                  state.handleForm.inspection_result = (e.target as HTMLSelectElement)
                    .value as InspectionResult;
                }}
              >
                {Object.entries(resultLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">办理意见 *</label>
              <textarea
                class="form-textarea"
                placeholder="请输入办理意见..."
                value={state.handleForm.handler_opinion}
                onInput$={(e) => {
                  state.handleForm.handler_opinion = (e.target as HTMLTextAreaElement).value;
                }}
              />
            </div>

            <div class="form-group">
              <label class="form-label">证据材料（可选）</label>
              <div class="grid-2">
                <div>
                  <select
                    class="form-select"
                    value={state.handleForm.evidence_type}
                    onChange$={(e) => {
                      state.handleForm.evidence_type = (e.target as HTMLSelectElement).value;
                    }}
                  >
                    <option value="photo">照片</option>
                    <option value="video">视频</option>
                    <option value="document">文档</option>
                  </select>
                </div>
                <div>
                  <input
                    type="text"
                    class="form-input"
                    placeholder="证据描述"
                    value={state.handleForm.evidence_desc}
                    onInput$={(e) => {
                      state.handleForm.evidence_desc = (e.target as HTMLInputElement).value;
                    }}
                  />
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-1">
                如检查结果为异常、缺证据等非通过状态，必须上传证据材料
              </p>
            </div>

            <div class="alert alert-info mb-4">
              <p class="text-sm">
                <strong>后端校验说明：</strong>提交时将自动校验处理人身份、角色权限、当前状态、版本号和必填证据。
                校验不通过将保留原状态并记录操作日志。
              </p>
            </div>

            <div class="flex gap-2">
              <button class="btn btn-primary" onClick$={handleSubmit}>
                提交办理
              </button>
              <button
                class="btn btn-outline"
                onClick$={() => (state.activeTab = "info")}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {state.activeTab === "review" && (
          <div class="max-w-2xl">
            <h3 class="sub-section-title">复核归档</h3>

            <div class="form-group">
              <label class="form-label">复核结果 *</label>
              <select
                class="form-select"
                value={state.reviewForm.inspection_result}
                onChange$={(e) => {
                  state.reviewForm.inspection_result = (e.target as HTMLSelectElement)
                    .value as InspectionResult;
                }}
              >
                {Object.entries(resultLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">复核意见 *</label>
              <textarea
                class="form-textarea"
                placeholder="请输入复核意见..."
                value={state.reviewForm.reviewer_opinion}
                onInput$={(e) => {
                  state.reviewForm.reviewer_opinion = (e.target as HTMLTextAreaElement).value;
                }}
              />
            </div>

            <div class="alert alert-info mb-4">
              <p class="text-sm">
                <strong>后端校验说明：</strong>复核时将校验复核员身份、角色权限、当前状态（必须为待复核）和版本号。
              </p>
            </div>

            <div class="flex gap-2">
              <button class="btn btn-success" onClick$={reviewSubmit}>
                ✅ 通过并归档
              </button>
              <button class="btn btn-warning" onClick$={returnSubmit}>
                ↩️ 退回补正
              </button>
              <button
                class="btn btn-outline"
                onClick$={() => (state.activeTab = "info")}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {state.activeTab === "risk" && (
          <div class="max-w-2xl">
            <h3 class="sub-section-title">风险等级变更</h3>

            <div class="alert alert-warning mb-4">
              <p class="text-sm">
                ⚠️ 风险等级变更将留痕记录，包括变更前后等级、原因和操作人。
                当前等级：<RiskBadge level={order.risk_level} />
              </p>
            </div>

            <div class="form-group">
              <label class="form-label">新风险等级 *</label>
              <select
                class="form-select"
                value={state.riskForm.new_risk_level}
                onChange$={(e) => {
                  state.riskForm.new_risk_level = (e.target as HTMLSelectElement)
                    .value as RiskLevel;
                }}
              >
                <option value="LOW">低风险</option>
                <option value="MEDIUM">中风险</option>
                <option value="HIGH">高风险</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">变更原因 *</label>
              <textarea
                class="form-textarea"
                placeholder="请详细说明风险等级变更的原因..."
                value={state.riskForm.reason}
                onInput$={(e) => {
                  state.riskForm.reason = (e.target as HTMLTextAreaElement).value;
                }}
              />
            </div>

            <div class="flex gap-2">
              <button class="btn btn-warning" onClick$={riskSubmit}>
                确认变更
              </button>
              <button
                class="btn btn-outline"
                onClick$={() => (state.activeTab = "info")}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {state.activeTab === "fault" && (
          <div class="max-w-2xl">
            <div class="mb-6">
              <h3 class="sub-section-title">故障报修</h3>
              <div class="form-group">
                <label class="form-label">故障描述 *</label>
                <textarea
                  class="form-textarea"
                  placeholder="请详细描述故障情况..."
                  value={state.faultForm.description}
                  onInput$={(e) => {
                    state.faultForm.description = (e.target as HTMLTextAreaElement).value;
                  }}
                />
              </div>
              <div class="checkbox-group">
                <input
                  type="checkbox"
                  checked={state.faultForm.is_high_risk}
                  onChange$={(e) => {
                    state.faultForm.is_high_risk = (e.target as HTMLInputElement).checked;
                  }}
                />
                <span class="text-red-600 font-medium">
                  此故障为高风险（勾选后将自动升级巡检单风险等级为高风险）
                </span>
              </div>
              <button class="btn btn-danger" onClick$={faultSubmit}>
                🔧 提交故障报修
              </button>
            </div>

            <div class="pt-6 border-t border-gray-200">
              <h3 class="sub-section-title">恢复确认</h3>
              <div class="form-group">
                <label class="form-label">恢复情况说明 *</label>
                <textarea
                  class="form-textarea"
                  placeholder="请说明故障修复和恢复情况..."
                  value={state.recoveryForm.description}
                  onInput$={(e) => {
                    state.recoveryForm.description = (e.target as HTMLTextAreaElement).value;
                  }}
                />
              </div>
              <button class="btn btn-success" onClick$={recoverySubmit}>
                ✅ 确认恢复
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
