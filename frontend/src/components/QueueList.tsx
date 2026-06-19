import React, { useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { useOrderStore } from "../stores/orderStore";
import type { Order, UserRole } from "../lib/types";
import { STATUS_LABEL, STATUS_COLOR, ROLE_LABEL } from "../lib/types";
import { api } from "../lib/api";
import {
  FileText,
  Search,
  CheckSquare,
  Square,
  ChevronRight,
  Plus,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "draft", label: "草稿" },
  { value: "submitted", label: "已提交" },
  { value: "returned_to_registrar", label: "退回补正" },
  { value: "reviewed", label: "审核通过" },
  { value: "returned_to_reviewer", label: "退回审核" },
  { value: "archived", label: "已归档" },
];

interface QueueListProps {
  onSelectOrder: (id: string) => void;
  selectedOrderId: string | null;
  onShowNewOrder: () => void;
}

export default function QueueList({ onSelectOrder, selectedOrderId, onShowNewOrder }: QueueListProps) {
  const { user } = useAuthStore();
  const { orders, loading, filterStatus, filterKeyword, selectedIds, fetchOrders, setFilterStatus, setFilterKeyword, toggleSelect, selectAll, clearSelection } = useOrderStore();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchOrders(user.role);
  }, [user]);

  const handleSearch = () => {
    if (user) fetchOrders(user.role);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const allSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));

  const handleBatchAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    setActionError(null);
    const res = await api.orders.batch(action, Array.from(selectedIds));
    if (res.success && res.data) {
      const failed = res.data.filter((r) => !r.success);
      if (failed.length > 0) {
        setActionError(
          failed.map((f) => `${f.id}: ${f.error?.message || "操作失败"}`).join("; ")
        );
      }
      clearSelection();
      if (user) fetchOrders(user.role);
    }
  };

  const canBatchApprove = user?.role === "reviewer";
  const canBatchReturn = user?.role === "reviewer" || user?.role === "archiver";
  const canBatchArchive = user?.role === "archiver";

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-indigo-900" />
          <h2 className="text-lg font-bold text-slate-800">
            菜品上新单队列
          </h2>
          <span className="text-sm text-slate-500">({orders.length})</span>
          {user?.role === "registrar" && (
            <button
              onClick={onShowNewOrder}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-md bg-indigo-900 text-white text-sm font-medium hover:bg-indigo-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建单据
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索单据编号/菜品名称"
              className="w-full pl-8 pr-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setTimeout(() => {
                if (user) fetchOrders(user.role);
              }, 0);
            }}
            className="px-3 py-2 rounded-md border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            className="px-3 py-2 rounded-md bg-indigo-900 text-white text-sm hover:bg-indigo-800 transition-colors"
          >
            搜索
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-3 text-sm">
          <span className="text-amber-700 font-medium">
            已选 {selectedIds.size} 项
          </span>
          <button onClick={allSelected ? clearSelection : selectAll} className="text-indigo-700 hover:underline">
            {allSelected ? "取消全选" : "全选"}
          </button>
          <div className="flex-1" />
          {canBatchApprove && (
            <button
              onClick={() => handleBatchAction("review")}
              className="px-3 py-1 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-500"
            >
              批量审核通过
            </button>
          )}
          {canBatchReturn && user?.role === "reviewer" && (
            <button
              onClick={() => handleBatchAction("review_return")}
              className="px-3 py-1 rounded bg-amber-500 text-white text-xs font-medium hover:bg-amber-400"
            >
              批量退回
            </button>
          )}
          {canBatchArchive && (
            <button
              onClick={() => handleBatchAction("archive")}
              className="px-3 py-1 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
            >
              批量归档
            </button>
          )}
          {canBatchReturn && user?.role === "archiver" && (
            <button
              onClick={() => handleBatchAction("archive_return")}
              className="px-3 py-1 rounded bg-amber-500 text-white text-xs font-medium hover:bg-amber-400"
            >
              批量退回审核
            </button>
          )}
        </div>
      )}

      {actionError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-400">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-slate-400">暂无单据</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                  selectedOrderId === order.id ? "bg-indigo-50 border-l-2 border-indigo-600" : ""
                }`}
                onClick={() => onSelectOrder(order.id)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(order.id);
                  }}
                  className="flex-shrink-0"
                >
                  {selectedIds.has(order.id) ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-800">
                      {order.order_no}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status]}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                    <span className="text-xs text-slate-400">v{order.version}</span>
                  </div>
                  <div className="text-sm text-slate-600 truncate">
                    {order.dish_name} · {order.dish_category} · ¥{order.price}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
