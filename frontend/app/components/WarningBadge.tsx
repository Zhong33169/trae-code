import { AlertTriangle, Clock, CheckCircle, Bell } from "lucide-react";
import type { WarningLevel } from "~/lib/types";
import { WARNING_LABELS } from "~/lib/types";

const WARNING_STYLES: Record<
  WarningLevel,
  { bg: string; text: string; border: string; icon: React.ReactNode; pulse?: boolean }
> = {
  normal: {
    bg: "bg-deep-50",
    text: "text-deep-600",
    border: "border-deep-200",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  notice: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: <Bell className="w-3 h-3" />,
  },
  near_due: {
    bg: "bg-amber-soft",
    text: "text-amber-warn",
    border: "border-amber-warn/30",
    icon: <Clock className="w-3 h-3" />,
  },
  overdue: {
    bg: "bg-crimson-soft",
    text: "text-crimson",
    border: "border-crimson/30",
    icon: <AlertTriangle className="w-3 h-3" />,
    pulse: true,
  },
};

export function WarningBadge({
  level,
  size = "sm",
}: {
  level: WarningLevel;
  size?: "sm" | "md";
}) {
  const style = WARNING_STYLES[level];
  const sizeCls = size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`badge border ${style.bg} ${style.text} ${style.border} ${sizeCls} ${
        style.pulse ? "animate-pulse-crimson" : ""
      }`}
    >
      {style.icon}
      {WARNING_LABELS[level]}
    </span>
  );
}

export function warningColor(level: WarningLevel): string {
  switch (level) {
    case "overdue":
      return "border-l-crimson";
    case "near_due":
      return "border-l-amber-warn";
    case "notice":
      return "border-l-blue-400";
    default:
      return "border-l-deep-200";
  }
}

export { WARNING_STYLES };
