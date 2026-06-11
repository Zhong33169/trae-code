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
  ShieldCheck,
  CheckCheck,
  Ban,
  RefreshCw,
  LogIn,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  batchAction,
  type Order,
  type EvidenceItem,
  type ApiError,
  type BatchActionResult,
  type BlockAttempt,
  type BlockCode,
  type ActionTarget,
  type ActionPayload,
  type Role,
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

const BLOCK_CODE_LABELS: Record<BlockCode, { label: string; color: string; bg: string }> = {
  wrong_role: { label: "错角色", color: "text-purple-700", bg: "bg-purple-100" },
  wrong_status: { label: "错状态", color: "text-orange-700", bg: "bg-orange-100" },
  missing_evidence: { label: "缺证据", color: "text-amber-700", bg: "bg-amber-100" },
  version_conflict: { label: "版本冲突", color: "text-rose-700", bg: "bg-rose-100" },
  duplicate_supplement: { label: "重复补录", color: "text-pink-700", bg: "bg-pink-100" },
  archived: { label: "已归档", color: "text-green-700", bg: "bg-green-100" },
  not_found: { label: "不存在", color: "text-gray-700", bg: "bg-gray-100" },
  unknown: { label: "未知", color: "text-gray-700", bg: "bg-gray-100" },
};

const ACTION_BUTTON_CONFIG: Record<ActionTarget, { label: string; icon: any; variant: string }> = {
  goto_detail: { label: "去详情", icon: ArrowRight, variant: "navy" },
  switch_role: { label: "切换角色", icon: LogIn, variant: "purple" },
  refresh_version: { label: "刷新版本", icon: RefreshCw, variant: "rose" },
  add_evidence: { label: "补充证据", icon: FileText, variant: "amber" },
  continue_verify: { label: "继续核验", icon: ShieldCheck, variant: "blue" },
  continue_review: { label: "继续归档", icon: CheckCheck, variant: "green" },
  continue_supplement: { label: "继续补录", icon: FileText, variant: "yellow" },
  no_action: { label: "无法处理", icon: Ban, variant: "gray" },
};

