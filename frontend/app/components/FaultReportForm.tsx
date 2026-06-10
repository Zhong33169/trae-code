import React, { useState } from "react";
import { Modal } from "./Modal";
import { FaultReport } from "~/services/inspection";
import { validateRequired, validatePhone } from "~/utils/helpers";

interface FaultReportFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<FaultReport>) => Promise<boolean>;
  loading: boolean;
  orderNo?: string;
}

interface FormData {
  fault_code: string;
  fault_description: string;
  fault_level: string;
  fault_location: string;
  repair_deadline: string;
  repair_company: string;
  repair_contact: string;
  repair_phone: string;
  report_opinion: string;
  opinion: string;
  signature: string;
}

const initialFormData: FormData = {
  fault_code: "",
  fault_description: "",
  fault_level: "general",
  fault_location: "",
  repair_deadline: "",
  repair_company: "",
  repair_contact: "",
  repair_phone: "",
  report_opinion: "",
  opinion: "",
  signature: "",
};

const faultLevels = [
  { value: "minor", label: "轻微" },
  { value: "general", label: "一般" },
  { value: "major", label: "严重" },
  { value: "critical", label: "紧急" },
];

export function FaultReportForm({
  open,
  onClose,
  onSubmit,
  loading,
  orderNo,
}: FaultReportFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    field: keyof FormData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    const requiredFields: (keyof FormData)[] = [
      "fault_code",
      "fault_description",
      "fault_level",
      "repair_deadline",
    ];

    requiredFields.forEach((field) => {
      const error = validateRequired(formData[field]);
      if (error) newErrors[field] = error;
    });

    const phoneError = validatePhone(formData.repair_phone);
    if (phoneError) newErrors.repair_phone = phoneError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const success = await onSubmit(formData);
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
    border: `1px solid ${errors[field] ? "#ef4444" : "#d1d5db"}`,
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

  return (
    <Modal
      open={open}
      title={`故障报告 - ${orderNo || ""}`}
      onClose={handleClose}
      width={600}
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
              backgroundColor: "#ef4444",
              color: "#fff",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "提交中..." : "提交故障报告"}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
        <div>
          <label style={labelStyle("fault_code", true)}>
            故障编码 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="text"
            value={formData.fault_code}
            onChange={(e) => handleChange("fault_code", e.target.value)}
            placeholder="如：FAULT-001"
            style={inputStyle("fault_code")}
          />
          {errors.fault_code && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.fault_code}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle("fault_level", true)}>
            故障等级 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <select
            value={formData.fault_level}
            onChange={(e) => handleChange("fault_level", e.target.value)}
            style={inputStyle("fault_level")}
          >
            {faultLevels.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
          {errors.fault_level && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.fault_level}
            </div>
          )}
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <label style={labelStyle("fault_description", true)}>
            故障描述 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            value={formData.fault_description}
            onChange={(e) => handleChange("fault_description", e.target.value)}
            placeholder="请详细描述故障情况..."
            rows={3}
            style={{
              ...inputStyle("fault_description"),
              resize: "vertical",
            }}
          />
          {errors.fault_description && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.fault_description}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle("fault_location")}>故障位置</label>
          <input
            type="text"
            value={formData.fault_location}
            onChange={(e) => handleChange("fault_location", e.target.value)}
            placeholder="如：A区3号充电桩"
            style={inputStyle("fault_location")}
          />
        </div>

        <div>
          <label style={labelStyle("repair_deadline", true)}>
            修复期限 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="date"
            value={formData.repair_deadline}
            onChange={(e) => handleChange("repair_deadline", e.target.value)}
            style={inputStyle("repair_deadline")}
          />
          {errors.repair_deadline && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.repair_deadline}
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle("repair_company")}>维修单位</label>
          <input
            type="text"
            value={formData.repair_company}
            onChange={(e) => handleChange("repair_company", e.target.value)}
            placeholder="请输入维修单位名称"
            style={inputStyle("repair_company")}
          />
        </div>

        <div>
          <label style={labelStyle("repair_contact")}>联系人</label>
          <input
            type="text"
            value={formData.repair_contact}
            onChange={(e) => handleChange("repair_contact", e.target.value)}
            placeholder="请输入联系人姓名"
            style={inputStyle("repair_contact")}
          />
        </div>

        <div style={{ gridColumn: "span 2" }}>
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

        <div style={{ gridColumn: "span 2" }}>
          <label style={labelStyle("report_opinion")}>上报意见</label>
          <textarea
            value={formData.report_opinion}
            onChange={(e) => handleChange("report_opinion", e.target.value)}
            placeholder="请输入上报意见或补充说明（可选）"
            rows={2}
            style={{
              ...inputStyle("report_opinion"),
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ gridColumn: "span 2" }}>
          <label style={labelStyle("opinion")}>办理意见</label>
          <textarea
            value={formData.opinion}
            onChange={(e) => handleChange("opinion", e.target.value)}
            placeholder="请输入办理意见（可选）"
            rows={2}
            style={{
              ...inputStyle("opinion"),
              resize: "vertical",
            }}
          />
        </div>

        <div>
          <label style={labelStyle("signature")}>
            办理签名 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="text"
            value={formData.signature}
            onChange={(e) => handleChange("signature", e.target.value)}
            placeholder="请输入办理人签名"
            style={inputStyle("signature")}
          />
          {errors.signature && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.signature}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
