export enum TimeoutStatus {
  NORMAL = 'normal',
  WARNING = 'warning',
  OVERDUE = 'overdue',
}

export const TimeoutStatusLabel: Record<TimeoutStatus, string> = {
  [TimeoutStatus.NORMAL]: '正常',
  [TimeoutStatus.WARNING]: '预警',
  [TimeoutStatus.OVERDUE]: '超时',
};

export const TimeoutStatusColor: Record<TimeoutStatus, string> = {
  [TimeoutStatus.NORMAL]: '#10b981',
  [TimeoutStatus.WARNING]: '#f59e0b',
  [TimeoutStatus.OVERDUE]: '#ef4444',
};
