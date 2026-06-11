import type { ApplicationStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: ApplicationStatus;
  isOverdue?: number;
  isReturned?: number;
}

const statusConfig = {
  '待签收': { label: '待签收', className: 'status-pending border' },
  '异常回传': { label: '异常回传', className: 'status-abnormal border' },
  '签收完成': { label: '签收完成', className: 'status-done border' },
};

export default function StatusBadge({ status, isOverdue, isReturned }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.className}`}
      >
        {config.label}
      </span>
      {isOverdue === 1 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-600 text-white">
          已逾期
        </span>
      )}
      {isReturned === 1 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500 text-white">
          已退回
        </span>
      )}
    </div>
  );
}
