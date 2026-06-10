import { STATUS_COLORS, INSPECTION_STATUS_LABELS } from "~/config";

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({ status, label, size = "md" }: StatusBadgeProps) {
  const displayLabel = label || INSPECTION_STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || "#6b7280";

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      padding: "2px 8px",
      fontSize: "11px",
    },
    md: {
      padding: "4px 12px",
      fontSize: "12px",
    },
    lg: {
      padding: "6px 16px",
      fontSize: "14px",
    },
  };

  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: `${color}15`,
        color: color,
        borderRadius: "4px",
        fontWeight: 500,
        border: `1px solid ${color}30`,
        ...sizeStyles[size],
      }}
    >
      {displayLabel}
    </span>
  );
}
