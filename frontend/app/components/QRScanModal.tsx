import React, { useState } from "react";
import { Modal } from "./Modal";
import { ScanResultResponse } from "~/services/qrScan";
import { formatDate } from "~/utils/helpers";
import { SCAN_RESULT_LABELS } from "~/config";

interface QRScanModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (qrContent: string) => Promise<ScanResultResponse | null>;
  loading: boolean;
  inspectionOrderId?: number;
}

export function QRScanModal({
  open,
  onClose,
  onScan,
  loading,
  inspectionOrderId,
}: QRScanModalProps) {
  const [qrContent, setQrContent] = useState("");
  const [result, setResult] = useState<ScanResultResponse | null>(null);
  const [scanningMode, setScanningMode] = useState<"manual" | "simulate">("manual");

  const handleScan = async () => {
    if (!qrContent.trim()) return;
    const scanResult = await onScan(qrContent.trim());
    if (scanResult) {
      setResult(scanResult);
    }
  };

  const handleSimulateScan = () => {
    const mockQRCodes = [
      `CP-${String(Math.floor(Math.random() * 100)).padStart(6, "0")}-QR-${Date.now()}`,
      "CP-000001-QR-20240101",
      "CP-000002-QR-20240102",
    ];
    const randomQR = mockQRCodes[Math.floor(Math.random() * mockQRCodes.length)];
    setQrContent(randomQR);
  };

  const handleClose = () => {
    setQrContent("");
    setResult(null);
    setScanningMode("manual");
    onClose();
  };

  const getResultColor = (success: boolean, resultCode: string) => {
    if (success) return "#10b981";
    const errorColors: Record<string, string> = {
      invalid_qr: "#ef4444",
      duplicate_scan: "#f59e0b",
      user_mismatch: "#f97316",
      order_not_found: "#6b7280",
      invalid_status: "#8b5cf6",
      pile_not_match: "#dc2626",
      time_out: "#0ea5e9",
    };
    return errorColors[resultCode] || "#ef4444";
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      title={result ? "扫码核验结果" : "扫码核验"}
      onClose={handleClose}
      width={600}
      footer={
        !result ? (
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
              onClick={handleScan}
              disabled={loading || !qrContent.trim()}
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
              {loading ? "核验中..." : "确认核验"}
            </button>
          </>
        ) : (
          <button
            onClick={handleClose}
            style={{
              padding: "8px 24px",
              border: "none",
              backgroundColor: "#3b82f6",
              color: "#fff",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            关闭
          </button>
        )
      }
    >
      {!result ? (
        <div>
          {inspectionOrderId && (
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
              📋 正在为巡检单 ID: {inspectionOrderId} 进行扫码核验
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <button
              onClick={() => setScanningMode("manual")}
              style={{
                flex: 1,
                padding: "10px",
                border: `2px solid ${scanningMode === "manual" ? "#3b82f6" : "#d1d5db"}`,
                backgroundColor: scanningMode === "manual" ? "#eff6ff" : "#fff",
                color: scanningMode === "manual" ? "#1e40af" : "#6b7280",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              ✏️ 手动输入
            </button>
            <button
              onClick={() => setScanningMode("simulate")}
              style={{
                flex: 1,
                padding: "10px",
                border: `2px solid ${scanningMode === "simulate" ? "#3b82f6" : "#d1d5db"}`,
                backgroundColor: scanningMode === "simulate" ? "#eff6ff" : "#fff",
                color: scanningMode === "simulate" ? "#1e40af" : "#6b7280",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              📷 模拟扫码
            </button>
          </div>

          {scanningMode === "manual" ? (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                二维码内容
              </label>
              <textarea
                value={qrContent}
                onChange={(e) => setQrContent(e.target.value)}
                placeholder="请输入或粘贴二维码内容"
                rows={4}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontFamily: "monospace",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  marginTop: "8px",
                }}
              >
                💡 提示：二维码内容格式示例：CP-000001-QR-20240101
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  border: "2px dashed #d1d5db",
                  borderRadius: "8px",
                  padding: "40px",
                  textAlign: "center",
                  backgroundColor: "#f9fafb",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontSize: "64px", marginBottom: "16px" }}>📷</div>
                <div style={{ fontSize: "16px", color: "#374151", marginBottom: "8px" }}>
                  模拟扫描二维码
                </div>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
                  点击下方按钮模拟扫描一个随机二维码
                </div>
                <button
                  onClick={handleSimulateScan}
                  style={{
                    padding: "10px 24px",
                    border: "none",
                    backgroundColor: "#10b981",
                    color: "#fff",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  🎯 开始模拟扫码
                </button>
              </div>

              {qrContent && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#374151",
                      marginBottom: "6px",
                    }}
                  >
                    扫描到的二维码内容：
                  </label>
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "6px",
                      fontFamily: "monospace",
                      fontSize: "13px",
                      color: "#166534",
                      wordBreak: "break-all",
                    }}
                  >
                    {qrContent}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "16px",
              padding: "20px",
              backgroundColor: result.success ? "#f0fdf4" : "#fef2f2",
              borderRadius: "8px",
              border: `1px solid ${result.success ? "#bbf7d0" : "#fecaca"}`,
              marginBottom: "16px",
            }}
          >
            <div style={{ fontSize: "40px" }}>
              {result.success ? "✅" : "❌"}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: result.success ? "#166534" : "#991b1b",
                  marginBottom: "4px",
                }}
              >
                {result.result_label ||
                  SCAN_RESULT_LABELS[result.result] ||
                  (result.success ? "核验成功" : "核验失败")}
              </div>
              <div style={{ fontSize: "14px", color: "#374151" }}>
                {result.message}
              </div>
              {result.scan_time && (
                <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px" }}>
                  核验时间：{formatDate(result.scan_time)}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            {result.inspection_order_no && (
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "6px",
                }}
              >
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                  关联巡检单
                </div>
                <div style={{ fontSize: "14px", color: "#111827", fontWeight: 500 }}>
                  {result.inspection_order_no}
                </div>
              </div>
            )}
            {result.record_id && (
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "6px",
                }}
              >
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                  记录ID
                </div>
                <div style={{ fontSize: "14px", color: "#111827", fontFamily: "monospace" }}>
                  {result.record_id}
                </div>
              </div>
            )}
          </div>

          {!result.success && result.suggestion && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "#fef3c7",
                borderLeft: "4px solid #f59e0b",
                borderRadius: "4px",
                marginBottom: "12px",
                fontSize: "13px",
                color: "#92400e",
              }}
            >
              💡 <strong>建议：</strong>
              {result.suggestion}
            </div>
          )}

          {!result.success && result.next_step && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "#eff6ff",
                borderLeft: "4px solid #3b82f6",
                borderRadius: "4px",
                fontSize: "13px",
                color: "#1e40af",
              }}
            >
              👉 <strong>下一步操作：</strong>
              {result.next_step}
            </div>
          )}

          {result.success && result.next_step && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "#f0fdf4",
                borderLeft: "4px solid #10b981",
                borderRadius: "4px",
                fontSize: "13px",
                color: "#166534",
              }}
            >
              ✨ <strong>后续操作：</strong>
              {result.next_step}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
