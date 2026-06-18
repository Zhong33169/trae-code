import type { OrderStatus, UserRole } from '../types';

export const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  registered: '已登记待核验',
  verifying: '核验办理中',
  verify_passed: '核验通过待复核',
  verify_returned: '核验退回补正',
  appeal_submitted: '申诉已提交',
  appeal_accepted: '申诉已受理复核中',
  appeal_rejected_correction: '申诉驳回补正',
  appeal_resubmitted: '申诉补正后重提',
  reviewing: '复核办理中',
  review_confirmed: '复核确认待归档',
  review_returned: '复核退回补正',
  archived: '已归档',
};

export const ROLE_LABELS: Record<string, string> = {
  registrar: '备件更换登记员',
  auditor: '备件更换审核主管',
  reviewer: '复核负责人',
};

export function statusClass(s: string) {
  return `status-tag status-${s}`;
}

export function formatTime(t?: string) {
  if (!t) return '-';
  try {
    const d = new Date(t);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return t;
  }
}

export function canSubmit(s: OrderStatus, role: UserRole) {
  if (role !== 'registrar') return false;
  return ['draft', 'verify_returned', 'appeal_rejected_correction'].includes(s);
}

export function canVerify(s: OrderStatus, role: UserRole) {
  if (role !== 'auditor') return false;
  return ['registered', 'verifying'].includes(s);
}

export function canReview(s: OrderStatus, role: UserRole) {
  if (role !== 'reviewer') return false;
  return ['appeal_submitted', 'appeal_accepted', 'appeal_resubmitted', 'reviewing'].includes(s);
}

export function canArchive(s: OrderStatus, role: UserRole) {
  if (role !== 'reviewer') return false;
  return ['review_confirmed', 'verify_passed'].includes(s);
}
