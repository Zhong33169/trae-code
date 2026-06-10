const API_BASE = 'http://localhost:8001'

export type Role = 'receptionist' | 'room_supervisor' | 'duty_manager'
export type OrderStatus = 'pending_supplement' | 'pending_verification' | 'pending_review' | 'archived'
export type EvidenceStage = 'registration' | 'verification' | 'archive'

export interface User {
  id: string
  username: string
  role: Role
}

export interface EvidenceItem {
  id: string
  order_id: string
  stage: EvidenceStage
  type: string
  description: string
  created_at: string
}

export interface AuditLog {
  id: string
  order_id: string
  action: string
  operator_id: string
  operator_role: Role
  detail: string
  created_at: string
}

export interface Order {
  id: string
  order_no: string
  guest_name: string
  guest_phone: string | null
  room_number: string | null
  supplement_reason: string | null
  status: OrderStatus
  version: number
  created_by: string
  created_at: string
  updated_at: string
  evidenceItems?: EvidenceItem[]
  auditLogs?: AuditLog[]
}

export interface CreateOrderData {
  guestName: string
  guestPhone?: string
  roomNumber?: string
  supplementReason?: string
}

export interface SupplementData {
  version: number
  guestName: string
  guestPhone?: string
  roomNumber?: string
  supplementReason?: string
  evidenceItems: { type: string; description: string }[]
}

export interface VerifyData {
  version: number
  verified: boolean
  evidenceItems?: { type: string; description: string }[]
  remark?: string
}

export interface ReviewData {
  version: number
  approved: boolean
  evidenceItems?: { type: string; description: string }[]
  remark?: string
}

export interface BatchActionData {
  orders: { id: string; version: number }[]
  action: 'supplement' | 'verify' | 'review'
  evidenceItems?: { type: string; description: string }[]
  verified?: boolean
  approved?: boolean
  remark?: string
}

export interface BatchSuccessItem {
  id: string
  order_no: string
}

export interface BatchFailureItem {
  id: string
  order_no?: string
  reason: string
  code: string
}

export interface BatchActionResult {
  successes: BatchSuccessItem[]
  failures: BatchFailureItem[]
}

export interface ApiError {
  error: string
  reason: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: '请求失败', reason: `HTTP ${res.status}` }))
    throw body as ApiError
  }
  return res.json()
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function getMe(token: string): Promise<User> {
  return request('/api/auth/me', { headers: authHeader(token) })
}

export async function getOrders(token: string, filters?: { status?: string }): Promise<Order[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  const query = params.toString() ? `?${params.toString()}` : ''
  return request(`/api/orders${query}`, { headers: authHeader(token) })
}

export async function getOrder(token: string, id: string): Promise<Order> {
  return request(`/api/orders/${id}`, { headers: authHeader(token) })
}

export async function createOrder(token: string, data: CreateOrderData): Promise<Order> {
  return request('/api/orders', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
}

export async function supplementOrder(token: string, id: string, data: SupplementData): Promise<Order> {
  return request(`/api/orders/${id}/supplement`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
}

export async function verifyOrder(token: string, id: string, data: VerifyData): Promise<Order> {
  return request(`/api/orders/${id}/verify`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
}

export async function reviewOrder(token: string, id: string, data: ReviewData): Promise<Order> {
  return request(`/api/orders/${id}/review`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
}

export async function batchAction(token: string, data: BatchActionData): Promise<BatchActionResult> {
  return request('/api/orders/batch-action', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
}
