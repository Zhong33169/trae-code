export enum Role {
  REGISTRAR = 'registrar',
  SUPERVISOR = 'supervisor',
  REVIEWER = 'reviewer',
}

export const RoleLabels: Record<Role, string> = {
  [Role.REGISTRAR]: '场地登记员',
  [Role.SUPERVISOR]: '场地审核主管',
  [Role.REVIEWER]: '体育场馆复核负责人',
};

export enum OrderStatus {
  DRAFT = 'draft',
  PENDING_REGISTRATION = 'pending_registration',
  PENDING_CORRECTION = 'pending_correction',
  PENDING_REVIEW = 'pending_review',
  PENDING_FINAL_REVIEW = 'pending_final_review',
  ARCHIVED = 'archived',
  REJECTED = 'rejected',
}

export const OrderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: '草稿',
  [OrderStatus.PENDING_REGISTRATION]: '待登记',
  [OrderStatus.PENDING_CORRECTION]: '待补正',
  [OrderStatus.PENDING_REVIEW]: '待审核',
  [OrderStatus.PENDING_FINAL_REVIEW]: '待复核',
  [OrderStatus.ARCHIVED]: '已归档',
  [OrderStatus.REJECTED]: '已驳回',
};

export const RoleStatusPermissions: Record<Role, OrderStatus[]> = {
  [Role.REGISTRAR]: [
    OrderStatus.PENDING_REGISTRATION,
    OrderStatus.PENDING_CORRECTION,
  ],
  [Role.SUPERVISOR]: [OrderStatus.PENDING_REVIEW],
  [Role.REVIEWER]: [OrderStatus.PENDING_FINAL_REVIEW, OrderStatus.ARCHIVED],
};

export enum OrderAction {
  SUBMIT_REGISTRATION = 'submit_registration',
  REQUEST_CORRECTION = 'request_correction',
  SUBMIT_CORRECTION = 'submit_correction',
  APPROVE_REVIEW = 'approve_review',
  REJECT_REVIEW = 'reject_review',
  APPROVE_FINAL_REVIEW = 'approve_final_review',
  REJECT_FINAL_REVIEW = 'reject_final_review',
}

export const StatusTransitions: Record<
  OrderStatus,
  Partial<Record<OrderAction, OrderStatus>>
> = {
  [OrderStatus.DRAFT]: {
    [OrderAction.SUBMIT_REGISTRATION]: OrderStatus.PENDING_REVIEW,
  },
  [OrderStatus.PENDING_REGISTRATION]: {
    [OrderAction.SUBMIT_REGISTRATION]: OrderStatus.PENDING_REVIEW,
  },
  [OrderStatus.PENDING_CORRECTION]: {
    [OrderAction.SUBMIT_CORRECTION]: OrderStatus.PENDING_REVIEW,
  },
  [OrderStatus.PENDING_REVIEW]: {
    [OrderAction.APPROVE_REVIEW]: OrderStatus.PENDING_FINAL_REVIEW,
    [OrderAction.REQUEST_CORRECTION]: OrderStatus.PENDING_CORRECTION,
    [OrderAction.REJECT_REVIEW]: OrderStatus.REJECTED,
  },
  [OrderStatus.PENDING_FINAL_REVIEW]: {
    [OrderAction.APPROVE_FINAL_REVIEW]: OrderStatus.ARCHIVED,
    [OrderAction.REJECT_FINAL_REVIEW]: OrderStatus.REJECTED,
  },
  [OrderStatus.ARCHIVED]: {},
  [OrderStatus.REJECTED]: {},
};

export enum ScanCodeError {
  INVALID_CODE = 'invalid_code',
  DUPLICATE_CODE = 'duplicate_code',
  NOT_CURRENT_HANDLER = 'not_current_handler',
  WRONG_STATUS = 'wrong_status',
  UNAUTHORIZED_ROLE = 'unauthorized_role',
  ORDER_NOT_FOUND = 'order_not_found',
  CONCURRENT_MODIFICATION = 'concurrent_modification',
  EVIDENCE_MISSING = 'evidence_missing',
}

export const ScanCodeErrorMessages: Record<ScanCodeError, string> = {
  [ScanCodeError.INVALID_CODE]: '二维码无效，请检查二维码是否正确或已过期',
  [ScanCodeError.DUPLICATE_CODE]: '二维码已被使用，请勿重复扫码',
  [ScanCodeError.NOT_CURRENT_HANDLER]: '该订单当前处理人不是您，请联系正确的处理人',
  [ScanCodeError.WRONG_STATUS]: '订单状态不允许当前操作，请确认订单流程',
  [ScanCodeError.UNAUTHORIZED_ROLE]: '您的岗位没有权限处理此类型订单',
  [ScanCodeError.ORDER_NOT_FOUND]: '未找到对应的订单记录',
  [ScanCodeError.CONCURRENT_MODIFICATION]: '订单正在被其他人处理，请稍后再试',
  [ScanCodeError.EVIDENCE_MISSING]: '缺少必要的证明材料，请补充后再提交',
};

export interface MaterialItem {
  id: string;
  name: string;
  type: string;
  url?: string;
  uploaded: boolean;
  required: boolean;
}

export interface TimeLimit {
  deadline: string;
  remainingHours: number;
  isOverdue: boolean;
}

export interface AuditLog {
  id: string;
  orderId: string;
  action: OrderAction | string;
  operatorId: string;
  operatorName: string;
  operatorRole: Role;
  timestamp: string;
  comment: string;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
  ipAddress?: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  username: string;
}

export interface BatchProcessResult {
  success: string[];
  failed: Array<{
    orderId: string;
    orderNo: string;
    error: string;
    details: any;
  }>;
}
