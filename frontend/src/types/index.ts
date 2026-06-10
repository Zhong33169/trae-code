export type Role = 'registrar' | 'supervisor' | 'reviewer';

export interface User {
  id: string;
  username: string;
  role: Role;
  name: string;
}

export type OrderStatus = 'draft' | 'pending' | 'returned' | 'processing' | 'reviewed' | 'archived';

export interface Material {
  id: string;
  name: string;
  type: string;
  uploaded: boolean;
  required: boolean;
}

export interface OrderOpinion {
  userId: string;
  userName: string;
  role: Role;
  content: string;
  time: string;
  pass: boolean;
}

export interface CrossBorderOrder {
  id: string;
  orderNo: string;
  productName: string;
  productSku: string;
  quantity: number;
  amount: number;
  currency: string;
  platform: string;
  buyerCountry: string;
  status: OrderStatus;
  registrarId: string;
  registrarName: string;
  supervisorId?: string;
  supervisorName?: string;
  reviewerId?: string;
  reviewerName?: string;
  materials: Material[];
  opinions: OrderOpinion[];
  createdAt: string;
  updatedAt: string;
  deadline: string;
  warningHours: number;
  isOverdue: boolean;
  overdueReason: string;
  nextAction: string;
  version: number;
  remark: string;
  returnReason: string;
}

export interface AuditLog {
  id: string;
  orderId: string;
  orderNo: string;
  userId: string;
  userName: string;
  role: Role;
  action: string;
  detail: string;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
  time: string;
  ip: string;
}

export interface BatchResultItem {
  orderId: string;
  orderNo: string;
  success: boolean;
  reason: string;
  nextStep: string;
}

export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  items: BatchResultItem[];
}

export interface Statistics {
  totalCount: number;
  pendingCount: number;
  processingCount: number;
  overdueCount: number;
  archivedCount: number;
  warningCount: number;
}

export const STATUS_TEXT: Record<OrderStatus, string> = {
  draft: '草稿',
  pending: '待审核',
  returned: '已退回',
  processing: '待复核',
  reviewed: '已复核',
  archived: '已归档',
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  draft: '#999',
  pending: '#faad14',
  returned: '#ff4d4f',
  processing: '#1890ff',
  reviewed: '#722ed1',
  archived: '#52c41a',
};

export const ROLE_TEXT: Record<Role, string> = {
  registrar: '跨境登记员',
  supervisor: '跨境审核主管',
  reviewer: '跨境电商复核负责人',
};
