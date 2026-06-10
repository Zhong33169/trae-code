import { useState, useEffect, useCallback } from "preact/hooks";
import { getBatches, getBatch, retryBatch, getBatchAudit } from "../utils/api.ts";
import { getUser, clearAuth } from "../utils/auth.ts";
import { BATCH_OP_MAP, ROLE_MAP } from "../utils/types.ts";
import type { BatchOperation, BatchItem, BatchDetail, BatchAuditDetail, AuditLog, User } from "../utils/types.ts";
import { formatDateTime } from "../utils/format.ts";

const ACTION_LABELS: Record<string, string> = {
  batch_create: "批量创建",
  batch_complete: "批量完成",
  batch_retry: "批量重试",
  batch_retry_complete: "重试完成",
  register: "登记",
  verify: "核验",
  review: "复核归档",
};

const getActionColor = (action: string) => {
  if (action === "batch_create") return "bg-blue-100 text-blue-800";
  if (action === "batch_complete") return "bg-green-100 text-green-800";
  if (action === "batch_retry") return "bg-orange-100 text-orange-800";
  if (action === "batch_retry_complete") return "bg-purple-100 text-purple-800";
  if (action === "register") return "bg-yellow-100 text-yellow-800";
  if (action === "verify") return "bg-emerald-100 text-emerald-800";
  if (action === "review") return "bg-indigo-100 text-indigo-800";
  return "bg-gray-100 text-gray-800";
};

const parseJSON = (str: string | null | undefined) => {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
};

const getSummary = (log: AuditLog) => {
  const val = parseJSON(log.new_value);
  if (!val) return "";

  if (log.action === "batch_create") {
    return `共 ${val.total_count || 0} 条 · ${val.remark || ""}`;
  }
  if (log.action === "batch_complete" || log.action === "batch_retry_complete") {
    return `成功 ${val.success_count || 0} · 失败 ${val.fail_count || 0}`;
  }
  if (log.action === "batch_retry") {
    return `重试 ${val.retry_count || 0} 条失败项`;
  }
  if (val.new_status) {
    const map: Record<string, string> = {
      pending_verification: "待核验",
      pending_review: "待复核",
      archived: "已归档",
    };
    return `状态：${map[val.new_status] || val.new_status}`;
  }
  return "";
};

