import { createSignal, onMount, Show, createEffect } from "solid-js";
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { useAuth } from "~/lib/auth";
import { apiFetch, statusLabel, statusClass, formatDateTime } from "~/lib/api";

interface FormItem {
  id: string;
  form_no: string;
  corporate_name: string;
  year: number;
  status: string;
  registrant_name: string;
  auditor_name: string | null;
  reviewer_name: string | null;
  created_at: string;
  submitted_at: string | null;
}

interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export default function FormsList() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [forms, setForms] = createSignal<FormItem[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(parseInt(params.page || "1"));
  const [pageSize] = createSignal(10);
  const [statusFilter, setStatusFilter] = createSignal(params.status || "");
  const [loading, setLoading] = createSignal(false);

  onMount(() => {
    if (!isLoading() && !user()) {
      navigate("/login");
      return;
    }
    if (user()) {
      loadForms();
    }
  });

  createEffect(() => {
    if (user()) {
      loadForms();
    }
  });

  const loadForms = async () => {
    setLoading(true);
    try {
      let url = `/api/forms?page=${page()}&page_size=${pageSize()}`;
      if (statusFilter()) {
        url += `&status=${statusFilter()}`;
      }
      const data: ListResponse<FormItem> = await apiFetch(url);
      setForms(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load forms:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
    setParams({ status, page: "1" });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setParams({ ...params, page: newPage.toString() });
  };

  const totalPages = Math.ceil(total() / pageSize());

  const statusOptions = [
    { value: "", label: "全部" },
    { value: "draft", label: "草稿" },
    { value: "pending_audit", label: "待审核" },
    { value: "audit_rejected", label: "审核退回" },
    { value: "pending_review", label: "待复核" },
    { value: "review_rejected", label: "复核退回" },
    { value: "archived", label: "已归档" },
  ];

  const canCreate = user()?.role === "registrar";

  return (
    <div>
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-xl font-semibold">资料年检单</h1>
        <div class="flex items-center gap-3">
          <select
            class="form-select"
            style="width: auto;"
            value={statusFilter()}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {statusOptions.map((opt) => (
              <option value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Show when={canCreate}>
            <A href="/forms/new" class="btn btn-primary">新建年检单</A>
          </Show>
        </div>
      </div>

      <div class="card">
        <div class="card-body p-0">
          <table class="table">
            <thead>
              <tr>
                <th>单号</th>
                <th>企业名称</th>
                <th>年检年度</th>
                <th>状态</th>
                <th>登记人</th>
                <th>审核人</th>
                <th>复核人</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <Show when={!loading() && forms().length > 0} fallback={
                <tr><td colspan="9" class="text-center text-gray-500 py-8">
                  {loading() ? "加载中..." : "暂无数据"}
                </td></tr>
              }>
                {forms().map((form) => (
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
                    <td>{form.registrant_name}</td>
                    <td>{form.auditor_name || "-"}</td>
                    <td>{form.reviewer_name || "-"}</td>
                    <td class="text-sm text-gray-500">{formatDateTime(form.created_at)}</td>
                    <td>
                      <A href={`/forms/${form.id}`} class="text-sm text-blue-600">查看</A>
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
