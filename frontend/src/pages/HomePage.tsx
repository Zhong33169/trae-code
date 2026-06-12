import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Header } from "../components/Header";
import { TaskList } from "../components/TaskList";
import { TaskDetail } from "../components/TaskDetail";
import { ReviewDialog } from "../components/ReviewDialog";
import { BatchResultDialog } from "../components/BatchResultDialog";
import { TaskFormDialog } from "../components/TaskFormDialog";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { taskApi, batchApi } from "../api/client";
import type {
  SamplingTask,
  BatchResult,
  BatchSubmitItem,
  UserRole,
} from "../types";
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

interface BatchReviewDialogState {
  isOpen: boolean;
  action: "supervisor_pass" | "supervisor_reject" | "reviewer_approve" | "reviewer_return" | "submit" | null;
}

export default function HomePage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<SamplingTask[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
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

  const [batchReviewDialog, setBatchReviewDialog] = useState<BatchReviewDialogState>({
    isOpen: false,
    action: null,
  });
  const [batchReason, setBatchReason] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);

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
    setStatusFilter("");
    setKeyword("");
  }, [user?.role]);

  const refreshAll = useCallback(async () => {
    await fetchTasks();
    if (selectedTaskId) {
      await fetchTaskDetail(selectedTaskId);
    }
  }, [fetchTasks, selectedTaskId, fetchTaskDetail]);

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

  const openBatchAction = (action: string) => {
    if (selectedIds.size === 0) {
      toast.warning("请先选择任务");
      return;
    }
    setBatchReviewDialog({ isOpen: true, action: action as BatchReviewDialogState["action"] });
    setBatchReason("");
  };

  const handleBatchConfirm = async () => {
    if (!batchReviewDialog.action || selectedIds.size === 0) return;

    const idArray = Array.from(selectedIds);
    const action = batchReviewDialog.action;
    const needReason =
      action === "supervisor_reject" || action === "reviewer_return";

    if (needReason && !batchReason.trim()) {
      toast.error("请填写原因");
      return;
    }

    setBatchLoading(true);
    try {
      let result: BatchResult | undefined;

      if (action === "submit") {
        const items: BatchSubmitItem[] = idArray.map((id) => {
          const task = tasks.find((t) => t.id === id);
          return {
            id,
            version: task?.version || 1,
          };
        });
        result = await batchApi.registrarSubmit(items);
      } else {
        const items: BatchReviewItem[] = idArray.map((id) => {
          const task = tasks.find((t) => t.id === id);
          return {
            id,
            version: task?.version || 1,
            pass: action === "supervisor_pass" || action === "reviewer_approve",
            reason: batchReason,
          };
        });

        if (user?.role === "supervisor") {
          result = await batchApi.supervisorReview(items);
        } else if (user?.role === "reviewer") {
          result = await batchApi.reviewerReview(items);
        }
      }

      if (result) {
        setBatchResult(result);
        setBatchResultOpen(true);
      }

      await refreshAll();
      toast.success("批量操作完成");
    } catch (error) {
      const err = error as Error;
      toast.error(`批量操作失败: ${err.message}`);
    } finally {
      setBatchLoading(false);
      setBatchReviewDialog({ isOpen: false, action: null });
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
      await refreshAll();
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
          title: "审核通过（上传过程核验证据）",
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
          title: "复核归档（上传复核证据）",
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

  const getBatchDialogConfig = () => {
    switch (batchReviewDialog.action) {
      case "submit":
        return {
          title: `批量提交审核（${selectedIds.size}条）`,
          description: "将选中的草稿、驳回、退回任务提交至主管审核",
          actionLabel: "提交",
          actionVariant: "primary" as const,
          showReason: false,
          reasonPlaceholder: "",
        };
      case "supervisor_pass":
        return {
          title: `批量审核通过（${selectedIds.size}条）`,
          description: "只有已上传过过程核验证据的任务才能审核通过，缺少证据的将标注失败",
          actionLabel: "批量通过",
          actionVariant: "success" as const,
          showReason: false,
          reasonPlaceholder: "",
        };
      case "supervisor_reject":
        return {
          title: `批量审核驳回（${selectedIds.size}条）`,
          description: "将选中的待审核任务驳回给登记员补正",
          actionLabel: "批量驳回",
          actionVariant: "danger" as const,
          showReason: true,
          reasonPlaceholder: "请填写统一驳回原因...",
        };
      case "reviewer_approve":
        return {
          title: `批量复核归档（${selectedIds.size}条）`,
          description: "只有已上传过复核证据的任务才能归档，缺少证据的将标注失败",
          actionLabel: "批量归档",
          actionVariant: "success" as const,
          showReason: false,
          reasonPlaceholder: "",
        };
      case "reviewer_return":
        return {
          title: `批量复核退回（${selectedIds.size}条）`,
          description: "将选中的待复核任务退回给登记员补正",
          actionLabel: "批量退回",
          actionVariant: "danger" as const,
          showReason: true,
          reasonPlaceholder: "请填写统一退回原因...",
        };
      default:
        return {
          title: "",
          description: "",
          actionLabel: "",
          actionVariant: "primary" as const,
          showReason: false,
          reasonPlaceholder: "",
        };
    }
  };

  const handleCreateTask = () => {
    setTaskForm({ isOpen: true, mode: "create", task: null });
  };

  const handleEditTask = () => {
    if (!selectedTask) return;
    setTaskForm({ isOpen: true, mode: "edit", task: selectedTask });
  };

  const handleTaskFormSubmit = async (data: any) => {
    setTaskFormLoading(true);
    try {
      if (taskForm.mode === "create") {
        const created = await taskApi.create(data);
        toast.success("任务创建成功（草稿状态）");
        setSelectedTaskId(created.id);
      } else if (taskForm.mode === "edit" && selectedTaskId) {
        await taskApi.update(selectedTaskId, {
          ...data,
          version: selectedTask?.version || 1,
        });
        toast.success("任务补正成功，可继续提交审核");
      }
      await refreshAll();
      setTaskForm({ isOpen: false, mode: "create", task: null });
    } catch (error) {
      const err = error as Error;
      toast.error(`操作失败: ${err.message}`);
    } finally {
      setTaskFormLoading(false);
    }
  };

  const role = user?.role as UserRole | undefined;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 flex overflow-hidden p-4 gap-4 min-w-[1280px]">
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
            currentRole={role || null}
            statusFilter={statusFilter}
            keyword={keyword}
            onBatchAction={openBatchAction}
            onCreateTask={handleCreateTask}
          />
        </div>

        <div className="flex-[4] min-w-0">
          <TaskDetail
            task={selectedTask}
            loading={detailLoading}
            currentRole={role || null}
            onEdit={handleEditTask}
            onSubmit={() => {
              if (selectedTaskId) openReviewDialog("submit", selectedTaskId);
            }}
            onSupervisorReview={(action) => {
              if (selectedTaskId)
                openReviewDialog(
                  action === "pass" ? "supervisor_pass" : "supervisor_reject",
                  selectedTaskId
                );
            }}
            onReviewerReview={(action) => {
              if (selectedTaskId)
                openReviewDialog(
                  action === "approve" ? "reviewer_approve" : "reviewer_return",
                  selectedTaskId
                );
            }}
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

      <Modal
        isOpen={batchReviewDialog.isOpen}
        onClose={() => setBatchReviewDialog({ isOpen: false, action: null })}
        title={getBatchDialogConfig().title}
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() =>
                setBatchReviewDialog({ isOpen: false, action: null })
              }
              disabled={batchLoading}
            >
              取消
            </Button>
            <Button
              variant={getBatchDialogConfig().actionVariant}
              onClick={handleBatchConfirm}
              loading={batchLoading}
            >
              {getBatchDialogConfig().actionLabel}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{getBatchDialogConfig().description}</p>
          <div className="text-xs bg-blue-50 border border-blue-100 rounded-md p-3 text-blue-700">
            已选择 <span className="font-bold">{selectedIds.size}</span> 条任务。
            系统将逐条校验并返回详细结果，不符合条件的任务会自动跳过并标注具体原因。
          </div>
          {getBatchDialogConfig().showReason && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                原因说明 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={batchReason}
                onChange={(e) => setBatchReason(e.target.value)}
                placeholder={getBatchDialogConfig().reasonPlaceholder}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}
        </div>
      </Modal>

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
