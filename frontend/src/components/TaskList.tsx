import { useState, useMemo, useCallback } from "react";
import type { SamplingTask, TaskStatus, UserRole } from "../types";
import { STATUS_LABELS } from "../types";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./Button";

interface TaskListProps {
  tasks: SamplingTask[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  selectedTaskId: number | null;
  selectedIds: Set<number>;
  onSelectTask: (task: SamplingTask) => void;
  onToggleSelect: (taskId: number) => void;
  onToggleSelectAll: () => void;
  onPageChange: (page: number) => void;
  onStatusFilter: (status: string) => void;
  onKeywordSearch: (keyword: string) => void;
  currentRole: UserRole | null;
  statusFilter: string;
  keyword: string;
  onBatchAction: (action: string) => void;
  onCreateTask: () => void;
}

const statusOptions: { value: string; label: string }[] = [
  { value: "", label: "全部状态" },
  { value: "draft", label: STATUS_LABELS.draft },
  { value: "pending_review", label: STATUS_LABELS.pending_review },
  { value: "review_passed", label: STATUS_LABELS.review_passed },
  { value: "review_rejected", label: STATUS_LABELS.review_rejected },
  { value: "review_approved", label: STATUS_LABELS.review_approved },
  { value: "review_returned", label: STATUS_LABELS.review_returned },
];

export function TaskList({
  tasks,
  total,
  page,
  pageSize,
  loading,
  selectedTaskId,
  selectedIds,
  onSelectTask,
  onToggleSelect,
  onToggleSelectAll,
  onPageChange,
  onStatusFilter,
  onKeywordSearch,
  currentRole,
  statusFilter,
  keyword,
  onBatchAction,
  onCreateTask,
}: TaskListProps) {
  const [searchInput, setSearchInput] = useState(keyword);

  const totalPages = Math.ceil(total / pageSize);

  const allSelected = useMemo(() => {
    if (tasks.length === 0) return false;
    return tasks.every((task) => selectedIds.has(task.id));
  }, [tasks, selectedIds]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        onKeywordSearch(searchInput);
      }
    },
    [searchInput, onKeywordSearch]
  );

  const batchButtons = useMemo(() => {
    switch (currentRole) {
      case "registrar":
        return [{ action: "submit", label: "批量提交审核", variant: "primary" as const }];
      case "supervisor":
        return [
          { action: "supervisor_pass", label: "批量审核通过", variant: "success" as const },
          { action: "supervisor_reject", label: "批量驳回", variant: "danger" as const },
        ];
      case "reviewer":
        return [
          { action: "reviewer_approve", label: "批量归档", variant: "success" as const },
          { action: "reviewer_return", label: "批量退回", variant: "danger" as const },
        ];
      default:
        return [];
    }
  }, [currentRole]);

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">任务队列</h2>
          {currentRole === "registrar" && (
            <Button size="sm" onClick={onCreateTask}>
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              新建任务
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="搜索任务编号、项目名称..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => onStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center space-x-3 p-3 bg-primary-50 rounded-md">
            <span className="text-sm text-primary-700">
              已选择 <span className="font-semibold">{selectedIds.size}</span> 项
            </span>
            <div className="flex-1" />
            {batchButtons.map((btn) => (
              <Button
                key={btn.action}
                size="sm"
                variant={btn.variant}
                onClick={() => onBatchAction(btn.action)}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                任务编号
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                项目名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                采样地点
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                采样类型
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                登记员
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <svg
                      className="animate-spin h-5 w-5 text-primary-600"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span className="text-gray-500 text-sm">加载中...</span>
                  </div>
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <svg
                      className="w-12 h-12 text-gray-300 mb-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <span className="text-gray-500 text-sm">暂无任务数据</span>
                  </div>
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className={`cursor-pointer transition-colors ${
                    selectedTaskId === task.id
                      ? "bg-primary-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onChange={() => onToggleSelect(task.id)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {task.task_no}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {task.project_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {task.sample_location}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {task.sample_type}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status as TaskStatus} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {task.registrar_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(task.created_at).toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            共 {total} 条，第 {page}/{totalPages} 页
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-3 py-1 text-sm rounded ${
                    page === pageNum
                      ? "bg-primary-600 text-white"
                      : "border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
