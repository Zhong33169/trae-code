import { createSignal, createEffect, onMount } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import Layout from "~/components/Layout";
import { api } from "~/lib/api";
import { authStore, statusNames, statusTagTypes, cropTypeNames } from "~/store/auth";
import { formatDate } from "~/utils/date";
import { showToast } from "~/store/toast";

export default function TaskList() {
  const navigate = useNavigate();
  const [tasks, setTasks] = createSignal<any[]>([]);
  const [total, setTotal] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [pageSize] = createSignal(10);
  const [status, setStatus] = createSignal("");
  const [keyword, setKeyword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [hasTimeoutFilter, setHasTimeoutFilter] = createSignal<boolean | undefined>(undefined);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: page(),
        pageSize: pageSize(),
      };
      if (status()) params.status = status();
      if (keyword()) params.keyword = keyword();
      if (hasTimeoutFilter() !== undefined) params.hasTimeout = hasTimeoutFilter();

      const result = await api.getTaskList(params);
      setTasks(result.data.list);
      setTotal(result.data.total);
    } catch (err: any) {
      showToast(err.message || "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadTasks();
  });

  createEffect(() => {
    loadTasks();
  });

  const handleSearch = () => {
    setPage(1);
    loadTasks();
  };

  const handleReset = () => {
    setStatus("");
    setKeyword("");
    setHasTimeoutFilter(undefined);
    setPage(1);
  };

  const totalPages = Math.ceil(total() / pageSize());

  const canCreate = authStore.hasRole("registrar");

  const goToDetail = (id: number) => {
    navigate(`/tasks/${id}`);
  };

  return (
    <Layout>
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">种植任务列表</h2>
          {canCreate && (
            <button class="btn btn-primary" onClick={() => navigate("/tasks/create")}>
              + 新建任务
            </button>
          )}
        </div>

        <div class="filter-bar">
          <div class="form-item">
            <label class="form-label">状态筛选</label>
            <select class="form-select" value={status()} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部状态</option>
              <option value="pending_registration">待登记</option>
              <option value="registered">待审核</option>
              <option value="audit_rejected">审核驳回</option>
              <option value="audit_passed">待复核</option>
              <option value="review_rejected">复核驳回</option>
              <option value="archived">已归档</option>
            </select>
          </div>

          <div class="form-item">
            <label class="form-label">超时筛选</label>
            <select
              class="form-select"
              value={hasTimeoutFilter() === undefined ? "" : String(hasTimeoutFilter())}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") setHasTimeoutFilter(undefined);
                else setHasTimeoutFilter(val === "true");
              }}
            >
              <option value="">全部</option>
              <option value="true">已超时</option>
              <option value="false">未超时</option>
            </select>
          </div>

          <div class="form-item" style="flex: 1; min-width: 200px;">
            <label class="form-label">关键词搜索</label>
            <input
              type="text"
              class="form-input"
              placeholder="搜索任务名称..."
              value={keyword()}
              onInput={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <div style="display: flex; gap: 8px; align-items: flex-end;">
            <button class="btn btn-primary" onClick={handleSearch}>
              查询
            </button>
            <button class="btn btn-default" onClick={handleReset}>
              重置
            </button>
          </div>
        </div>

        {loading() ? (
          <div class="loading">加载中...</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>任务编号</th>
                  <th>任务名称</th>
                  <th>作物类型</th>
                  <th>种植面积(亩)</th>
                  <th>种植地点</th>
                  <th>种植户</th>
                  <th>状态</th>
                  <th>是否超时</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks().length === 0 ? (
                  <tr>
                    <td colspan="10" class="empty">暂无数据</td>
                  </tr>
                ) : (
                  tasks().map((task) => (
                    <tr key={task.id}>
                      <td>{task.taskNo}</td>
                      <td>{task.taskName}</td>
                      <td>{cropTypeNames[task.cropType] || task.cropType}</td>
                      <td>{task.plantingArea}</td>
                      <td>{task.location}</td>
                      <td>{task.planterName}</td>
                      <td>
                        <span class={`tag tag-${statusTagTypes[task.status] || "default"}`}>
                          {statusNames[task.status] || task.status}
                        </span>
                      </td>
                      <td>
                        {task.hasTimeout ? (
                          <span class="tag tag-error">已超时</span>
                        ) : (
                          <span class="tag tag-success">正常</span>
                        )}
                      </td>
                      <td>{formatDate(task.createdAt)}</td>
                      <td>
                        <button class="btn btn-primary btn-sm" onClick={() => goToDetail(task.id)}>
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div class="pagination">
              <button
                disabled={page() <= 1}
                onClick={() => setPage(page() - 1)}
              >
                上一页
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  class={p === page() ? "active" : ""}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page() >= totalPages}
                onClick={() => setPage(page() + 1)}
              >
                下一页
              </button>
              <span style="margin-left: 16px; color: #999; font-size: 13px;">
                共 {total()} 条
              </span>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
