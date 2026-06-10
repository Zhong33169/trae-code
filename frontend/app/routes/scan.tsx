import React, { useState, useEffect } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useToast } from "~/hooks/useToast";
import { formatDate, generateRequestId } from "~/utils/helpers";
import { StatusBadge } from "~/components/StatusBadge";
import { Table } from "~/components/Table";
import { Pagination } from "~/components/Pagination";
import {
  scanQRCode,
  getQRCodeRecords,
  type QRCodeScanRequest,
  type ScanResultResponse,
} from "~/services/qrScan";
import { type QRCodeRecord } from "~/services/inspection";
import { SCAN_RESULT_LABELS } from "~/config";

const SCAN_RESULT_COLORS: Record<string, string> = {
  success: "#10b981",
  invalid_qr: "#ef4444",
  duplicate_scan: "#f59e0b",
  user_mismatch: "#ef4444",
  order_not_found: "#ef4444",
  invalid_status: "#f59e0b",
  pile_not_match: "#ef4444",
  time_out: "#f59e0b",
};

const SCAN_SUGGESTIONS: Record<string, string> = {
  success: "核验成功，可以继续巡检流程。",
  invalid_qr: "请检查二维码是否损坏或使用正确的二维码。",
  duplicate_scan: "该二维码已被扫码核验过，无需重复操作。",
  user_mismatch: "请确认您是该巡检单指定的巡检员。",
  order_not_found: "请检查二维码对应的巡检单是否存在。",
  invalid_status: "该巡检单当前状态不允许扫码，请先处理前置流程。",
  pile_not_match: "请确认扫码的充电桩与巡检单指定的充电桩一致。",
  time_out: "扫码已超时，请在规定时间内完成扫码。",
};

const SCAN_NEXT_STEPS: Record<string, string> = {
  success: "继续完成巡检单的检查项填写。",
  invalid_qr: "重新扫描正确的二维码或手动输入二维码内容。",
  duplicate_scan: "查看巡检单详情，继续后续流程。",
  user_mismatch: "联系管理员更换巡检员或使用正确账号登录。",
  order_not_found: "确认巡检单是否已创建，或联系管理员。",
  invalid_status: "查看巡检单当前状态，完成前置操作后再扫码。",
  pile_not_match: "找到正确的充电桩重新扫码。",
  time_out: "重新发起扫码操作。",
};

