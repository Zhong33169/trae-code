// ============================================================
// Home / Workbench Dashboard
// ============================================================

import { component$, useStore, $, useTask$ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { useCurrentUser, useRefreshSignal } from "~/state/app";
import api from "~/services/api";
import type { StatisticsResponse, QueueItem } from "~/types";
import { StatusBadge, RiskBadge } from "~/components/Badges";
import { formatDate } from "~/utils/format";

interface PageState {
  stats: StatisticsResponse | null;
  queue: QueueItem[];
  loading: boolean;
  error: string | null;
}

export default component$(() => {
  const nav = useNavigate();
  const userCtx = useCurrentUser();
  const refreshSig = useRefreshSignal();

  const state = useStore<PageState>({
    stats: null,
    queue: [],
    loading: true,
    error: null,
  });

  const loadData = $(async () => {
    if (!userCtx.user) return;
    state.loading = true;
    state.error = null;
    try {
      const [stats, queue] = await Promise.all([
        api.getStatistics(),
        api.getQueue(userCtx.user.id, userCtx.user.role),
      ]);
      if (stats.success) state.stats = stats.data;
      else state.error = stats.message;
      if (queue.success) state.queue = queue.data || [];
    } catch (e) {
      state.error = "加载数据失败：" + (e as Error).message;
    } finally {
      state.loading = false;
    }
  });

  useTask$(async ({ track }) => {
    track(() => userCtx.user?.id);
    track(() => refreshSig.tick);
    if (userCtx.user) await loadData();
  });

  const statCards = [
    {
      label: "巡检单总数",
      value: state.stats?.total ?? 0,
      color: "text-gray-700",
      bar: "bg-gray-400",
    },
    {
      label: "待办理",
      value: state.stats?.pending_handling ?? 0,
      color: "text-yellow-700",
      bar: "bg-yellow-500",
    },
    {
      label: "办理中",
      value: state.stats?.in_progress ?? 0,
      color: "text-blue-700",
      bar: "bg-blue-500",
    },
    {
      label: "待复核",
      value: state.stats?.pending_review ?? 0,
      color: "text-purple-700",
      bar: "bg-purple-500",
    },
    {
      label: "已退回",
      value: state.stats?.returned ?? 0,
      color: "text-orange-700",
      bar: "bg-orange-500",
    },
    {
      label: "已归档",
      value: state.stats?.archived ?? 0,
      color: "text-green-700",
      bar: "bg-green-500",
    },
    {
      label: "🚨 高风险",
      value: state.stats?.high_risk ?? 0,
      color: "text-red-700",
      bar: "bg-red-500",
    },
    {
      label: "⏰ 逾期未办",
      value: state.stats?.overdue ?? 0,
      color: "text-red-700",
      bar: "bg-red-400",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">工作台</h1>
          <p class="text-sm text-gray-500 mt-1">
            {userCtx.user
              ? `当前用户：${userCtx.user.name}（${
                  { inspector: "巡检员", handler: "办理员", reviewer: "复核员" }[
                    userCtx.user.role
                  ]
                }）`
              : "加载用户中..."}
          </p>
        </div>
        <button
          class="btn btn-primary"
          onClick$={async () => await loadData()}
        >
          🔄 刷新
        </button>
      </div>

      {state.error && (
        <div class="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          {state.error}
        </div>
      )}

      {state.loading && !state.stats ? (
        <div class="card text-center py-14 text-gray-500">加载数据中...</div>
      ) : (
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Statistics */}
          <section class="lg:col-span-2 space-y-5">
            <div class="card">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-800">统计概览</h2>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statCards.map((s) => (
                  <div
                    key={s.label}
                    class="rounded-lg border border-gray-200 bg-gray-50/40 p-4 hover:shadow-sm transition-shadow"
                  >
                    <div class="flex items-center gap-2 mb-2">
                      <span class={`w-1.5 h-5 rounded-full ${s.bar}`}></span>
                      <span class="text-xs text-gray-600 font-medium">
                        {s.label}
                      </span>
                    </div>
                    <div class={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Risk distribution */}
              <div class="mt-5 pt-5 border-t border-gray-200">
                <h3 class="text-sm font-semibold text-gray-700 mb-3">
                  按风险等级分布
                </h3>
                <div class="grid grid-cols-3 gap-3">
                  <div class="p-3 rounded bg-green-50 border border-green-100">
                    <div class="text-xs text-green-700 font-medium mb-1">
                      低风险
                    </div>
                    <div class="text-xl font-bold text-green-800">
                      {state.stats?.low_risk ?? 0}
                    </div>
                  </div>
                  <div class="p-3 rounded bg-yellow-50 border border-yellow-100">
                    <div class="text-xs text-yellow-700 font-medium mb-1">
                      中风险
                    </div>
                    <div class="text-xl font-bold text-yellow-800">
                      {state.stats?.medium_risk ?? 0}
                    </div>
                  </div>
                  <div class="p-3 rounded bg-red-50 border border-red-100">
                    <div class="text-xs text-red-700 font-medium mb-1">
                      🚨 高风险
                    </div>
                    <div class="text-xl font-bold text-red-800">
                      {state.stats?.high_risk ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* By location */}
              {state.stats && Object.keys(state.stats.by_location).length > 0 && (
                <div class="mt-5 pt-5 border-t border-gray-200">
                  <h3 class="text-sm font-semibold text-gray-700 mb-3">
                    按区域分布
                  </h3>
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(state.stats.by_location).map(
                      ([loc, count]) => (
                        <div
                          key={loc}
                          class="flex justify-between items-center p-2.5 rounded bg-gray-50 border border-gray-100"
                        >
                          <span class="text-sm text-gray-700">{loc}</span>
                          <span class="text-sm font-semibold text-gray-800">
                            {count} 单
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Results distribution */}
            <div class="card">
              <h2 class="text-lg font-semibold text-gray-800 mb-4">
                巡检结果分布
              </h2>
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  {
                    label: "✅ 正常",
                    val: state.stats?.normal ?? 0,
                    cls: "bg-green-50 text-green-700",
                  },
                  {
                    label: "❌ 异常",
                    val: state.stats?.abnormal ?? 0,
                    cls: "bg-red-50 text-red-700",
                  },
                  {
                    label: "📭 缺证据",
                    val: state.stats?.missing_evidence ?? 0,
                    cls: "bg-orange-50 text-orange-700",
                  },
                  {
                    label: "⏰ 逾期",
                    val: state.stats?.overdue ?? 0,
                    cls: "bg-red-50 text-red-700",
                  },
                  {
                    label: "🔄 状态冲突",
                    val: state.stats?.status_conflict ?? 0,
                    cls: "bg-pink-50 text-pink-700",
                  },
                ].map((r) => (
                  <div
                    key={r.label}
                    class={`p-3 rounded-lg ${r.cls} text-center`}
                  >
                    <div class="text-xl font-bold">{r.val}</div>
                    <div class="text-xs mt-1">{r.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Queue */}
          <section>
            <div class="card h-full">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-800">
                  {userCtx.user?.role === "inspector"
                    ? "我的发起"
                    : userCtx.user?.role === "handler"
                    ? "我的待办"
                    : userCtx.user?.role === "reviewer"
                    ? "复核队列"
                    : "任务队列"}
                </h2>
                <span class="text-xs text-gray-500">
                  共 {state.queue.length} 条
                </span>
              </div>

              {state.queue.length === 0 ? (
                <div class="py-10 text-center text-sm text-gray-500">
                  🎉 暂无待办
                </div>
              ) : (
                <ul class="space-y-3">
                  {state.queue.map((item) => (
                    <li
                      key={item.id}
                      onClick$={() => nav(`/inspections/${item.id}`)}
                      class={`group cursor-pointer p-3 rounded-lg border border-gray-200 transition-all
                        hover:shadow-md hover:border-blue-300 hover:-translate-y-px
                        ${
                          item.risk_level === "high"
                            ? "border-l-4 border-l-red-500 bg-red-50/30"
                            : item.risk_level === "medium"
                            ? "border-l-4 border-l-yellow-400"
                            : ""
                        }`}
                    >
                      <div class="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div class="font-semibold text-gray-800 group-hover:text-blue-700">
                            {item.order_no}
                          </div>
                          <div class="text-xs text-gray-500 mt-0.5">
                            {item.equipment_location}
                          </div>
                        </div>
                        <RiskBadge level={item.risk_level} showIcon />
                      </div>
                      <div class="text-sm text-gray-700 mb-2">
                        {item.equipment_name}
                      </div>
                      <div class="flex items-center justify-between">
                        <StatusBadge status={item.status} withDot />
                        <span class="text-xs text-gray-500">
                          {formatDate(item.updated_at)}
                        </span>
                      </div>
                      {item.action_required && (
                        <div class="mt-2 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">
                          👉 {item.action_required}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div class="mt-4 pt-4 border-t border-gray-200">
                <a
                  href="/inspections"
                  class="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  查看全部巡检单 →
                </a>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
});
