export type UserRole = 'registrar' | 'auditor' | 'reviewer';

export const ROLE_LABELS: Record<UserRole, string> = {
  registrar: '登记员',
  auditor: '审核主管',
  reviewer: '复核负责人',
};

export type ConfirmationOrderStatus =
  | 'draft'
  | 'pending_audit'
  | 'returned'
  | 'pending_review'
  | 'archived';

export const CONFIRMATION_ORDER_STATUS_LABELS: Record<ConfirmationOrderStatus, string> = {
  draft: '草稿',
  pending_audit: '待审核',
  returned: '已退回',
  pending_review: '待复核',
  archived: '已归档',
};

export const CONFIRMATION_ORDER_STATUS_COLORS: Record<ConfirmationOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending_audit: 'bg-yellow-100 text-yellow-800',
  returned: 'bg-red-100 text-red-800',
  pending_review: 'bg-blue-100 text-blue-800',
  archived: 'bg-green-100 text-green-800',
};

export type ARStatus = 'pending' | 'confirmed';

export const AR_STATUS_LABELS: Record<ARStatus, string> = {
  pending: '待确权',
  confirmed: '已确权',
};

export const AR_STATUS_COLORS: Record<ARStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
};

export type PaymentVerificationStatus = 'pending' | 'verified' | 'partially_verified';

export const PAYMENT_VERIFICATION_STATUS_LABELS: Record<PaymentVerificationStatus, string> = {
  pending: '待核销',
  verified: '已核销',
  partially_verified: '部分核销',
};

export const PAYMENT_VERIFICATION_STATUS_COLORS: Record<PaymentVerificationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  partially_verified: 'bg-blue-100 text-blue-800',
};

export type ActionType =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'review'
  | 'archive'
  | 'resubmit'
  | 'view'
  | 'edit'
  | 'delete';

export const ACTION_LABELS: Record<ActionType, string> = {
  submit: '提交审核',
  approve: '审核通过',
  reject: '审核退回',
  review: '复核通过',
  archive: '归档',
  resubmit: '重新提交',
  view: '查看',
  edit: '编辑',
  delete: '删除',
};

export const ROLE_MENUS: Record<UserRole, { key: string; label: string; path: string }[]> = {
  registrar: [
    { key: 'dashboard', label: '统计看板', path: '/dashboard' },
    { key: 'accounts-receivable', label: '应收账款', path: '/accounts-receivable' },
    { key: 'confirmation-orders', label: '应收确权单', path: '/confirmation-orders' },
    { key: 'operation-logs', label: '操作日志', path: '/operation-logs' },
  ],
  auditor: [
    { key: 'dashboard', label: '统计看板', path: '/dashboard' },
    { key: 'confirmation-orders', label: '应收确权单', path: '/confirmation-orders' },
    { key: 'operation-logs', label: '操作日志', path: '/operation-logs' },
  ],
  reviewer: [
    { key: 'dashboard', label: '统计看板', path: '/dashboard' },
    { key: 'accounts-receivable', label: '应收账款', path: '/accounts-receivable' },
    { key: 'confirmation-orders', label: '应收确权单', path: '/confirmation-orders' },
    { key: 'payment-verifications', label: '回款核销', path: '/payment-verifications' },
    { key: 'operation-logs', label: '操作日志', path: '/operation-logs' },
  ],
};

export const SHIFTS = ['早班', '中班', '晚班'];
