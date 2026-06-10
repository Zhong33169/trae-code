import { useState, useEffect, useCallback } from "preact/hooks";
import { getBatches, getBatch, retryBatch } from "../utils/api.ts";
import { getUser, clearAuth } from "../utils/auth.ts";
import { BATCH_OP_MAP, ROLE_MAP } from "../utils/types.ts";
import type { BatchOperation, BatchItem, BatchDetail, User } from "../utils/types.ts";
import { formatDateTime } from "../utils/format.ts";

export default function BatchList() {
  const [user, setUser] = useState<User | null>(null);
  const [batches, setBatches] = useState<BatchOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [showDetail, setShowDetail] = useState(false);

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
    try {
      const result = await getBatch(batchNo);
      setSelectedBatch(result);
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

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

  const parseDetail = (item: BatchItem) => {
    try {
      if (item.result_data) {
        return JSON.parse(item.result_data);
      }
    } catch (_) {}
    return null;
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
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
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

            <div className="flex-1 overflow-auto p-6">
              {detailLoading ? (
                <div className="py-12 text-center text-gray-500">加载中...</div>
              ) : detailError ? (
                <div className="py-12 text-center text-red-500">{detailError}</div>
              ) : selectedBatch ? (
                <div>
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{selectedBatch.batch.total_count}</p>
                      <p className="text-sm text-gray-500 mt-1">总数</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{selectedBatch.batch.success_count}</p>
                      <p className="text-sm text-gray-500 mt-1">成功</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-red-600">{selectedBatch.batch.fail_count}</p>
                      <p className="text-sm text-gray-500 mt-1">失败</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-lg font-bold text-blue-600">
                        {getBatchStatusLabel(selectedBatch.batch.status)}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">状态</p>
                    </div>
                  </div>

                  {selectedBatch.batch.fail_count > 0 && (
                    <div className="mb-4">
                      <button
                        onClick={() => handleRetry(selectedBatch.batch.batch_no)}
                        className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        重试失败项
                      </button>
                    </div>
                  )}

                  <h4 className="text-sm font-medium text-gray-700 mb-3">明细列表</h4>
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
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">
                              <a
                                href={`/transfer/${item.transfer_id}`}
                                target="_blank"
                                className="text-blue-600 hover:text-blue-800"
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
