import { useState, useEffect, useCallback } from "preact/hooks";
import { getTransfers, getEvidences, batchRegister, batchVerify, batchReview } from "../utils/api.ts";
import { getUser, clearAuth } from "../utils/auth.ts";
import { STATUS_MAP, ROLE_MAP, EVIDENCE_TYPE_MAP } from "../utils/types.ts";
import type { PrescriptionTransfer, TransferEvidence, User } from "../utils/types.ts";
import { formatDateTime, formatAmount, maskIdCard } from "../utils/format.ts";
import { StatusBadge } from "../components/StatusBadge.tsx";

export default function TransferDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [transfers, setTransfers] = useState<PrescriptionTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [evidences, setEvidences] = useState<TransferEvidence[]>([]);
  const [evidencesLoading, setEvidencesLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchEvidence, setBatchEvidence] = useState("");
  const [batchRemark, setBatchRemark] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [batchSuccess, setBatchSuccess] = useState("");

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getTransfers({
        status: statusFilter || undefined,
        keyword: keyword || undefined,
        page,
        page_size: pageSize,
      });
      setTransfers(result.list);
      setTotal(result.pagination.total);
    } catch (err: any) {
      setError(err.error || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, keyword, page, pageSize]);

  const loadEvidences = useCallback(async (id: number) => {
    setEvidencesLoading(true);
    try {
      const result = await getEvidences(id);
      setEvidences(result);
    } catch (err: any) {
      console.error("加载证据失败:", err);
      setEvidences([]);
    } finally {
      setEvidencesLoading(false);
    }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      window.location.href = "/login";
      return;
    }
    setUser(u);
    loadTransfers();
  }, [loadTransfers]);

  useEffect(() => {
    if (selectedId) {
      loadEvidences(selectedId);
    } else {
      setEvidences([]);
    }
  }, [selectedId, loadEvidences]);

  const handleSelect = (id: number) => {
    setSelectedId(id);
  };

  const handleCheckboxChange = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(transfers.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const canDoBatch = () => {
    if (!user || selectedIds.length === 0) return false;
    const selectedTransfers = transfers.filter((t) => selectedIds.includes(t.id));
    if (selectedTransfers.length === 0) return false;

    if (user.role === "reception_assistant") {
      return selectedTransfers.every((t) => 
        t.status === "draft" || t.status === "pending_registration"
      );
    }
    if (user.role === "attending_physician") {
      return selectedTransfers.every((t) => 
        t.status === "registered" || t.status === "pending_verification"
      );
    }
    if (user.role === "pharmacy_admin") {
      return selectedTransfers.every((t) => 
        t.status === "verified" || t.status === "pending_review"
      );
    }
    return false;
  };

  const getBatchActionLabel = () => {
    if (!user) return "";
    if (user.role === "reception_assistant") return "批量登记";
    if (user.role === "attending_physician") return "批量核验";
    if (user.role === "pharmacy_admin") return "批量复核归档";
    return "";
  };

  const handleBatchSubmit = async () => {
    if (!batchEvidence.trim()) {
      setBatchError("请输入证据内容");
      return;
    }

    setBatchLoading(true);
    setBatchError("");
    setBatchSuccess("");

    try {
      let result;
      const data = {
        transfer_ids: selectedIds,
        evidence_content: batchEvidence,
        remark: batchRemark,
      };

      if (user?.role === "reception_assistant") {
        result = await batchRegister(data);
      } else if (user?.role === "attending_physician") {
        result = await batchVerify(data);
      } else if (user?.role === "pharmacy_admin") {
        result = await batchReview(data);
      }

      setBatchSuccess(`批量操作提交成功！批次号：${result.batch_no}`);
      setShowBatchModal(false);
      setSelectedIds([]);
      loadTransfers();
      
      setTimeout(() => {
        window.location.href = `/batch`;
      }, 1500);
    } catch (err: any) {
      setBatchError(err.error || "批量操作失败");
    } finally {
      setBatchLoading(false);
    }
  };

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

  const selectedTransfer = transfers.find((t) => t.id === selectedId);

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
                <a href="/" className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-blue-600 bg-blue-50">
                  <span className="mr-2">📋</span>处方流转
                </a>
                <a href="/batch" className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {selectedIds.length > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm text-blue-700">
              已选择 <span className="font-medium">{selectedIds.length}</span> 项
            </span>
            <div className="flex items-center space-x-2">
              {canDoBatch() && (
                <button
                  onClick={() => {
                    setBatchEvidence("");
                    setBatchRemark("");
                    setBatchError("");
                    setBatchSuccess("");
                    setShowBatchModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {getBatchActionLabel()}
                </button>
              )}
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-2 text-gray-600 text-sm hover:text-gray-900 transition-colors"
              >
                取消选择
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">处方流转单列表</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="搜索流转单号、患者姓名、身份证号..."
                      value={keyword}
                      onInput={(e) => {
                        setKeyword((e.target as HTMLInputElement).value);
                        setPage(1);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter((e.target as HTMLSelectElement).value);
                      setPage(1);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">全部状态</option>
                    {Object.entries(STATUS_MAP).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <button
                    onClick={loadTransfers}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    搜索
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-gray-500">加载中...</div>
              ) : error ? (
                <div className="p-12 text-center text-red-500">{error}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedIds.length === transfers.length && transfers.length > 0}
                            onChange={(e) => handleSelectAll((e.target as HTMLInputElement).checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">流转单号</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">患者姓名</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科室</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金额</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transfers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                            暂无数据
                          </td>
                        </tr>
                      ) : (
                        transfers.map((transfer) => (
                          <tr
                            key={transfer.id}
                            onClick={() => handleSelect(transfer.id)}
                            className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                              selectedId === transfer.id ? "bg-blue-50" : ""
                            }`}
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(transfer.id)}
                                onChange={(e) => handleCheckboxChange(transfer.id, (e.target as HTMLInputElement).checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <a href={`/transfer/${transfer.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                                {transfer.transfer_no}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{transfer.patient_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{transfer.department}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">{formatAmount(transfer.total_amount)}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={transfer.status} />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(transfer.created_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
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
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let p = i + 1;
                      if (totalPages > 5) {
                        if (page > 3) p = page - 2 + i;
                        if (page > totalPages - 2) p = totalPages - 4 + i;
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`px-3 py-1.5 border rounded text-sm ${
                            page === p
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
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

          <div className="w-full lg:w-96">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-6">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">证据摘要</h3>
              </div>

              {!selectedTransfer ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">📄</div>
                  <p>请选择一个流转单查看证据</p>
                </div>
              ) : (
                <div className="p-4">
                  <div className="mb-4 pb-4 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{selectedTransfer.transfer_no}</p>
                    <p className="text-sm text-gray-500 mt-1">{selectedTransfer.patient_name} · {selectedTransfer.department}</p>
                    <div className="mt-2">
                      <StatusBadge status={selectedTransfer.status} />
                    </div>
                  </div>

                  {evidencesLoading ? (
                    <div className="py-8 text-center text-gray-500 text-sm">加载中...</div>
                  ) : evidences.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">
                      暂无证据记录
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {evidences.map((ev) => (
                        <div key={ev.id} className="relative pl-6 pb-4 border-l-2 border-gray-200 last:border-l-0 last:pb-0">
                          <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
                          <div className="text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-900">
                                {EVIDENCE_TYPE_MAP[ev.evidence_type] || ev.evidence_type}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDateTime(ev.created_at)}
                              </span>
                            </div>
                            <p className="text-gray-600 text-xs mb-1">
                              {ev.operator_name} ({ROLE_MAP[ev.operator_role] || ev.operator_role})
                            </p>
                            <p className="text-gray-700 mt-2 bg-gray-50 p-2 rounded text-xs">
                              {ev.evidence_content}
                            </p>
                            {ev.remark && (
                              <p className="text-gray-500 mt-1 text-xs">
                                备注：{ev.remark}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <a
                      href={`/transfer/${selectedTransfer.id}`}
                      className="block text-center px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      查看详情 →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{getBatchActionLabel()}</h3>
              <p className="text-sm text-gray-500 mt-1">已选择 {selectedIds.length} 项</p>
            </div>
            <div className="p-6 space-y-4">
              {batchError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {batchError}
                </div>
              )}
              {batchSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {batchSuccess}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  证据内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={batchEvidence}
                  onInput={(e) => setBatchEvidence((e.target as HTMLTextAreaElement).value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入证据内容..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={batchRemark}
                  onInput={(e) => setBatchRemark((e.target as HTMLTextAreaElement).value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="可选"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowBatchModal(false)}
                disabled={batchLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleBatchSubmit}
                disabled={batchLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {batchLoading ? "提交中..." : "确认提交"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
