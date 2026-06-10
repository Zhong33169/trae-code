export type Role = 'registrar' | 'auditor' | 'reviewer'

export type ApplicationStatus =
  | 'draft'
  | 'pending_review'
  | 'returned'
  | 'reviewed'
  | 'pending_confirm'
  | 'room_confirmed'
  | 'pending_handover'
  | 'completed'
  | 'rejected'

export type NodeType =
  | 'contract_signing'
  | 'review'
  | 'room_confirm'
  | 'handover'
  | 'archive'

export interface User {
  id: number
  username: string
  realName: string
  role: Role
  roleName: string
}

export interface LeaseApplication {
  id: number
  applicationNo: string
  tenantName: string
  tenantIdCard: string
  tenantPhone: string
  apartmentName: string
  roomNo: string
  roomArea: number
  monthlyRent: number
  leaseStartDate: string
  leaseEndDate: string
  depositAmount: number
  paymentMethod: string
  status: ApplicationStatus
  statusName: string
  currentNode: NodeType
  currentNodeName: string
  isOverdue: boolean
  overdueReason: string
  followUpAction: string
  remark: string
  returnReason: string
  rejectReason: string
  reviewResult: string
  confirmResult: string
  handoverResult: string
  createdBy: number
  createdByName: string
  reviewedBy?: number
  reviewedByName?: string
  confirmedBy?: number
  confirmedByName?: string
  handedOverBy?: number
  handedOverByName?: string
  archivedBy?: number
  archivedByName?: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
  reviewedAt?: string
  confirmedAt?: string
  handedOverAt?: string
  completedAt?: string
  attachments?: Attachment[]
  nodeTimelines?: NodeTimeline[]
  operationLogs?: OperationLog[]
}

export interface Attachment {
  id: number
  applicationId: number
  fileName: string
  fileType: string
  fileSize: number
  fileUrl: string
  category: string
  uploadedBy: number
  uploadedByName: string
  createdAt: string
}

export interface NodeTimeline {
  id: number
  applicationId: number
  nodeType: NodeType
  nodeName: string
  startTime: string
  dueTime?: string
  endTime?: string
  timeLimitHours: number
  isOverdue: boolean
  overdueReason: string
  followUpAction: string
  handlerUserId?: number
  handlerName?: string
  status: string
  remark: string
  createdAt: string
  updatedAt: string
}

export interface OperationLog {
  id: number
  applicationId: number
  userId: number
  userName: string
  userRole: string
  operationType: string
  operationName: string
  oldStatus?: string
  newStatus?: string
  detail: string
  ipAddress?: string
  createdAt: string
}

export interface NodeTimeLimit {
  nodeType: NodeType
  nodeName: string
  timeLimitHours: number
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

export interface Statistics {
  total: number
  totalRent: number
  newThisMonth: number
  completedThisMonth: number
  overdueCount: number
  statusStats: Record<string, number>
  statusNames: Record<string, string>
  nodeStats: Record<string, number>
  apartmentStats: Array<{
    apartmentName: string
    count: number
    totalRent: number
  }>
  myPending: Record<string, number>
}
