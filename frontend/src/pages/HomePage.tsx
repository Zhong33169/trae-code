import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Header } from "../components/Header";
import { TaskList } from "../components/TaskList";
import { TaskDetail } from "../components/TaskDetail";
import { ReviewDialog } from "../components/ReviewDialog";
import { BatchResultDialog } from "../components/BatchResultDialog";
import { TaskFormDialog } from "../components/TaskFormDialog";
import { useAuth } from "../context/AuthContext";
import { taskApi, batchApi } from "../api/client";
import type { SamplingTask, BatchResult, TaskStatus } from "../types";
import type { BatchReviewItem } from "../api/client";

interface ReviewDialogState {
  isOpen: boolean;
  type:
    | "submit"
    | "supervisor_pass"
    | "supervisor_reject"
    | "reviewer_approve"
    | "reviewer_return"
    | null;
  taskId: number | null;
}

interface TaskFormState {
  isOpen: boolean;
  mode: "create" | "edit";
  task: SamplingTask | null;
}

export default function HomePage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<SamplingTask[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<SamplingTask | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>({
    isOpen: false,
    type: null,
    taskId: null,
  });
  const [reviewLoading, setReviewLoading] = useState(false);

  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [batchResultOpen, setBatchResultOpen] = useState(false);

  const [taskForm, setTaskForm] = useState<TaskFormState>({
    isOpen: false,
    mode: "create",
    task: null,
  });
  const [taskFormLoading, setTaskFormLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!user) return;

    setListLoading(true);
    try {
      const response = await taskApi.list({
        status: statusFilter,
        keyword,
        page,
        size: pageSize,
      });
      setTasks(response.list);
      setTotal(response.total);
    } catch (error) {
      const err = error as Error;
      toast.error(`获取任务列表失败: ${err.message}`);
    } finally {
      setListLoading(false);
    }
  }, [user, statusFilter, keyword, page, pageSize]);

  const fetchTaskDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const task = await taskApi.get(id);
      setSelectedTask(task);
    } catch (error) {
      const err = error as Error;
      toast.error(`获取任务详情失败: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectedTaskId(null);
    setSelectedTask(null);
    setPage(1);
  }, [user?.role]);

  const handleSelectTask = (task: SamplingTask) => {
    setSelectedTaskId(task.id);
    setSelectedTask(task);
    fetchTaskDetail(task.id);
  };

  const handleToggleSelect = (taskId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedIds(newSelected);
  };

  const handleToggleSelectAll = () => {
    if (tasks.every((t) => selectedIds.has(t.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSelectedIds(new Set());
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleKeywordSearch = (kw: string) => {
    setKeyword(kw);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleBatchAction = async (action: string) => {
    if (selectedIds.size === 0) return;

    const idArray = Array.from(selectedIds);

    if (action === "submit") {
      toast.info("批量提交功能暂未开放");
      return;
    }

    setReviewLoading(true);
    try {
      const items: BatchReviewItem[] = idArray.map((id) => {
        const task = tasks.find((t) => t.id === id);
        return {
          id,
          version: task?.version || 1,
          pass: action === "pass" || action === "approve",
          reason: "",
        };
      });

      let result: BatchResult | undefined;
      if (user?.role === "supervisor") {
        result = await batchApi.supervisorReview(items);
      } else if (user?.role === "reviewer") {
        result = await batchApi.reviewerReview(items);
      }

      if (result) {
        setBatchResult(result);
        setBatchResultOpen(true);
      }
      await fetchTasks();
      if (selectedTaskId) {
        await fetchTaskDetail(selectedTaskId);
      }
      toast.success("批量操作完成");
    } catch (error) {
      const err = error as Error;
      toast.error(`批量操作失败: ${err.message}`);
    } finally {
      setReviewLoading(false);
      setSelectedIds(new Set());
    }
  };

  const openReviewDialog = (
    type: ReviewDialogState["type"],
    taskId: number
  ) => {
    setReviewDialog({ isOpen: true, type, taskId });
  };

  const handleReviewConfirm = async (data: {
    reason: string;
    evidences: any[];
  }) => {
    if (!reviewDialog.taskId || !reviewDialog.type) return;

    setReviewLoading(true);
    try {
      const taskId = reviewDialog.taskId;
      const version = selectedTask?.version || 1;

      if (data.evidences && data.evidences.length > 0) {
        for (const ev of data.evidences) {
          await taskApi.addEvidence(taskId, {
            type: ev.type,
            title: ev.title,
            description: ev.description,
            file_url: ev.file_url,
          });
        }
      }

      let resultTask: SamplingTask | undefined;

      switch (reviewDialog.type) {
        case "submit":
          resultTask = await taskApi.submit(taskId, version);
          break;
        case "supervisor_pass":
          resultTask = await taskApi.supervisorReview(taskId, {
            version,
            pass: true,
            reason: data.reason,
          });
          break;
        case "supervisor_reject":
          resultTask = await taskApi.supervisorReview(taskId, {
            version,
            pass: false,
            reason: data.reason,
          });
          break;
        case "reviewer_approve":
          resultTask = await taskApi.reviewerReview(taskId, {
            version,
            approve: true,
            reason: data.reason,
          });
          break;
        case "reviewer_return":
          resultTask = await taskApi.reviewerReview(taskId, {
            version,
            approve: false,
            reason: data.reason,
          });
          break;
      }

      if (resultTask) {
        setSelectedTask(resultTask);
      }
      await fetchTasks();
      if (selectedTaskId) {
        await fetchTaskDetail(selectedTaskId);
      }
      toast.success("操作成功");
    } catch (error) {
      const err = error as Error;
      toast.error(`操作失败: ${err.message}`);
    } finally {
      setReviewLoading(false);
      setReviewDialog({ isOpen: false, type: null, taskId: null });
    }
  };

  const getReviewDialogConfig = () => {
    switch (reviewDialog.type) {
      case "submit":
        return {
          title: "提交审核",
          actionLabel: "提交",
          actionVariant: "primary" as const,
          showReason: false,
          showEvidence: false,
          evidenceType: "registration" as const,
        };
      case "supervisor_pass":
        return {
          title: "审核通过",
          actionLabel: "通过",
          actionVariant: "success" as const,
          showReason: false,
          showEvidence: true,
          evidenceType: "process" as const,
        };
      case "supervisor_reject":
        return {
          title: "审核驳回",
          actionLabel: "驳回",
          actionVariant: "danger" as const,
          showReason: true,
          showEvidence: false,
          evidenceType: "process" as const,
        };
      case "reviewer_approve":
        return {
          title: "复核归档",
          actionLabel: "归档",
          actionVariant: "success" as const,
          showReason: false,
          showEvidence: true,
          evidenceType: "review" as const,
        };
      case "reviewer_return":
        return {
          title: "复核退回",
          actionLabel: "退回",
          actionVariant: "danger" as const,
          showReason: true,
          showEvidence: false,
          evidenceType: "review" as const,
        };
      default:
        return {
          title: "",
          actionLabel: "",
          actionVariant: "primary" as const,
          showReason: true,
          showEvidence: true,
          evidenceType: "process" as const,
        };
    }
  };

  const handleCreateTask = () => {
    setTaskForm({ isOpen: true, mode: "create", task: null });
  };

  const handleEditTask = () => {
    setTaskForm({ isOpen: true, mode: "edit", task: selectedTask });
  };

  const handleTaskFormSubmit = async (data: any) => {
    setTaskFormLoading(true);
    try {
      if (taskForm.mode === "create") {
        await taskApi.create(data);
        toast.success("任务创建成功");
      } else if (taskForm.mode === "edit" && selectedTaskId) {
        await taskApi.update(selectedTaskId, {
          ...data,
          version: selectedTask?.version || 1,
        });
        toast.success("任务更新成功");
      }
      await fetchTasks();
      setTaskForm({ isOpen: false, mode: "create", task: null });
    } catch (error) {
      const err = error as Error;
      toast.error(`操作失败: ${err.message}`);
    } finally {
      setTaskFormLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 flex overflow-hidden p-4 gap-4 min-w-[1200px]">
        <div className="flex-[6] min-w-0">
          <TaskList
            tasks={tasks}
            total={total}
            page={page}
            pageSize={pageSize}
            loading={listLoading}
            selectedTaskId={selectedTaskId}
            selectedIds={selectedIds}
            onSelectTask={handleSelectTask}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onPageChange={handlePageChange}
            onStatusFilter={handleStatusFilter}
            onKeywordSearch={handleKeywordSearch}
            currentRole={user?.role || null}
            statusFilter={statusFilter}
            keyword={keyword}
            onBatchAction={handleBatchAction}
            onCreateTask={handleCreateTask}
          />
        </div>

        <div className="flex-[4] min-w-0">
          <TaskDetail
            task={selectedTask}
            loading={detailLoading}
            currentRole={user?.role || null}
            onEdit={handleEditTask}
            onSubmit={() => openReviewDialog("submit", selectedTaskId!)}
            onSupervisorReview={(action) =>
              openReviewDialog(
                action === "pass" ? "supervisor_pass" : "supervisor_reject",
                selectedTaskId!
              )
            }
            onReviewerReview={(action) =>
              openReviewDialog(
                action === "approve" ? "reviewer_approve" : "reviewer_return",
                selectedTaskId!
              )
            }
          />
        </div>
      </main>

      <ReviewDialog
        isOpen={reviewDialog.isOpen}
        onClose={() =>
          setReviewDialog({ isOpen: false, type: null, taskId: null })
        }
        onConfirm={handleReviewConfirm}
        title={getReviewDialogConfig().title}
        actionLabel={getReviewDialogConfig().actionLabel}
        actionVariant={getReviewDialogConfig().actionVariant}
        loading={reviewLoading}
        showReason={getReviewDialogConfig().showReason}
        showEvidence={getReviewDialogConfig().showEvidence}
        evidenceType={getReviewDialogConfig().evidenceType}
      />

      <BatchResultDialog
        isOpen={batchResultOpen}
        onClose={() => setBatchResultOpen(false)}
        result={batchResult}
      />

      <TaskFormDialog
        isOpen={taskForm.isOpen}
        onClose={() => setTaskForm({ isOpen: false, mode: "create", task: null })}
        onSubmit={handleTaskFormSubmit}
        task={taskForm.task}
        mode={taskForm.mode}
        loading={taskFormLoading}
      />
    </div>
  );
}
