import { component$, useStore, $, useOnMount } from "@builder.io/qwik";
import { Link, useNavigate } from "@builder.io/qwik-city";
import type { StatisticsResponse, QueueItem } from "~/types";
import { api } from "~/services/api";
import { StatisticsCard } from "~/components/StatisticsCard";
import { StatusBadge, RiskBadge } from "~/components/StatusBadge";
import { formatDate, resultLabels } from "~/utils/format";

interface PageState {
  stats: StatisticsResponse | null;
  queue: QueueItem[];
  loading: boolean;
  error: string | null;
}

export default component$(() => {
  const nav = useNavigate();
  const state = useStore<PageState>({
    stats: null,
    queue: [],
    loading: true,
    error: null,
  });

  useOnMount$(async () => {
    await loadData();
  });

  const loadData = $(async () => {
    state.loading = true;
    state.error = null;
    try {
      const [statsRes, queueRes] = await Promise.all([
        api.getStatistics(),
        api.getQueue(2, "handler"),
      ]);

      if (statsRes.success) {
        state.stats = statsRes.data;
      }
      if (queueRes.success) {
        state.queue = queueRes.data;
      }
    } catch (error) {
      state.error = "加载数据失败，请刷新页面重试";
      console.error("Failed to load data:", error);
    } finally {
      state.loading = false;
    }
  });

  const handleRefresh = $(async () => {
    await loadData();
  });

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">工作台</h1>
      <button class="btn btn-primary" onClick$={handleRefresh}>
        🔄 刷新</button>
    </div>

    {state.error && <div class="alert alert-error">{state.error}</div>}

    {state.loading ? (
      <div class="card text-center py-12">
        <p class="text-gray-500">加载中...</p>
      </div>
    ) : (
      <div class="grid grid-cols-3 gap-6">
        <div class="col-span-2">
          {state.stats && <StatisticsCard stats={state.stats} />}
        </div>

        <div class="col-span-1">
          <div class="card">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-800">待办队列</h3>
              <span class="text-sm text-gray-500">
                共 {state.queue.length} 条
              </span>
            </div>

            {state.queue.length === 0 ? (
              <div class="text-center py-8 text-gray-500">暂无待办事项</div>
            ) : (
              <div class="space-y-3">
                {state.queue.map((item) => (
                  <div
                    key={item.id}
                    class="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick$={() => nav(`/inspections/${item.id}`}
                  >
                    <div class="flex justify-between items-start mb-2">
                      <span class="font-medium text-gray-800">{item.order_no}</span>
                      <RiskBadge level={item.risk_level} />
                    </div>
                    <div class="text-sm text-gray-600 mb-2">
                      {item.equipment_name}
                    </div>
                    <div class="flex justify-between items-center">
                      <StatusBadge status={item.status} />
                      <span class="text-xs text-gray-500">
                        {formatDate(item.updated_at)}
                      </span>
                    </div>
                    <div class="mt-2 text-xs text-blue-600 font-medium">
                      {item.action_required}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div class="mt-4 pt-4 border-t border-gray-200">
              <Link
                href="/inspections"
                class="text-blue-600 text-sm hover:underline"
              >
                查看全部 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
