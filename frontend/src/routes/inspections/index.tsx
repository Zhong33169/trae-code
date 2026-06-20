import { component$, useStore, $, useOnMount } from "@builder.io/qwik";
import { Link, useNavigate } from "@builder.io/qwik-city";
import type { InspectionOrderListItem, InspectionStatus } from "~/types";
import { api } from "~/services/api";
import { StatusBadge, RiskBadge } from "~/components/StatusBadge";
import { formatDate, resultLabels, statusLabels } from "~/utils/format";

interface PageState {
  orders: InspectionOrderListItem[];
  filteredOrders: InspectionOrderListItem[];
  loading: boolean;
  error: string | null;
  statusFilter: string;
  riskFilter: string;
  searchKeyword: string;
}

export default component$(() => {
  const nav = useNavigate();
  const state = useStore<PageState>({
    orders: [],
    filteredOrders: [],
    loading: true,
    error: null,
    statusFilter: "all",
    riskFilter: "all",
    searchKeyword: "",
  });

  useOnMount$(async () => {
    await loadData();
  });

  const loadData = $(async () => {
    state.loading = true;
    state.error = null;
    try {
      const response = await api.getInspections();
      if (response.success) {
        state.orders = response.data;
        applyFilters();
      }
    } catch (error) {
      state.error = "加载数据失败";
      console.error("Failed to load inspections:", error);
    } finally {
      state.loading = false;
    }
  });

  const applyFilters = $(() => {
    let filtered = [...state.orders];

    if (state.statusFilter !== "all") {
      filtered = filtered.filter(
        (o) => o.status === state.statusFilter
      );
    }
    if (state.riskFilter !== "all") {
      filtered = filtered.filter(
        (o) => o.risk_level === state.riskFilter
      );
    }
    if (state.searchKeyword) {
      const keyword = state.searchKeyword.toLowerCase();
      filtered = filtered.filter(
        (o) =>
        o.order_no.toLowerCase().includes(keyword) ||
        o.equipment_name.toLowerCase().includes(keyword) ||
        o.equipment_code.toLowerCase().includes(keyword)
      );
    }

    state.filteredOrders = filtered;
  });

  const handleStatusFilter = $((e: Event) => {
    state.statusFilter = (e.target as HTMLSelectElement).value;
    applyFilters();
  });

  const handleRiskFilter = $((e: Event) => {
    state.riskFilter = (e.target as HTMLSelectElement).value;
    applyFilters();
  });

  const handleSearch = $((e: Event) => {
    state.searchKeyword = (e.target as HTMLInputElement).value;
    applyFilters();
  });

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">巡检单列表</h1>
        <button class="btn btn-primary" onClick$={loadData}>🔄 刷新</button>
      </div>

      {state.error && <div class="alert alert-error">{state.error}</div>}

      <div class="card mb-6">
        <div class="grid-3">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">状态筛选</label>
            <select
              class="form-select"
              value={state.statusFilter}
              onChange$={handleStatusFilter}
            >
              <option value="all">全部状态</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">风险等级</label>
            <select
              class="form-select"
              value={state.riskFilter}
              onChange$={handleRiskFilter}
            >
              <option value="all">全部等级</option>
              <option value="LOW">低风险</option>
              <option value="MEDIUM">中风险</option>
              <option value="HIGH">高风险</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">搜索</label>
            <input
              type="text"
              class="form-input"
              placeholder="输入单号或器械名称"
              value={state.searchKeyword}
              onInput$={handleSearch}
            />
          </div>
        </div>
      </div>

      {state.loading ? (
        <div class="card text-center py-12">
          <p class="text-gray-500">加载中...</p>
        </div>
      ) : (
        <div class="card">
          <div class="mb-4 text-sm text-gray-600">
            共 {state.filteredOrders.length} 条记录
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>单号</th>
                <th>器械</th>
                <th>位置</th>
                <th>状态</th>
                <th>风险等级</th>
                <th>结果</th>
                <th>当前处理人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.filteredOrders.length === 0 ? (
                <tr>
                <td colSpan={9} class="text-center text-gray-500 py-8">
                  暂无数据
                </td>
              </tr>
              ) : (
                state.filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    class={{
                      "bg-red-50":
                        order.risk_level === "HIGH",
                      "bg-orange-50":
                        order.is_overdue,
                    }}
                  >
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
                      <RiskBadge level={order.risk_level} showIcon={order.risk_level === "HIGH"} />
                    </td>
                    <td>
                      {order.inspection_result ? (
                        <span
                          class={{
                            "text-green-600":
                              order.inspection_result === "NORMAL",
                            "text-red-600":
                              order.inspection_result !== "NORMAL",
                          }}
                        >
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
                        class="btn btn-outline text-sm"
                        onClick$={() => nav(`/inspections/${order.id}`}
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
