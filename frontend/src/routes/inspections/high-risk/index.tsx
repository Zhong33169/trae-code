import { component$, useStore, $, useOnMount } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import type { InspectionOrderListItem } from "~/types";
import { api } from "~/services/api";
import { StatusBadge, RiskBadge } from "~/components/StatusBadge";
import { formatDate, resultLabels } from "~/utils/format";

interface PageState {
  orders: InspectionOrderListItem[];
  loading: boolean;
  error: string | null;
}

export default component$(() => {
  const nav = useNavigate();
  const state = useStore<PageState>({
    orders: [],
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
      const response = await api.getHighRiskInspections();
      if (response.success) {
        state.orders = response.data;
      }
    } catch (error) {
      state.error = "加载数据失败";
      console.error("Failed to load high-risk inspections:", error);
    } finally {
      state.loading = false;
    }
  });

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">
          ⚠️ 高风险巡检单
        </h1>
        <button class="btn btn-primary" onClick$={loadData}>
          🔄 刷新</button>
      </div>

      <div class="alert alert-error mb-6">
        <p class="font-medium">以下巡检单为高风险，请优先处理！</p>
        <p class="text-sm mt-1">
          共 {state.orders.length} 条高风险记录需要立即关注
        </p>
      </div>

      {state.error && <div class="alert alert-error">{state.error}</div>}

      {state.loading ? (
        <div class="card text-center py-12">
          <p class="text-gray-500">加载中...</p>
        </div>
      ) : (
        <div class="card">
          <div class="mb-4 text-sm text-gray-600">
            共 {state.orders.length} 条高风险记录
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>单号</th>
                <th>器械</th>
                <th>位置</th>
                <th>状态</th>
                <th>结果</th>
                <th>当前处理人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.orders.length === 0 ? (
                <tr>
                  <td colSpan={8} class="text-center text-gray-500 py-8">
                    暂无高风险记录
                  </td>
                </tr>
              ) : (
                  state.orders.map((order) => (
                    <tr key={order.id} class="bg-red-50">
                      <td class="font-medium">{order.order_no}</td>
                      <td>
                        <div>{order.equipment_name}</div>
                        <div class="text-xs text-gray-500">
                          {order.equipment_code}
                        </div>
                      </td>
                      <td>{order.equipment_location}</td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td>
                        {order.inspection_result ? (
                          <span class="text-red-600">
                            {resultLabels[order.inspection_result]}
                          </span>
                        ) : (
                          <span class="text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        {order.current_handler_name || (
                          <span class="text-gray-400">待分配</span>
                        )}
                      </td>
                      <td>{formatDate(order.created_at)}</td>
                      <td>
                        <button
                          class="btn btn-danger text-sm"
                          onClick$={() => nav(`/inspections/${order.id}`}
                        >
                          立即处理
                        </button>
                      </td>
                    </tr>
                  ))
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
