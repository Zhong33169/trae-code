import type { TaskStatus } from "../types";
import { STATUS_LABELS } from "../types";
import { twMerge } from "tailwind-merge";

const statusStyles: Record<TaskStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  pending_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
  review_passed: "bg-blue-100 text-blue-800 border-blue-200",
  review_rejected: "bg-red-100 text-red-800 border-red-200",
  review_approved: "bg-green-100 text-green-800 border-green-200",
  review_returned: "bg-orange-100 text-orange-800 border-orange-200",
};

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={twMerge(
        "inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border",
        statusStyles[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
