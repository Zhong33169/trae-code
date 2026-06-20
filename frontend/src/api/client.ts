const BASE_URL = '/api'

export const ROLE_LABELS: Record<string, string> = {
  REGISTRAR: '政策兑现登记员',
  REVIEWER: '政策兑现审核主管',
  APPROVER: '园区招商中心复核负责人'
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待审核',
  PENDING_CORRECTION: '待补正',
  REVIEWED: '审核通过',
  APPROVED: '复核通过',
  ARCHIVED: '已归档',
  REJECTED: '已退回'
}

export const ATTACHMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '有效',
  REJECTED: '已驳回',
  SUPERSEDED: '已作废（已替换）'
}

export const ABNORMAL_LABELS: Record<string, string> = {
  MISSING_ATTACHMENT: '缺材料',
  TIMEOUT: '超时',
  REJECTED: '已退回'
}

export interface User {
  id: number
  username: string
  name: string
  role: string
  roleLabel: string
}

export interface PolicyOrder {
  id: number
  order_no: string
  title: string
  applicant: string
  amount: number
  status: string
  statusLabel: string
  abnormal_type: string | null
  abnormalLabel: string | null
  timeout_deadline: string | null
  reject_reason: string | null
  audit_remark: string | null
  result_content: string | null
  created_by: number
  creator_name: string
  created_at: string
  updated_at: string
  isTimeout: boolean
  hasAllAttachments: boolean
  valid_attachments: number
  required_attachments: number
}

export interface RequiredAttachmentDef {
  id: number
  order_id: number
  name: string
  sort_order: number
  has_active?: number
}

export interface Attachment {
  id: number
  order_id: number
  required_def_id: number | null
  parent_id: number | null
  name: string
  file_type: string
  file_size: number
  att_status: string
  statusLabel: string
  required: number
  rejected: number
  reject_reason: string | null
  version: number
  uploaded_by: number
  uploader_name: string
  def_name?: string
  def_sort?: number
  created_at: string
}

export interface AttachmentCompletion {
  def_id: number
  def_name: string
  sort_order: number
  attachment_id: number | null
  attachment_name: string | null
  att_status: string | null
  rejected: number | null
  reject_reason: string | null
  version: number | null
  created_at: string | null
}

export interface ReviewRecord {
  id: number
  order_id: number
  operator_id: number
  operator_name: string
  operator_role?: string
  action: string
  remark: string | null
  from_status: string | null
  to_status: string | null
  created_at: string
}

export interface AuditLog {
  id: number
  order_id: number
  operator_id: number
  operator_name: string
  operator_role: string
  action: string
  failure_reason: string | null
  detail: string | null
  created_at: string
  order_no?: string
  title?: string
}

const STORAGE_KEY = 'policy_current_user'

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as User
  } catch {}
  return null
}

export function setCurrentUser(user: User): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function clearCurrentUser(): void {
  localStorage.removeItem(STORAGE_KEY)
}

function getCurrentUserId(): string | null {
  const user = getCurrentUser()
  return user ? String(user.id) : null
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  }
  const uid = getCurrentUserId()
  if (uid) {
    headers['X-User-Id'] = uid
  }
  
  const res = await fetch(BASE_URL + url, {
    ...options,
    headers
  })
  
  const data = await res.json()
  
  if (!res.ok) {
    throw new Error(data.error || '请求失败')
  }
  
  return data as T
}