function parseActionPayload(payload: string | null): ActionPayload {
  if (!payload) return {};
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

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

function BlockCodeBadge({ code }: { code: BlockCode | string }) {
  const cfg = BLOCK_CODE_LABELS[code as BlockCode] || { label: code, color: "text-gray-700", bg: "bg-gray-100" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function BlockHintCard({
  block,
  compact,
  onAction,
}: {
  block: BlockAttempt
  compact?: boolean
  onAction?: (actionTarget: ActionTarget, payload: ActionPayload) => void
}) {
  const actionCfg = ACTION_BUTTON_CONFIG[block.action_target] || ACTION_BUTTON_CONFIG.no_action
  const ActionIcon = actionCfg.icon
  const payload = parseActionPayload(block.action_payload)

  const variantClasses: Record<string, string> = {
    navy: "bg-navy-700 hover:bg-navy-800 text-white",
    purple: "bg-purple-600 hover:bg-purple-700 text-white",
    rose: "bg-rose-600 hover:bg-rose-700 text-white",
    amber: "bg-amber-600 hover:bg-amber-700 text-white",
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    green: "bg-green-600 hover:bg-green-700 text-white",
    yellow: "bg-yellow-600 hover:bg-yellow-700 text-white",
    gray: "bg-gray-400 text-white cursor-not-allowed",
  }

  const statusBadge =
    block.resolve_status === "resolved"
      ? { label: "已处理", cls: "bg-green-100 text-green-700" }
      : block.resolve_status === "ignored"
      ? { label: "已忽略", cls: "bg-gray-100 text-gray-600" }
      : { label: "待处理", cls: "bg-amber-100 text-amber-700" }

  if (compact) {
    return (
      <div className="mt-2.5 border border-amber-200 bg-amber-50 rounded-md px-2.5 py-1.5">
        <div className="flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <BlockCodeBadge code={block.code} />
              <span className="text-[10px] text-gray-400">v{block.current_version}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge.cls}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="text-[11px] text-amber-900 mt-0.5 truncate">{block.reason}</p>
          </div>
        </div>
        {block.action_target !== "no_action" && block.resolve_status === "pending" && onAction && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAction(block.action_target, payload)
            }}
            className={`mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${variantClasses[actionCfg.variant]}`}
          >
            <ActionIcon className="w-3 h-3" />
            {actionCfg.label}
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <BlockCodeBadge code={block.code} />
          <span className="text-xs text-gray-500">当前版本 v{block.current_version}</span>
          {block.submitted_version !== null && block.submitted_version !== block.current_version && (
            <span className="text-[10px] text-rose-600">(提交 v{block.submitted_version})</span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>
        <p className="text-sm text-amber-900 font-medium">{block.reason}</p>
        <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
          <ArrowRight className="w-3 h-3" />
          {block.action_hint}
        </p>
        {block.action_target !== "no_action" && block.resolve_status === "pending" && onAction && (
          <button
            onClick={() => onAction(block.action_target, payload)}
            className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${variantClasses[actionCfg.variant]}`}
          >
            <ActionIcon className="w-3.5 h-3.5" />
            {actionCfg.label}
          </button>
        )}
      </div>
    </div>
  )
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

function BatchActionBar({ onShowDetail }: { onShowDetail: (result: BatchActionResult) => void }) {
  const { selectedOrderIds, currentUser, token, clearSelection, fetchOrders, orders } = useStore();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<BatchActionResult | null>(null);

  if (selectedOrderIds.length === 0) return null;

  const role = currentUser?.role;
  const actionLabel =
    role === "receptionist" ? "批量补录" : role === "room_supervisor" ? "批量核验" : "批量归档";
  const actionType =
    role === "receptionist" ? "supplement" as const : role === "room_supervisor" ? "verify" as const : "review" as const;

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));

  const handleBatchAction = async () => {
    if (!token) return;
    setProcessing(true);
    setResult(null);
    try {
      const batchOrders = selectedOrders.map((o) => ({ id: o.id, version: o.version }));
      const res = await batchAction(token, {
        orders: batchOrders,
        action: actionType,
        evidenceItems: [{ type: "其他", description: "批量操作证据" }],
        verified: true,
        approved: true,
      });
      setResult(res);
      clearSelection();
      await fetchOrders();
      if (res.failures.length > 0) {
        onShowDetail(res);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      const failResult: BatchActionResult = {
        successes: [],
        failures: selectedOrders.map((o) => ({
          id: o.id,
          order_no: o.order_no,
          reason: apiErr.reason || apiErr.error || "操作失败",
          code: apiErr.code || "unknown",
          actionHint: apiErr.actionHint || "请联系管理员或稍后重试",
          actionTarget: apiErr.actionTarget || "no_action",
          actionPayload: apiErr.actionPayload || {},
          submittedVersion: o.version,
          currentVersion: apiErr.currentVersion ?? o.version,
        })),
      };
      setResult(failResult);
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
          <div className="flex items-center gap-3 text-xs">
            {result.successes.length > 0 && (
              <span className="text-green-300 font-medium">成功 {result.successes.length}</span>
            )}
            {result.failures.length > 0 && (
              <button
                onClick={() => onShowDetail(result)}
                className="text-red-300 font-medium hover:text-red-200 underline underline-offset-2"
              >
                失败 {result.failures.length}（点击查看详情）
              </button>
            )}
          </div>
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
  const router = useRouter();
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
  const [batchFailDetail, setBatchFailDetail] = useState<BatchActionResult | null>(null);

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

  const handleBlockAction = useCallback(
    async (actionTarget: ActionTarget, payload: ActionPayload) => {
      if (actionTarget === "switch_role" && payload.targetRole) {
        const roleKey = payload.targetRole as keyof typeof ROLE_CONFIG;
        const cfg = ROLE_CONFIG[roleKey];
        if (cfg && currentUser?.role !== roleKey) {
          try {
            await login(cfg.username, cfg.password);
            setToast({ message: `已切换为${cfg.label}`, type: "success" });
          } catch {
            setToast({ message: "角色切换失败", type: "error" });
          }
        } else if (currentUser?.role === roleKey) {
          setToast({ message: "当前已是该角色", type: "success" });
        }
      } else if (actionTarget === "goto_detail" || actionTarget === "add_evidence" || actionTarget === "continue_verify" || actionTarget === "continue_review" || actionTarget === "continue_supplement") {
        const orderId = payload.orderId || selectedOrderId;
        if (orderId) {
          setSelectedOrderId(orderId);
          if (!selectedOrderIds.includes(orderId)) {
            toggleOrderSelection(orderId);
          }
          const hash = payload.scrollTo ? `#${payload.scrollTo}` : "";
          router.push(`/orders/${orderId}${hash}`);
        }
      } else if (actionTarget === "refresh_version") {
        await fetchOrders();
        setToast({ message: "已刷新订单列表与版本", type: "success" });
      }
    },
    [login, selectedOrderId, selectedOrderIds, toggleOrderSelection, setSelectedOrderId, fetchOrders, currentUser, router]
  );

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
              const lastBlock = (order.blockAttempts || []).slice(-1)[0] || null;
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-navy-800">{order.order_no}</span>
                          <span className="text-[10px] text-gray-400">v{order.version}</span>
                        </div>
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
                      {lastBlock && <BlockHintCard block={lastBlock} compact onAction={handleBlockAction} />}
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

      <BatchActionBar onShowDetail={setBatchFailDetail} />

      {batchFailDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setBatchFailDetail(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-navy-700 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-300" />
                <span className="font-semibold">批量操作失败详情</span>
              </div>
              <button onClick={() => setBatchFailDetail(null)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto space-y-3">
              <div className="text-sm text-gray-600 mb-3">
                成功 <span className="font-semibold text-green-600">{batchFailDetail.successes.length}</span> 条，
                失败 <span className="font-semibold text-red-600">{batchFailDetail.failures.length}</span> 条
              </div>
              {batchFailDetail.failures.map((f) => {
                const actionCfg = ACTION_BUTTON_CONFIG[f.actionTarget] || ACTION_BUTTON_CONFIG.no_action
                const ActionIcon = actionCfg.icon
                const variantClasses: Record<string, string> = {
                  navy: "bg-navy-700 hover:bg-navy-800 text-white",
                  purple: "bg-purple-600 hover:bg-purple-700 text-white",
                  rose: "bg-rose-600 hover:bg-rose-700 text-white",
                  amber: "bg-amber-600 hover:bg-amber-700 text-white",
                  blue: "bg-blue-600 hover:bg-blue-700 text-white",
                  green: "bg-green-600 hover:bg-green-700 text-white",
                  yellow: "bg-yellow-600 hover:bg-yellow-700 text-white",
                  gray: "bg-gray-400 text-white cursor-not-allowed",
                }
                return (
                  <div key={f.id} className="border border-red-200 bg-red-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-sm text-navy-900">{f.order_no || f.id}</span>
                      <BlockCodeBadge code={f.code} />
                    </div>
                    <div className="flex items-center gap-3 mb-1 text-xs text-gray-500">
                      <span>当前版本 v{f.currentVersion}</span>
                      {f.submittedVersion !== null && f.submittedVersion !== f.currentVersion && (
                        <span className="text-rose-600">(提交 v{f.submittedVersion})</span>
                      )}
                    </div>
                    <p className="text-sm text-red-700 mb-1.5">{f.reason}</p>
                    <p className="text-xs text-red-600 bg-white/60 rounded px-2 py-1 flex items-start gap-1">
                      <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{f.actionHint}</span>
                    </p>
                    {f.actionTarget !== "no_action" && (
                      <button
                        onClick={() => {
                          setBatchFailDetail(null)
                          handleBlockAction(f.actionTarget, f.actionPayload)
                        }}
                        className={`mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${variantClasses[actionCfg.variant]}`}
                      >
                        <ActionIcon className="w-3.5 h-3.5" />
                        {actionCfg.label}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setBatchFailDetail(null)}
                className="px-4 py-2 text-sm rounded-lg bg-navy-700 text-white hover:bg-navy-800 transition-colors"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
