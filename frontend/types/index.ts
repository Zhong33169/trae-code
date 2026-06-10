export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  department?: string;
}

export type UserRole = 'registrar' | 'supervisor' | 'reviewer';

export const UserRoleLabels: Record<UserRole, string> = {
  registrar: '团购登记员',
  supervisor: '团购审核主管',
  reviewer: '社区团购平台复核负责人',
};

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  groupBuyPrice?: number;
  stock: number;
  minGroupQuantity: number;
  unit?: string;
  category?: string;
  status: ProductStatus;
  imageUrl?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductStatus = 'draft' | 'on_shelf' | 'off_shelf';

export const ProductStatusLabels: Record<ProductStatus, string> = {
  draft: '草稿',
  on_shelf: '已上架',
  off_shelf: '已下架',
};

export type OrderStatus =
  | 'draft'
  | 'pending_review'
  | 'review_approved'
  | 'review_rejected'
  | 'pending_final_review'
  | 'final_approved'
  | 'final_rejected'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'signed'
  | 'archived'
  | 'exception'
  | 'materials_missing'
  | 'timeout'
  | 'returned';

export const OrderStatusLabels: Record<OrderStatus, string> = {
  draft: '草稿',
  pending_review: '待审核',
  review_approved: '审核通过',
  review_rejected: '审核退回',
  pending_final_review: '待复核',
  final_approved: '复核通过',
  final_rejected: '复核退回',
  processing: '处理中',
  shipped: '已发货',
  delivered: '已配送',
  signed: '已签收',
  archived: '已归档',
  exception: '异常',
  materials_missing: '材料缺失',
  timeout: '超时',
  returned: '已退回',
};

export type OrderSource = 'online' | 'offline_import';

export const OrderSourceLabels: Record<OrderSource, string> = {
  online: '线上创建',
  offline_import: '离线导入',
};

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
  subtotal: number;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNo: string;
  communityName: string;
  contactName?: string;
  contactPhone?: string;
  deliveryAddress?: string;
  totalAmount: number;
  totalQuantity: number;
  status: OrderStatus;
  source: OrderSource;
  remark?: string;
  rejectReason?: string;
  auditRemark?: string;
  signedAt?: string;
  expectedDeliveryDate?: string;
  createdById: string;
  createdBy?: User;
  reviewedById?: string;
  reviewedBy?: User;
  reviewedAt?: string;
  finalReviewedById?: string;
  finalReviewedBy?: User;
  finalReviewedAt?: string;
  importBatchId?: string;
  items?: OrderItem[];
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export type AttachmentType = 'proof' | 'receipt' | 'material' | 'other';

export const AttachmentTypeLabels: Record<AttachmentType, string> = {
  proof: '证明材料',
  receipt: '签收单',
  material: '补充材料',
  other: '其他',
};

export interface Attachment {
  id: string;
  orderId?: string;
  importBatchId?: string;
  filename: string;
  originalName: string;
  mimeType?: string;
  size: number;
  type: AttachmentType;
  uploadedById?: string;
  createdAt: string;
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'submit'
  | 'review_approve'
  | 'review_reject'
  | 'final_approve'
  | 'final_reject'
  | 'ship'
  | 'deliver'
  | 'sign'
  | 'archive'
  | 'return'
  | 'rectify'
  | 'import'
  | 'exception'
  | 'delete';

export const AuditActionLabels: Record<AuditAction, string> = {
  create: '创建',
  update: '更新',
  submit: '提交',
  review_approve: '审核通过',
  review_reject: '审核退回',
  final_approve: '复核通过',
  final_reject: '复核退回',
  ship: '发货',
  deliver: '配送',
  sign: '签收',
  archive: '归档',
  return: '退回',
  rectify: '补正',
  import: '导入',
  exception: '异常',
  delete: '删除',
};

export interface AuditLog {
  id: string;
  orderId?: string;
  userId?: string;
  user?: User;
  action: AuditAction;
  description?: string;
  beforeData?: any;
  afterData?: any;
  failReason?: string;
  success: boolean;
  ipAddress?: string;
  createdAt: string;
}

export type ImportBatchStatus = 'pending' | 'processing' | 'partial_success' | 'success' | 'failed';

export const ImportBatchStatusLabels: Record<ImportBatchStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  partial_success: '部分成功',
  success: '全部成功',
  failed: '全部失败',
};

export type ImportSource = 'excel' | 'csv' | 'manual';

export const ImportSourceLabels: Record<ImportSource, string> = {
  excel: 'Excel导入',
  csv: 'CSV导入',
  manual: '手工录入',
};

export interface ImportBatch {
  id: string;
  batchNo: string;
  source: ImportSource;
  status: ImportBatchStatus;
  filename: string;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  conflictCount: number;
  skippedCount: number;
  remark?: string;
  importedById: string;
  importedBy?: User;
  createdAt: string;
}

export type ImportRecordStatus = 'pending' | 'success' | 'failed' | 'conflict' | 'skipped';

export const ImportRecordStatusLabels: Record<ImportRecordStatus, string> = {
  pending: '待处理',
  success: '成功',
  failed: '失败',
  conflict: '冲突',
  skipped: '跳过',
};

export interface ImportRecord {
  id: string;
  batchId: string;
  orderId?: string;
  order?: Order;
  rowNumber: number;
  sourceOrderNo?: string;
  status: ImportRecordStatus;
  failReason?: string;
  conflictDescription?: string;
  rawData?: any;
  differences?: any;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}
