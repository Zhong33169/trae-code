"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Hotel,
  ClipboardList,
  CheckSquare,
  Shield,
  UserCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  X,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  batchAction,
  type Order,
  type EvidenceItem,
  type ApiError,
} from "@/lib/api";

const ROLE_CONFIG = {
  receptionist: { label: "前厅接待", username: "receptionist1", password: "123456" },
  room_supervisor: { label: "客房主管", username: "supervisor1", password: "123456" },
  duty_manager: { label: "值班经理", username: "manager1", password: "123456" },
} as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_supplement: { label: "待补录", color: "text-yellow-700", bg: "bg-yellow-100" },
  pending_verification: { label: "待核验", color: "text-blue-700", bg: "bg-blue-100" },
  pending_review: { label: "待复核", color: "text-purple-700", bg: "bg-purple-100" },
  archived: { label: "已归档", color: "text-green-700", bg: "bg-green-100" },
};

const STATUS_FILTERS = [
  { key: "all", label: "全部" },
  { key: "pending_supplement", label: "待补录" },
  { key: "pending_verification", label: "待核验" },
  { key: "pending_review", label: "待复核" },
  { key: "archived", label: "已归档" },
];

const STAGE_LABELS: Record<string, string> = {
  registration: "登记证据",
  verification: "核验证据",
  archive: "归档证据",
};

