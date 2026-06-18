import { createSignal, onMount, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { useAuth } from "~/lib/auth";
import { apiFetch, statusLabel, statusClass, formatDateTime } from "~/lib/api";

interface FormItem {
  id: string;
  form_no: string;
  corporate_name: string;
  year: number;
  status: string;
  registrant_name: string;
  created_at: string;
}

interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export default function Index() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = createSignal<any>(null);
  const [recentForms, setRecentForms] = createSignal<FormItem[]>([]);

  onMount(() => {
    if (!isLoading() && user()) {
      loadStats();
      loadRecentForms();
    }
  });

  const loadStats = async () => {
    try {
      const data = await apiFetch("/api/stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const loadRecentForms = async () => {
    try {
      const data: ListResponse<FormItem> = await apiFetch("/api/forms?page_size=5");
      setRecentForms(data.items);
    } catch (err) {
      console.error("Failed to load forms:", err);
    }
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      registrar: "资料年检登记员",
      auditor: "资料年检审核主管",
      reviewer: "银行网点复核负责人",
    };
    return map[role] || role;
  };

  return (
    <div>
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-gray-900">欢迎，{user()?.name}</h1>
        <p class="text-sm text-gray-500 mt-1">当前岗位：{roleLabel(user()?.role || "")}</p>
      </div>

      <Show when={stats()}>
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
            <div class="stat-title">已归档</div>
            <div class="stat-value green">{stats()?.archived || 0}</div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-header flex justify-between items-center">
              <span>最近年检单</span>
              <A href="/forms" class="text-sm text-blue-600">查看全部</A>
            </div>
            <div class="card-body p-0">
              <table class="table">
                <thead>
                  <tr>
                    <th>单号</th>
                    <th>企业名称</th>
                    <th>年份</th>
                    <th>状态</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  <Show when={recentForms().length > 0} fallback={
                    <tr><td colspan="5" class="text-center text-gray-500 py-4">暂无数据</td></tr>
                  }>
                    {recentForms().map((form) => (
                      <tr>
                        <td>
                          <A href={`/forms/${form.id}`}>{form.form_no}</A>
                        </td>
                        <td>{form.corporate_name}</td>
                        <td>{form.year}年</td>
                        <td>
                          <span class={`badge ${statusClass(form.status)}`}>
                            {statusLabel(form.status)}
                          </span>
                        </td>
                        <td class="text-sm text-gray-500">{formatDateTime(form.created_at)}</td>
                      </tr>
                    ))}
                  </Show>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header">快捷操作</div>
            <div class="card-body">
              <div class="grid grid-2 gap-4">
                <A href="/forms/new" class="btn btn-primary text-center justify-center" style="display: flex;">
                  新建年检单
                </A>
                <A href="/forms?status=pending_audit" class="btn btn-secondary text-center justify-center" style="display: flex;">
                  待办事项
                </A>
                <A href="/reminders" class="btn btn-secondary text-center justify-center" style="display: flex;">
                  年检提醒
                </A>
                <A href="/corporates" class="btn btn-secondary text-center justify-center" style="display: flex;">
                  对公资料
                </A>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
