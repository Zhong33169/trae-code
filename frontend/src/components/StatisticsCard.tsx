import { component$ } from "@builder.io/qwik";
import type { StatisticsResponse } from "~/types";

interface StatisticsCardProps {
  stats: StatisticsResponse;
}

export const StatisticsCard = component$<StatisticsCardProps>(({ stats }) => {
  const statItems = [
    { label: "总单数", value: stats.total, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "待办理", value: stats.pending_handling, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "办理中", value: stats.in_progress, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "待复核", value: stats.pending_review, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "已退回", value: stats.returned, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "已归档", value: stats.archived, color: "text-green-600", bg: "bg-green-50" },
    { label: "高风险", value: stats.high_risk, color: "text-red-600", bg: "bg-red-50" },
    { label: "逾期", value: stats.overdue, color: "text-red-600", bg: "bg-red-50" },
    { label: "缺证据", value: stats.missing_evidence, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold mb-4 text-gray-800">统计概览</h3>
      <div class="grid grid-cols-3 gap-4">
        {statItems.map((item) => (
          <div key={item.label} class={`${item.bg} rounded-lg p-4 text-center`}>
            <div class={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div class="text-sm text-gray-600">{item.label}</div>
          </div>
        ))}
      </div>
      {Object.keys(stats.by_location).length > 0 && (
        <div class="mt-6 pt-4 border-t border-gray-200">
          <h4 class="text-sm font-medium text-gray-700 mb-3">按区域统计</h4>
          <div class="grid grid-cols-2 gap-2">
            {Object.entries(stats.by_location).map(([location, count]) => (
              <div key={location} class="flex justify-between text-sm p-2 bg-gray-50 rounded">
                <span class="text-gray-600">{location}</span>
                <span class="font-medium text-gray-800">{count} 单</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
