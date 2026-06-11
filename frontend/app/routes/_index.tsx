import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@remix-run/react";
import {
  apiFetch,
  CreativeDemand,
  Statistics,
  statusLabels,
  statusColors,
  DemandStatus,
  getAvailableActions,
  ApiError,
} from "~/api/client";

export default function Index() {
  const navigate = useNavigate();
  const [demands, setDemands] = useState<CreativeDemand[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<DemandStatus | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<string | null>(null);
  const [batchComments, setBatchComments] = useState("");
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    loadData();
  }, [statusFilter, mineOnly]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, demandsRes] = await Promise.all([
        apiFetch<Statistics>("/api/creative-demands/statistics"),
        apiFetch<{ items: CreativeDemand[]; total: number }>(
          `/api/creative-demands?${new URLSearchParams({
            ...(statusFilter !== "all" ? { status: statusFilter } : {}),
            ...(mineOnly ? { mine: "true" } : {}),
          })}`
        ),
      ]);
      setStatistics(statsRes);
      setDemands(demandsRes.items);
    } catch (err: any) {
      setError(err.message || "加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === demands.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(demands.map((d) => d.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleScan = async () => {
    if (!scanCode.trim()) return;
    
    try {
      const result = await apiFetch<any>(`/api/creative-demands/scan`, {
        method: "POST",
        body: JSON.stringify({ code: scanCode.trim() }),
      });
      setScanResult(result);

      if (result.success && result.creative_demand) {
        setTimeout(() => {
          navigate(`/demand/${result.creative_demand.id}`);
        }, 1500);
      }
    } catch (err: any) {
      setScanResult({
        success: false,
        error_code: "SCAN_FAILED",
        error_message: err.message,
      });
    }
  };

  const handleBatchAction = async () => {
    if (!batchAction || selectedIds.size === 0) return;

    try {
      const result = await apiFetch<any>("/api/creative-demands/batch-transition", {
        method: "POST",
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          target_status: batchAction,
          comments: batchComments || undefined,
        }),
      });

      alert(
        `批量处理完成：成功 ${result.success_count} 个，失败 ${result.fail_count} 个`
      );
      setShowBatchModal(false);
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      alert(`批量处理失败：${err.message}`);
    }
  };

  const handleQuickAction = async (
    demand: CreativeDemand,
    targetStatus: DemandStatus,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    
    const comments = prompt("请输入处理意见（可选）：");
    if (comments === null) return;

    try {
      await apiFetch(`/api/creative-demands/${demand.id}/transition`, {
        method: "POST",
        body: JSON.stringify({
          target_status: targetStatus,
          comments: comments || undefined,
        }),
      });
      alert("操作成功");
      loadData();
    } catch (err: any) {
      alert(`操作失败：${err.message}`);
    }
  };

  const availableBatchActions = useMemo(() => {
    if (selectedIds.size === 0 || !user) return [];
    
    const firstDemand = demands.find((d) => selectedIds.has(d.id));
    if (!firstDemand) return [];
    
    const allSameStatus = Array.from(selectedIds).every(
      (id) => demands.find((d) => d.id === id)?.status === firstDemand.status
    );
    
    if (!allSameStatus) return [];
    
    return getAvailableActions(firstDemand.status, user.role);
  }, [selectedIds, demands, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="card p-4">
            <div className="text-sm text-gray-500">总数</div>
            <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
          </div>
          <div
            className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter("pending_registrar")}
          >
            <div className="text-sm text-yellow-600">待登记员处理</div>
            <div className="text-2xl font-bold text-yellow-700">
              {statistics.pending_registrar}
            </div>
          </div>
          <div
            className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter("pending_supervisor")}
          >
            <div className="text-sm text-blue-600">待主管审核</div>
            <div className="text-2xl font-bold text-blue-700">
              {statistics.pending_supervisor}
            </div>
          </div>
          <div
            className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter("pending_reviewer")}
          >
            <div className="text-sm text-purple-600">待复核归档</div>
            <div className="text-2xl font-bold text-purple-700">
              {statistics.pending_reviewer}
            </div>
          </div>
          <div
            className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter("completed")}
          >
            <div className="text-sm text-green-600">已完成</div>
            <div className="text-2xl font-bold text-green-700">
              {statistics.completed}
            </div>
          </div>
          <div
            className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setStatusFilter("rejected")}
          >
            <div className="text-sm text-red-600">已退回</div>
            <div className="text-2xl font-bold text-red-700">
              {statistics.rejected}
            </div>
          </div>
          <div
            className="card p-4 cursor-pointer hover:shadow-md transition-shadow border-primary-300 bg-primary-50"
            onClick={() => setMineOnly(!mineOnly)}
          >
            <div className="text-sm text-primary-600">我的待办</div>
            <div className="text-2xl font-bold text-primary-700">
              {statistics.my_tasks}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">全部状态</option>
            <option value="pending_registrar">待登记员处理</option>
            <option value="pending_supervisor">待主管审核</option>
            <option value="pending_reviewer">待复核归档</option>
            <option value="completed">已完成</option>
            <option value="rejected">已退回</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">只看我的</span>
          </label>
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            className="btn btn-secondary"
            onClick={() => setShowScanModal(true)}
          >
            📱 扫码核验
          </button>
          {user?.role === "registrar" && (
            <button
              className="btn btn-primary"
              onClick={() => navigate("/create")}
            >
              + 新建需求单
            </button>
          )}
          {selectedIds.size > 0 && availableBatchActions.length > 0 && (
            <button
              className="btn btn-success"
              onClick={() => setShowBatchModal(true)}
            >
              批量处理 ({selectedIds.size})
            </button>
          )}
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === demands.length && demands.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  单号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  标题
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  客户
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  当前处理人
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {demands.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                demands.map((demand) => (
                  <tr
                    key={demand.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/demand/${demand.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(demand.id)}
                        onChange={() => handleSelect(demand.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {demand.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {demand.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {demand.client_name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          statusColors[demand.status]
                        }`}
                      >
                        {statusLabels[demand.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {demand.current_handler_role === "registrar" && "登记员"}
                      {demand.current_handler_role === "supervisor" && "主管"}
                      {demand.current_handler_role === "reviewer" && "复核人"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(demand.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {getAvailableActions(demand.status, user?.role || "").map(
                          (action) => (
                            <button
                              key={action.key}
                              className={`text-xs px-2 py-1 rounded ${
                                action.variant === "primary"
                                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  : action.variant === "warning"
                                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                  : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                              onClick={(e) =>
                                handleQuickAction(demand, action.target, e)
                              }
                            >
                              {action.label}
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">扫码核验创意需求单</h3>
            <div className="space-y-4">
              <div>
                <label className="label">输入创意需求单编号</label>
                <input
                  type="text"
                  className="input"
                  placeholder="例如：CD202406001"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  autoFocus
                />
              </div>
              {scanResult && (
                <div
                  className={`p-3 rounded-md ${
                    scanResult.success
                      ? "bg-green-50 border border-green-200 text-green-700"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}
                >
                  <div className="font-medium">
                    {scanResult.success ? "核验成功" : "核验失败"}
                  </div>
                  {scanResult.error_message && (
                    <div className="text-sm mt-1">{scanResult.error_message}</div>
                  )}
                  {scanResult.error_code && (
                    <div className="text-xs mt-1 opacity-75">
                      错误码：{scanResult.error_code}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowScanModal(false);
                    setScanCode("");
                    setScanResult(null);
                  }}
                >
                  关闭
                </button>
                <button className="btn btn-primary" onClick={handleScan}>
                  核验
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">批量处理</h3>
            <div className="space-y-4">
              <div>
                <label className="label">选择操作</label>
                <select
                  className="input"
                  value={batchAction || ""}
                  onChange={(e) => setBatchAction(e.target.value)}
                >
                  <option value="">请选择操作</option>
                  {availableBatchActions.map((action) => (
                    <option key={action.key} value={action.target}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">处理意见</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="请输入处理意见（可选）"
                  value={batchComments}
                  onChange={(e) => setBatchComments(e.target.value)}
                />
              </div>
              <div className="text-sm text-gray-500">
                已选择 {selectedIds.size} 条记录
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowBatchModal(false);
                    setBatchAction(null);
                    setBatchComments("");
                  }}
                >
                  取消
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleBatchAction}
                  disabled={!batchAction}
                >
                  确认处理
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
