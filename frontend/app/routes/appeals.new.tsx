import { useState } from "react";
import { useNavigate, useActionData, Form, useNavigation } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { ArrowLeft } from "lucide-react";
import { fetchApi } from "~/utils/api";
import type { Appeal, AnomalyType, AppealCreate } from "~/utils/types";
import { useUser } from "~/utils/store";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const payload: AppealCreate = {
    visitor_name: formData.get("visitor_name") as string,
    visitor_phone: formData.get("visitor_phone") as string,
    appointment_date: formData.get("appointment_date") as string,
    anomaly_type: formData.get("anomaly_type") as AnomalyType,
    description: formData.get("description") as string,
    evidence_urls: (formData.get("evidence_urls") as string)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    operator_id: formData.get("operator_id") as string,
  };
  try {
    const appeal = await fetchApi<Appeal>("/appeals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { success: true, appealId: appeal.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

const ANOMALY_OPTIONS: { value: AnomalyType; label: string }[] = [
  { value: "normal", label: "正常通过" },
  { value: "missing_evidence", label: "缺证据" },
  { value: "overdue", label: "逾期" },
  { value: "returned", label: "退回补正" },
  { value: "status_conflict", label: "状态冲突" },
];

export default function AppealsNew() {
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { currentUser } = useUser();
  const isSubmitting = navigation.state === "submitting";

  const [evidenceInput, setEvidenceInput] = useState("");

  if (actionData?.success && actionData.appealId) {
    navigate(`/appeals/${actionData.appealId}`);
    return null;
  }

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        返回队列
      </button>

      <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">发起申诉</h2>

      {actionData?.error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-5">
        <input type="hidden" name="operator_id" value={currentUser.id} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            来访人姓名
          </label>
          <input
            type="text"
            name="visitor_name"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            来访人电话
          </label>
          <input
            type="tel"
            name="visitor_phone"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            预约日期
          </label>
          <input
            type="date"
            name="appointment_date"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            异常类型
          </label>
          <select
            name="anomaly_type"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {ANOMALY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            申诉描述
          </label>
          <textarea
            name="description"
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            证据链接（逗号分隔）
          </label>
          <input
            type="text"
            name="evidence_urls"
            value={evidenceInput}
            onChange={(e) => setEvidenceInput(e.target.value)}
            placeholder="https://example.com/e1.pdf, https://example.com/e2.png"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#1e3a5f" }}
          >
            {isSubmitting ? "提交中..." : "提交申诉"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
        </div>
      </Form>
    </div>
  );
}
