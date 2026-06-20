import type { Appointment, AppointmentDetail, ApiError, BatchResult, BatchResultWithId, BatchSummary, BatchDetail, Evidence, EvidenceType } from './types'

async function request<T>(path: string, options: RequestInit = {}): Promise<T | ApiError> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  try {
    const res = await fetch(`/api${path}`, { ...options, headers })
    const data = await res.json()
    if (!res.ok) {
      return data as ApiError
    }
    return data as T
  } catch {
    return { code: 'NOT_FOUND', message: '网络请求失败' } as ApiError
  }
}

export function isApiError<T>(result: T | ApiError): result is ApiError {
  return (result as ApiError).code !== undefined && (result as ApiError).message !== undefined
}

export async function login(username: string, password: string) {
  return request<{ token: string; user: { username: string; role: string; display_name: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function fetchAppointments(params: { status?: string; keyword?: string }) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.keyword) query.set('keyword', params.keyword)
  return request<Appointment[]>(`/appointments?${query.toString()}`)
}

export async function fetchAppointmentDetail(id: string) {
  return request<AppointmentDetail>(`/appointments/${id}`)
}

export async function createAppointment(data: {
  visitor_name: string
  visitor_phone: string
  visitor_id_number: string
  exhibition_name: string
}) {
  return request<Appointment>('/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function correctAppointment(id: string, data: {
  visitor_name: string
  visitor_phone: string
  visitor_id_number: string
  exhibition_name: string
  version: number
}) {
  return request<Appointment>(`/appointments/${id}/correct`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function reviewAppointment(id: string, data: { action: 'approve' | 'reject'; version: number; detail?: string }) {
  return request<Appointment>(`/appointments/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function archiveAppointment(id: string, data: { action: 'archive' | 'reject'; version: number; detail?: string }) {
  return request<Appointment>(`/appointments/${id}/archive`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function batchReview(data: { items: { id: string; version: number }[]; action: 'approve' | 'reject'; comment?: string }) {
  return request<BatchResultWithId>('/appointments/batch-review', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function batchArchive(data: { items: { id: string; version: number }[]; action: 'archive' | 'reject'; comment?: string }) {
  return request<BatchResultWithId>('/appointments/batch-archive', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function fetchBatches(params?: { action_type?: 'batch_review' | 'batch_archive'; limit?: number }) {
  const q = new URLSearchParams()
  if (params?.action_type) q.set('action_type', params.action_type)
  if (params?.limit) q.set('limit', String(params.limit))
  return request<BatchSummary[]>(`/batches${q.toString() ? `?${q.toString()}` : ''}`)
}

export async function fetchBatchDetail(id: string) {
  return request<BatchDetail>(`/batches/${id}`)
}

export async function fetchEvidence(appointmentId: string, type?: EvidenceType) {
  const query = type ? `?type=${type}` : ''
  return request<Evidence[]>(`/appointments/${appointmentId}/evidence${query}`)
}

export async function addEvidence(appointmentId: string, data: { type: EvidenceType; content: string }) {
  return request<Evidence>(`/appointments/${appointmentId}/evidence`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
