import { component$ } from "@builder.io/qwik";

interface StatusBadgeProps {
  label: string;
  type?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray';
}

const typeMap: Record<string, string> = {
  default: 'bg-gray-100 text-gray-700 border-gray-200',
  primary: 'bg-blue-50 text-blue-700 border-blue-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const StatusBadge = component$<StatusBadgeProps>(({ label, type = 'default' }) => {
  return (
    <span class={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${typeMap[type] || typeMap.default}`}>
      {label}
    </span>
  );
});

export function getStatusColor(status: string): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray' {
  const s = (status || '').toLowerCase();
  if (s.includes('确认') || s.includes('通过') || s.includes('回收') || s.includes('归档') || s.includes('完成') || s === 'confirmed' || s === 'approved' || s === 'success' || s === 'done' || s === 'issued' || s === 'collected' || s === 'archived') {
    return 'success';
  }
  if (s.includes('失败') || s.includes('退回') || s === 'failed' || s === 'rejected') {
    return 'danger';
  }
  if (s.includes('待') || s.includes('待审核') || s.includes('待确认') || s.includes('草稿') || s === 'draft' || s === 'pending' || s === 'submitted' || s === 'arranged' || s === 'waiting') {
    return 'warning';
  }
  if (s.includes('处理中') || s.includes('执行') || s.includes('安排') || s.includes('出单') || s === 'processing' || s === 'in_progress') {
    return 'primary';
  }
  if (s.includes('补正') || s === 'corrected') {
    return 'info';
  }
  return 'gray';
}
