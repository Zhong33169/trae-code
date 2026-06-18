import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useOutletContext,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { fetchOrders, fetchStats, batchProcess, ApiError } from "~/lib/api";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  STAGE_LABELS,
  STAGE_ROLE,
} from "~/lib/types";
import type {
  OrderListItem,
  OrderStatus,
  Role,
  Stats,
  User,
} from "~/lib/types";
import { WarningBadge, warningColor } from "~/components/WarningBadge";
import { Toast } from "~/components/Toast";
import type { ToastData } from "~/components/Toast";

export const meta: MetaFunction = () => [
  { title: "工单列表 · 水务营业厅" },
];

const ROLES: Role[] = ["window_staff", "meter_supervisor", "business_manager"];
const STATUSES: OrderStatus[] = ["pending_review", "approved", "synced"];

const STATUS_META: Record<
  OrderStatus,
  { color: string; icon: React.ReactNode }
> = {
  pending_review: {
    color: "border-t-deep-300",
    icon: <Clock className="w-4 h-4 text-deep-500" />,
  },
  approved: {
    color: "border-t-emerald-ok/60",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-ok" />,
  },
  synced: {
    color: "border-t-aqua/60",
    icon: <CheckCircle2 className="w-4 h-4 text-aqua" />,
  },
};

interface OutletCtx {
  users: User[];
}

export async function loader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url);
  const role = (url.searchParams.get("role") as Role) || "meter_supervisor";
  const validRole = ROLES.includes(role) ? role : "meter_supervisor";
  try {
    const [orders, stats] = await Promise.all([
      fetchOrders({ role: validRole }),
      fetchStats(),
    ]);
    return { orders, stats, role: validRole, error: null };
  } catch (e) {
    return {
      orders: [] as OrderListItem[],
      stats: null as Stats | null,
      role: validRole,
      error: e instanceof Error ? e.message : "加载失败",
    };
  }
}