function getEvidenceProgress(order: Order): { current: number; total: number; percent: number } {
  const reg = (order.evidenceItems || []).filter((e) => e.stage === "registration").length;
  const ver = (order.evidenceItems || []).filter((e) => e.stage === "verification").length;
  const arc = (order.evidenceItems || []).filter((e) => e.stage === "archive").length;
  const current = (reg > 0 ? 1 : 0) + (ver > 0 ? 1 : 0) + (arc > 0 ? 1 : 0);
  return { current, total: 3, percent: Math.round((current / 3) * 100) };
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "text-gray-700", bg: "bg-gray-100" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function EvidencePanel({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ registration: true, verification: true, archive: true });
  const router = useRouter();

  const stages = ["registration", "verification", "archive"] as const;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-navy-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gold-500" />
          证据详情 — {order.order_no}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {stages.map((stage) => {
          const items = (order.evidenceItems || []).filter((e: EvidenceItem) => e.stage === stage);
          const isExpanded = expanded[stage];
          const hasItems = items.length > 0;
          return (
            <div key={stage} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [stage]: !prev[stage] }))}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-navy-700">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {STAGE_LABELS[stage]}
                  <span className="text-xs text-gray-400">({items.length})</span>
                  {hasItems ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-gray-300" />
                  )}
                </span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-3">
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">暂无证据</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((item: EvidenceItem) => (
                        <li key={item.id} className="text-xs bg-gray-50 rounded px-3 py-2">
                          <span className="font-medium text-navy-700">{item.type}</span>
                          <span className="mx-1.5 text-gray-300">|</span>
                          <span className="text-gray-600">{item.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="p-4 border-t border-gray-200 bg-white">
        <button
          onClick={() => router.push(`/orders/${order.id}`)}
          className="w-full flex items-center justify-center gap-2 bg-navy-700 text-white py-2.5 px-4 rounded-lg hover:bg-navy-800 transition-colors text-sm font-medium"
        >
          办理此订单
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function BatchActionBar() {
  const { selectedOrderIds, currentUser, token, clearSelection, fetchOrders } = useStore();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ successes: string[]; failures: { id: string; reason: string }[] } | null>(null);

  if (selectedOrderIds.length === 0) return null;

  const role = currentUser?.role;
  const actionLabel =
    role === "receptionist" ? "批量补录" : role === "room_supervisor" ? "批量核验" : "批量归档";
  const actionType =
    role === "receptionist" ? "supplement" as const : role === "room_supervisor" ? "verify" as const : "review" as const;

  const handleBatchAction = async () => {
    if (!token) return;
    setProcessing(true);
    setResult(null);
    try {
      const res = await batchAction(token, {
        orderIds: selectedOrderIds,
        action: actionType,
        version: 1,
        evidenceItems: [{ type: "其他", description: "批量操作证据" }],
        verified: true,
        approved: true,
      });
      setResult(res);
      clearSelection();
      await fetchOrders();
    } catch (err) {
      const apiErr = err as ApiError;
      setResult({ successes: [], failures: selectedOrderIds.map((id) => ({ id, reason: apiErr.reason || apiErr.error })) });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-navy-700 text-white px-6 py-4 flex items-center justify-between z-50 shadow-lg">
      <div className="flex items-center gap-3">
        <CheckSquare className="w-5 h-5 text-gold-400" />
        <span className="text-sm">已选择 <strong>{selectedOrderIds.length}</strong> 个订单</span>
      </div>
      <div className="flex items-center gap-3">
        {result && (
          <span className="text-xs">
            {result.successes.length > 0 && <span className="text-green-300 mr-2">成功 {result.successes.length}</span>}
            {result.failures.length > 0 && <span className="text-red-300">失败 {result.failures.length}</span>}
          </span>
        )}
        <button
          onClick={clearSelection}
          className="px-4 py-2 text-sm rounded-lg border border-white/30 hover:bg-white/10 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleBatchAction}
          disabled={processing}
          className="px-6 py-2 text-sm rounded-lg bg-gold-500 text-navy-900 font-medium hover:bg-gold-400 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {processing && <Loader2 className="w-4 h-4 animate-spin" />}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-right ${
        type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function HomePage() {
  const {
    currentUser,
    token,
    orders,
    selectedOrderId,
    statusFilter,
    selectedOrderIds,
    loading,
    error,
    login,
    setStatusFilter,
    setSelectedOrderId,
    toggleOrderSelection,
    fetchOrders,
  } = useStore();

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!token) {
      login("receptionist1", "123456").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchOrders().then(() => setInitialized(true));
    }
  }, [token]);

  useEffect(() => {
    if (token && initialized) {
      fetchOrders();
    }
  }, [statusFilter]);

  const handleRoleSwitch = useCallback(
    async (role: keyof typeof ROLE_CONFIG) => {
      const cfg = ROLE_CONFIG[role];
      try {
        await login(cfg.username, cfg.password);
        setToast({ message: `已切换为${cfg.label}`, type: "success" });
      } catch {
        setToast({ message: "角色切换失败", type: "error" });
      }
    },
    [login]
  );

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;

  return (
    <div className="h-screen flex flex-col">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-navy-700 text-white px-6 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <Hotel className="w-6 h-6 text-gold-400" />
          <h1 className="text-lg font-semibold tracking-wide">住客订单补录校验系统</h1>
        </div>
        <div className="flex items-center gap-1 bg-navy-800 rounded-lg p-1">
          {(Object.entries(ROLE_CONFIG) as [keyof typeof ROLE_CONFIG, (typeof ROLE_CONFIG)[keyof typeof ROLE_CONFIG]][]).map(
            ([key, cfg]) => (
              <button
                key={key}
                onClick={() => handleRoleSwitch(key)}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${
                  currentUser?.role === key
                    ? "bg-gold-500 text-navy-900 font-semibold shadow"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {cfg.label}
              </button>
            )
          )}
        </div>
        <div className="flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-gold-400" />
          <span className="text-sm">
            {currentUser?.username || "—"}
            <span className="ml-2 text-xs text-white/60">
              {currentUser ? ROLE_CONFIG[currentUser.role].label : ""}
            </span>
          </span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[60%] flex flex-col border-r border-gray-200 bg-gray-50">
          <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-2 shrink-0">
            <ClipboardList className="w-4 h-4 text-navy-500" />
            <span className="text-sm font-medium text-navy-700">订单列表</span>
            <div className="flex gap-1 ml-4">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    statusFilter === f.key
                      ? "bg-navy-700 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && orders.length === 0 && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-navy-400" />
                <span className="ml-2 text-sm text-gray-500">加载中...</span>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            {!loading && orders.length === 0 && (
              <div className="text-center py-20 text-gray-400 text-sm">暂无订单</div>
            )}
            {orders.map((order) => {
              const progress = getEvidenceProgress(order);
              const isSelected = selectedOrderId === order.id;
              const isChecked = selectedOrderIds.includes(order.id);
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? "border-navy-500 shadow-md ring-1 ring-navy-200" : "border-transparent shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOrderSelection(order.id);
                      }}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isChecked ? "bg-navy-600 border-navy-600" : "border-gray-300 hover:border-navy-400"
                      }`}
                    >
                      {isChecked && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-navy-800">{order.order_no}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                        <span>住客: {order.guest_name}</span>
                        <span>房间: {order.room_number || "—"}</span>
                      </div>
                      {order.supplement_reason && (
                        <p className="text-xs text-gray-400 mb-2 truncate">补录原因: {order.supplement_reason}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-gold-400 to-gold-500 rounded-full transition-all"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{progress.current}/{progress.total}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-[40%] bg-white flex flex-col">
          {selectedOrder ? (
            <EvidencePanel order={selectedOrder} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Shield className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">请选择一个订单查看证据</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <BatchActionBar />
    </div>
  );
}
