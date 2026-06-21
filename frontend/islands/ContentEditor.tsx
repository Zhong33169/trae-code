import { useSignal } from "@preact/signals";
import {
  STAGES,
  STAGE_NAMES,
  STATUSES,
} from "../lib/constants.ts";
import type { ContractForm } from "../lib/api.ts";

interface ContentEditorProps {
  form: ContractForm;
  stage: string;
  userId: number;
  userRole: string;
  onSuccess?: (form: ContractForm) => void;
}

export default function ContentEditor(
  { form, stage, userId, userRole, onSuccess }: ContentEditorProps,
) {
  const contentField = stage === STAGES.SIGN
    ? "signContent"
    : stage === STAGES.PLAN
    ? "planContent"
    : "performContent";

  const currentContent = stage === STAGES.SIGN
    ? form.sign_content
    : stage === STAGES.PLAN
    ? form.plan_content
    : form.perform_content;

  const canEdit = userRole === "REGISTER" &&
    form.current_handler_id === userId &&
    (form.status === STATUSES.DRAFT || form.status === STATUSES.NEEDS_CORRECTION) &&
    form.stage === stage;

  const isEditing = useSignal(false);
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);
  const content = useSignal(currentContent || "");

  const handleSave = async () => {
    if (!content.value.trim()) {
      error.value = "请输入服务内容";
      return;
    }

    saving.value = true;
    error.value = null;

    try {
      const apiBase = (window as unknown as { API_BASE_URL?: string }).API_BASE_URL ||
        "http://localhost:8005/api";

      const body: Record<string, unknown> = {
        version: form.version,
        stage,
      };
      body[contentField] = content.value;

      const res = await fetch(`${apiBase}/contracts/${form.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "保存失败" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const updatedForm = await res.json();
      isEditing.value = false;

      if (onSuccess) {
        onSuccess(updatedForm);
      } else {
        window.location.reload();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "保存失败";
    } finally {
      saving.value = false;
    }
  };

  if (!canEdit && !isEditing.value) {
    return (
      <div>
        <p class="text-xs text-gray-500 mb-1">内容描述</p>
        <p class="text-sm text-gray-700 whitespace-pre-wrap">
          {currentContent || "（暂无内容）"}
        </p>
      </div>
    );
  }

  if (!isEditing.value) {
    return (
      <div>
        <p class="text-xs text-gray-500 mb-1">内容描述</p>
        <p class="text-sm text-gray-700 whitespace-pre-wrap mb-2">
          {currentContent || "（暂无内容）"}
        </p>
        <button
          onClick={() => {
            content.value = currentContent || "";
            isEditing.value = true;
          }}
          class="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          ✏️ 编辑内容
        </button>
      </div>
    );
  }

  return (
    <div>
      <p class="text-xs text-gray-500 mb-1">
        编辑 {STAGE_NAMES[stage as keyof typeof STAGE_NAMES]} 内容
      </p>
      <textarea
        value={content.value}
        onInput={(e) => content.value = e.currentTarget.value}
        rows={4}
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm mb-2"
        placeholder={`请输入${STAGE_NAMES[stage as keyof typeof STAGE_NAMES]}内容描述...`}
        disabled={saving.value}
      />
      {error.value && (
        <p class="text-sm text-red-600 mb-2">{error.value}</p>
      )}
      <div class="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving.value}
          class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving.value ? "保存中..." : "保存"}
        </button>
        <button
          onClick={() => {
            content.value = currentContent || "";
            isEditing.value = false;
            error.value = null;
          }}
          disabled={saving.value}
          class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          取消
        </button>
      </div>
    </div>
  );
}
