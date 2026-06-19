import { API_BASE } from '~/app/constants'

export interface ApiResp<T> {
  success: boolean
  message: string
  data?: T
}

export interface User {
  id: string
  username: string
  role: string
  real_name: string
  created_at: string
}

export interface LoginResp {
  token: string
  user: User
  message: string
}

export interface SeedRecord {
  id: string
  batch_no: string
  seed_type: string
  seed_species: string
  quantity: number
  unit: string
  source: string
  supplier?: string
  register_id: string
  register_name: string
  register_time: string
  current_node: string
  overall_status: string
  pond_entry_time?: string
  pond_id?: string
  pond_quantity?: number
  survival_rate?: number
  survival_observe_time?: string
  archive_time?: string
  archive_remark?: string
  created_at: string
  updated_at: string
}

export interface NodeTracking {
  id: string
  record_id: string
  node_type: string
  node_name: string
  assignee_id?: string
  assignee_name?: string
  deadline: string
  status: string
  started_at?: string
  completed_at?: string
  is_timeout: boolean
  timeout_reason?: string
  follow_up_action?: string
  timeout_remark?: string
  remark?: string
  created_at: string
  updated_at: string
}

export interface OperationLog {
  id: string
  record_id?: string
  user_id: string
  user_name: string
  user_role: string
  action: string
  action_target: string
  detail?: string
  old_status?: string
  new_status?: string
  evidence_note?: string
  created_at: string
}

export interface SeedRecordDetail {
  record: SeedRecord
  nodes: NodeTracking[]
  logs: OperationLog[]
}

export interface ArchiveSummaryPublic {
  id: string
  record_id: string
  batch_no: string
  archive_time: string
  archive_remark: string
  reviewer_name: string
  total_duration_hours: number
  node_count: number
  completed_node_count: number
  timeout_node_count: number
  timeout_summary?: string
  node_duration_summary?: string
  final_status: string
  created_at: string
}

export interface PaginatedRecords {
  items: SeedRecord[]
  total: number
  page: number
  page_size: number
  timeout_count: number
}

export interface Statistics {
  total_records: number
  pending_count: number
  processing_count: number
  completed_count: number
  rejected_count: number
  timeout_count: number
  by_status: { status: string; status_label: string; count: number }[]
  by_node: { node: string; node_label: string; count: number; timeout_count: number }[]
  recent_trend: { date: string; new_count: number; completed_count: number }[]
}

const TOKEN_KEY = 'seed_tracking_token'
const USER_KEY = 'seed_tracking_user'

export const auth = {
  saveToken: (t: string, u: User) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(TOKEN_KEY, t)
      sessionStorage.setItem(USER_KEY, JSON.stringify(u))
    }
  },
  getToken: () => {
    if (typeof window === 'undefined') return ''
    return sessionStorage.getItem(TOKEN_KEY) || ''
  },
  getUser: (): User | null => {
    if (typeof window === 'undefined') return null
    const s = sessionStorage.getItem(USER_KEY)
    return s ? JSON.parse(s) : null
  },
  clear: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(USER_KEY)
    }
  },
}

const headers = (more?: Record<string, string>) => {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...(more || {}) }
  const t = auth.getToken()
  if (t) h.Authorization = `Bearer ${t}`
  return h
}

async function req<T>(path: string, init: RequestInit = {}): Promise<ApiResp<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers: headers(init.headers as any) })
    if (res.status === 401) {
      auth.clear()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      return { success: false, message: '登录已过期，请重新登录' } as ApiResp<T>
    }
    const text = await res.text()
    let data: ApiResp<T>
    try { data = JSON.parse(text) } catch { data = { success: res.ok, message: text || '请求失败' } as ApiResp<T> }
    if (!data.message) data.message = res.ok ? '操作成功' : '请求失败'
    return data
  } catch (e: any) {
    return { success: false, message: `网络异常：${e?.message || e}` } as ApiResp<T>
  }
}

export const api = {
  login: (username: string, password: string) =>
    req<LoginResp>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => req<User>('/auth/me'),

  listRecords: (params?: { status?: string; node?: string; keyword?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.node) q.set('node', params.node)
    if (params?.keyword) q.set('keyword', params.keyword)
    if (params?.page) q.set('page', String(params.page))
    if (params?.page_size) q.set('page_size', String(params.page_size))
    const qs = q.toString()
    return req<PaginatedRecords>(`/records/${qs ? '?' + qs : ''}`)
  },
  getRecord: (id: string) => req<SeedRecordDetail>(`/records/${id}`),
  createRecord: (body: any) =>
    req<SeedRecordDetail>('/records/', { method: 'POST', body: JSON.stringify(body) }),
  updateRecord: (id: string, body: any) =>
    req<SeedRecordDetail>(`/records/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  approveAudit: (id: string, body: any = {}) =>
    req<SeedRecordDetail>(`/records/${id}/approve-audit`, { method: 'POST', body: JSON.stringify(body) }),
  rejectAudit: (id: string, body: any) =>
    req<SeedRecordDetail>(`/records/${id}/reject-audit`, { method: 'POST', body: JSON.stringify(body) }),
  pondEntry: (id: string, body: any) =>
    req<SeedRecordDetail>(`/records/${id}/pond-entry`, { method: 'POST', body: JSON.stringify(body) }),
  survivalObserve: (id: string, body: any) =>
    req<SeedRecordDetail>(`/records/${id}/survival-observe`, { method: 'POST', body: JSON.stringify(body) }),
  archive: (id: string, body: any) =>
    req<SeedRecordDetail>(`/records/${id}/archive`, { method: 'POST', body: JSON.stringify(body) }),
  getArchiveSummary: (id: string) =>
    req<ArchiveSummaryPublic>(`/records/${id}/archive-summary`),
  handleTimeout: (id: string, body: any) =>
    req<SeedRecordDetail>(`/records/${id}/handle-timeout`, { method: 'POST', body: JSON.stringify(body) }),
  batchAction: (body: any) =>
    req<any>('/records/batch', { method: 'POST', body: JSON.stringify(body) }),

  listLogs: (params?: { record_id?: string; user_id?: string; action?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams()
    if (params?.record_id) q.set('record_id', params.record_id)
    if (params?.user_id) q.set('user_id', params.user_id)
    if (params?.action) q.set('action', params.action)
    if (params?.page) q.set('page', String(params.page))
    if (params?.page_size) q.set('page_size', String(params.page_size))
    return req<any>(`/logs/${q.toString() ? '?' + q.toString() : ''}`)
  },

  stats: () => req<Statistics>('/stats/overview'),
}
