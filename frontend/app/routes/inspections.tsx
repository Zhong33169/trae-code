import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import { useAuth } from "~/hooks/useAuth";
import { useToast } from "~/hooks/useToast";
import {
  getInspectionOrders,
  updateInspectionStatus,
  InspectionOrder,
} from "~/services/inspection";
import { batchProcess, BatchProcessResult } from "~/services/batch";
import { Table, Column } from "~/components/Table";
import { Pagination } from "~/components/Pagination";
import { StatusBadge } from "~/components/StatusBadge";
import { BatchProcessModal } from "~/components/BatchProcessModal";
import { StatusFlowModal } from "~/components/StatusFlowModal";
import { ConfirmModal } from "~/components/Modal";
import {
  formatDate,
  formatDateOnly,
  generateRequestId,
  debounce,
  buildQueryString,
  parseQueryString,
} from "~/utils/helpers";
import {
  INSPECTION_STATUS_LABELS,
  INSPECTION_TYPE_LABELS,
  STATUS_COLORS,
  ACTION_CONFIGS,
} from "~/config";

export function meta() {
  return [{ title: "巡检单列表 - 充电桩巡检系统" }];
}

function InspectionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasRole } = useAuth();
  const { success, error, warning } = useToast();

  const queryParams = parseQueryString(location.search);
  const initialQueue = queryParams.queue || "my_todo";

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InspectionOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState("");
  const [queue, setQueue] = useState(initialQueue);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("");
  const [statistics, setStatistics] = useState<Record<string, number>>({});

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<InspectionOrder[]>([]);

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchTargetStatus, setBatchTargetStatus] = useState("");
  const [batchTargetLabel, setBatchTargetLabel] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [targetStatusLabel, setTargetStatusLabel] = useState("");
  const [currentOrder, setCurrentOrder] = useState<InspectionOrder | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [versionConflictModalOpen, setVersionConflictModalOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");

  const queueLabels: Record<string, string> = {
    my_todo: "待我处理",
    my_created: "我发起的",
    all: "全部",
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        page_size: pageSize,
        status: status || undefined,
        queue,
        keyword: keyword || undefined,
        type: type || undefined,
      };
      const response = await getInspectionOrders(params);
      setData(response.items);
      setTotal(response.total);
      setStatistics(response.statistics);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || "加载数据失败";
      error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, queue, keyword, type, error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (queue !== "pending_my") params.set("queue", queue);
    const newSearch = params.toString();
    const newPath = `/inspections${newSearch ? `?${newSearch}` : ""}`;
    if (location.search !== `?${newSearch}` && newSearch) {
      navigate(newPath, { replace: true });
    }
  }, [queue, navigate, location.search]);

  const handleSearch = debounce((value: string) => {
    setKeyword(value);
    setPage(1);
  }, 300);

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  const handleRowClick = (record: InspectionOrder) => {
    navigate(`/inspections/${record.id}`);
  };

  const handleSelectChange = (keys: string[], records: InspectionOrder[]) => {
    setSelectedRowKeys(keys);
    setSelectedRecords(records);
  };

  const handleBatchProcess = (actionKey: string, actionLabel: string) => {
    if (selectedRecords.length === 0) {
      warning("请先选择要处理的巡检单");
      return;
    }
    const config = ACTION_CONFIGS[actionKey];
    if (!config?.target_status) {
      warning("此操作不支持批量处理");
      return;
    }
    const operableItems = selectedRecords.filter(
      (r) => r.allowed_actions?.includes(actionKey)
    );
    if (operableItems.length === 0) {
      warning("所选巡检单均不支持此操作");
      return;
    }
    if (operableItems.length < selectedRecords.length) {
      warning(
        `已自动过滤 ${selectedRecords.length - operableItems.length} 条不支持此操作的巡检单`
      );
    }
    setSelectedRecords(operableItems);
    setSelectedRowKeys(operableItems.map((r) => String(r.id)));
    setBatchTargetStatus(config.target_status);
    setBatchTargetLabel(actionLabel);
    setBatchModalOpen(true);
  };

  const handleBatchConfirm = async (opinion: string, signature: string): Promise<BatchProcessResult | null> => {
    setBatchLoading(true);
    try {
      const requestId = generateRequestId();
      const result = await batchProcess({
        items: selectedRecords.map((item) => ({
          inspection_order_id: item.id,
          order_no: item.order_no,
          target_status: batchTargetStatus,
          current_version: item.version,
          opinion: opinion,
          signature: signature,
        })),
        request_id: requestId,
        operation: `batch_${batchTargetStatus}`,
      });

      if (result.statistics.success_count > 0) {
        success(
          `批量处理完成：成功 ${result.statistics.success_count} 条，失败 ${result.statistics.failed_count} 条`
        );
      } else {
        error("批量处理失败，请查看详情");
      }

      if (result.statistics.success_count > 0) {
        loadData();
        setSelectedRowKeys([]);
        setSelectedRecords([]);
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || "批量处理失败";
      error(errorMessage);
      return null;
    } finally {
      setBatchLoading(false);
    }
  };

  const handleActionClick = (record: InspectionOrder, actionKey: string) => {
    const config = ACTION_CONFIGS[actionKey];
    if (!config) return;

    if (actionKey === "update") {
      navigate(`/inspections/${record.id}/edit`);
      return;
    }

    if (actionKey === "scan_qr" || config.is_form) {
      navigate(`/inspections/${record.id}?action=${actionKey}`);
      return;
    }

    setCurrentOrder(record);
    setTargetStatus(config.target_status || "");
    setTargetStatusLabel(config.label);
    setStatusModalOpen(true);
  };

  const handleStatusConfirm = async (data: {
    opinion: string;
    signature: string;
  }): Promise<boolean> => {
    if (!currentOrder) return false;
    setStatusLoading(true);
    try {
      const requestId = generateRequestId();
      await updateInspectionStatus(currentOrder.id, {
        target_status: targetStatus,
        opinion: data.opinion,
        signature: data.signature,
        request_id: requestId,
        current_version: currentOrder.version,
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

  const handleRefresh = () => {
    setVersionConflictModalOpen(false);
    loadData();
  };

  const columns: Column<InspectionOrder>[] = [
    {
      key: "order_no",
      title: "巡检单编号",
      dataIndex: "order_no",
      width: "160px",
      render: (record) => (
        <span
          style={{ color: "#3b82f6", fontWeight: 500, cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/inspections/${record.id}`);
          }}
        >
          {record.order_no}
        </span>
      ),
    },
    {
      key: "type",
      title: "类型",
      dataIndex: "type",
      width: "100px",
      render: (record) => (
        <span
          style={{
            padding: "2px 8px",
            backgroundColor: "#f3f4f6",
            borderRadius: "4px",
            fontSize: "12px",
          }}
        >
          {INSPECTION_TYPE_LABELS[record.type] || record.type}
        </span>
      ),
    },
    {
      key: "status",
      title: "状态",
      dataIndex: "status",
      width: "140px",
      render: (record) => (
        <StatusBadge status={record.status} label={record.status_label} />
      ),
    },
    {
      key: "charging_pile",
      title: "充电桩",
      width: "180px",
      render: (record) => (
        <div>
          <div style={{ fontSize: "13px", color: "#111827" }}>
            {record.charging_pile?.pile_name || "-"}
          </div>
          <div style={{ fontSize: "11px", color: "#9ca3af" }}>
            {record.charging_pile?.pile_code || ""}
          </div>
        </div>
      ),
    },
    {
      key: "inspector_name",
      title: "巡检员",
      dataIndex: "inspector_name",
      width: "100px",
    },
    {
      key: "inspection_date",
      title: "巡检日期",
      width: "120px",
      render: (record) => formatDateOnly(record.inspection_date),
    },
    {
      key: "is_overdue",
      title: "是否逾期",
      width: "80px",
      align: "center",
      render: (record) => (
        <span
          style={{
            color: record.is_overdue ? "#ef4444" : "#10b981",
            fontWeight: 500,
            fontSize: "12px",
          }}
        >
          {record.is_overdue ? "是" : "否"}
        </span>
      ),
    },
    {
      key: "created_at",
      title: "创建时间",
      width: "160px",
      render: (record) => formatDate(record.created_at),
    },
    {
      key: "actions",
      title: "操作",
      width: "200px",
      align: "center",
      render: (record) => {
        const actionKeys = record.allowed_actions?.filter(
          (a) => a !== "view" && a !== "update"
        ) || [];

        return (
          <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
            {actionKeys.slice(0, 2).map((actionKey) => {
              const config = ACTION_CONFIGS[actionKey];
              if (!config) return null;
              return (
                <button
                  key={actionKey}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleActionClick(record, actionKey);
                  }}
                  style={{
                    padding: "4px 10px",
                    border: `1px solid ${config.color}`,
                    backgroundColor: "transparent",
                    color: config.color,
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor =
                      `${config.color}10`;
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLButtonElement).style.backgroundColor =
                      "transparent";
                  }}
                >
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                </button>
              );
            })}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/inspections/${record.id}`);
              }}
              style={{
                padding: "4px 10px",
                border: "1px solid #d1d5db",
                backgroundColor: "transparent",
                color: "#6b7280",
                borderRadius: "4px",
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor =
                  "#f9fafb";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor =
                  "transparent";
              }}
            >
              详情
            </button>
          </div>
        );
      },
    },
  ];

  const filterSectionStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "13px",
    minWidth: "160px",
  };

  return (
    <div>
      <div style={{ ...filterSectionStyle }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>队列：</span>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {Object.entries(queueLabels).map(([key, label]) => {
                const count = statistics[key] || 0;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setQueue(key);
                      setPage(1);
                    }}
                    style={{
                      padding: "6px 14px",
                      border: `1px solid ${queue === key ? "#3b82f6" : "#d1d5db"}`,
                      backgroundColor: queue === key ? "#eff6ff" : "#fff",
                      color: queue === key ? "#2563eb" : "#374151",
                      borderRadius: "20px",
                      fontSize: "13px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onMouseEnter={(e) => {
                      if (queue !== key) {
                        (e.target as HTMLButtonElement).style.backgroundColor =
                          "#f9fafb";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (queue !== key) {
                        (e.target as HTMLButtonElement).style.backgroundColor =
                          "#fff";
                      }
                    }}
                  >
                    {label}
                    <span
                      style={{
                        padding: "1px 6px",
                        backgroundColor:
                          count > 0
                            ? queue === key
                              ? "#3b82f6"
                              : "#e5e7eb"
                            : "#f3f4f6",
                        color: count > 0 ? "#fff" : "#9ca3af",
                        borderRadius: "10px",
                        fontSize: "11px",
                        fontWeight: 500,
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...filterSectionStyle }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>状态：</span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                style={inputStyle}
              >
                <option value="">全部状态</option>
                {Object.entries(INSPECTION_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>类型：</span>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
                style={inputStyle}
              >
                <option value="">全部类型</option>
                {Object.entries(INSPECTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>搜索：</span>
              <input
                type="text"
                placeholder="编号、充电桩名称..."
                onChange={(e) => handleSearch(e.target.value)}
                style={{ ...inputStyle, minWidth: "240px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            {hasRole("registrar") && (
              <button
                onClick={() => navigate("/inspections/new")}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  backgroundColor: "#3b82f6",
                  color: "#fff",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: 500,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor =
                    "#2563eb";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor =
                    "#3b82f6";
                }}
              >
                ➕ 创建巡检单
              </button>
            )}

            {selectedRowKeys.length > 0 && (
              <div style={{ display: "flex", gap: "8px" }}>
                {hasRole("supervisor") && (
                  <button
                    onClick={() =>
                      handleBatchProcess("approve", "审核通过")
                    }
                    style={{
                      padding: "8px 16px",
                      border: "1px solid #10b981",
                      backgroundColor: "#fff",
                      color: "#10b981",
                      borderRadius: "6px",
                      fontSize: "13px",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    ✅ 批量通过 ({selectedRowKeys.length})
                  </button>
                )}
                {hasRole("supervisor") && (
                  <button
                    onClick={() => handleBatchProcess("reject", "审核退回")}
                    style={{
                      padding: "8px 16px",
                      border: "1px solid #ef4444",
                      backgroundColor: "#fff",
                      color: "#ef4444",
                      borderRadius: "6px",
                      fontSize: "13px",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    ❌ 批量退回 ({selectedRowKeys.length})
                  </button>
                )}
                {hasRole("reviewer") && (
                  <button
                    onClick={() => handleBatchProcess("archive", "复核归档")}
                    style={{
                      padding: "8px 16px",
                      border: "1px solid #0ea5e9",
                      backgroundColor: "#fff",
                      color: "#0ea5e9",
                      borderRadius: "6px",
                      fontSize: "13px",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    📦 批量归档 ({selectedRowKeys.length})
                  </button>
                )}
              </div>
            )}

            <button
              onClick={loadData}
              style={{
                padding: "8px 16px",
                border: "1px solid #d1d5db",
                backgroundColor: "#fff",
                color: "#6b7280",
                borderRadius: "6px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              🔄 刷新
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <Table
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          onRowClick={handleRowClick}
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectChange={handleSelectChange}
          emptyText="暂无巡检单数据"
        />
        {!loading && total > 0 && (
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={handlePageChange}
            showSizeChanger
            showQuickJumper
          />
        )}
      </div>

      <BatchProcessModal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        selectedItems={selectedRecords}
        targetStatus={batchTargetStatus}
        targetStatusLabel={batchTargetLabel}
        onConfirm={handleBatchConfirm}
        loading={batchLoading}
      />

      <StatusFlowModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        targetStatus={targetStatus}
        targetStatusLabel={targetStatusLabel}
        onConfirm={handleStatusConfirm}
        loading={statusLoading}
        orderNo={currentOrder?.order_no}
        currentVersion={currentOrder?.version}
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
              请刷新页面后重新操作。
            </div>
          </div>
        }
        okText="刷新页面"
        cancelText="取消"
        onOk={handleRefresh}
        onClose={() => setVersionConflictModalOpen(false)}
        okButtonProps={{ backgroundColor: "#ef4444" }}
      />
    </div>
  );
}

export default InspectionsPage;
