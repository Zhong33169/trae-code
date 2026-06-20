// ============================================================
// Inspection Order List Page
// ============================================================

import { component$, useStore, $, useOnMount, useTask$ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import api from "~/services/api";
import { useCurrentUser, useRefreshSignal } from "~/state/app";
import type {
  InspectionOrderListItem,
  InspectionStatus,
  RiskLevel,
  InspectionResult,
  InspectionListFilter,
} from "~/types";
import { StatusBadge, RiskBadge, ResultBadge } from "~/components/Badges";
import {
  statusLabels,
  riskLabels,
  resultLabels,
  formatDate,
  formatShortDate,
  riskRowBg,
} from "~/utils/format";

interface ListState {
  items: InspectionOrderListItem[];
  loading: boolean;
  error: string | null;
  filters: InspectionListFilter;
}

export default component$(() => {
  const nav = useNavigate();
  const userCtx = useCurrentUser();
  const refreshSig = useRefreshSignal();

  const state = useStore<ListState>({
    items: [],
    loading: true,
    error: null,
    filters: {
      status: undefined,
      risk_level: undefined,
      location: "",
      keyword: "",
    },
  });

  const loadList = $(async () => {
    state.loading = true;
    state.error = null;
    try {
      const res = await api.getInspections(state.filters);
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

  const onFilterChange = $((k: keyof InspectionListFilter, v: string) => {
    (state.filters as any)[k] = v || undefined;
  });

  const allStatuses: InspectionStatus[] = [
    "draft",
    "pending_handling",
    "in_progress",
    "pending_review",
    "returned",
    "archived",
  ];
  const allRisks: RiskLevel[] = ["low", "medium", "high"];
  const allResults: InspectionResult[] = [
    "normal",
    "abnormal",
    "missing_evidence",
    "overdue",
    "returned",
    "status_conflict",
  ];

  const allLocations = Array.from(
    new Set(state.items.map((i) => i.equipment_location))
  );

  return (
    <div>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">巡检单列表</h1>
          <p class="text-sm text-gray-500 mt-1">
            共 {state.items.length} 条记录
          </p>
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-primary"
            onClick$={async () => await loadList()}
          >
            🔄 刷新
          </button>
          {userCtx.user?.role === "inspector" && (
            <button
              class="btn btn-success"
              onClick$={async () => {
                if (!userCtx.user) return;
                const today = new Date();
                const due = new Date(today);
                due.setDate(due.getDate() + 3);
                const res = await api.initiateInspection(
                  {
                    equipment_id: 1,
                    inspector_id: userCtx.user.id,
                    handler_id: 2,
                    reviewer_id: 3,
                    risk_level: "medium",
                    inspection_date: today.toISOString().split("T")[0],
                    due_date: due.toISOString().split("T")[0],
                  },
                  userCtx.user.id
                );
                if (res.success && res.data) {
                  refreshSig.bump();
                  nav(`/inspections/${res.data.id}`);
                } else {
                  alert(res.message);
                }
              }}
            >
              ＋ 发起巡检
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div class="card mb-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              状态
            </label>
            <select
              class="form-select"
              value={state.filters.status ?? ""}
              onChange$={(e) =>
                onFilterChange("status", (e.target as HTMLSelectElement).value)
              }
            >
              <option value="">全部状态</option>
              {allStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              风险等级
            </label>
            <select
              class="form-select"
              value={state.filters.risk_level ?? ""}
              onChange$={(e) =>
                onFilterChange(
                  "risk_level",
                  (e.target as HTMLSelectElement).value
                )
              }
            >
              <option value="">全部风险</option>
              {allRisks.map((r) => (
                <option key={r} value={r}>
                  {riskLabels[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              巡检结果
            </label>
            <select
              class="form-select"
              value={state.filters.result ?? ""}
              onChange$={(e) =>
                onFilterChange("result", (e.target as HTMLSelectElement).value)
              }
            >
              <option value="">全部结果</option>
              {allResults.map((r) => (
                <option key={r} value={r}>
                  {resultLabels[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              区域
            </label>
            <select
              class="form-select"
              value={state.filters.location ?? ""}
              onChange$={(e) =>
                onFilterChange(
                  "location",
                  (e.target as HTMLSelectElement).value
                )
              }
            >
              <option value="">全部区域</option>
              {allLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              关键字（单号/器械名）
            </label>
            <input
              type="text"
              class="form-input"
              value={state.filters.keyword ?? ""}
              onInput$={(e) =>
                onFilterChange(
                  "keyword",
                  (e.target as HTMLInputElement).value
                )
              }
              placeholder="搜索..."
            />
          </div>
        </div>
        <div class="mt-3 flex gap-2">
          <button class="btn btn-primary" onClick$={async () => await loadList()}>
            🔎 查询
          </button>
          <button
            class="btn btn-outline"
            onClick$={async () => {
              state.filters = {};
              await loadList();
            }}
          >
            重置
          </button>
        </div>
      </div>

      {/* Table */}
      <div class="card overflow-auto">
        {state.loading ? (
          <div class="py-14 text-center text-gray-500">加载中...</div>
        ) : state.error ? (
          <div class="py-14 text-center text-red-600">{state.error}</div>
        ) : state.items.length === 0 ? (
          <div class="py-14 text-center text-gray-500">暂无数据</div>
        ) : (
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50">
              <tr class="text-left text-xs text-gray-600 uppercase tracking-wider">
                <th class="px-3 py-3 font-semibold">单号</th>
                <th class="px-3 py-3 font-semibold">器械</th>
                <th class="px-3 py-3 font-semibold">区域</th>
                <th class="px-3 py-3 font-semibold">状态</th>
                <th class="px-3 py-3 font-semibold">风险</th>
                <th class="px-3 py-3 font-semibold">结果</th>
                <th class="px-3 py-3 font-semibold">巡检日/截止</th>
                <th class="px-3 py-3 font-semibold">版本</th>
                <th class="px-3 py-3 font-semibold">更新时间</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {state.items.map((row) => {
                const overdue =
                  row.due_date && new Date(row.due_date) < new Date();
                return (
                  <tr
                    key={row.id}
                    onClick$={() => nav(`/inspections/${row.id}`)}
                    class={`cursor-pointer hover:bg-blue-50/40 transition-colors ${riskRowBg[row.risk_level]} ${
                      overdue ? "!bg-red-50/70" : ""
                    }`}
                  >
                    <td class="px-3 py-3">
                      <div class="font-semibold text-gray-800 hover:text-blue-700">
                        {row.order_no}
                      </div>
                    </td>
                    <td class="px-3 py-3">
                      <div class="text-gray-800 font-medium">
                        {row.equipment_name}
                      </div>
                      <div class="text-xs text-gray-500">
                        编号：{row.equipment_code}
                      </div>
                    </td>
                    <td class="px-3 py-3 text-gray-700">
                      {row.equipment_location}
                    </td>
                    <td class="px-3 py-3">
                      <StatusBadge status={row.status} withDot />
                    </td>
                    <td class="px-3 py-3">
                      <RiskBadge level={row.risk_level} showIcon />
                    </td>
                    <td class="px-3 py-3">
                      <ResultBadge result={row.inspection_result} />
                    </td>
                    <td class="px-3 py-3">
                      <div class="text-gray-700">
                        {formatShortDate(row.inspection_date)}
                      </div>
                      <div
                        class={`text-xs ${
                          overdue ? "text-red-600 font-semibold" : "text-gray-500"
                        }`}
                      >
                        截止：{formatShortDate(row.due_date)}
                        {overdue && " ⏰逾期"}
                      </div>
                    </td>
                    <td class="px-3 py-3">
                      <span class="text-xs text-gray-500">v{row.version}</span>
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