export default function OrderListPage() {
  const { orders, stats, role, error } = useLoaderData<typeof loader>();
  const { users } = useOutletContext<OutletCtx>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<ToastData | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const showToast = useCallback((t: ToastData) => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const switchRole = (r: Role) => {
    setSelected(new Set());
    const next = new URLSearchParams(searchParams);
    next.set("role", r);
    setSearchParams(next, { preventScrollReset: true });
  };

  const grouped = useMemo(() => {
    const map: Record<OrderStatus, OrderListItem[]> = {
      pending_review: [],
      approved: [],
      synced: [],
    };
    for (const o of orders) {
      map[o.status]?.push(o);
    }
    for (const s of STATUSES) {
      map[s].sort((a, b) => a.warning.remainSeconds - b.warning.remainSeconds);
    }
    return map;
  }, [orders]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInColumn = (status: OrderStatus) => {
    const colItems = grouped[status];
    const allSelected = colItems.every((o) => selected.has(o.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        colItems.forEach((o) => next.delete(o.id));
      } else {
        colItems.forEach((o) => next.add(o.id));
      }
      return next;
    });
  };

  const selectedOrders = useMemo(
    () => orders.filter((o) => selected.has(o.id)),
    [orders, selected],
  );

  const canBatch = role !== "window_staff" && selected.size > 0;

  const runBatch = async (action: "approve" | "reject") => {
    const user = users.find((u) => u.role === role);
    if (!user || selectedOrders.length === 0) return;
    setBatchLoading(true);
    try {
      const results = await batchProcess({
        items: selectedOrders.map((o) => ({ id: o.id, version: o.version })),
        action,
        actorRole: role,
        actorId: user.id,
        reviewComment: action === "approve" ? "批量处理通过" : "批量退回重审",
      });
      const ok = results.filter((r) => r.success).length;
      const fail = results.length - ok;
      if (fail === 0) {
        showToast({ type: "success", msg: `批量处理完成：${ok} 条工单已${action === "approve" ? "推进" : "退回"}` });
      } else if (ok === 0) {
        const firstFail = results.find((r) => !r.success);
        showToast({
          type: "error",
          msg: `批量处理失败：${fail} 条均未通过校验（${firstFail?.message ?? ""}）`,
        });
      } else {
        showToast({
          type: "info",
          msg: `批量处理完成：成功 ${ok} 条，失败 ${fail} 条（证据缺失/超时限/并发冲突）`,
        });
      }
      const failedIds = new Set(results.filter((r) => !r.success).map((r) => r.id));
      setSelected((prev) => {
        const next = new Set<number>();
        prev.forEach((id) => {
          if (failedIds.has(id)) next.add(id);
        });
        return next;
      });
      revalidator.revalidate();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "批量处理请求失败";
      showToast({ type: "error", msg });
    } finally {
      setBatchLoading(false);
    }
  };

  const onRefresh = () => {
    setSelected(new Set());
    revalidator.revalidate();
  };

  if (error) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-crimson mx-auto mb-3" />
        <p className="text-ink-soft font-medium mb-1">数据加载失败</p>
        <p className="text-ink-muted text-sm font-mono">{error}</p>
        <p className="text-xs text-ink-muted mt-3">
          请确认后端服务已启动（端口 8004）
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} />

      <RoleSwitcherBar
        role={role}
        onSwitch={switchRole}
        stats={stats}
        onRefresh={onRefresh}
        refreshing={revalidator.state !== "idle"}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {STATUSES.map((status, idx) => (
          <div
            key={status}
            className="flex flex-col"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <QueueColumn
              status={status}
              items={grouped[status]}
              role={role}
              selected={selected}
              onToggle={toggleSelect}
              onSelectAll={selectAllInColumn}
              onNavigate={(id) => navigate(`/orders/${id}`)}
            />
          </div>
        ))}
      </div>

      {canBatch && (
        <BatchActionBar
          count={selected.size}
          role={role}
          onApprove={() => runBatch("approve")}
          onReject={() => runBatch("reject")}
          loading={batchLoading}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}

function RoleSwitcherBar({
  role,
  onSwitch,
  stats,
  onRefresh,
  refreshing,
}: {
  role: Role;
  onSwitch: (r: Role) => void;
  stats: Stats | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 p-1 bg-paper rounded border border-deep-100">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => onSwitch(r)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition-all ${
                role === r
                  ? "bg-deep-500 text-white shadow-sm"
                  : "text-ink-soft hover:bg-white"
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>

        <div className="text-sm text-ink-muted">
          当前视图：<span className="font-semibold text-ink">{ROLE_LABELS[role]}</span>
          <span className="ml-2 text-xs">
            （{STAGE_LABELS[roleToStage(role)]}阶段）
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {stats && (
            <>
              <StatPill
                label="待审核"
                value={stats.pendingReview}
                color="text-deep-600 bg-deep-50"
              />
              <StatPill
                label="审核通过"
                value={stats.approved}
                color="text-emerald-ok bg-emerald-soft"
              />
              <StatPill
                label="已同步"
                value={stats.synced}
                color="text-aqua bg-blue-50"
              />
              <div className="w-px h-6 bg-deep-100 mx-1" />
              <StatPill
                label="临期"
                value={stats.nearDue}
                color="text-amber-warn bg-amber-soft"
                icon={<Clock className="w-3 h-3" />}
              />
              <StatPill
                label="逾期"
                value={stats.overdue}
                color="text-crimson bg-crimson-soft"
                icon={<AlertTriangle className="w-3 h-3" />}
              />
            </>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="btn-secondary !py-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>
    </div>
  );
}

function roleToStage(role: Role) {
  const entry = Object.entries(STAGE_ROLE).find(([, r]) => r === role);
  return entry ? (entry[0] as keyof typeof STAGE_ROLE) : "registration";
}

function StatPill({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-semibold ${color}`}
    >
      {icon}
      <span>{label}</span>
      <span className="font-mono text-base">{value}</span>
    </div>
  );
}

function QueueColumn({
  status,
  items,
  role,
  selected,
  onToggle,
  onSelectAll,
  onNavigate,
}: {
  status: OrderStatus;
  items: OrderListItem[];
  role: Role;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: (status: OrderStatus) => void;
  onNavigate: (id: number) => void;
}) {
  const meta = STATUS_META[status];
  const allSelected = items.length > 0 && items.every((o) => selected.has(o.id));
  const someSelected = items.some((o) => selected.has(o.id));

  return (
    <div className={`card flex flex-col min-h-[400px] border-t-4 ${meta.color}`}>
      <div className="px-4 py-3 border-b border-deep-50 flex items-center gap-2">
        {meta.icon}
        <h3 className="font-display font-bold text-base text-ink">
          {STATUS_LABELS[status]}
        </h3>
        <span className="ml-auto text-sm font-mono text-ink-muted">
          {items.length}
        </span>
        {items.length > 0 && role !== "window_staff" && (
          <button
            onClick={() => onSelectAll(status)}
            className="text-xs text-deep-500 hover:text-deep-700 font-medium ml-2"
          >
            {allSelected ? "取消全选" : "全选"}
          </button>
        )}
      </div>
      <div className="flex-1 p-3 space-y-2 overflow-y-auto scrollbar-thin max-h-[calc(100vh-260px)]">
        {items.length === 0 ? (
          <div className="text-center py-12 text-ink-muted text-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            暂无工单
          </div>
        ) : (
          items.map((order, i) => (
            <OrderCard
              key={order.id}
              order={order}
              selectable={role !== "window_staff"}
              checked={selected.has(order.id)}
              onToggle={() => onToggle(order.id)}
              onNavigate={() => onNavigate(order.id)}
              delay={i * 60}
            />
          ))
        )}
      </div>
      {someSelected && (
        <div className="px-4 py-2 bg-deep-50/50 border-t border-deep-50 text-xs text-deep-600 font-medium">
          已选 {items.filter((o) => selected.has(o.id)).length} / {items.length}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  selectable,
  checked,
  onToggle,
  onNavigate,
  delay,
}: {
  order: OrderListItem;
  selectable: boolean;
  checked: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  delay: number;
}) {
  return (
    <div
      className={`group relative border-l-4 ${warningColor(
        order.warning.level,
      )} bg-white border-y border-r border-deep-50 rounded-r p-3 hover:shadow-md transition-all cursor-pointer animate-fade-up ${
        checked ? "ring-2 ring-deep-300 bg-deep-50/30" : ""
      }`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onNavigate}
    >
      <div className="flex items-start gap-2">
        {selectable && (
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 accent-deep-500 cursor-pointer"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-ink-muted">
              {order.orderNo}
            </span>
            <WarningBadge level={order.warning.level} />
          </div>
          <h4 className="text-sm font-semibold text-ink truncate group-hover:text-deep-600">
            {order.title}
          </h4>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-deep-300" />
              {order.repairType}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  order.priority === "紧急" ? "bg-crimson" : "bg-deep-300"
                }`}
              />
              {order.priority}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span
              className={`font-mono text-sm font-bold ${
                order.warning.level === "overdue"
                  ? "text-crimson"
                  : order.warning.level === "near_due"
                  ? "text-amber-warn"
                  : order.warning.level === "notice"
                  ? "text-blue-600"
                  : "text-deep-500"
              }`}
            >
              {order.warning.remainText}
            </span>
            <span className="text-xs text-ink-muted">
              {STAGE_LABELS[order.currentStage]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BatchActionBar({
  count,
  role,
  onApprove,
  onReject,
  loading,
  onClear,
}: {
  count: number;
  role: Role;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
  onClear: () => void;
}) {
  const actionLabel =
    role === "business_manager" ? "归档同步" : "核验推进";
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 card px-5 py-3 flex items-center gap-4 shadow-lg border-2 border-deep-300 animate-fade-up">
      <span className="text-sm font-semibold text-ink">
        已选 <span className="font-mono text-deep-600 text-lg">{count}</span> 条工单
      </span>
      <div className="w-px h-8 bg-deep-100" />
      <button onClick={onApprove} disabled={loading} className="btn-success">
        <CheckCircle2 className="w-4 h-4" />
        {actionLabel}
      </button>
      <button onClick={onReject} disabled={loading} className="btn-danger">
        <XCircle className="w-4 h-4" />
        退回
      </button>
      <button onClick={onClear} className="btn-secondary !py-1.5">
        取消
      </button>
      {loading && (
        <span className="text-xs text-ink-muted animate-pulse">处理中…</span>
      )}
    </div>
  );
}