export const api = {
  auth: {
    login: (username: string, password: string) => 
      request<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      }),
    getUsers: () => request<{ users: User[] }>('/auth/users'),
    switchRole: (userId: number) =>
      request<{ user: User }>('/auth/switch-role', {
        method: 'POST',
        body: JSON.stringify({ userId })
      })
  },
  
  orders: {
    list: (params?: { status?: string; abnormal?: string; role?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.status) searchParams.set('status', params.status)
      if (params?.abnormal) searchParams.set('abnormal', params.abnormal)
      if (params?.role) searchParams.set('role', params.role)
      const qs = searchParams.toString()
      return request<{ orders: PolicyOrder[] }>(`/orders${qs ? '?' + qs : ''}`)
    },
    get: (id: number) =>
      request<{ 
        order: PolicyOrder
        requiredDefs: RequiredAttachmentDef[]
        attachments: Attachment[]
        groupedAttachments: Record<string, Attachment[]>
        attachmentCompletion: AttachmentCompletion[]
        reviews: ReviewRecord[]
        audits: AuditLog[]
      }>(`/orders/${id}`),
    create: (data: { title: string; applicant: string; amount: number; requiredAttachmentNames?: string[]; userId?: number }) =>
      request<{ id: number; orderNo: string }>('/orders', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    update: (id: number, data: { title: string; applicant: string; amount: number }) =>
      request<{ success: boolean }>(`/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    delete: (id: number) =>
      request<{ success: boolean }>(`/orders/${id}`, {
        method: 'DELETE'
      }),
    batchResult: (data: { orderIds: number[]; action: string; userId?: number; remark?: string }) =>
      request<{ success: boolean; summary: string; results: any[] }>('/orders/batch-result', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },
  
  attachments: {
    add: (data: { orderId: number; name: string; fileType: string; fileSize: number; required?: boolean; requiredDefId?: number; userId?: number }) =>
      request<{ attachment: Attachment }>('/attachments', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    reupload: (id: number, data: { name: string; fileType: string; fileSize: number; userId?: number }) =>
      request<{ attachment: Attachment; oldRejectReason: string | null; replacedAttachmentId: number }>(`/attachments/${id}/reupload`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    update: (id: number, data: { name: string; fileType: string; fileSize: number; userId?: number }) =>
      request<{ attachment: Attachment }>(`/attachments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    reject: (id: number, data: { rejectReason: string; userId?: number }) =>
      request<{ attachment: Attachment }>(`/attachments/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    delete: (id: number) =>
      request<{ success: boolean }>(`/attachments/${id}`, {
        method: 'DELETE'
      }),
    getRequiredDefs: (orderId: number) =>
      request<{ defs: RequiredAttachmentDef[] }>(`/attachments/required-defs/${orderId}`)
  },
  
  review: {
    submit: (data: { orderId: number; userId?: number; remark?: string }) =>
      request<{ success: boolean; status: string }>('/review/submit', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    correctionSubmit: (data: { orderId: number; userId?: number; remark?: string }) =>
      request<{ success: boolean; status: string }>('/review/correction/submit', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    reviewApprove: (data: { orderId: number; userId?: number; remark?: string; auditRemark?: string }) =>
      request<{ success: boolean; status: string }>('/review/review/approve', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    reviewReject: (data: { orderId: number; userId?: number; remark?: string; rejectReason?: string; failureReason?: string; timeoutDays?: number }) =>
      request<{ success: boolean; status: string }>('/review/review/reject', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    approverApprove: (data: { orderId: number; userId?: number; remark?: string; resultContent?: string; auditRemark?: string }) =>
      request<{ success: boolean; status: string }>('/review/approver/approve', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    approverReject: (data: { orderId: number; userId?: number; remark?: string; rejectReason?: string; failureReason?: string }) =>
      request<{ success: boolean; status: string }>('/review/approver/reject', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    archive: (data: { orderId: number; userId?: number; remark?: string; auditRemark?: string }) =>
      request<{ success: boolean; status: string }>('/review/approver/archive', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },
  
  audit: {
    list: (params?: { orderId?: number; operatorId?: number }) => {
      const searchParams = new URLSearchParams()
      if (params?.orderId) searchParams.set('orderId', String(params.orderId))
      if (params?.operatorId) searchParams.set('operatorId', String(params.operatorId))
      const qs = searchParams.toString()
      return request<{ logs: AuditLog[] }>(`/audit${qs ? '?' + qs : ''}`)
    },
    failures: () => request<{ logs: AuditLog[] }>('/audit/failures')
  }
}
