import React, { useState } from "react";
import { Modal } from "./Modal";
import { RepairAcceptance } from "~/services/inspection";
import { validateRequired, validatePhone, formatCurrency } from "~/utils/helpers";

interface RepairAcceptanceFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<RepairAcceptance>) => Promise<boolean>;
  loading: boolean;
  orderNo?: string;
  existingData?: RepairAcceptance;
}

interface FormData {
  repair_company: string;
  repair_person: string;
  repair_phone: string;
  repair_start_date: string;
  repair_end_date: string;
  repair_content: string;
  parts_replaced: string;
  repair_cost: string;
  is_guarantee: boolean;
  acceptance_result: string;
  acceptance_check_items: string;
  acceptance_opinion: string;
  material_complete: boolean;
  material_note: string;
}

const initialFormData: FormData = {
  repair_company: "",
  repair_person: "",
  repair_phone: "",
  repair_start_date: "",
  repair_end_date: "",
  repair_content: "",
  parts_replaced: "",
  repair_cost: "",
  is_guarantee: false,
  acceptance_result: "pass",
  acceptance_check_items: "",
  acceptance_opinion: "",
  material_complete: true,
  material_note: "",
};

const acceptanceResults = [
  { value: "pass", label: "验收通过" },
  { value: "fail", label: "验收不合格" },
];

