import { createSignal, onMount, Show, createEffect } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { useAuth } from "~/lib/auth";
import { apiFetch, formatDateTime } from "~/lib/api";

interface LogItem {
  id: string;
  form_id: string | null;
  form_no: string | null;
  operator_id: string;
  operator_name: string;
  action: string;
  action_display: string;
  detail: string | null;
  created_at: string;
}

interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export default function Logs() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [logs, setLogs] = createSignal<LogItem[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(parseInt(params.page || "1"));
  const [pageSize] = createSignal(20);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    if (!isLoading() && !user()) {
      navigate("/login");
      return;
    }
    if (user()) {
      loadLogs();
    }
  });

  createEffect(() => {
    if (user()) {
      loadLogs();
    }
  });

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data: ListResponse<LogItem> = await apiFetch(
        `/api/logs?page=${page()}&page_size=${pageSize()}`
      );
      setLogs(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setParams({ ...params, page: newPage.toString() });
  };

  const totalPages = Math.ceil(total() / pageSize());

  return (
    <div>
      <div class="mb-4">
        <h1 class="text-xl font-semibold">操作日志</h1>
      </div>

      <div class="card">
        <div class="card-body p-0">
          <table class="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>操作类型</th>
                <th>关联单据</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              <Show when={!loading() && logs().length > 0} fallback={
                <tr><td colspan="5" class="text-center text-gray-500 py-8">
                  {loading() ? "加载中..." : "暂无数据"}
                </td></tr>
              }>
                {logs().map((log) => (
                  <tr>
                    <td class="text-sm text-gray-500 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td>{log.operator_name}</td>
                    <td>
                      <span class="badge badge-blue">{log.action_display}</span>
                    </td>
                    <td>
                      {log.form_no ? (
                        <a href={`/forms/${log.form_id}`} class="text-blue-600 text-sm">
                          {log.form_no}
                        </a>
                      ) : (
                        <span class="text-gray-400">-</span>
                      )}
                    </td>
                    <td class="text-sm text-gray-600 max-w-xs truncate">
                      {log.detail || "-"}
                    </td>
                  </tr>
                ))}
              </Show>
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <div class="pagination-info">
            共 {total()} 条，第 {page()} / {totalPages || 1} 页
          </div>
          <div class="pagination-buttons">
            <button
              class="btn btn-secondary btn-sm"
              onClick={() => handlePageChange(page() - 1)}
              disabled={page() <= 1}
            >
              上一页
            </button>
            <button
              class="btn btn-secondary btn-sm"
              onClick={() => handlePageChange(page() + 1)}
              disabled={page() >= totalPages}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
