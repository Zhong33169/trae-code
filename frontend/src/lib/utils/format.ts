import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.locale('zh-cn');
dayjs.extend(relativeTime);

export function formatDate(date: string | Date | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD');
}

export function formatDateTime(date: string | Date | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

export function formatDateCustom(date: string | Date | undefined, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!date) return '-';
  return dayjs(date).format(format);
}

export function fromNow(date: string | Date | undefined): string {
  if (!date) return '-';
  return dayjs(date).fromNow();
}

export function formatNumber(num: number | undefined | null, decimals: number = 2): string {
  if (num === undefined || num === null) return '-';
  return num.toFixed(decimals);
}

export function truncateText(text: string | undefined, maxLength: number = 50): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
