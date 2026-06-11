import { cn } from '@/lib/utils';
import type { RiskLevel, Stage, TicketStatus } from '@/types';

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  pulse?: boolean;
}

export function RiskBadge({ level, label, pulse = false }: RiskBadgeProps) {
  const styles = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  const dotStyles = {
    high: 'bg-red-500',
    medium: 'bg-amber-500',
    low: 'bg-emerald-500',
  };

  const labels = {
    high: '高风险',
    medium: '中风险',
    low: '低风险',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-md border',
        styles[level]
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          dotStyles[level],
          pulse && level === 'high' && 'animate-pulse'
        )}
      />
      {label || labels[level]}
    </span>
  );
}

interface StatusBadgeProps {
  status: TicketStatus;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    pending: 'bg-blue-50 text-blue-700 border-blue-200',
    processing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    returned: 'bg-orange-50 text-orange-700 border-orange-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    overdue: 'bg-red-50 text-red-700 border-red-200',
  };

  const labels: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    returned: '已退回',
    completed: '已完成',
    overdue: '已逾期',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border',
        styles[status]
      )}
    >
      {label || labels[status]}
    </span>
  );
}

interface StageBadgeProps {
  stage: Stage;
  label?: string;
}

export function StageBadge({ stage, label }: StageBadgeProps) {
  const styles: Record<string, string> = {
    confirm: 'bg-slate-100 text-slate-700 border-slate-200',
    schedule: 'bg-violet-50 text-violet-700 border-violet-200',
    acceptance: 'bg-teal-50 text-teal-700 border-teal-200',
  };

  const labels: Record<string, string> = {
    confirm: '需求确认',
    schedule: '排期评估',
    acceptance: '交付验收',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border',
        styles[stage]
      )}
    >
      {label || labels[stage]}
    </span>
  );
}
