import type { RiskLevel } from '@/lib/types';

interface RiskBadgeProps {
  level: RiskLevel;
  reason?: string;
  showReason?: boolean;
}

const riskConfig = {
  high: { label: '高风险', className: 'risk-high border' },
  medium: { label: '中风险', className: 'risk-medium border' },
  low: { label: '低风险', className: 'risk-low border' },
};

export default function RiskBadge({ level, reason, showReason = false }: RiskBadgeProps) {
  const config = riskConfig[level];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.className}`}
      >
        {level === 'high' && (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {config.label}
      </span>
      {showReason && reason && (
        <span className="text-xs text-gray-500">{reason}</span>
      )}
    </div>
  );
}
