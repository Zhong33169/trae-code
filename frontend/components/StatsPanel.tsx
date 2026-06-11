import type { Statistics } from '@/lib/types';

interface StatsPanelProps {
  stats: Statistics;
  onFilterChange: (filters: { status?: string; risk_level?: string; stage?: string }) => void;
}

export default function StatsPanel({ stats, onFilterChange }: StatsPanelProps) {
  const statCards = [
    {
      label: '全部申请',
      value: stats.total_count,
      color: 'bg-gray-50 border-gray-200',
      filter: {},
    },
    {
      label: '待签收',
      value: stats.pending_count,
      color: 'bg-yellow-50 border-yellow-300',
      filter: { status: '待签收' },
    },
    {
      label: '异常回传',
      value: stats.abnormal_count,
      color: 'bg-red-50 border-red-300',
      filter: { status: '异常回传' },
    },
    {
      label: '签收完成',
      value: stats.done_count,
      color: 'bg-green-50 border-green-300',
      filter: { status: '签收完成' },
    },
    {
      label: '高风险',
      value: stats.high_risk_count,
      color: 'bg-red-50 border-red-500',
      filter: { risk_level: 'high' },
    },
    {
      label: '中风险',
      value: stats.medium_risk_count,
      color: 'bg-amber-50 border-amber-400',
      filter: { risk_level: 'medium' },
    },
    {
      label: '低风险',
      value: stats.low_risk_count,
      color: 'bg-green-50 border-green-400',
      filter: { risk_level: 'low' },
    },
    {
      label: '已逾期',
      value: stats.overdue_count,
      color: 'bg-red-100 border-red-400',
      filter: {},
    },
  ];

  const stageCards = [
    {
      label: '开户预约',
      value: stats.stage_booking_count,
      filter: { stage: '开户预约' },
    },
    {
      label: '资料审核',
      value: stats.stage_review_count,
      filter: { stage: '资料审核' },
    },
    {
      label: '账户启用',
      value: stats.stage_enable_count,
      filter: { stage: '账户启用' },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((card, index) => (
          <button
            key={index}
            onClick={() => onFilterChange(card.filter)}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${card.color}`}
          >
            <div className="text-xs text-gray-500 mb-1">{card.label}</div>
            <div className="text-2xl font-bold text-gray-800">{card.value}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stageCards.map((card, index) => (
          <button
            key={index}
            onClick={() => onFilterChange(card.filter)}
            className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50 text-left transition-all hover:shadow-md hover:bg-blue-100"
          >
            <div className="text-xs text-blue-600 mb-1">{card.label}</div>
            <div className="text-2xl font-bold text-blue-800">{card.value}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
