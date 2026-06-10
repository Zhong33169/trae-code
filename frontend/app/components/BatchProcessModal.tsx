import React, { useState } from "react";
import { Modal } from "./Modal";
import { BatchItemResult, BatchProcessResult } from "~/services/batch";
import { InspectionOrder } from "~/services/inspection";
import { formatDate } from "~/utils/helpers";

interface BatchProcessModalProps {
  open: boolean;
  onClose: () => void;
  selectedItems: InspectionOrder[];
  targetStatus: string;
  targetStatusLabel: string;
  onConfirm: () => Promise<BatchProcessResult | null>;
  loading: boolean;
}

export function BatchProcessModal({
  open,
  onClose,
  selectedItems,
  targetStatus,
  targetStatusLabel,
  onConfirm,
  loading,
}: BatchProcessModalProps) {
  const [result, setResult] = useState<BatchProcessResult | null>(null);
  const [opinion, setOpinion] = useState("");
  const [signature, setSignature] = useState("");

  const handleConfirm = async () => {
    const processResult = await onConfirm();
    if (processResult) {
      setResult(processResult);
    }
  };

  const handleClose = () => {
    setResult(null);
    setOpinion("");
    setSignature("");
    onClose();
  };

  const getResultStatusStyle = (success: boolean): React.CSSProperties => ({
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 500,
    backgroundColor: success ? "#dcfce7" : "#fee2e2",
    color: success ? "#166534" : "#991b1b",
  });

  if (!open) return null;

  return (
    <Modal
      open={open}
      title={
        result
          ? `批量${targetStatusLabel} - 处理结果`
          : `批量${targetStatusLabel} (${selectedItems.length}条)`
      }
      onClose={handleClose}
      width={result ? 800 : 600}
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
              onClick={handleConfirm}
              disabled={loading || selectedItems.length === 0}
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
              {loading ? "处理中..." : `确认${targetStatusLabel}`}
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
          <div
            style={{
              backgroundColor: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: "6px",
              padding: "12px 16px",
              marginBottom: "16px",
            }}
          >
            <div style={{ fontWeight: 600, color: "#92400e", marginBottom: "4px" }}>
              ⚠️ 批量操作确认
            </div>
            <div style={{ fontSize: "13px", color: "#92400e" }}>
              您即将将以下 <strong>{selectedItems.length}</strong> 条巡检单标记为 "
              <strong>{targetStatusLabel}</strong>"，此操作不可撤销，请确认。
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "8px",
              }}
            >
              已选巡检单列表：
            </div>
            <div
              style={{
                maxHeight: "200px",
                overflowY: "auto",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
              }}
            >
              {selectedItems.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderBottom: index < selectedItems.length - 1 ? "1px solid #f3f4f6" : "none",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <span style={{ color: "#374151", fontWeight: 500 }}>{item.order_no}</span>
                    <span style={{ color: "#6b7280", marginLeft: "12px" }}>
                      {item.charging_pile?.pile_name || "-"}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                    {formatDate(item.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 500,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              处理意见
            </label>
            <textarea
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              placeholder="请输入处理意见（可选）"
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

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
              签名
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="请输入签名确认"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
              padding: "16px",
              backgroundColor:
                result.statistics.failed_count > 0 ? "#fef2f2" : "#f0fdf4",
              borderRadius: "8px",
              border: `1px solid ${
                result.statistics.failed_count > 0 ? "#fecaca" : "#bbf7d0"
              }`,
            }}
          >
            <div
              style={{
                fontSize: "32px",
              }}
            >
              {result.statistics.failed_count > 0 ? "⚠️" : "✅"}
            </div>
            <div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: result.statistics.failed_count > 0 ? "#991b1b" : "#166534",
                }}
              >
                {result.statistics.failed_count > 0
                  ? "部分处理失败"
                  : "全部处理成功"}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                共 {result.statistics.total_count} 条，
                <span style={{ color: "#166534", fontWeight: 500 }}>
                  成功 {result.statistics.success_count} 条
                </span>
                ，
                <span style={{ color: "#991b1b", fontWeight: 500 }}>
                  失败 {result.statistics.failed_count} 条
                </span>
              </div>
              {result.request_id && (
                <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                  请求ID：{result.request_id}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
            }}
          >
            {result.results.map((item: BatchItemResult, index: number) => (
              <div
                key={item.inspection_order_id}
                style={{
                  padding: "16px",
                  borderBottom:
                    index < result.results.length - 1 ? "1px solid #f3f4f6" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontWeight: 500, color: "#374151" }}>
                      {item.order_no}
                    </span>
                    <span style={getResultStatusStyle(item.success)}>
                      {item.success ? "成功" : "失败"}
                    </span>
                  </div>
                </div>

                {!item.success && (
                  <>
                    {item.error_code && (
                      <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>
                        <span style={{ color: "#9ca3af" }}>错误代码：</span>
                        <span style={{ fontFamily: "monospace" }}>{item.error_code}</span>
                      </div>
                    )}
                    {item.error_message && (
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#991b1b",
                          backgroundColor: "#fef2f2",
                          padding: "8px 12px",
                          borderRadius: "4px",
                          marginBottom: "8px",
                        }}
                      >
                        ❌ {item.error_message}
                      </div>
                    )}
                    {item.suggestion && (
                      <div style={{ fontSize: "13px", color: "#92400e", marginBottom: "4px" }}>
                        💡 <strong>建议：</strong>
                        {item.suggestion}
                      </div>
                    )}
                    {item.next_step && (
                      <div style={{ fontSize: "13px", color: "#1e40af" }}>
                        👉 <strong>下一步：</strong>
                        {item.next_step}
                      </div>
                    )}
                  </>
                )}

                {item.success && item.current_status && (
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>
                    <span style={{ color: "#9ca3af" }}>当前状态：</span>
                    {item.current_status}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
