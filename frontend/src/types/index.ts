export type Role = 'registrar' | 'supervisor' | 'reviewer';

export interface User {
  id: string;
  username: string;
  role: Role;
  name: string;
}

export type OrderStatus = 'draft' | 'pending' | 'returned' | 'processing' | 'reviewed' | 'archived';

export type ListingStatus = 'not_listed' | 'active' | 'listing_failed' | 'delisted';

export type InventoryStatus = 'not_synced' | 'synced' | 'insufficient' | 'sync_failed';

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

export interface BlockReason {
  field: 'deadline' | 'listing' | 'inventory' | 'materials';
  reason: string;
  level: 'error' | 'warning' | 'info';
}

export interface ManualDisposition {
  userId: string;
  userName: string;
  role: Role;
  action: 'archive' | 'return';
  reason: string;
  approvalDoc: string;
  time: string;
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
  listingStatus: ListingStatus;
  inventoryStatus: InventoryStatus;
  inventoryQuantity: number;
  listingUrl: string;
  registrarId: string;
  registrarName: string;
  supervisorId?: string;
  supervisorName?: string;
  reviewerId?: string;
  reviewerName?: string;
  materials: Material[];
  opinions: OrderOpinion[];
  blockReasons: BlockReason[];
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
  manualDispositions: ManualDisposition[];
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
  blockReasons?: BlockReason[];
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
  blockedCount: number;
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

export const LISTING_TEXT: Record<ListingStatus, string> = {
  not_listed: '未刊登',
  active: '刊登正常',
  listing_failed: '刊登失败',
  delisted: '已下架',
};

export const LISTING_COLOR: Record<ListingStatus, string> = {
  not_listed: '#999',
  active: '#52c41a',
  listing_failed: '#ff4d4f',
  delisted: '#faad14',
};

export const INVENTORY_TEXT: Record<InventoryStatus, string> = {
  not_synced: '未同步',
  synced: '同步正常',
  insufficient: '库存不足',
  sync_failed: '同步失败',
};

export const INVENTORY_COLOR: Record<InventoryStatus, string> = {
  not_synced: '#999',
  synced: '#52c41a',
  insufficient: '#ff4d4f',
  sync_failed: '#faad14',
};

export const BLOCK_FIELD_TEXT: Record<BlockReason['field'], string> = {
  deadline: '处理时限',
  listing: '商品刊登',
  inventory: '库存同步',
  materials: '材料清单',
};

export const ROLE_TEXT: Record<Role, string> = {
  registrar: '跨境登记员',
  supervisor: '跨境审核主管',
  reviewer: '跨境电商复核负责人',
};