export default function BatchList() {
  const [user, setUser] = useState<User | null>(null);
  const [batches, setBatches] = useState<BatchOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null);
  const [batchAudit, setBatchAudit] = useState<BatchAuditDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "audit">("items");
  const [expandedAuditId, setExpandedAuditId] = useState<number | null>(null);
  const [highlightTransferId, setHighlightTransferId] = useState<number | null>(null);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getBatches({ page, page_size: pageSize });
      setBatches(result.list);
      setTotal(result.pagination.total);
    } catch (err: any) {
      setError(err.error || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      window.location.href = "/login";
      return;
    }
    setUser(u);
    loadBatches();
  }, [loadBatches]);

  const viewDetail = async (batchNo: string) => {
    setShowDetail(true);
    setDetailLoading(true);
    setDetailError("");
    setSelectedBatch(null);
    setBatchAudit(null);
    setActiveTab("items");
    setExpandedAuditId(null);
    setHighlightTransferId(null);
    try {
      const [detail, audit] = await Promise.all([
        getBatch(batchNo),
        getBatchAudit(batchNo),
      ]);
      setSelectedBatch(detail);
      setBatchAudit(audit);
    } catch (err: any) {
      setDetailError(err.error || "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRetry = async (batchNo: string) => {
    if (!confirm("确定要重试该批次中失败的任务吗？")) return;

    try {
      await retryBatch(batchNo);
      await viewDetail(batchNo);
      loadBatches();
    } catch (err: any) {
      setDetailError(err.error || "重试失败");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  const getBatchStatusColor = (status: string) => {
    if (status === "completed") return "bg-green-100 text-green-800";
    if (status === "processing") return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };

  const getOpTypeColor = (type: string) => {
    if (type === "register") return "bg-yellow-100 text-yellow-800";
    if (type === "verify") return "bg-green-100 text-green-800";
    if (type === "review") return "bg-purple-100 text-purple-800";
    return "bg-gray-100 text-gray-800";
  };

  const getBatchStatusLabel = (status: string) => {
    if (status === "completed") return "已完成";
    if (status === "processing") return "处理中";
    return status;
  };

  const getItemStatusColor = (status: string) => {
    if (status === "success") return "text-green-600";
    if (status === "failed") return "text-red-600";
    if (status === "pending") return "text-yellow-600";
    return "text-gray-600";
  };

  const getItemStatusLabel = (status: string) => {
    if (status === "success") return "成功";
    if (status === "failed") return "失败";
    if (status === "pending") return "待处理";
    return status;
  };

  const failedItems = selectedBatch?.items.filter((i) => i.status === "failed") || [];
  const successItems = selectedBatch?.items.filter((i) => i.status === "success") || [];

  const getRetryAuditLog = () => {
    if (!batchAudit) return null;
    return batchAudit.audit_logs.find((l) => l.action === "batch_retry") || null;
  };

  const retryLog = getRetryAuditLog();

  const scrollToFailed = () => {
    const el = document.getElementById("failed-items-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-blue-600">💊 处方流转系统</span>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
                <a href="/" className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                  <span className="mr-2">📋</span>处方流转
                </a>
                <a href="/batch" className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-blue-600 bg-blue-50">
                  <span className="mr-2">📦</span>批量操作
                </a>
                <a href="/audit" className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                  <span className="mr-2">📝</span>审计日志
                </a>
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{user.name}</p>
                  <p className="text-xs text-gray-500">{ROLE_MAP[user.role] || user.role}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-medium">{user.name.charAt(0)}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  退出
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">批量操作记录</h1>
          <p className="text-sm text-gray-500 mt-1">查看所有批量操作的执行情况</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">加载中...</div>
          ) : error ? (
            <div className="p-12 text-center text-red-500">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">批次号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作人</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总数</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">成功</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">失败</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-blue-600">{batch.batch_no}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getOpTypeColor(batch.operation_type)}`}>
                            {BATCH_OP_MAP[batch.operation_type] || batch.operation_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {batch.operator_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {batch.total_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          {batch.success_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                          {batch.fail_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBatchStatusColor(batch.status)}`}>
                            {getBatchStatusLabel(batch.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(batch.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => viewDetail(batch.batch_no)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            查看详情
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                共 {total} 条，第 {page} / {totalPages} 页
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">批次详情</h3>
                {selectedBatch && (
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedBatch.batch.batch_no} · {BATCH_OP_MAP[selectedBatch.batch.operation_type] || selectedBatch.batch.operation_type}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex border-b border-gray-200 px-6">
              <button
                onClick={() => setActiveTab("items")}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "items"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                明细列表
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "audit"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                审计时间线
                {retryLog && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800">
                    含重试
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {detailLoading ? (
                <div className="py-12 text-center text-gray-500">加载中...</div>
              ) : detailError ? (
                <div className="py-12 text-center text-red-500">{detailError}</div>
              ) : selectedBatch ? (
                activeTab === "items" ? (
                  <div>
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900">{selectedBatch.batch.total_count}</p>
                        <p className="text-sm text-gray-500 mt-1">总数</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{successItems.length}</p>
                        <p className="text-sm text-gray-500 mt-1">成功</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 text-center cursor-pointer hover:bg-red-100 transition-colors" onClick={scrollToFailed}>
                        <p className="text-2xl font-bold text-red-600">{failedItems.length}</p>
                        <p className="text-sm text-gray-500 mt-1">失败（点击定位）</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <p className="text-lg font-bold text-blue-600">
                          {getBatchStatusLabel(selectedBatch.batch.status)}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">状态</p>
                      </div>
                    </div>

                    {failedItems.length > 0 && (
                      <div className="mb-4">
                        <button
                          onClick={() => handleRetry(selectedBatch.batch.batch_no)}
                          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                        >
                          🔄 重试失败项
                        </button>
                      </div>
                    )}

                    {retryLog && (
                      <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <h5 className="text-sm font-medium text-orange-900 mb-2">📊 重试前后对比</h5>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-gray-500 mb-1">重试前</p>
                            <p className="text-gray-700">
                              成功 <span className="font-medium text-green-600">{parseJSON(retryLog.old_value)?.prev_success || 0}</span> ·
                              失败 <span className="font-medium text-red-600">{parseJSON(retryLog.old_value)?.prev_fail || 0}</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">重试后</p>
                            <p className="text-gray-700">
                              成功 <span className="font-medium text-green-600">{successItems.length}</span> ·
                              失败 <span className="font-medium text-red-600">{failedItems.length}</span>
                            </p>
                          </div>
                        </div>
                        {successItems.length - (parseJSON(retryLog.old_value)?.prev_success || 0) > 0 && (
                          <p className="text-xs text-green-700 mt-2">
                            ✅ 本次重试新增 {successItems.length - parseJSON(retryLog.old_value)?.prev_success || 0} 条成功
                          </p>
                        )}
                      </div>
                    )}

                    {failedItems.length > 0 && (
                      <div id="failed-items-section" className="mb-6">
                        <h4 className="text-sm font-medium text-red-700 mb-3 flex items-center">
                          <span className="mr-2">⚠️</span>失败项（{failedItems.length}条）
                        </h4>
                        <div className="space-y-2">
                          {failedItems.map((item) => (
                            <div
                              key={item.id}
                              className={`p-3 border-2 border-red-200 bg-red-50 rounded-lg transition-all ${
                                highlightTransferId === item.transfer_id ? "ring-2 ring-red-500" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <a
                                  href={`/transfer/${item.transfer_id}`}
                                  target="_blank"
                                  className="text-sm font-medium text-red-700 hover:text-red-900"
                                >
                                  {item.transfer_no}
                                </a>
                                <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                  失败
                                </span>
                              </div>
                              <p className="text-xs text-red-600">{item.error_message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <h4 className="text-sm font-medium text-gray-700 mb-3">全部明细</h4>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">流转单号</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">状态</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">错误信息</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedBatch.items.map((item) => (
                            <tr
                              key={item.id}
                              className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                                item.status === "failed" ? "bg-red-50" : ""
                              } ${
                                highlightTransferId === item.transfer_id ? "bg-yellow-50" : ""
                              }`}
                              onClick={() => setHighlightTransferId(
                                highlightTransferId === item.transfer_id ? null : item.transfer_id
                              )}
                            >
                              <td className="px-4 py-3 text-sm">
                                <a
                                  href={`/transfer/${item.transfer_id}`}
                                  target="_blank"
                                  className="text-blue-600 hover:text-blue-800"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {item.transfer_no}
                                </a>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`font-medium ${getItemStatusColor(item.status)}`}>
                                  {getItemStatusLabel(item.status)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-red-600">
                                {item.error_message || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">📌 批次审计记录</h4>
                      <p className="text-xs text-gray-500">点击时间线节点可查看详情</p>
                    </div>

                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                      {batchAudit?.audit_logs?.map((log, idx) => (
                        <div key={log.id} className="relative pl-10 pb-6">
                          <div className={`absolute left-2 top-1 w-4 h-4 rounded-full border-2 border-white ${
                            log.action.includes("retry") ? "bg-orange-500" :
                            log.action === "batch_create" ? "bg-blue-500" :
                            log.action.includes("complete") ? "bg-green-500" : "bg-gray-400"
                          }`} />

                          <div
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${
                              expandedAuditId === log.id
                                ? "border-blue-300 bg-blue-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                            onClick={() => setExpandedAuditId(expandedAuditId === log.id ? null : log.id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                                  {ACTION_LABELS[log.action] || log.action}
                                </span>
                                {log.action === "batch_retry" && (
                                  <span className="text-xs text-orange-600 font-medium">第 {idx + 1} 次重试</span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">{formatDateTime(log.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-700">{getSummary(log)}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              操作人：{log.user_name} · IP：{log.ip_address || "-"}
                            </p>

                            {expandedAuditId === log.id && (
                              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                                {log.old_value && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">变更前：</p>
                                    <pre className="text-xs p-2 bg-gray-100 rounded text-gray-700 overflow-x-auto">
                                      {JSON.stringify(parseJSON(log.old_value), null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.new_value && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-500 mb-1">变更后：</p>
                                    <pre className="text-xs p-2 bg-blue-50 rounded text-blue-800 overflow-x-auto">
                                      {JSON.stringify(parseJSON(log.new_value), null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {batchAudit?.transfer_logs && batchAudit.transfer_logs.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">📄 关联流转单操作记录</h4>
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">时间</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">操作</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">流转单ID</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">摘要</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {batchAudit.transfer_logs.map((log) => (
                                <tr
                                  key={log.id}
                                  className={`hover:bg-gray-50 cursor-pointer ${
                                    highlightTransferId === log.target_id ? "bg-yellow-50" : ""
                                  }`}
                                  onClick={() => {
                                    setHighlightTransferId(
                                      highlightTransferId === log.target_id ? null : log.target_id
                                    );
                                    setActiveTab("items");
                                    setTimeout(scrollToFailed, 100);
                                  }}
                                >
                                  <td className="px-4 py-2 text-xs text-gray-500">
                                    {formatDateTime(log.created_at)}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                                      {ACTION_LABELS[log.action] || log.action}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-blue-600">
                                    #{log.target_id}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-600">
                                    {getSummary(log)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">💡 点击记录可跳转到明细页对应项</p>
                      </div>
                    )}
                  </div>
                )
              ) : null}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