export function RepairAcceptanceForm({
  open,
  onClose,
  onSubmit,
  loading,
  orderNo,
  existingData,
}: RepairAcceptanceFormProps) {
  const [formData, setFormData] = useState<FormData>(
    existingData
      ? {
          ...initialFormData,
          repair_company: existingData.repair_company || "",
          repair_person: existingData.repair_person || "",
          repair_phone: existingData.repair_phone || "",
          repair_start_date: existingData.repair_start_date?.split("T")[0] || "",
          repair_end_date: existingData.repair_end_date?.split("T")[0] || "",
          repair_content: existingData.repair_content || "",
          parts_replaced: existingData.parts_replaced || "",
          repair_cost: existingData.repair_cost || "",
          is_guarantee: existingData.is_guarantee || false,
          acceptance_result: existingData.acceptance_result || "pass",
          acceptance_check_items: existingData.acceptance_check_items || "",
          acceptance_opinion: existingData.acceptance_opinion || "",
          material_complete: existingData.material_complete !== false,
          material_note: existingData.material_note || "",
        }
      : initialFormData
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    field: keyof FormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors((prev) => ({ ...prev, [field as string]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    const requiredFields: (keyof FormData)[] = [
      "repair_company",
      "repair_person",
      "repair_content",
      "acceptance_result",
    ];

    requiredFields.forEach((field) => {
      const value = formData[field];
      if (typeof value === "string") {
        const error = validateRequired(value);
        if (error) newErrors[field] = error;
      }
    });

    const phoneError = validatePhone(formData.repair_phone);
    if (phoneError) newErrors.repair_phone = phoneError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    
    const submitData: Partial<RepairAcceptance> = {
      ...formData,
      repair_cost: formData.repair_cost || undefined,
    };
    
    const success = await onSubmit(submitData);
    if (success) {
      setFormData(initialFormData);
      setErrors({});
    }
  };

  const handleClose = () => {
    setFormData(initialFormData);
    setErrors({});
    onClose();
  };

  if (!open) return null;

  const inputStyle = (field: keyof FormData): React.CSSProperties => ({
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${errors[field as string] ? "#ef4444" : "#d1d5db"}`,
    borderRadius: "4px",
    fontSize: "14px",
    boxSizing: "border-box",
  });

  const labelStyle = (
    field: keyof FormData,
    required: boolean = false
  ): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "6px",
  });

  const checkboxStyle = (): React.CSSProperties => ({
    width: "18px",
    height: "18px",
    marginRight: "8px",
    cursor: "pointer",
  });

  return (
    <Modal
      open={open}
      title={`修复验收 - ${orderNo || ""}`}
      onClose={handleClose}
      width={700}
      footer={
        <>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              padding: "8px 20px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#374151",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: "8px 20px",
              border: "none",
              backgroundColor: "#8b5cf6",
              color: "#fff",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "提交中..." : "提交验收"}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: "16px", fontSize: "13px", color: "#6b7280" }}>
        <div
          style={{
            backgroundColor: "#f5f3ff",
            border: "1px solid #ddd6fe",
            borderRadius: "6px",
            padding: "12px 16px",
            marginBottom: "16px",
          }}
        >
          <strong style={{ color: "#5b21b6" }}>📋 修复信息与验收</strong>
          <div style={{ marginTop: "4px", fontSize: "12px" }}>
            请填写修复详情并进行验收
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
        <div>
          <label style={labelStyle("repair_company", true)}>
            维修单位 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="text"
            value={formData.repair_company}
            onChange={(e) => handleChange("repair_company", e.target.value)}
            placeholder="请输入维修单位名称"
            style={inputStyle("repair_company")}
          />
          {errors.repair_company && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.repair_company}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle("repair_person", true)}>
            维修人员 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="text"
            value={formData.repair_person}
            onChange={(e) => handleChange("repair_person", e.target.value)}
            placeholder="请输入维修人员姓名"
            style={inputStyle("repair_person")}
          />
          {errors.repair_person && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.repair_person}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle("repair_phone")}>联系电话</label>
          <input
            type="tel"
            value={formData.repair_phone}
            onChange={(e) => handleChange("repair_phone", e.target.value)}
            placeholder="请输入联系电话"
            style={inputStyle("repair_phone")}
          />
          {errors.repair_phone && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.repair_phone}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle("repair_cost")}>维修费用</label>
          <input
            type="number"
            step="0.01"
            value={formData.repair_cost}
            onChange={(e) => handleChange("repair_cost", e.target.value)}
            placeholder="请输入维修费用"
            style={inputStyle("repair_cost")}
          />
          {formData.repair_cost && (
            <div style={{ fontSize: "12px", color: "#10b981", marginTop: "4px" }}>
              大写：{formatCurrency(formData.repair_cost)}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle("repair_start_date")}>维修开始日期</label>
          <input
            type="date"
            value={formData.repair_start_date}
            onChange={(e) => handleChange("repair_start_date", e.target.value)}
            style={inputStyle("repair_start_date")}
          />
        </div>

        <div>
          <label style={labelStyle("repair_end_date")}>维修完成日期</label>
          <input
            type="date"
            value={formData.repair_end_date}
            onChange={(e) => handleChange("repair_end_date", e.target.value)}
            style={inputStyle("repair_end_date")}
          />
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <label style={labelStyle("repair_content", true)}>
            维修内容 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            value={formData.repair_content}
            onChange={(e) => handleChange("repair_content", e.target.value)}
            placeholder="请详细描述维修内容..."
            rows={3}
            style={{
              ...inputStyle("repair_content"),
              resize: "vertical",
            }}
          />
          {errors.repair_content && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.repair_content}
            </div>
          )}
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <label style={labelStyle("parts_replaced")}>更换零部件</label>
          <textarea
            value={formData.parts_replaced}
            onChange={(e) => handleChange("parts_replaced", e.target.value)}
            placeholder="请列出更换的零部件（可选）"
            rows={2}
            style={{
              ...inputStyle("parts_replaced"),
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formData.is_guarantee}
                onChange={(e) => handleChange("is_guarantee", e.target.checked)}
                style={checkboxStyle()}
              />
              <span style={{ fontSize: "13px", color: "#374151" }}>是否在保修期内</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formData.material_complete}
                onChange={(e) => handleChange("material_complete", e.target.checked)}
                style={checkboxStyle()}
              />
              <span style={{ fontSize: "13px", color: "#374151" }}>资料齐全</span>
            </label>
          </div>
        </div>

        {!formData.material_complete && (
          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle("material_note")}>资料缺失说明</label>
            <textarea
              value={formData.material_note}
              onChange={(e) => handleChange("material_note", e.target.value)}
              placeholder="请说明缺失的资料..."
              rows={2}
              style={{
                ...inputStyle("material_note"),
                resize: "vertical",
              }}
            />
          </div>
        )}

        <div>
          <label style={labelStyle("acceptance_result", true)}>
            验收结果 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <select
            value={formData.acceptance_result}
            onChange={(e) => handleChange("acceptance_result", e.target.value)}
            style={inputStyle("acceptance_result")}
          >
            {acceptanceResults.map((result) => (
              <option key={result.value} value={result.value}>
                {result.label}
              </option>
            ))}
          </select>
          {errors.acceptance_result && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.acceptance_result}
            </div>
          )}
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <label style={labelStyle("acceptance_check_items")}>验收检查项</label>
          <textarea
            value={formData.acceptance_check_items}
            onChange={(e) => handleChange("acceptance_check_items", e.target.value)}
            placeholder="请列出验收检查的项目及结果..."
            rows={2}
            style={{
              ...inputStyle("acceptance_check_items"),
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <label style={labelStyle("acceptance_opinion")}>验收意见</label>
          <textarea
            value={formData.acceptance_opinion}
            onChange={(e) => handleChange("acceptance_opinion", e.target.value)}
            placeholder="请输入验收意见..."
            rows={3}
            style={{
              ...inputStyle("acceptance_opinion"),
              resize: "vertical",
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
