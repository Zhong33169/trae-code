import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "~/lib/auth";
import { apiFetch } from "~/lib/api";

interface Stats {
  total: number;
  draft: number;
  pending_audit: number;
  audit_rejected: number;
  pending_review: number;
  review_rejected: number;
  archived: number;
  by_role: {
    registrar_count: number;
    auditor_count: number;
    reviewer_count: number;
  };
  by_month: Array<{
    month: string;
    count: number;
  }>;
}

export default function Stats() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    if (!isLoading() && !user()) {
      navigate("/login");
      return;
    }
    if (user()) {
      loadStats();
    }
  });

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div class="mb-4">
        <h1 class="text-xl font-semibold">数据统计</h1>
      </div>

      <Show when={stats() && !loading()}>
        <div class="grid grid-4 mb-6">
          <div class="stat-card">
            <div class="stat-title">全部年检单</div>
            <div class="stat-value gray">{stats()?.total || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">草稿</div>
            <div class="stat-value gray">{stats()?.draft || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">待审核</div>
            <div class="stat-value yellow">{stats()?.pending_audit || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">审核退回</div>
            <div class="stat-value red">{stats()?.audit_rejected || 0}</div>
          </div>
        </div>

        <div class="grid grid-4 mb-6">
          <div class="stat-card">
            <div class="stat-title">待复核</div>
            <div class="stat-value blue">{stats()?.pending_review || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">复核退回</div>
            <div class="stat-value red">{stats()?.review_rejected || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">已归档</div>
            <div class="stat-value green">{stats()?.archived || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">归档率</div>
            <div class="stat-value purple">
              {stats()?.total ? Math.round((stats()!.archived / stats()!.total) * 100) : 0}%
            </div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-header">岗位人员统计</div>
            <div class="card-body">
              <div class="grid grid-3 gap-4 text-center">
                <div class="p-4 bg-gray-50 rounded-lg">
                  <div class="text-2xl font-bold text-blue-600">
                    {stats()?.by_role.registrar_count || 0}
                  </div>
                  <div class="text-sm text-gray-500 mt-1">资料年检登记员</div>
                </div>
                <div class="p-4 bg-gray-50 rounded-lg">
                  <div class="text-2xl font-bold text-purple-600">
                    {stats()?.by_role.auditor_count || 0}
                  </div>
                  <div class="text-sm text-gray-500 mt-1">资料年检审核主管</div>
                </div>
                <div class="p-4 bg-gray-50 rounded-lg">
                  <div class="text-2xl font-bold text-green-600">
                    {stats()?.by_role.reviewer_count || 0}
                  </div>
                  <div class="text-sm text-gray-500 mt-1">银行网点复核负责人</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">近12个月年检单趋势</div>
            <div class="card-body">
              <div class="space-y-2">
                {(stats()?.by_month || []).map((item) => (
                  <div class="flex items-center gap-3">
                    <div class="text-sm text-gray-500 w-20">{item.month}</div>
                    <div class="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        class="bg-blue-500 h-full rounded-full transition-all"
                        style={`width: ${stats()?.total ? (item.count / stats()!.total) * 100 : 0}%; min-width: 2px;`}
                      ></div>
                    </div>
                    <div class="text-sm font-medium w-12 text-right">{item.count}</div>
                  </div>
                ))}
                <Show when={(stats()?.by_month || []).length === 0}>
                  <div class="text-center text-gray-500 py-4">暂无数据</div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>

      <Show when={loading()}>
        <div class="text-center py-8 text-gray-500">加载中...</div>
      </Show>
    </div>
  );
}
