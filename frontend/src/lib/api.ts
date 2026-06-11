const API_BASE = 'http://localhost:8001'

export type Role = 'receptionist' | 'room_supervisor' | 'duty_manager'
export type OrderStatus = 'pending_supplement' | 'pending_verification' | 'pending_review' | 'archived'
export type EvidenceStage = 'registration' | 'verification' | 'archive'
export type BlockCode = 'wrong_role' | 'wrong_status' | 'missing_evidence' | 'version_conflict' | 'duplicate_supplement' | 'archived' | 'not_found' | 'unknown'
export type ActionTarget = 'goto_detail' | 'switch_role' | 'refresh_version' | 'add_evidence' | 'continue_verify' | 'continue_review' | 'continue_supplement' | 'no_action'
export type ResolveStatus = 'pending' | 'resolved' | 'ignored'

export interface ActionPayload {
  targetRole?: Role
  orderId?: string
  scrollTo?: 'evidence' | 'action'
}

export interface BlockAttempt {
  id: string
  order_id: string
  operator_id: string
  operator_role: Role
  action_attempted: 'supplement' | 'verify' | 'review'
  code: BlockCode
  reason: string
  action_hint: string
  action_target?: ActionTarget
  action_payload?: string | null
  submitted_version: number | null
  current_version: number
  resolve_status?: ResolveStatus
  resolve_remark?: string | null
  resolved_at?: string | null
  created_at: string
}

const BLOCK_DEFAULT_ACTION_TARGET: Record<BlockCode, ActionTarget> = {
  wrong_role: 'switch_role',
  wrong_status: 'goto_detail',
  missing_evidence: 'add_evidence',
  version_conflict: 'refresh_version',
  duplicate_supplement: 'continue_verify',
  archived: 'no_action',
  not_found: 'no_action',
  unknown: 'no_action',
}

export function parseActionPayloadJSON(payload: string | null | undefined): ActionPayload {
  if (!payload) return {}
  try {
    return JSON.parse(payload)
  } catch {
    return {}
  }
}

export function normalizeBlockAttempt(b: BlockAttempt): BlockAttempt & {
  action_target: ActionTarget
  resolve_status: ResolveStatus
  parsedActionPayload: ActionPayload
} {
  const code = b.code || 'unknown'
  const actionTarget = b.action_target || BLOCK_DEFAULT_ACTION_TARGET[code] || 'goto_detail'
  const parsedPayload = parseActionPayloadJSON(b.action_payload)
  if (!parsedPayload.orderId && b.order_id) parsedPayload.orderId = b.order_id
  if (actionTarget === 'switch_role' && !parsedPayload.targetRole) {
    if (b.action_attempted === 'supplement') parsedPayload.targetRole = 'receptionist'
    else if (b.action_attempted === 'verify') parsedPayload.targetRole = 'room_supervisor'
    else if (b.action_attempted === 'review') parsedPayload.targetRole = 'duty_manager'
  }
  if (actionTarget === 'add_evidence' && !parsedPayload.scrollTo) parsedPayload.scrollTo = 'evidence'
  if ((actionTarget === 'continue_supplement' || actionTarget === 'continue_verify' || actionTarget === 'continue_review') && !parsedPayload.scrollTo) {
    parsedPayload.scrollTo = 'action'
  }
  return {
    ...b,
    action_target: actionTarget,
    resolve_status: b.resolve_status || 'pending',
    parsedActionPayload: parsedPayload,
  }
}

export function normalizeOrderBlockAttempts(order: Order): Order {
  if (!order.blockAttempts || order.blockAttempts.length === 0) return order
  return { ...order, blockAttempts: order.blockAttempts.map(normalizeBlockAttempt) }
}

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
  blockAttempts?: BlockAttempt[]
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
  actionHint?: string
  actionTarget?: ActionTarget
  actionPayload?: ActionPayload
  submittedVersion?: number | null
  currentVersion: number
}

export interface BatchActionResult {
  successes: BatchSuccessItem[]
  failures: BatchFailureItem[]
}

const BATCH_FAIL_DEFAULT_ACTION_TARGET: Record<string, ActionTarget> = {
  wrong_role: 'switch_role',
  wrong_status: 'goto_detail',
  missing_evidence: 'add_evidence',
  version_conflict: 'refresh_version',
  duplicate_supplement: 'continue_verify',
  archived: 'no_action',
  not_found: 'no_action',
  unknown: 'no_action',
}

export function normalizeBatchFailure(f: BatchFailureItem): BatchFailureItem & {
  actionHint: string
  actionTarget: ActionTarget
  actionPayload: ActionPayload
  submittedVersion: number | null
} {
  const code = f.code || 'unknown'
  const actionTarget = f.actionTarget || BATCH_FAIL_DEFAULT_ACTION_TARGET[code] || 'goto_detail'
  const existingPayload = f.actionPayload || {}
  const payload: ActionPayload = { ...existingPayload }
  if (!payload.orderId) payload.orderId = f.id
  return {
    ...f,
    actionHint: f.actionHint || f.reason,
    actionTarget,
    actionPayload: payload,
    submittedVersion: f.submittedVersion ?? null,
  }
}

export interface ApiError {
  error: string
  reason: string
  code?: string
  actionHint?: string
  actionTarget?: ActionTarget
  actionPayload?: ActionPayload
  currentVersion?: number
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
  const orders = await request<Order[]>(`/api/orders${query}`, { headers: authHeader(token) })
  return orders.map(normalizeOrderBlockAttempts)
}

export async function getOrder(token: string, id: string): Promise<Order> {
  const order = await request<Order>(`/api/orders/${id}`, { headers: authHeader(token) })
  return normalizeOrderBlockAttempts(order)
}

export async function createOrder(token: string, data: CreateOrderData): Promise<Order> {
  const order = await request<Order>('/api/orders', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return normalizeOrderBlockAttempts(order)
}

export async function supplementOrder(token: string, id: string, data: SupplementData): Promise<Order> {
  const order = await request<Order>(`/api/orders/${id}/supplement`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return normalizeOrderBlockAttempts(order)
}

export async function verifyOrder(token: string, id: string, data: VerifyData): Promise<Order> {
  const order = await request<Order>(`/api/orders/${id}/verify`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return normalizeOrderBlockAttempts(order)
}

export async function reviewOrder(token: string, id: string, data: ReviewData): Promise<Order> {
  const order = await request<Order>(`/api/orders/${id}/review`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
  return normalizeOrderBlockAttempts(order)
}

export async function batchAction(token: string, data: BatchActionData): Promise<BatchActionResult> {
  return request('/api/orders/batch-action', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(data),
  })
}
