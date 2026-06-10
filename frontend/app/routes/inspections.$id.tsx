import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "@remix-run/react";
import { useAuth } from "~/hooks/useAuth";
import { useToast } from "~/hooks/useToast";
import {
  getInspectionOrder,
  updateInspectionStatus,
  submitFaultReport,
  submitRepairComplete,
  submitRepairAcceptance,
  InspectionOrderWithDetails,
  FaultReport,
  RepairAcceptance,
} from "~/services/inspection";
import { getInspectionAuditLogs } from "~/services/audit";
import { scanQRCode } from "~/services/qrScan";
import { AuditLog } from "~/services/audit";
import { StatusBadge } from "~/components/StatusBadge";
import { StatusFlowModal } from "~/components/StatusFlowModal";
import { FaultReportForm } from "~/components/FaultReportForm";
import { RepairAcceptanceForm } from "~/components/RepairAcceptanceForm";
import { QRScanModal } from "~/components/QRScanModal";
import { AuditTimeline } from "~/components/AuditTimeline";
import { ConfirmModal } from "~/components/Modal";
import {
  formatDate,
  formatDateOnly,
  formatCurrency,
  generateRequestId,
  getCheckResultLabel,
  getCheckResultColor,
} from "~/utils/helpers";
import {
  INSPECTION_TYPE_LABELS,
  SCAN_RESULT_LABELS,
  ACTION_CONFIGS,
} from "~/config";
import { ScanResultResponse } from "~/services/qrScan";

export function meta() {
  return [{ title: "巡检单详情 - 充电桩巡检系统" }];
}

function InspectionDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasRole, user } = useAuth();
  const { success, error, warning, info } = useToast();

  const id = parseInt(params.id || "0");
  const queryParams = new URLSearchParams(location.search);
  const urlAction = queryParams.get("action");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InspectionOrderWithDetails | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "timeline">("basic");

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [targetStatusLabel, setTargetStatusLabel] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);

  const [faultModalOpen, setFaultModalOpen] = useState(false);
  const [faultLoading, setFaultLoading] = useState(false);

  const [acceptanceModalOpen, setAcceptanceModalOpen] = useState(false);
  const [acceptanceLoading, setAcceptanceLoading] = useState(false);

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  const [versionConflictModalOpen, setVersionConflictModalOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");

  const [repairCompleteModalOpen, setRepairCompleteModalOpen] = useState(false);
  const [repairCompleteLoading, setRepairCompleteLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, logs] = await Promise.all([
        getInspectionOrder(id),
        getInspectionAuditLogs(id, { page_size: 100 }),
      ]);
      setData(detail);
      setAuditLogs(logs.items);

      if (urlAction) {
        setTimeout(() => {
          switch (urlAction) {
            case "scan_qr":
              if (detail.allowed_actions?.includes("scan_qr")) {
                setQrModalOpen(true);
              }
              break;
            case "submit_fault_report":
              if (detail.allowed_actions?.includes("submit_fault_report")) {
                setFaultModalOpen(true);
              }
              break;
            case "mark_repair_complete":
              if (detail.allowed_actions?.includes("mark_repair_complete")) {
                setRepairCompleteModalOpen(true);
              }
              break;
            case "acceptance_pass":
            case "acceptance_reject":
              if (
                detail.allowed_actions?.includes("acceptance_pass") ||
                detail.allowed_actions?.includes("acceptance_reject")
              ) {
                setAcceptanceModalOpen(true);
              }
              break;
            case "submit":
            case "approve":
            case "reject":
            case "report_fault":
            case "mark_repair_start":
            case "submit_acceptance":
            case "archive":
            case "final_reject":
              if (detail.allowed_actions?.includes(urlAction)) {
                const config = ACTION_CONFIGS[urlAction];
                if (config?.target_status) {
                  setTargetStatus(config.target_status);
                  setTargetStatusLabel(config.label);
                  setStatusModalOpen(true);
                }
              }
              break;
            default:
              break;
          }
        }, 100);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || "加载数据失败";
      error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id, error, urlAction]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  const handleStatusAction = (status: string, label: string) => {
    if (!data?.can_operate) {
      warning("当前状态不允许操作或您没有权限");
      return;
    }
    setTargetStatus(status);
    setTargetStatusLabel(label);
    setStatusModalOpen(true);
  };

  const handleStatusConfirm = async (formData: {
    opinion: string;
    signature: string;
  }): Promise<boolean> => {
    if (!data) return false;
    setStatusLoading(true);
    try {
      const requestId = generateRequestId();
      await updateInspectionStatus(data.id, {
        target_status: targetStatus,
        opinion: formData.opinion,
        signature: formData.signature,
        request_id: requestId,
        current_version: data.version,
      });
      success(`${targetStatusLabel}成功`);
      setStatusModalOpen(false);
      loadData();
      return true;
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictMessage(
          err.response.data?.detail || "版本冲突，该巡检单已被其他用户修改"
        );
        setVersionConflictModalOpen(true);
        return false;
      }
      const errorMessage = err.response?.data?.detail || "操作失败";
      error(errorMessage);
      return false;
    } finally {
      setStatusLoading(false);
    }
  };

  const handleFaultSubmit = async (
    formData: Partial<FaultReport>
  ): Promise<boolean> => {
    if (!data) return false;
    setFaultLoading(true);
    try {
      await submitFaultReport(data.id, formData);
      success("故障报告提交成功");
      setFaultModalOpen(false);
      loadData();
      return true;
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictMessage(
          err.response.data?.detail || "版本冲突，该巡检单已被其他用户修改"
        );
        setVersionConflictModalOpen(true);
        return false;
      }
      const errorMessage = err.response?.data?.detail || "提交失败";
      error(errorMessage);
      return false;
    } finally {
      setFaultLoading(false);
    }
  };

  const handleRepairComplete = async (): Promise<void> => {
    if (!data) return;
    setRepairCompleteLoading(true);
    try {
      await submitRepairComplete(data.id);
      success("修复完成，已提交验收");
      setRepairCompleteModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictMessage(
          err.response.data?.detail || "版本冲突，该巡检单已被其他用户修改"
        );
        setVersionConflictModalOpen(true);
        return;
      }
      const errorMessage = err.response?.data?.detail || "操作失败";
      error(errorMessage);
    } finally {
      setRepairCompleteLoading(false);
    }
  };

  const handleAcceptanceSubmit = async (
    formData: Partial<RepairAcceptance>
  ): Promise<boolean> => {
    if (!data) return false;
    setAcceptanceLoading(true);
    try {
      await submitRepairAcceptance(data.id, formData);
      success("修复验收提交成功");
      setAcceptanceModalOpen(false);
      loadData();
      return true;
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictMessage(
          err.response.data?.detail || "版本冲突，该巡检单已被其他用户修改"
        );
        setVersionConflictModalOpen(true);
        return false;
      }
      const errorMessage = err.response?.data?.detail || "提交失败";
      error(errorMessage);
      return false;
    } finally {
      setAcceptanceLoading(false);
    }
  };

  const handleQRScan = async (
    qrContent: string
  ): Promise<ScanResultResponse | null> => {
    setQrLoading(true);
    try {
      const requestId = generateRequestId();
      const result = await scanQRCode({
        qr_code_content: qrContent,
        inspection_order_id: id,
        request_id: requestId,
      });
      if (result.success) {
        success("扫码核验成功");
        loadData();
      } else {
        warning(`扫码核验失败：${result.message}`);
      }
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || "扫码核验失败";
      error(errorMessage);
      return null;
    } finally {
      setQrLoading(false);
    }
  };

  const handleRefresh = () => {
    setVersionConflictModalOpen(false);
    loadData();
  };

  const checkItems = [
    {
      key: "appearance",
      label: "外观检查",
      resultKey: "appearance_check",
      noteKey: "appearance_note",
    },
    {
      key: "cable",
      label: "线缆检查",
      resultKey: "cable_check",
      noteKey: "cable_note",
    },
    {
      key: "connector",
      label: "接头检查",
      resultKey: "connector_check",
      noteKey: "connector_note",
    },
    {
      key: "display",
      label: "显示屏检查",
      resultKey: "display_check",
      noteKey: "display_note",
    },
    {
      key: "charging",
      label: "充电功能检查",
      resultKey: "charging_check",
      noteKey: "charging_note",
    },
    {
      key: "emergency_stop",
      label: "急停按钮检查",
      resultKey: "emergency_stop_check",
      noteKey: "emergency_stop_note",
    },
    {
      key: "grounding",
      label: "接地检查",
      resultKey: "grounding_check",
      noteKey: "grounding_note",
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: "80px", textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            width: "40px",
            height: "40px",
            border: "3px solid #e5e7eb",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div style={{ marginTop: "16px", color: "#6b7280" }}>加载中...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "80px", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>📋</div>
        <div style={{ fontSize: "16px", color: "#6b7280", marginBottom: "16px" }}>
          巡检单不存在或已被删除
        </div>
        <button
          onClick={() => navigate("/inspections")}
          style={{
            padding: "8px 20px",
            border: "1px solid #d1d5db",
            backgroundColor: "#fff",
            color: "#374151",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          返回列表
        </button>
      </div>
    );
  }

  const sectionStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    borderRadius: "12px",
    marginBottom: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };

  const sectionHeaderStyle: React.CSSProperties = {
    padding: "16px 20px",
    borderBottom: "1px solid #f3f4f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "15px",
    fontWeight: 600,
    color: "#111827",
  };

  const sectionBodyStyle: React.CSSProperties = {
    padding: "20px",
  };

  const infoRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  };

  const infoItemStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  };

  const infoLabelStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#6b7280",
  };

  const infoValueStyle: React.CSSProperties = {
    fontSize: "14px",
    color: "#111827",
  };

  const getActionButton = (actionKey: string) => {
    const config = ACTION_CONFIGS[actionKey];
    if (!config) return null;
    if (!data.allowed_actions?.includes(actionKey)) return null;

    const handleClick = () => {
      switch (actionKey) {
        case "scan_qr":
          setQrModalOpen(true);
          break;
        case "update":
          navigate(`/inspections/${data.id}/edit`);
          break;
        case "submit_fault_report":
          setFaultModalOpen(true);
          break;
        case "mark_repair_complete":
          setRepairCompleteModalOpen(true);
          break;
        case "acceptance_pass":
        case "acceptance_reject":
          setAcceptanceModalOpen(true);
          break;
        case "submit":
        case "approve":
        case "reject":
        case "report_fault":
        case "mark_repair_start":
        case "submit_acceptance":
        case "archive":
        case "final_reject":
          handleStatusAction(config.target_status || "", config.label);
          break;
        default:
          break;
      }
    };

    const isPrimary = actionKey === "scan_qr";

    return (
      <button
        key={actionKey}
        onClick={handleClick}
        style={{
          padding: "8px 16px",
          border: isPrimary ? "none" : `1px solid ${config.color}`,
          backgroundColor: isPrimary ? config.color : "#fff",
          color: isPrimary ? "#fff" : config.color,
          borderRadius: "6px",
          fontSize: "13px",
          cursor: "pointer",
          fontWeight: 500,
          transition: "all 0.2s",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
        onMouseEnter={(e) => {
          if (!isPrimary) {
            (e.target as HTMLButtonElement).style.backgroundColor =
              `${config.color}10`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isPrimary) {
            (e.target as HTMLButtonElement).style.backgroundColor = "#fff";
          }
        }}
      >
        <span>{config.icon}</span>
        {config.label}
      </button>
    );
  };

  return (
    <div>
      <div style={{ ...sectionStyle }}>
        <div style={{ ...sectionHeaderStyle }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => navigate("/inspections")}
              style={{
                padding: "4px 12px",
                border: "1px solid #d1d5db",
                backgroundColor: "#fff",
                color: "#6b7280",
                borderRadius: "6px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              ← 返回
            </button>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  {data.order_no}
                </span>
                <StatusBadge status={data.status} label={data.status_label} />
                <span
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    backgroundColor: "#f3f4f6",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                >
                  v{data.version}
                </span>
                {data.is_overdue && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#fff",
                      backgroundColor: "#ef4444",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    已逾期
                  </span>
                )}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                {INSPECTION_TYPE_LABELS[data.type] || data.type} ·{" "}
                {data.charging_pile?.pile_name || "-"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {data.allowed_actions
              ?.filter((a) => a !== "view")
              .map((actionKey) => getActionButton(actionKey))}
            <button
              onClick={loadData}
              style={{
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                backgroundColor: "#fff",
                color: "#6b7280",
                borderRadius: "6px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <button
          onClick={() => setActiveTab("basic")}
          style={{
            padding: "10px 20px",
            border: "none",
            backgroundColor: activeTab === "basic" ? "#fff" : "transparent",
            color: activeTab === "basic" ? "#3b82f6" : "#6b7280",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: activeTab === "basic" ? 600 : 400,
            cursor: "pointer",
            boxShadow: activeTab === "basic" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          }}
        >
          📋 基本信息
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          style={{
            padding: "10px 20px",
            border: "none",
            backgroundColor: activeTab === "timeline" ? "#fff" : "transparent",
            color: activeTab === "timeline" ? "#3b82f6" : "#6b7280",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: activeTab === "timeline" ? 600 : 400,
            cursor: "pointer",
            boxShadow: activeTab === "timeline" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          }}
        >
          📜 审计日志
        </button>
      </div>

      {activeTab === "basic" ? (
        <>
          <div style={{ ...sectionStyle }}>
            <div style={{ ...sectionHeaderStyle }}>
              <span style={{ ...sectionTitleStyle }}>📝 基本信息</span>
            </div>
            <div style={{ ...sectionBodyStyle }}>
              <div style={{ ...infoRowStyle }}>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>巡检单编号</span>
                  <span style={{ ...infoValueStyle, fontWeight: 600 }}>
                    {data.order_no}
                  </span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>巡检类型</span>
                  <span style={{ ...infoValueStyle }}>
                    {INSPECTION_TYPE_LABELS[data.type] || data.type}
                  </span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>当前状态</span>
                  <span style={{ ...infoValueStyle }}>
                    <StatusBadge status={data.status} label={data.status_label} />
                  </span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>版本号</span>
                  <span style={{ ...infoValueStyle }}>v{data.version}</span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>充电桩</span>
                  <span style={{ ...infoValueStyle }}>
                    {data.charging_pile?.pile_name || "-"}
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#9ca3af",
                        marginLeft: "8px",
                      }}
                    >
                      ({data.charging_pile?.pile_code || "-"})
                    </span>
                  </span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>充电站</span>
                  <span style={{ ...infoValueStyle }}>
                    {data.charging_pile?.station_name || "-"}
                  </span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>巡检员</span>
                  <span style={{ ...infoValueStyle }}>
                    {data.inspector_name}
                  </span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>巡检日期</span>
                  <span style={{ ...infoValueStyle }}>
                    {formatDateOnly(data.inspection_date)}
                  </span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>创建时间</span>
                  <span style={{ ...infoValueStyle }}>
                    {formatDate(data.created_at)}
                  </span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>处理时限</span>
                  <span style={{ ...infoValueStyle }}>
                    {data.time_limit ? formatDateOnly(data.time_limit) : "-"}
                  </span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>是否逾期</span>
                  <span
                    style={{
                      ...infoValueStyle,
                      color: data.is_overdue ? "#ef4444" : "#10b981",
                      fontWeight: 500,
                    }}
                  >
                    {data.is_overdue ? "是" : "否"}
                  </span>
                </div>
                <div style={{ ...infoItemStyle }}>
                  <span style={{ ...infoLabelStyle }}>总体结果</span>
                  <span
                    style={{
                      ...infoValueStyle,
                      color: getCheckResultColor(data.overall_result),
                      fontWeight: 500,
                    }}
                  >
                    {getCheckResultLabel(data.overall_result)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...sectionStyle }}>
            <div style={{ ...sectionHeaderStyle }}>
              <span style={{ ...sectionTitleStyle }}>🔍 检查项明细</span>
            </div>
            <div style={{ ...sectionBodyStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: "16px",
                }}
              >
                {checkItems.map((item) => {
                  const result =
                    data[item.resultKey as keyof typeof data] as string;
                  const note =
                    data[item.noteKey as keyof typeof data] as string;
                  return (
                    <div
                      key={item.key}
                      style={{
                        padding: "16px",
                        backgroundColor: "#f9fafb",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "8px",
                        }}
                      >
                        <span
                          style={{ fontSize: "14px", fontWeight: 500, color: "#111827" }}
                        >
                          {item.label}
                        </span>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: 500,
                            backgroundColor: `${getCheckResultColor(result)}15`,
                            color: getCheckResultColor(result),
                          }}
                        >
                          {getCheckResultLabel(result)}
                        </span>
                      </div>
                      {note && (
                        <div style={{ fontSize: "13px", color: "#6b7280" }}>
                          <span style={{ color: "#9ca3af" }}>备注：</span>
                          {note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {data.qr_records && data.qr_records.length > 0 && (
            <div style={{ ...sectionStyle }}>
              <div style={{ ...sectionHeaderStyle }}>
                <span style={{ ...sectionTitleStyle }}>
                  📱 扫码核验记录 ({data.qr_records.length})
                </span>
              </div>
              <div style={{ ...sectionBodyStyle, padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: "#f9fafb" }}>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#374151",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          时间
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#374151",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          二维码内容
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#374151",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          结果
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#374151",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          备注
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.qr_records.map((record) => (
                        <tr key={record.id}>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontSize: "13px",
                              color: "#374151",
                              borderBottom: "1px solid #f3f4f6",
                            }}
                          >
                            {formatDate(record.scan_time)}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontSize: "13px",
                              color: "#374151",
                              borderBottom: "1px solid #f3f4f6",
                              fontFamily: "monospace",
                            }}
                          >
                            {record.qr_code_content}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontSize: "13px",
                              borderBottom: "1px solid #f3f4f6",
                            }}
                          >
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "12px",
                                fontWeight: 500,
                                backgroundColor:
                                  record.result === "success"
                                    ? "#dcfce7"
                                    : "#fee2e2",
                                color:
                                  record.result === "success"
                                    ? "#166534"
                                    : "#991b1b",
                              }}
                            >
                              {record.result_label ||
                                SCAN_RESULT_LABELS[record.result] ||
                                record.result}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontSize: "13px",
                              color: "#6b7280",
                              borderBottom: "1px solid #f3f4f6",
                            }}
                          >
                            {record.note || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {data.fault_report && (
            <div style={{ ...sectionStyle }}>
              <div style={{ ...sectionHeaderStyle }}>
                <span style={{ ...sectionTitleStyle }}>
                  ⚠️ 故障报告信息
                </span>
              </div>
              <div style={{ ...sectionBodyStyle }}>
                <div style={{ ...infoRowStyle }}>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>故障编码</span>
                    <span style={{ ...infoValueStyle, fontFamily: "monospace" }}>
                      {data.fault_report.fault_code}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>故障等级</span>
                    <span
                      style={{
                        ...infoValueStyle,
                        color:
                          data.fault_report.fault_level === "critical"
                            ? "#ef4444"
                            : data.fault_report.fault_level === "major"
                            ? "#f97316"
                            : "#f59e0b",
                        fontWeight: 500,
                      }}
                    >
                      {{
                        minor: "轻微",
                        general: "一般",
                        major: "严重",
                        critical: "紧急",
                      }[data.fault_report.fault_level] ||
                        data.fault_report.fault_level}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>故障位置</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.fault_report.fault_location || "-"}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>修复期限</span>
                    <span style={{ ...infoValueStyle }}>
                      {formatDateOnly(data.fault_report.repair_deadline)}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>维修单位</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.fault_report.repair_company || "-"}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>联系人</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.fault_report.repair_contact || "-"}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>联系电话</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.fault_report.repair_phone || "-"}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>上报时间</span>
                    <span style={{ ...infoValueStyle }}>
                      {formatDate(data.fault_report.reported_at)}
                    </span>
                  </div>
                  <div
                    style={{ ...infoItemStyle, gridColumn: "span 2" }}
                  >
                    <span style={{ ...infoLabelStyle }}>故障描述</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.fault_report.fault_description}
                    </span>
                  </div>
                  {data.fault_report.report_opinion && (
                    <div
                      style={{ ...infoItemStyle, gridColumn: "span 2" }}
                    >
                      <span style={{ ...infoLabelStyle }}>上报意见</span>
                      <span style={{ ...infoValueStyle }}>
                        {data.fault_report.report_opinion}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {data.repair_acceptance && (
            <div style={{ ...sectionStyle }}>
              <div style={{ ...sectionHeaderStyle }}>
                <span style={{ ...sectionTitleStyle }}>
                  ✅ 修复验收信息
                </span>
              </div>
              <div style={{ ...sectionBodyStyle }}>
                <div style={{ ...infoRowStyle }}>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>维修单位</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.repair_acceptance.repair_company}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>维修人员</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.repair_acceptance.repair_person}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>联系电话</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.repair_acceptance.repair_phone || "-"}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>维修费用</span>
                    <span
                      style={{
                        ...infoValueStyle,
                        color: "#10b981",
                        fontWeight: 500,
                      }}
                    >
                      {formatCurrency(data.repair_acceptance.repair_cost)}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>维修开始日期</span>
                    <span style={{ ...infoValueStyle }}>
                      {formatDateOnly(data.repair_acceptance.repair_start_date)}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>维修完成日期</span>
                    <span style={{ ...infoValueStyle }}>
                      {formatDateOnly(data.repair_acceptance.repair_end_date)}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>是否保修</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.repair_acceptance.is_guarantee ? "是" : "否"}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>资料是否齐全</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.repair_acceptance.material_complete ? "是" : "否"}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>验收结果</span>
                    <span
                      style={{
                        ...infoValueStyle,
                        color:
                          data.repair_acceptance.acceptance_result === "pass"
                            ? "#10b981"
                            : "#ef4444",
                        fontWeight: 500,
                      }}
                    >
                      {data.repair_acceptance.acceptance_result === "pass"
                        ? "验收通过"
                        : "验收不合格"}
                    </span>
                  </div>
                  <div style={{ ...infoItemStyle }}>
                    <span style={{ ...infoLabelStyle }}>验收时间</span>
                    <span style={{ ...infoValueStyle }}>
                      {formatDate(data.repair_acceptance.accepted_at)}
                    </span>
                  </div>
                  <div
                    style={{ ...infoItemStyle, gridColumn: "span 2" }}
                  >
                    <span style={{ ...infoLabelStyle }}>维修内容</span>
                    <span style={{ ...infoValueStyle }}>
                      {data.repair_acceptance.repair_content}
                    </span>
                  </div>
                  {data.repair_acceptance.parts_replaced && (
                    <div
                      style={{ ...infoItemStyle, gridColumn: "span 2" }}
                    >
                      <span style={{ ...infoLabelStyle }}>更换零部件</span>
                      <span style={{ ...infoValueStyle }}>
                        {data.repair_acceptance.parts_replaced}
                      </span>
                    </div>
                  )}
                  {data.repair_acceptance.acceptance_check_items && (
                    <div
                      style={{ ...infoItemStyle, gridColumn: "span 2" }}
                    >
                      <span style={{ ...infoLabelStyle }}>验收检查项</span>
                      <span style={{ ...infoValueStyle }}>
                        {data.repair_acceptance.acceptance_check_items}
                      </span>
                    </div>
                  )}
                  {data.repair_acceptance.acceptance_opinion && (
                    <div
                      style={{ ...infoItemStyle, gridColumn: "span 2" }}
                    >
                      <span style={{ ...infoLabelStyle }}>验收意见</span>
                      <span style={{ ...infoValueStyle }}>
                        {data.repair_acceptance.acceptance_opinion}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ ...sectionStyle }}>
            <div style={{ ...sectionHeaderStyle }}>
              <span style={{ ...sectionTitleStyle }}>💬 处理意见</span>
            </div>
            <div style={{ ...sectionBodyStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: "16px",
                }}
              >
                {data.registrar_opinion && (
                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#166534",
                        marginBottom: "8px",
                        fontWeight: 500,
                      }}
                    >
                      🏷️ 设备巡检登记员意见
                    </div>
                    <div style={{ fontSize: "13px", color: "#166534" }}>
                      {data.registrar_opinion}
                    </div>
                  </div>
                )}
                {data.supervisor_opinion && (
                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#1e40af",
                        marginBottom: "8px",
                        fontWeight: 500,
                      }}
                    >
                      🔍 审核主管意见
                      {data.supervisor_review_date && (
                        <span
                          style={{ marginLeft: "8px", fontWeight: "normal" }}
                        >
                          ({formatDate(data.supervisor_review_date)})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "13px", color: "#1e40af" }}>
                      {data.supervisor_opinion}
                    </div>
                  </div>
                )}
                {data.reviewer_opinion && (
                  <div
                    style={{
                      padding: "16px",
                      backgroundColor: "#faf5ff",
                      border: "1px solid #ddd6fe",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#5b21b6",
                        marginBottom: "8px",
                        fontWeight: 500,
                      }}
                    >
                      📦 复核负责人意见
                      {data.reviewer_review_date && (
                        <span
                          style={{ marginLeft: "8px", fontWeight: "normal" }}
                        >
                          ({formatDate(data.reviewer_review_date)})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "13px", color: "#5b21b6" }}>
                      {data.reviewer_opinion}
                    </div>
                  </div>
                )}
                {!data.registrar_opinion &&
                  !data.supervisor_opinion &&
                  !data.reviewer_opinion && (
                    <div
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#9ca3af",
                        gridColumn: "span 2",
                      }}
                    >
                      暂无处理意见
                    </div>
                  )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ ...sectionStyle }}>
          <div style={{ ...sectionHeaderStyle }}>
            <span style={{ ...sectionTitleStyle }}>📜 审计日志</span>
          </div>
          <div style={{ ...sectionBodyStyle }}>
            <AuditTimeline logs={auditLogs} loading={auditLoading} />
          </div>
        </div>
      )}

      <StatusFlowModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        targetStatus={targetStatus}
        targetStatusLabel={targetStatusLabel}
        onConfirm={handleStatusConfirm}
        loading={statusLoading}
        orderNo={data.order_no}
        currentVersion={data.version}
      />

      <FaultReportForm
        open={faultModalOpen}
        onClose={() => setFaultModalOpen(false)}
        onSubmit={handleFaultSubmit}
        loading={faultLoading}
        orderNo={data.order_no}
      />

      <RepairAcceptanceForm
        open={acceptanceModalOpen}
        onClose={() => setAcceptanceModalOpen(false)}
        onSubmit={handleAcceptanceSubmit}
        loading={acceptanceLoading}
        orderNo={data.order_no}
        existingData={data.repair_acceptance || undefined}
      />

      <QRScanModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        onScan={handleQRScan}
        loading={qrLoading}
        inspectionOrderId={id}
      />

      <ConfirmModal
        open={repairCompleteModalOpen}
        title="确认修复完成"
        content={
          <div style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6 }}>
            您即将将此巡检单标记为"修复完成待验收"。
            <br />
            <br />
            确认修复工作已完成，可以提交验收了吗？
          </div>
        }
        okText="确认完成"
        cancelText="取消"
        onOk={handleRepairComplete}
        onClose={() => setRepairCompleteModalOpen(false)}
        okButtonProps={{ backgroundColor: "#8b5cf6" }}
      />

      <ConfirmModal
        open={versionConflictModalOpen}
        title="版本冲突"
        content={
          <div>
            <div
              style={{
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                padding: "12px 16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ color: "#991b1b", fontWeight: 500, marginBottom: "4px" }}>
                ⚠️ 版本冲突
              </div>
              <div style={{ fontSize: "13px", color: "#991b1b" }}>
                {conflictMessage}
              </div>
            </div>
            <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6 }}>
              该巡检单已被其他用户修改，您看到的可能是旧版本。
              <br />
              请刷新页面获取最新数据后再操作。
            </div>
          </div>
        }
        okText="立即刷新"
        cancelText="取消"
        onOk={handleRefresh}
        onClose={() => setVersionConflictModalOpen(false)}
        okButtonProps={{ backgroundColor: "#ef4444" }}
      />
    </div>
  );
}

export default InspectionDetailPage;
