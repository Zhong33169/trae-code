import { useSignal } from "@preact/signals";
import {
  STAGES,
  STATUSES,
  STATUS_NAMES,
  STAGE_NAMES,
} from "../lib/constants.ts";
import type { ContractForm } from "../lib/api.ts";

interface ActionPanelProps {
  form: ContractForm;
  userId: number;
  userRole: string;
  onSuccess?: (form: ContractForm) => void;
}

interface ActionButtonConfig {
  key: string;
  label: string;
  description: string;
  endpoint: string;
  color: "primary" | "warning" | "danger" | "success";
  requiresOpinion?: boolean;
}

const COLOR_CLASSES: Record<string, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  warning: "bg-orange-500 hover:bg-orange-600 text-white",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  success: "bg-green-600 hover:bg-green-700 text-white",
};

export default function ActionPanel(
  { form, userId, userRole, onSuccess }: ActionPanelProps,
) {
  const canAct = form.current_handler_id === userId && form.current_role === userRole;
  const isRegister = userRole === "REGISTER";
  const isAuditor = userRole === "AUDITOR";
  const isReviewer = userRole === "REVIEWER";

  const actions: ActionButtonConfig[] = [];

  if (canAct && isRegister &&
    (form.status === STATUSES.DRAFT || form.status === STATUSES.NEEDS_CORRECTION)) {
    actions.push({
      key: "submit",
      label: "提交审核",
      description: "提交给下一环节处理",
      endpoint: "submit",
      color: "primary",
      requiresOpinion: true,
    });
  }

  if (canAct && (isAuditor || isReviewer) && form.status === STATUSES.PENDING) {
    actions.push({
      key: "approve",
      label: "审核通过",
      description: isReviewer && form.stage === STAGES.PERFORM
        ? "复核通过并归档"
        : "通过审核，进入下一阶段",
      endpoint: "approve",
      color: "primary",
      requiresOpinion: true,
    });
  }

  if (canAct && (isAuditor || isReviewer) && form.status === STATUSES.PENDING) {
    actions.push({
      key: "return-correction",
      label: "退回补正",
      description: "退回给登记员补充材料",
      endpoint: "return-correction",
      color: "warning",
      requiresOpinion: true,
    });
  }

  if (canAct && isAuditor && form.status === STATUSES.PENDING) {
    actions.push({
      key: "reject",
      label: "不予通过",
      description: "驳回申请，终止流程",
      endpoint: "reject",
      color: "danger",
      requiresOpinion: true,
    });
  }

  if (canAct && isReviewer && form.status === STATUSES.PENDING &&
    form.stage === STAGES.PERFORM) {
    actions.push({
      key: "archive",
      label: "复核归档",
      description: "完成履约确认，归档结案",
      endpoint: "archive",
      color: "success",
      requiresOpinion: true,
    });
  }

  const loading = useSignal(false);
  const error = useSignal<string | null>(null);

  const handleAction = async (action: ActionButtonConfig) => {
    let opinion = "";
    if (action.requiresOpinion) {
      const input = window.prompt("请输入办理意见：");
      if (input === null) return;
      opinion = input;
    }

    loading.value = true;
    error.value = null;

    try {
      const apiBase = (window as unknown as { API_BASE_URL?: string }).API_BASE_URL ||
        "http://localhost:8005/api";

      const res = await fetch(`${apiBase}/contracts/${form.id}/${action.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
        },
        body: JSON.stringify({ opinion, version: form.version }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "操作失败" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const updatedForm = await res.json() as ContractForm;

      if (onSuccess) {
        onSuccess(updatedForm);
      } else {
        window.location.reload();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "操作失败";
    } finally {
      loading.value = false;
    }
  };

  if (!canAct || actions.length === 0) {
    return (
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">办理操作</h3>
        <p class="text-sm text-gray-400 text-center py-4">
          当前状态无可用操作
        </p>
      </div>
    );
  }

  return (
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 class="text-sm font-semibold text-gray-900 mb-4">办理操作</h3>

      {error.value && (
        <div class="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600">{error.value}</p>
        </div>
      )}

      <div class="space-y-3">
        {actions.map((action) => (
          <button
            key={action.key}
            onClick={() => handleAction(action)}
            disabled={loading.value}
            class={`w-full px-4 py-3 rounded-lg text-left transition-colors ${COLOR_CLASSES[action.color]} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <p class="font-medium">
              {loading.value ? "处理中..." : action.label}
            </p>
            <p class="text-sm opacity-80">{action.description}</p>
          </button>
        ))}
      </div>

      <p class="text-xs text-gray-400 mt-3 text-center">
        当前处理人：您 ({STAGE_NAMES[form.stage as keyof typeof STAGE_NAMES]} · {STATUS_NAMES[form.status as keyof typeof STATUS_NAMES]})
      </p>
    </div>
  );
}