export default function ScanPage() {
  const { user, loading } = useAuth();
  const { success, error, warning, info } = useToast();

  const [mode, setMode] = useState<"input" | "simulate">("input");
  const [qrContent, setQrContent] = useState("");
  const [note, setNote] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<ScanResultResponse | null>(null);
  const [showResult, setShowResult] = useState(false);

  const [records, setRecords] = useState<QRCodeRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadRecords();
  }, [page, pageSize]);

  async function loadRecords() {
    try {
      setLoadingRecords(true);
      const response = await getQRCodeRecords({
        page,
        page_size: pageSize,
      });
      setRecords(response.items);
      setTotal(response.total);
    } catch (err: any) {
      error("加载扫码记录失败：" + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingRecords(false);
    }
  }

  async function handleVerify() {
    if (!qrContent.trim()) {
      warning("请输入二维码内容");
      return;
    }

    try {
      setVerifying(true);
      const requestId = generateRequestId();

      const requestData: QRCodeScanRequest = {
        qr_code_content: qrContent.trim(),
        note: note || undefined,
        request_id: requestId,
      };

      const result = await scanQRCode(requestData);
      setVerifyResult(result);
      setShowResult(true);

      if (result.success) {
        success("扫码核验成功！");
        loadRecords();
      } else {
        warning("扫码核验失败");
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        error("提交冲突，请刷新后重试");
      } else {
        error("核验失败：" + (err.response?.data?.detail || err.message));
      }
    } finally {
      setVerifying(false);
    }
  }

  function handleSimulateScan() {
    const simulatedQR = `CP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setQrContent(simulatedQR);
    info("已生成模拟二维码内容");
  }

  function handleClear() {
    setQrContent("");
    setNote("");
    setVerifyResult(null);
    setShowResult(false);
  }

  function handlePageChange(newPage: number, newPageSize: number) {
    setPage(newPage);
    setPageSize(newPageSize);
  }

  const columns = [
    {
      key: "id",
      title: "ID",
      width: 60,
    },
    {
      key: "qr_code_content",
      title: "二维码内容",
      render: (record: QRCodeRecord) => (
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#374151" }}>
          {record.qr_code_content}
        </span>
      ),
    },
    {
      key: "scan_time",
      title: "扫码时间",
      render: (record: QRCodeRecord) => formatDate(record.scan_time),
    },
    {
      key: "result",
      title: "核验结果",
      render: (record: QRCodeRecord) => (
        <span
          style={{
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: `${SCAN_RESULT_COLORS[record.result]}15`,
            color: SCAN_RESULT_COLORS[record.result],
          }}
        >
          {record.result_label}
        </span>
      ),
    },
    {
      key: "inspection_order_id",
      title: "关联巡检单",
      render: (record: QRCodeRecord) =>
        record.inspection_order_id ? (
          <a
            href={`/inspections/${record.inspection_order_id}`}
            style={{ color: "#3b82f6", textDecoration: "none" }}
          >
            #{record.inspection_order_id}
          </a>
        ) : (
          <span style={{ color: "#9ca3af" }}>-</span>
        ),
    },
    {
      key: "note",
      title: "备注",
      render: (record: QRCodeRecord) => record.note || "-",
    },
    {
      key: "created_at",
      title: "创建时间",
      render: (record: QRCodeRecord) => formatDate(record.created_at),
    },
  ];

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: 16, color: "#6b7280" }}>加载中...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>扫码核验</h1>
          <p style={styles.subtitle}>扫码核验充电桩二维码，确认巡检位置</p>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.scanSection}>
          <div style={styles.modeTabs}>
            <button
              style={{
                ...styles.modeTab,
                backgroundColor: mode === "input" ? "#3b82f6" : "#f3f4f6",
                color: mode === "input" ? "#fff" : "#374151",
              }}
              onClick={() => setMode("input")}
            >
              手动输入
            </button>
            <button
              style={{
                ...styles.modeTab,
                backgroundColor: mode === "simulate" ? "#3b82f6" : "#f3f4f6",
                color: mode === "simulate" ? "#fff" : "#374151",
              }}
              onClick={() => setMode("simulate")}
            >
              模拟扫码
            </button>
          </div>

          <div style={styles.scanCard}>
            {mode === "simulate" && (
              <div style={styles.simulateSection}>
                <div style={styles.simulateIcon}>
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h3v3h-3z" />
                    <path d="M20 14v3" />
                    <path d="M14 20h3" />
                  </svg>
                </div>
                <p style={styles.simulateText}>
                  点击下方按钮模拟扫码，系统将生成随机二维码内容
                </p>
                <button style={styles.simulateButton} onClick={handleSimulateScan}>
                  模拟扫码
                </button>
              </div>
            )}

            <div style={styles.inputSection}>
              <label style={styles.label}>
                二维码内容 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                style={styles.input}
                value={qrContent}
                onChange={(e) => setQrContent(e.target.value)}
                placeholder="请输入或扫描二维码内容"
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              />

              <label style={{ ...styles.label, marginTop: 16 }}>备注（选填）</label>
              <textarea
                style={styles.textarea}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="请输入扫码备注信息"
                rows={3}
              />

              <div style={styles.buttonGroup}>
                <button style={styles.clearButton} onClick={handleClear}>
                  清空
                </button>
                <button
                  style={styles.verifyButton}
                  onClick={handleVerify}
                  disabled={verifying}
                >
                  {verifying ? "核验中..." : "核验"}
                </button>
              </div>
            </div>
          </div>

          {showResult && verifyResult && (
            <div
              style={{
                ...styles.resultCard,
                borderLeftColor: verifyResult.success ? "#10b981" : "#ef4444",
              }}
            >
              <div style={styles.resultHeader}>
                <div style={styles.resultTitle}>
                  <span
                    style={{
                      ...styles.resultIcon,
                      backgroundColor: verifyResult.success ? "#d1fae5" : "#fee2e2",
                      color: verifyResult.success ? "#10b981" : "#ef4444",
                    }}
                  >
                    {verifyResult.success ? "✓" : "✕"}
                  </span>
                  <span style={styles.resultTitleText}>
                    {verifyResult.success ? "核验成功" : "核验失败"}
                  </span>
                </div>
                <StatusBadge
                  status={verifyResult.success ? "archived" : "cancelled"}
                  label={SCAN_RESULT_LABELS[verifyResult.result] || verifyResult.result}
                />
              </div>

              <div style={styles.resultDetails}>
                <div style={styles.resultItem}>
                  <span style={styles.resultLabel}>结果代码：</span>
                  <span style={styles.resultValue}>{verifyResult.result}</span>
                </div>
                <div style={styles.resultItem}>
                  <span style={styles.resultLabel}>消息：</span>
                  <span style={styles.resultValue}>{verifyResult.message}</span>
                </div>
                {verifyResult.inspection_order_id && (
                  <div style={styles.resultItem}>
                    <span style={styles.resultLabel}>关联巡检单：</span>
                    <a
                      href={`/inspections/${verifyResult.inspection_order_id}`}
                      style={{ color: "#3b82f6", textDecoration: "none" }}
                    >
                      #{verifyResult.inspection_order_id}
                    </a>
                  </div>
                )}
                {verifyResult.scan_time && (
                  <div style={styles.resultItem}>
                    <span style={styles.resultLabel}>扫码时间：</span>
                    <span style={styles.resultValue}>
                      {formatDate(verifyResult.scan_time)}
                    </span>
                  </div>
                )}
              </div>

              <div style={styles.resultSuggestion}>
                <div style={styles.suggestionTitle}>💡 建议</div>
                <p style={styles.suggestionText}>
                  {verifyResult.suggestion ||
                    SCAN_SUGGESTIONS[verifyResult.result] ||
                    verifyResult.message}
                </p>
              </div>

              <div style={styles.resultNextStep}>
                <div style={styles.nextStepTitle}>➡️ 下一步</div>
                <p style={styles.nextStepText}>
                  {verifyResult.next_step ||
                    SCAN_NEXT_STEPS[verifyResult.result] ||
                    "请根据实际情况处理。"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={styles.recordsSection}>
          <h2 style={styles.sectionTitle}>最近扫码记录</h2>
          <Table
            columns={columns}
            data={records}
            loading={loadingRecords}
            rowKey="id"
            emptyText="暂无扫码记录"
          />
          <div style={styles.paginationWrapper}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              onChange={handlePageChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: 24,
    maxWidth: 1200,
    margin: "0 auto",
  },
  loading: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 400,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #e5e7eb",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    color: "#111827",
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  content: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  },
  scanSection: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  modeTabs: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
  },
  modeTab: {
    padding: "8px 20px",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  scanCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 24,
  },
  simulateSection: {
    textAlign: "center" as const,
    padding: "20px 0",
    borderBottom: "1px dashed #e5e7eb",
    marginBottom: 24,
  },
  simulateIcon: {
    width: 80,
    height: 80,
    margin: "0 auto 16px",
    backgroundColor: "#eff6ff",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  simulateText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
  },
  simulateButton: {
    padding: "10px 24px",
    border: "none",
    borderRadius: 6,
    backgroundColor: "#3b82f6",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  inputSection: {},
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    fontFamily: "monospace",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  buttonGroup: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 20,
  },
  clearButton: {
    padding: "10px 20px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#374151",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  verifyButton: {
    padding: "10px 24px",
    border: "none",
    borderRadius: 6,
    backgroundColor: "#3b82f6",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  resultCard: {
    marginTop: 24,
    padding: 20,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderLeft: "4px solid #10b981",
  },
  resultHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  resultTitle: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 600,
  },
  resultTitleText: {
    fontSize: 16,
    fontWeight: 600,
    color: "#111827",
  },
  resultDetails: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 6,
  },
  resultItem: {
    fontSize: 13,
  },
  resultLabel: {
    color: "#6b7280",
  },
  resultValue: {
    color: "#111827",
    fontWeight: 500,
  },
  resultSuggestion: {
    padding: 12,
    backgroundColor: "#fffbeb",
    borderRadius: 6,
    marginBottom: 12,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#92400e",
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 13,
    color: "#78350f",
    margin: 0,
  },
  resultNextStep: {
    padding: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    marginBottom: 12,
  },
  nextStepTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e40af",
    marginBottom: 4,
  },
  nextStepText: {
    fontSize: 13,
    color: "#1e3a8a",
    margin: 0,
  },
  recordsSection: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#111827",
    margin: "0 0 20px 0",
    paddingBottom: 12,
    borderBottom: "1px solid #e5e7eb",
  },
  paginationWrapper: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
  },
};
