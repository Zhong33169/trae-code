import { useState } from "preact/hooks";
import { RISK_LEVELS, RISK_NAMES, RISK_COLORS } from "../lib/constants.ts";
import type { ContractForm } from "../lib/api.ts";

interface ContractFormEditorProps {
  form?: ContractForm;
  userId: number;
  userRole: string;
  onSuccess?: (form: ContractForm) => void;
}

export default function ContractFormEditor(
  { form, userId, userRole, onSuccess }: ContractFormEditorProps,
) {
  const isEdit = !!form;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    residentName: form?.resident_name || "",
    idCard: form?.id_card || "",
    phone: form?.phone || "",
    address: form?.address || "",
    doctorName: form?.doctor_name || "",
    teamName: form?.team_name || "",
    riskLevel: form?.risk_level || RISK_LEVELS.MEDIUM,
    signContent: form?.sign_content || "",
  });

  const handleChange = (
    e: preact.JSX.TargetedEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.currentTarget;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (formData.residentName.trim() === "") return "请输入居民姓名";
    if (formData.idCard.trim() === "") return "请输入身份证号";
    if (formData.phone.trim() === "") return "请输入联系电话";
    if (formData.doctorName.trim() === "") return "请输入家庭医生姓名";
    if (formData.teamName.trim() === "") return "请输入服务团队名称";
    return null;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const apiBase = (window as unknown as { API_BASE_URL?: string }).API_BASE_URL ||
        "http://localhost:8005/api";

      const url = isEdit
        ? `${apiBase}/contracts/${form!.id}`
        : `${apiBase}/contracts`;
      const method = isEdit ? "PUT" : "POST";

      const body = isEdit
        ? {
          ...formData,
          version: form!.version,
          stage: form!.stage,
        }
        : formData;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "操作失败" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      const savedForm = result;

      if (onSuccess) {
        onSuccess(savedForm);
      } else if (!isEdit) {
        window.location.href = `/contract/${savedForm.id}?userId=${userId}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="space-y-6">
      {error && (
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100">
          <h2 class="text-base font-semibold text-gray-900">
            {isEdit ? "编辑签约服务单" : "新建签约服务单"}
          </h2>
        </div>

        <div class="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              居民姓名 <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="residentName"
              value={formData.residentName}
              onChange={handleChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="请输入居民姓名"
              disabled={saving}
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              身份证号 <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="idCard"
              value={formData.idCard}
              onChange={handleChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="请输入身份证号"
              disabled={saving}
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              联系电话 <span class="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="请输入联系电话"
              disabled={saving}
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              居住地址
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="请输入居住地址"
              disabled={saving}
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              家庭医生 <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="doctorName"
              value={formData.doctorName}
              onChange={handleChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="请输入家庭医生姓名"
              disabled={saving}
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              服务团队 <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="teamName"
              value={formData.teamName}
              onChange={handleChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="请输入服务团队名称"
              disabled={saving}
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              风险等级 <span class="text-red-500">*</span>
            </label>
            <select
              name="riskLevel"
              value={formData.riskLevel}
              onChange={handleChange}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={saving}
            >
              {Object.entries(RISK_NAMES).map(([key, name]) => (
                <option key={key} value={key} style={{
                  color: RISK_COLORS[key as keyof typeof RISK_COLORS],
                }}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100">
          <h2 class="text-base font-semibold text-gray-900">签约内容</h2>
        </div>
        <div class="px-6 py-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              签约服务内容描述
            </label>
            <textarea
              name="signContent"
              value={formData.signContent}
              onChange={handleChange}
              rows={4}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="请描述签约服务内容，如服务包类型、主要健康问题等"
              disabled={saving}
            />
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        {isEdit && (
          <button
          type="button"
          onClick={() => window.location.reload()}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          disabled={saving}
        >
          取消
        </button>
      )}
        <button
          type="submit"
          class="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={saving}
        >
          {saving ? "保存中..." : isEdit ? "保存修改" : "创建签约单"}
        </button>
      </div>
    </form>
  );
}
