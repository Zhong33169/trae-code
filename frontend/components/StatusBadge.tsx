import { STATUS_MAP, STATUS_COLORS } from "../utils/types.ts";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = STATUS_MAP[status] || status;
  const color = STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
