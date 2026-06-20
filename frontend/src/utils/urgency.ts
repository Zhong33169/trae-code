import { UrgencyLevel } from '@/types';
import dayjs from 'dayjs';

export function getRemainingHours(deadline: string): number {
  return dayjs(deadline).diff(dayjs(), 'hour');
}

export function getUrgencyFromDeadline(deadline: string): UrgencyLevel {
  const hours = getRemainingHours(deadline);
  if (hours <= 0) return UrgencyLevel.Overdue;
  if (hours <= 72) return UrgencyLevel.Urgent;
  return UrgencyLevel.Normal;
}

export function formatRemaining(deadline: string): string {
  const hours = getRemainingHours(deadline);
  if (hours <= 0) return `已逾期 ${Math.abs(hours)}h`;
  return `剩余 ${hours}h`;
}
