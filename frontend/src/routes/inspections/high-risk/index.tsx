// ============================================================
// High Risk Inspection Orders List
// ============================================================

import { component$, useStore, $, useOnMount, useTask$ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import api from "~/services/api";
import { useCurrentUser, useRefreshSignal } from "~/state/app";
import type { InspectionOrderListItem } from "~/types";
import { StatusBadge, RiskBadge, ResultBadge } from "~/components/Badges";
import { formatDate, formatShortDate } from "~/utils/format";

interface PageState {
  items: InspectionOrderListItem[];
  loading: boolean;
  error: string | null;
}

export default component$(() => {
  const nav = useNavigate();
  const userCtx = useCurrentUser();
  const refreshSig = useRefreshSignal();

  const state = useStore<PageState>({
    items: [],
    loading: true,
    error: null,
  });

  const loadList = $(async () => {
    state.loading = true;
    state.error = null;
    try {
      const res = await api.getHighRiskInspections();
      if (res.success) state.items = res.data || [];
      else state.error = res.message;
    } catch (e) {
      state.error = "加载失败：" + (e as Error).message;
    } finally {
      state.loading = false;
    }
  });

  useOnMount$(() => loadList());
  useTask$(({ track }) => {
    track(() => refreshSig.tick);
  });

  // Summary counts by status
  const statusBuckets = state.items.reduce<Record<string, number>>((acc, it) => {
    acc[it.status] = (acc[it.status] || 0) + 1;
    return acc;
  }, {});

  const avgRiskChanges =
    state.items.length > 0
      ? (
          state.items.reduce(
            (s, i) => s + (i.risk_change_count || 0),
            0
          ) / state.items.length
        ).toFixed(1)
      : "0";

  const totalUnresolvedFaults = state.items.reduce(
    (s, i) => s + (i.fault_report_count || 0) - (i.recovery_confirm_count || 0),
    0
  );

  return (
    <div>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 class="text-2xl font-bold text-red-700 flex items-center gap-2">
            🚨 高风险巡检单
          </h1>
          <p class="text-sm text-gray-500 mt-1">
            重点关注 · 共 {state.items.length} 条高风险记录
          </p>
        </div>
        <button
          class="btn btn-primary"
          onClick$={async () => await loadList()}
        >
          🔄 刷新
        </button>
      </div>

      {/* Summary cards */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div class="card p-4 bg-red-50 border-red-200">
          <div class="text-xs text-red-700 font-medium mb-1">高风险总数</div>
          <div class="text-2xl font-bold text-red-800">{state.items.length}</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-gray-600 font-medium mb-1">待办理</div>
          <div class="text-2xl font-bold text-yellow-700">
            {statusBuckets["pending_handling"] || 0}
          </div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-gray-600 font-medium mb-1">待复核</div>
          <div class="text-2xl font-bold text-purple-700">
            {statusBuckets["pending_review"] || 0}
          </div>
        </div>
        <div class="card p-4 bg-orange-50 border-orange-200">
          <div class="text-xs text-orange-700 font-medium mb-1">未解决故障</div>
          <div class="text-2xl font-bold text-orange-800">
            {totalUnresolvedFaults}
          </div>
        </div>
      </div>

      {/* Info */}
      {avgRiskChanges !== "0" && (
        <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          ⚠️ 高风险单平均每条经历 {avgRiskChanges} 次风险等级变更（升级/降级）
        </div>
      )}

      {/* Table */}
      <div class="card overflow-auto">
        {state.loading ? (
          <div class="py-14 text-center text-gray-500">加载中...</div>
        ) : state.error ? (
          <div class="py-14 text-center text-red-600">{state.error}</div>
        ) : state.items.length === 0 ? (
          <div class="py-14 text-center text-gray-500">
            ✅ 暂无高风险巡检单
          </div>
        ) : (
          <table class="min-w-full text-sm">
            <thead class="bg-red-50">
              <tr class="text-left text-xs text-red-700 uppercase tracking-wider">
                <th class="px-3 py-3 font-semibold">单号</th>
                <th class="px-3 py-3 font-semibold">器械</th>
                <th class="px-3 py-3 font-semibold">区域</th>
                <th class="px-3 py-3 font-semibold">状态</th>
                <th class="px-3 py-3 font-semibold">风险变更</th>
                <th class="px-3 py-3 font-semibold">故障/恢复</th>
                <th class="px-3 py-3 font-semibold">上一处理人意见</th>
                <th class="px-3 py-3 font-semibold">截止</th>
                <th class="px-3 py-3 font-semibold">更新时间</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-red-100">
              {state.items.map((row) => {
                const overdue =
                  row.due_date && new Date(row.due_date) < new Date();
                return (
                  <tr
                    key={row.id}
                    onClick$={() => nav(`/inspections/${row.id}`)}
                    class={`cursor-pointer hover:bg-red-50/40 transition-colors bg-red-50/20 ${
                      overdue ? "!bg-red-100/60" : ""
                    }`}
                  >
                    <td class="px-3 py-3">
                      <div class="font-bold text-gray-800 hover:text-red-700">
                        {row.order_no}
                      </div>
                      <RiskBadge level={row.risk_level} showIcon />
                    </td>
                    <td class="px-3 py-3">
                      <div class="text-gray-800 font-medium">
                        {row.equipment_name}
                      </div>
                      <div class="text-xs text-gray-500">
                        {row.equipment_code}
                      </div>
                    </td>
                    <td class="px-3 py-3 text-gray-700">
                      {row.equipment_location}
                    </td>
                    <td class="px-3 py-3">
                      <StatusBadge status={row.status} withDot />
                    </td>
                    <td class="px-3 py-3">
                      <div class="text-sm font-semibold text-orange-700">
                        {row.risk_change_count || 0} 次
                      </div>
                      <div class="text-xs text-gray-500">
                        升级/降级
                      </div>
                    </td>
                    <td class="px-3 py-3">
                      <div class="text-sm">
                        <span class="text-red-600 font-semibold">
                          {row.fault_report_count || 0} 故障
                        </span>
                      </div>
                      <div class="text-xs text-green-600 font-medium">
                        {row.recovery_confirm_count || 0} 恢复
                      </div>
                    </td>
                    <td class="px-3 py-3 max-w-[220px]">
                      {row.last_handler_opinion ? (
                        <div class="text-xs text-gray-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                          <div class="font-semibold text-blue-700 mb-1">
                            {row.last_handler_result
                              ? {
                                  normal: "正常",
                                  abnormal: "异常",
                                  missing_evidence: "缺证据",
                                  overdue: "逾期",
                                  returned: "退回补正",
                                  status_conflict: "状态冲突",
                                }[row.last_handler_result]
                              : ""}
                          </div>
                          <div class="line-clamp-2">
                            {row.last_handler_opinion}
                          </div>
                        </div>
                      ) : (
                        <span class="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td class="px-3 py-3">
                      <div
                        class={`text-xs ${
                          overdue ? "text-red-700 font-bold" : "text-gray-600"
                        }`}
                      >
                        {formatShortDate(row.due_date)}
                        {overdue && " ⏰"}
                      </div>
                    </td>
                    <td class="px-3 py-3 text-xs text-gray-500">
                      {formatDate(row.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});
