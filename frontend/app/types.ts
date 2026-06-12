'use client';

export enum Role {
  CLERK = 'CLERK',
  SUPERVISOR = 'SUPERVISOR',
  REVIEWER = 'REVIEWER',
}

export enum FormStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  MATERIALS_MISSING = 'MATERIALS_MISSING',
  QUALIFIED = 'QUALIFIED',
  REJECTED = 'REJECTED',
  STORE_OPENED = 'STORE_OPENED',
  ARCHIVED = 'ARCHIVED',
}

export enum ActionType {
  CREATE = 'CREATE',
  SUBMIT = 'SUBMIT',
  START_REVIEW = 'START_REVIEW',
  REQUEST_MATERIALS = 'REQUEST_MATERIALS',
  RESUBMIT = 'RESUBMIT',
  APPROVE_QUALIFICATION = 'APPROVE_QUALIFICATION',
  REJECT = 'REJECT',
  OPEN_STORE = 'OPEN_STORE',
  ARCHIVE = 'ARCHIVE',
  ADD_ATTACHMENT = 'ADD_ATTACHMENT',
  REMOVE_ATTACHMENT = 'REMOVE_ATTACHMENT',
  ADD_AUDIT_NOTE = 'ADD_AUDIT_NOTE',
  BATCH_IMPORT = 'BATCH_IMPORT',
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  roleLabel: string;
}

export interface MerchantOnboardingForm {
  id: string;
  batchNo: string;
  merchantName: string;
  contact: string;
  phone: string;
  email: string;
  businessLicense: string;
  taxCertificate: string;
  orgCode: string;
  legalPerson: string;
  registeredCapital: string;
  businessScope: string;
  status: FormStatus;
  statusLabel: string;
  currentRole: Role;
  currentRoleLabel: string;
  createdBy: string;
  createdAt: string;
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
  rejectReason?: string;
  materialsMissingNote?: string;
  auditRemark?: string;
  isOverdue: boolean;
  hasException: boolean;
  exceptionMessage?: string;
  offlineStatus?: string;
  deadline?: string;
}

export interface Attachment {
  id: string;
  formId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  remark?: string;
}

export interface AuditLog {
  id: string;
  formId: string;
  operator: string;
  operatorRole: Role;
  operatorRoleLabel: string;
  operatorName: string;
  action: ActionType;
  actionLabel: string;
  oldStatus?: FormStatus;
  oldStatusLabel?: string;
  newStatus?: FormStatus;
  newStatusLabel?: string;
  reason?: string;
  remark?: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  exceptionMessage?: string;
}

export interface BatchResult {
  success: boolean;
  batchNo: string;
  total: number;
  processed: number;
  failed: number;
  results: Array<{
    merchantName: string;
    success: boolean;
    message: string;
  }>;
}

export const roleLabels: Record<string, string> = {
  CLERK: '商家入驻登记员',
  SUPERVISOR: '商家入驻审核主管',
  REVIEWER: 'B2B批发平台复核负责人',
};

export const statusLabels: Record<FormStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交待审核',
  UNDER_REVIEW: '审核中',
  MATERIALS_MISSING: '待补正材料',
  QUALIFIED: '资质审核通过',
  REJECTED: '已驳回',
  STORE_OPENED: '店铺已开通',
  ARCHIVED: '已归档',
};

export const actionLabels: Record<ActionType, string> = {
  CREATE: '创建入驻单',
  SUBMIT: '提交审核',
  START_REVIEW: '开始审核',
  REQUEST_MATERIALS: '退回补正',
  RESUBMIT: '补正后重提',
  APPROVE_QUALIFICATION: '资质审核通过',
  REJECT: '驳回申请',
  OPEN_STORE: '开通店铺',
  ARCHIVE: '复核归档',
  ADD_ATTACHMENT: '上传附件',
  REMOVE_ATTACHMENT: '删除附件',
  ADD_AUDIT_NOTE: '添加审计备注',
  BATCH_IMPORT: '批量导入',
};

export const statusColorMap: Record<FormStatus, string> = {
  DRAFT: '#9ca3af',
  SUBMITTED: '#3b82f6',
  UNDER_REVIEW: '#f59e0b',
  MATERIALS_MISSING: '#ef4444',
  QUALIFIED: '#10b981',
  REJECTED: '#dc2626',
  STORE_OPENED: '#059669',
  ARCHIVED: '#6b7280',
};
