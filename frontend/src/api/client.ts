const BASE_URL = '/api'

export const ROLE_LABELS: Record<string, string> = {
  REGISTRAR: '政策兑现登记员',
  REVIEWER: '政策兑现审核主管',
  APPROVER: '园区招商中心复核负责人'
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

export interface Attachment {
  id: number
  order_id: number
  name: string
  file_type: string
  file_size: number
  required: number
  rejected: number
  reject_reason: string | null
  uploaded_by: number
  uploader_name: string
  created_at: string
}

export interface ReviewRecord {
  id: number
  order_id: number
  operator_id: number
  operator_name: string
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

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE_URL + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
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
      request<{ order: PolicyOrder; attachments: Attachment[]; reviews: ReviewRecord[]; audits: AuditLog[] }>(`/orders/${id}`),
    create: (data: { title: string; applicant: string; amount: number; userId: number }) =>
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
    batchResult: (data: { orderIds: number[]; action: string; userId: number; remark?: string }) =>
      request<{ success: boolean; summary: string; results: any[] }>('/orders/batch-result', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },
  
  attachments: {
    add: (data: { orderId: number; name: string; fileType: string; fileSize: number; required: boolean; userId: number }) =>
      request<{ attachment: Attachment }>('/attachments', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    update: (id: number, data: { name: string; fileType: string; fileSize: number; userId: number }) =>
      request<{ attachment: Attachment }>(`/attachments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    reject: (id: number, data: { rejectReason: string; userId: number }) =>
      request<{ attachment: Attachment }>(`/attachments/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    delete: (id: number) =>
      request<{ success: boolean }>(`/attachments/${id}`, {
        method: 'DELETE'
      })
  },
  
  review: {
    submit: (data: { orderId: number; userId: number; remark?: string }) =>
      request<{ success: boolean; status: string }>('/review/submit', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    correctionSubmit: (data: { orderId: number; userId: number; remark?: string }) =>
      request<{ success: boolean; status: string }>('/review/correction/submit', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    reviewApprove: (data: { orderId: number; userId: number; remark?: string; auditRemark?: string }) =>
      request<{ success: boolean; status: string }>('/review/review/approve', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    reviewReject: (data: { orderId: number; userId: number; remark?: string; rejectReason?: string; failureReason?: string; timeoutDays?: number }) =>
      request<{ success: boolean; status: string }>('/review/review/reject', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    approverApprove: (data: { orderId: number; userId: number; remark?: string; resultContent?: string; auditRemark?: string }) =>
      request<{ success: boolean; status: string }>('/review/approver/approve', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    approverReject: (data: { orderId: number; userId: number; remark?: string; rejectReason?: string; failureReason?: string }) =>
      request<{ success: boolean; status: string }>('/review/approver/reject', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    archive: (data: { orderId: number; userId: number; remark?: string; auditRemark?: string }) =>
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
