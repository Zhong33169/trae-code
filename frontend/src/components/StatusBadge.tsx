import { component$ } from "@builder.io/qwik";
import type { InspectionStatus, RiskLevel } from "~/types";
import { statusLabels, statusColors, riskLabels, riskColors } from "~/utils/format";

interface StatusBadgeProps {
  status: InspectionStatus;
}

export const StatusBadge = component$<StatusBadgeProps>(({ status }) => {
  return (
    <span
      class={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
});

interface RiskBadgeProps {
  level: RiskLevel;
  showIcon?: boolean;
}

export const RiskBadge = component$<RiskBadgeProps>(
  ({ level, showIcon = false }) => {
    return (
      <span
        class={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${riskColors[level]}`}
      >
        {showIcon && level === "HIGH" && <span>⚠️</span>}
        {riskLabels[level]}
      </span>
    );
  }
);
