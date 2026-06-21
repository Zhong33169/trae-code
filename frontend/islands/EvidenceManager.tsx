import { useSignal } from "@preact/signals";
import {
  STAGES,
  STAGE_NAMES,
  STATUSES,
  REQUIRED_EVIDENCES_BY_STAGE,
} from "../lib/constants.ts";
import type { ContractForm, Evidence } from "../lib/api.ts";

interface EvidenceManagerProps {
  form: ContractForm;
  stage: string;
  evidences: Evidence[];
  userId: number;
  userRole: string;
  onSuccess?: (form: ContractForm) => void;
}

const IS_BROWSER = typeof document !== "undefined";

export default function EvidenceManager(
  { form, stage, evidences, userId, userRole, onSuccess }: EvidenceManagerProps,
) {
  const requiredEvidences = REQUIRED_EVIDENCES_BY_STAGE[stage as keyof typeof REQUIRED_EVIDENCES_BY_STAGE] || [];
  const submittedRequired = evidences.filter((e) => e.is_required).length;

  const canManage = userRole === "REGISTER" &&
    form.current_handler_id === userId &&
    (form.status === STATUSES.DRAFT || form.status === STATUSES.NEEDS_CORRECTION) &&
    form.stage === stage;

  if (!IS_BROWSER) {
    return (
      <div>
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs text-gray-500">
            证据材料
            <span class="text-gray-400 ml-1">
              ({submittedRequired}/{requiredEvidences.length} 必需)
            </span>
          </p>
        </div>
        {evidences.length === 0
          ? (
            <p class="text-sm text-gray-400">暂无证据材料</p>
          )
          : (
            <div class="space-y-1.5">
              {evidences.map((ev) => (
                <div
                  key={ev.id}
                  class="flex items-center gap-2 text-sm bg-white border border-gray-100 rounded-lg px-3 py-2"
                >
                  <span class="text-gray-400">📄</span>
                  <span class="text-gray-700 flex-1">{ev.name}</span>
                  {ev.is_required
                    ? (
                      <span class="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                        必需
                      </span>
                    )
                    : (
                      <span class="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                        补充
                      </span>
                    )}
                </div>
              ))}
            </div>
          )}
      </div>
    );
  }

  return <EvidenceManagerInteractive
    form={form}
    stage={stage}
    evidences={evidences}
    userId={userId}
    userRole={userRole}
    onSuccess={onSuccess}
    requiredEvidences={requiredEvidences}
    submittedRequired={submittedRequired}
    canManage={canManage}
  />;
}

function EvidenceManagerInteractive(
  { form, stage, evidences, userId, userRole, onSuccess, requiredEvidences, submittedRequired, canManage }:
    EvidenceManagerProps & { requiredEvidences: string[]; submittedRequired: number; canManage: boolean },
) {
  const showAddForm = useSignal(false);
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);

  const evidenceName = useSignal("");
  const evidenceDesc = useSignal("");

  const handleAddEvidence = async () => {
    if (!evidenceName.value.trim()) {
      error.value = "请输入证据名称";
      return;
    }

    saving.value = true;
    error.value = null;

    try {
      const apiBase = (window as unknown as { API_BASE_URL?: string }).API_BASE_URL ||
        "http://localhost:8005/api";

      const isRequired = requiredEvidences.includes(evidenceName.value.trim());

      const res = await fetch(`${apiBase}/contracts/${form.id}/evidences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
        },
        body: JSON.stringify({
          stage,
          name: evidenceName.value.trim(),
          description: evidenceDesc.value.trim(),
          isRequired,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "添加失败" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const result = await res.json();

      evidenceName.value = "";
      evidenceDesc.value = "";
      showAddForm.value = false;

      if (onSuccess && result.form) {
        onSuccess(result.form);
      } else {
        window.location.reload();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "添加失败";
    } finally {
      saving.value = false;
    }
  };

  const handleRemoveEvidence = async (evidenceId: number) => {
    if (!confirm("确定要删除这个证据吗？")) return;

    try {
      const apiBase = (window as unknown as { API_BASE_URL?: string }).API_BASE_URL ||
        "http://localhost:8005/api";

      const res = await fetch(`${apiBase}/evidences/${evidenceId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "删除失败" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const result = await res.json();

      if (onSuccess && result.form) {
        onSuccess(result.form);
      } else {
        window.location.reload();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div>
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs text-gray-500">
          证据材料
          <span class="text-gray-400 ml-1">
            ({submittedRequired}/{requiredEvidences.length} 必需)
          </span>
        </p>
        {canManage && !showAddForm.value && (
          <button
            onClick={() => showAddForm.value = true}
            class="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            + 添加证据
          </button>
        )}
      </div>

      {showAddForm.value && (
        <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
          <div class="space-y-2">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">
                证据名称 <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={evidenceName.value}
                onChange={(e) => evidenceName.value = e.currentTarget.value}
                class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="如：签约协议书"
                disabled={saving.value}
              />
              <p class="text-xs text-gray-400 mt-1">
                必需证据：{requiredEvidences.join("、")}
              </p>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">
                证据描述
              </label>
              <input
                type="text"
                value={evidenceDesc.value}
                onChange={(e) => evidenceDesc.value = e.currentTarget.value}
                class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="简要描述证据内容"
                disabled={saving.value}
              />
            </div>
          </div>
          {error.value && (
            <p class="text-xs text-red-600 mt-2">{error.value}</p>
          )}
          <div class="flex gap-2 mt-2">
            <button
              onClick={handleAddEvidence}
              disabled={saving.value}
              class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving.value ? "添加中..." : "确认添加"}
            </button>
            <button
              onClick={() => {
                showAddForm.value = false;
                evidenceName.value = "";
                evidenceDesc.value = "";
                error.value = null;
              }}
              disabled={saving.value}
              class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {evidences.length === 0
        ? (
          <p class="text-sm text-gray-400">暂无证据材料</p>
        )
        : (
          <div class="space-y-1.5">
            {evidences.map((ev) => (
              <div
                key={ev.id}
                class="flex items-center gap-2 text-sm bg-white border border-gray-100 rounded-lg px-3 py-2"
              >
                <span class="text-gray-400">📄</span>
                <span class="text-gray-700 flex-1">{ev.name}</span>
                {ev.is_required
                  ? (
                    <span class="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                      必需
                    </span>
                  )
                  : (
                    <span class="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                      补充
                    </span>
                  )}
                {canManage && (
                  <button
                    onClick={() => handleRemoveEvidence(ev.id)}
                    class="text-xs text-red-500 hover:text-red-700 ml-2"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
