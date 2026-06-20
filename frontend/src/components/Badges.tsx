// ============================================================
// Badge Components
// ============================================================

import { component$ } from "@builder.io/qwik";
import type { InspectionStatus, RiskLevel, InspectionResult, OperationType, UserRole } from "~/types";
import {
  statusLabels,
  statusColors,
  riskLabels,
  riskColors,
  resultLabels,
  resultColors,
  operationLabels,
  operationColors,
  roleLabels,
  roleColors,
} from "~/utils/format";

// ---------- Status Badge ----------
interface StatusBadgeProps {
  status: InspectionStatus;
  withDot?: boolean;
}

export const StatusBadge = component$<StatusBadgeProps>(
  ({ status, withDot = false }) => {
    return (
      <span
        class={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}
      >
        {withDot && (
          <span
            class={`inline-block w-1.5 h-1.5 rounded-full`}
            style={{
              backgroundColor:
                status === "archived"
                  ? "#22c55e"
                  : status === "pending_handling"
                  ? "#eab308"
                  : status === "in_progress"
                  ? "#3b82f6"
                  : status === "pending_review"
                  ? "#a855f7"
                  : status === "returned"
                  ? "#f97316"
                  : "#6b7280",
            }}
          />
        )}
        {statusLabels[status]}
      </span>
    );
  }
);

// ---------- Risk Badge ----------
interface RiskBadgeProps {
  level: RiskLevel;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export const RiskBadge = component$<RiskBadgeProps>(
  ({ level, showIcon = false, size = "sm" }) => {
    const padding = size === "md" ? "px-3 py-1.5" : "px-2.5 py-1";
    const icon = level === "high" ? "⚠️" : level === "medium" ? "⚡" : "✅";
    return (
      <span
        class={`inline-flex items-center gap-1 ${padding} rounded-full text-xs font-semibold ${riskColors[level]}`}
      >
        {showIcon && <span>{icon}</span>}
        {riskLabels[level]}
      </span>
    );
  }
);

// ---------- Result Badge ----------
interface ResultBadgeProps {
  result: InspectionResult | null | undefined;
}

export const ResultBadge = component$<ResultBadgeProps>(({ result }) => {
  if (!result) {
    return (
      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        待判定
      </span>
    );
  }
  const bgMap: Record<InspectionResult, string> = {
    normal: "bg-green-50",
    abnormal: "bg-red-50",
    missing_evidence: "bg-orange-50",
    overdue: "bg-red-50",
    returned: "bg-orange-50",
    status_conflict: "bg-pink-50",
  };
  return (
    <span
      class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${bgMap[result]} ${resultColors[result]}`}
    >
      {resultLabels[result]}
    </span>
  );
});

// ---------- Operation Type Badge ----------
interface OperationBadgeProps {
  type: OperationType;
}

export const OperationBadge = component$<OperationBadgeProps>(({ type }) => {
  return (
    <span
      class={`inline-block px-2 py-1 rounded text-xs font-medium ${operationColors[type]}`}
    >
      {operationLabels[type]}
    </span>
  );
});

// ---------- Role Badge ----------
interface RoleBadgeProps {
  role: UserRole | string;
}

export const RoleBadge = component$<RoleBadgeProps>(({ role }) => {
  const r = role as UserRole;
  return (
    <span
      class={`inline-block px-2 py-0.5 rounded text-xs font-medium ${roleColors[r] || "bg-gray-100 text-gray-700"}`}
    >
      {roleLabels[r] || role}
    </span>
  );
});
