import React, { useState } from "react";
import { Modal } from "./Modal";
import { INSPECTION_STATUS_LABELS } from "~/config";
import { validateRequired } from "~/utils/helpers";

interface StatusFlowModalProps {
  open: boolean;
  onClose: () => void;
  targetStatus: string;
  targetStatusLabel?: string;
  onConfirm: (data: { opinion: string; signature: string }) => Promise<boolean>;
  loading: boolean;
  requireOpinion?: boolean;
  requireSignature?: boolean;
  orderNo?: string;
  currentVersion?: number;
}

export function StatusFlowModal({
  open,
  onClose,
  targetStatus,
  targetStatusLabel,
  onConfirm,
  loading,
  requireOpinion = true,
  requireSignature = true,
  orderNo,
  currentVersion,
}: StatusFlowModalProps) {
  const [opinion, setOpinion] = useState("");
  const [signature, setSignature] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const displayLabel = targetStatusLabel || INSPECTION_STATUS_LABELS[targetStatus] || targetStatus;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (requireOpinion) {
      const error = validateRequired(opinion);
      if (error) newErrors.opinion = error;
    }
    if (requireSignature) {
      const error = validateRequired(signature);
      if (error) newErrors.signature = error;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    const success = await onConfirm({ opinion, signature });
    if (success) {
      setOpinion("");
      setSignature("");
      setErrors({});
    }
  };

  const handleClose = () => {
    setOpinion("");
    setSignature("");
    setErrors({});
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      title={`${displayLabel} - ${orderNo || ""}`}
      onClose={handleClose}
      width={500}
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
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: "8px 20px",
              border: "none",
              backgroundColor: "#3b82f6",
              color: "#fff",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "处理中..." : `确认${displayLabel}`}
          </button>
        </>
      }
    >
      <div>
        <div
          style={{
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            padding: "12px 16px",
            marginBottom: "16px",
            fontSize: "13px",
            color: "#1e40af",
          }}
        >
          <div style={{ marginBottom: "4px" }}>
            <strong>操作说明：</strong>
          </div>
          <div>
            您即将将此巡检单状态更新为
            <span
              style={{
                fontWeight: 600,
                backgroundColor: "#dbeafe",
                padding: "2px 8px",
                borderRadius: "4px",
                margin: "0 4px",
              }}
            >
              {displayLabel}
            </span>
          </div>
          {currentVersion !== undefined && (
            <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.8 }}>
              当前版本号：v{currentVersion}
            </div>
          )}
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "13px",
              fontWeight: 500,
              color: "#374151",
              marginBottom: "6px",
            }}
          >
            处理意见
            {requireOpinion && (
              <span style={{ color: "#ef4444", marginLeft: "4px" }}>*</span>
            )}
          </label>
          <textarea
            value={opinion}
            onChange={(e) => {
              setOpinion(e.target.value);
              if (errors.opinion) {
                setErrors((prev) => ({ ...prev, opinion: "" }));
              }
            }}
            placeholder={`请输入${displayLabel}意见...`}
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1px solid ${errors.opinion ? "#ef4444" : "#d1d5db"}`,
              borderRadius: "4px",
              fontSize: "14px",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          {errors.opinion && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.opinion}
            </div>
          )}
        </div>

        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: "13px",
              fontWeight: 500,
              color: "#374151",
              marginBottom: "6px",
            }}
          >
            签名确认
            {requireSignature && (
              <span style={{ color: "#ef4444", marginLeft: "4px" }}>*</span>
            )}
          </label>
          <input
            type="text"
            value={signature}
            onChange={(e) => {
              setSignature(e.target.value);
              if (errors.signature) {
                setErrors((prev) => ({ ...prev, signature: "" }));
              }
            }}
            placeholder="请输入您的姓名进行签名确认"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1px solid ${errors.signature ? "#ef4444" : "#d1d5db"}`,
              borderRadius: "4px",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
          {errors.signature && (
            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
              {errors.signature}
            </div>
          )}
          <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "6px" }}>
            签名表示您已审阅并确认上述处理意见
          </div>
        </div>
      </div>
    </Modal>
  );
}
