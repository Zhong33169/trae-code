import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useNavigate, useOutletContext, useRevalidator } from "@remix-run/react";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { fetchWarnings, batchProcess, ApiError } from "~/lib/api";
import {
  ROLE_LABELS,
  STAGE_LABELS,
  STAGE_ROLE,
} from "~/lib/types";
import type {
  BatchResultItem,
  OrderListItem,
  Role,
  User,
} from "~/lib/types";
import { WarningBadge, warningColor } from "~/components/WarningBadge";
import { Toast } from "~/components/Toast";
import type { ToastData } from "~/components/Toast";

export const meta: MetaFunction = () => [
  { title: "到期预警看板 · 水务营业厅" },
];

interface OutletCtx {
  users: User[];
}

export async function loader(_args: LoaderFunctionArgs) {
  try {
    const groups = await fetchWarnings();
    return { groups, error: null };
  } catch (e) {
    return {
      groups: { near_due: [] as OrderListItem[], overdue: [] as OrderListItem[] },
      error: e instanceof Error ? e.message : "加载失败",
    };
  }
}

export default function WarningsPage() {
  const { groups, error } = useLoaderData<typeof loader>();
  const { users } = useOutletContext<OutletCtx>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<ToastData | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const showToast = useCallback((t: ToastData) => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const overdue = [...groups.overdue].sort(
    (a, b) => a.warning.remainSeconds - b.warning.remainSeconds,
  );
  const nearDue = [...groups.near_due].sort(
    (a, b) => a.warning.remainSeconds - b.warning.remainSeconds,
  );

  const allWarningOrders = useMemo(() => [...overdue, ...nearDue], [overdue, nearDue]);
  const selectedOrders = allWarningOrders.filter((o) => selected.has(o.id));

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (orders: OrderListItem[]) => {
    const allSelected = orders.every((o) => selected.has(o.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        orders.forEach((o) => next.delete(o.id));
      } else {
        orders.forEach((o) => next.add(o.id));
      }
      return next;
    });
  };

  const runBatch = async (action: "approve" | "reject") => {
    if (selectedOrders.length === 0) return;
    const role = STAGE_ROLE[selectedOrders[0].currentStage];
    const user = users.find((u) => u.role === role);
    if (!user) {
      showToast({ type: "error", msg: "未找到对应岗位用户" });
      return;
    }
    setBatchLoading(true);
    try {
      const results = await batchProcess({
        items: selectedOrders.map((o) => ({ id: o.id, version: o.version })),
        action,
        actorRole: role,
        actorId: user.id,
        reviewComment: action === "approve" ? "预警催办批量处理" : "预警批量退回",
      });
      const ok = results.filter((r) => r.success).length;
      const fail = results.length - ok;
      if (fail === 0) {
        showToast({ type: "success", msg: `批量处理完成：${ok} 条工单已推进` });
      } else if (ok === 0) {
        const firstFail = results.find((r) => !r.success);
        showToast({
          type: "error",
          msg: `批量处理失败：${fail} 条均未通过校验（${firstFail?.message ?? ""}）`,
        });
      } else {
        showToast({
          type: "info",
          msg: `批量处理完成：成功 ${ok} 条，失败 ${fail} 条`,
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

  if (error) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-crimson mx-auto mb-3" />
        <p className="text-ink-soft font-medium">预警数据加载失败</p>
        <p className="text-ink-muted text-sm font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Toast toast={toast} />

      <div className="flex items-center gap-3">
        <Link to="/" className="btn-secondary !py-1.5">
          <ArrowLeft className="w-4 h-4" /> 返回列表
        </Link>
        <h1 className="font-display text-2xl font-extrabold text-ink">
          到期预警看板
        </h1>
        <span className="text-sm text-ink-muted">
          临期 {nearDue.length} · 逾期 {overdue.length}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WarningColumn
          title="逾期工单"
          subtitle="已过截止时间，需立即处置"
          orders={overdue}
          level="overdue"
          selected={selected}
          onToggle={toggleSelect}
          onSelectAll={() => selectAll(overdue)}
          onNavigate={(id) => navigate(`/orders/${id}`)}
        />
        <WarningColumn
          title="临期工单"
          subtitle="剩余时间 ≤24 小时，优先处置"
          orders={nearDue}
          level="near_due"
          selected={selected}
          onToggle={toggleSelect}
          onSelectAll={() => selectAll(nearDue)}
          onNavigate={(id) => navigate(`/orders/${id}`)}
        />
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 card px-5 py-3 flex items-center gap-4 shadow-lg border-2 border-crimson/40 animate-fade-up">
          <span className="text-sm font-semibold text-ink">
            已选 <span className="font-mono text-crimson text-lg">{selected.size}</span> 条预警工单
          </span>
          <div className="w-px h-8 bg-deep-100" />
          <button onClick={() => runBatch("approve")} disabled={batchLoading} className="btn-success">
            <CheckCircle2 className="w-4 h-4" />
            批量推进
          </button>
          <button onClick={() => runBatch("reject")} disabled={batchLoading} className="btn-danger">
            <XCircle className="w-4 h-4" />
            批量退回
          </button>
          <button onClick={() => setSelected(new Set())} className="btn-secondary !py-1.5">
            取消
          </button>
          {batchLoading && <span className="text-xs text-ink-muted animate-pulse">处理中…</span>}
        </div>
      )}
    </div>
  );
}

function WarningColumn({
  title,
  subtitle,
  orders,
  level,
  selected,
  onToggle,
  onSelectAll,
  onNavigate,
}: {
  title: string;
  subtitle: string;
  orders: OrderListItem[];
  level: "overdue" | "near_due";
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onNavigate: (id: number) => void;
}) {
  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));
  const isOverdue = level === "overdue";
  return (
    <div
      className={`card flex flex-col border-t-4 ${
        isOverdue ? "border-t-crimson" : "border-t-amber-warn"
      }`}
    >
      <div
        className={`px-4 py-3 border-b flex items-center gap-2 ${
          isOverdue ? "bg-crimson-soft/30 border-crimson/20" : "bg-amber-soft/30 border-amber-warn/20"
        }`}
      >
        {isOverdue ? (
          <AlertTriangle className="w-5 h-5 text-crimson" />
        ) : (
          <Clock className="w-5 h-5 text-amber-warn" />
        )}
        <div>
          <h3 className="font-display font-bold text-base text-ink">{title}</h3>
          <p className="text-xs text-ink-muted">{subtitle}</p>
        </div>
        <span className="ml-auto text-2xl font-mono font-bold text-ink">{orders.length}</span>
        {orders.length > 0 && (
          <button
            onClick={onSelectAll}
            className="text-xs text-deep-500 hover:text-deep-700 font-medium ml-2"
          >
            {allSelected ? "取消全选" : "全选"}
          </button>
        )}
      </div>
      <div className="flex-1 p-3 space-y-2 overflow-y-auto scrollbar-thin max-h-[calc(100vh-280px)]">
        {orders.length === 0 ? (
          <div className="text-center py-12 text-ink-muted text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-ok opacity-40" />
            暂无{isOverdue ? "逾期" : "临期"}工单
          </div>
        ) : (
          orders.map((order, i) => (
            <div
              key={order.id}
              className={`group relative border-l-4 ${warningColor(
                order.warning.level,
              )} bg-white border-y border-r border-deep-50 rounded-r p-3 hover:shadow-md transition-all cursor-pointer animate-fade-up ${
                selected.has(order.id) ? "ring-2 ring-deep-300 bg-deep-50/30" : ""
              } ${isOverdue ? "animate-pulse-crimson" : ""}`}
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => onNavigate(order.id)}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(order.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggle(order.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 w-4 h-4 accent-deep-500 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-ink-muted">{order.orderNo}</span>
                    <WarningBadge level={order.warning.level} />
                  </div>
                  <h4 className="text-sm font-semibold text-ink truncate group-hover:text-deep-600">
                    {order.title}
                  </h4>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`font-mono text-lg font-bold ${
                        isOverdue ? "text-crimson" : "text-amber-warn"
                      }`}
                    >
                      {order.warning.remainText}
                    </span>
                    <div className="text-right">
                      <div className="text-xs text-ink-muted">{STAGE_LABELS[order.currentStage]}</div>
                      <div className="text-xs font-mono text-ink-muted">
                        v{order.version} · {ROLE_LABELS[STAGE_ROLE[order.currentStage]]}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-xs text-ink-muted">
                    截止：{new Date(order.warning.deadline).toLocaleString("zh-CN")}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
