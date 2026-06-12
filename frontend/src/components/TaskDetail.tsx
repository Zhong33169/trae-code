import { useState, useMemo } from "react";
import type { SamplingTask, UserRole, Evidence, TaskLog } from "../types";
import {
  ROLE_LABELS,
  STATUS_LABELS,
  EVIDENCE_TYPE_LABELS,
} from "../types";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./Button";

interface TaskDetailProps {
  task: SamplingTask | null;
  loading: boolean;
  currentRole: UserRole | null;
  onEdit: () => void;
  onSubmit: () => void;
  onSupervisorReview: (action: "pass" | "reject") => void;
  onReviewerReview: (action: "approve" | "return") => void;
}

type TabType = "info" | "evidence" | "logs";

export function TaskDetail({
  task,
  loading,
  currentRole,
  onEdit,
  onSubmit,
  onSupervisorReview,
  onReviewerReview,
}: TaskDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>("info");

  const actionButtons = useMemo(() => {
    if (!task || !currentRole) return [];

    const buttons: {
      label: string;
      variant: "primary" | "secondary" | "danger" | "success";
      onClick: () => void;
    }[] = [];

    switch (currentRole) {
      case "registrar":
        if (
          task.status === "review_rejected" ||
          task.status === "review_returned"
        ) {
          buttons.push({
            label: "编辑补正",
            variant: "secondary",
            onClick: onEdit,
          });
          buttons.push({
            label: "提交审核",
            variant: "primary",
            onClick: onSubmit,
          });
        }
        break;
      case "supervisor":
        if (task.status === "pending_review") {
          buttons.push({
            label: "审核通过",
            variant: "success",
            onClick: () => onSupervisorReview("pass"),
          });
          buttons.push({
            label: "驳回",
            variant: "danger",
            onClick: () => onSupervisorReview("reject"),
          });
        }
        break;
      case "reviewer":
        if (task.status === "review_passed") {
          buttons.push({
            label: "归档",
            variant: "success",
            onClick: () => onReviewerReview("approve"),
          });
          buttons.push({
            label: "退回",
            variant: "danger",
            onClick: () => onReviewerReview("return"),
          });
        }
        break;
    }

    return buttons;
  }, [task, currentRole, onEdit, onSubmit, onSupervisorReview, onReviewerReview]);

  const groupedEvidences = useMemo(() => {
    if (!task?.evidences) return {} as Record<string, Evidence[]>;

    return task.evidences.reduce((acc, evidence) => {
      const type = evidence.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(evidence);
      return acc;
    }, {} as Record<string, Evidence[]>);
  }, [task?.evidences]);

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="text-center">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-500 text-sm">请选择一个任务查看详情</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-2">
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
          <span className="text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              任务详情
            </h2>
            <p className="text-sm text-gray-500">
              任务编号：{task.task_no}
            </p>
          </div>
          <StatusBadge status={task.status} />
        </div>

        {task.reject_reason && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-600 font-medium mb-1">驳回原因</p>
            <p className="text-sm text-red-700">{task.reject_reason}</p>
          </div>
        )}
        {task.return_reason && (
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-600 font-medium mb-1">退回原因</p>
            <p className="text-sm text-yellow-700">{task.return_reason}</p>
          </div>
        )}

        {actionButtons.length > 0 && (
          <div className="flex items-center space-x-2">
            {actionButtons.map((btn, index) => (
              <Button
                key={index}
                size="sm"
                variant={btn.variant}
                onClick={btn.onClick}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="border-b border-gray-200">
        <div className="flex">
          {[
            { key: "info", label: "基本信息" },
            { key: "evidence", label: "证据材料" },
            { key: "logs", label: "操作日志" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "text-primary-600 border-primary-600"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "info" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="项目名称" value={task.project_name} />
              <InfoItem label="采样类型" value={task.sample_type} />
              <InfoItem
                label="采样地点"
                value={task.sample_location}
                fullWidth
              />
              <InfoItem label="登记员" value={task.registrar_name} />
              <InfoItem label="版本号" value={`v${task.version}`} />
              <InfoItem
                label="创建时间"
                value={new Date(task.created_at).toLocaleString("zh-CN")}
              />
              <InfoItem
                label="更新时间"
                value={new Date(task.updated_at).toLocaleString("zh-CN")}
                fullWidth
              />
              {task.supervisor_name && (
                <InfoItem label="审核主管" value={task.supervisor_name} />
              )}
              {task.reviewer_name && (
                <InfoItem label="复核负责人" value={task.reviewer_name} />
              )}
            </div>
          </div>
        )}

        {activeTab === "evidence" && (
          <div className="space-y-6">
            {Object.keys(groupedEvidences).length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="w-12 h-12 text-gray-300 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                <p className="text-gray-500 text-sm">暂无证据材料</p>
              </div>
            ) : (
              Object.entries(groupedEvidences).map(([type, evidences]) => (
                <div key={type}>
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    {EVIDENCE_TYPE_LABELS[type as keyof typeof EVIDENCE_TYPE_LABELS] || type}
                    <span className="ml-2 text-xs text-gray-500">
                      ({evidences.length} 个)
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {evidences.map((evidence) => (
                      <EvidenceCard key={evidence.id} evidence={evidence} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-1">
            {task.logs && task.logs.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />
                {task.logs.map((log: TaskLog) => (
                  <div key={log.id} className="relative pl-10 pb-4">
                    <div className="absolute left-2.5 w-3 h-3 bg-primary-500 rounded-full ring-4 ring-white" />
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {log.action}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleString("zh-CN")}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        操作人：{log.operator_name} (
                        {ROLE_LABELS[log.operator_role] || log.operator_role})
                      </div>
                      {log.remark && (
                        <div className="text-sm text-gray-700 mt-2">
                          {log.remark}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg
                  className="w-12 h-12 text-gray-300 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-gray-500 text-sm">暂无操作日志</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900 mb-1">
            {evidence.title}
          </h4>
          <p className="text-xs text-gray-500 mb-2">{evidence.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center text-xs text-gray-400">
              <svg
                className="w-3 h-3 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {evidence.file_url || "未上传文件"}
            </div>
            <span className="text-xs text-gray-400">
              {evidence.uploaded_by}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
