import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { FilePlus } from "lucide-react";
import { fetchApi } from "~/utils/api";
import type { Appeal, Stats } from "~/utils/types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_BAR_COLORS,
  ANOMALY_LABELS,
} from "~/utils/types";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const [stats, appeals] = await Promise.all([
    fetchApi<Stats>("/stats"),
    fetchApi<Appeal[]>(status ? `/appeals?status=${status}` : "/appeals"),
  ]);
  return { stats, appeals, currentStatus: status };
}

const TABS: { key: string; label: string }[] = [
  { key: "", label: "全部" },
  { key: "pending_review", label: "待审核" },
  { key: "pending_recheck", label: "待复核" },
  { key: "returned", label: "退回补正" },
  { key: "rejected", label: "已驳回" },
  { key: "archived", label: "已归档" },
];

function getCount(stats: Stats, key: string): number {
  if (!key) return stats.total;
  return stats[key as keyof Stats] as number;
}

export default function Index() {
  const { stats, appeals, currentStatus } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif font-bold text-gray-900">申诉队列</h2>
        <button
          onClick={() => navigate("/appeals/new")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
          style={{ backgroundColor: "#1e3a5f" }}
        >
          <FilePlus size={16} />
          发起申诉
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSearchParams(tab.key ? { status: tab.key } : {})}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              currentStatus === tab.key
                ? "text-blue-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                currentStatus === tab.key
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {getCount(stats, tab.key)}
            </span>
            {currentStatus === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {appeals.length === 0 && (
          <div className="text-center py-12 text-gray-400">暂无申诉记录</div>
        )}
        {appeals.map((appeal) => (
          <button
            key={appeal.id}
            onClick={() => navigate(`/appeals/${appeal.id}`)}
            className="w-full text-left bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="flex">
              <div className={`w-1.5 shrink-0 ${STATUS_BAR_COLORS[appeal.status]}`} />
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-500">
                      {appeal.appeal_no}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[appeal.status]}`}
                    >
                      {STATUS_LABELS[appeal.status]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      {ANOMALY_LABELS[appeal.anomaly_type]}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(appeal.created_at).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">
                    {appeal.visitor_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    当前处理: {appeal.current_handler_name}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
