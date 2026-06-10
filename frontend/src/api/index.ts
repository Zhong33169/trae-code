import { get, post, put, del } from '../utils/request'
import {
  LeaseApplication,
  User,
  Statistics,
  PageResult,
  NodeTimeLimit,
  Attachment,
  OperationLog,
} from '../types'

export const authApi = {
  login: (data: { username: string; password: string }) =>
    post<{ token: string; expiresAt: string; user: User }>('/login', data),

  logout: () => post('/logout'),

  getCurrentUser: () => get<User>('/me'),

  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    post('/change-password', data),
}

export const applicationApi = {
  getList: (params: {
    page?: number
    pageSize?: number
    status?: string
    keyword?: string
    isOverdue?: string
    currentNode?: string
  }) => get<PageResult<Partial<LeaseApplication>>>('/applications', params),

  getDetail: (id: number) => get<LeaseApplication>(`/applications/${id}`),

  create: (data: any) => post<{ id: number; applicationNo: string; status: string }>('/applications', data),

  update: (id: number, data: any) => put(`/applications/${id}`, data),

  submit: (id: number, data?: { remark?: string; overdueReason?: string; followUpAction?: string }) =>
    post<{ id: number; status: string; statusName: string }>(`/applications/${id}/submit`, data),

  review: (id: number, data: {
    action: 'approve' | 'return' | 'reject'
    reviewResult?: string
    returnReason?: string
    rejectReason?: string
    overdueReason?: string
    followUpAction?: string
  }) => post<{ id: number; status: string; statusName: string }>(`/applications/${id}/review`, data),

  roomConfirm: (id: number, data: {
    action: 'confirm' | 'problem'
    confirmResult: string
    overdueReason?: string
    followUpAction?: string
  }) => post<{ id: number; status: string; statusName: string }>(`/applications/${id}/room-confirm`, data),

  handover: (id: number, data: {
    action: 'complete' | 'problem'
    handoverResult: string
    overdueReason?: string
    followUpAction?: string
  }) => post<{ id: number; status: string; statusName: string }>(`/applications/${id}/handover`, data),

  archive: (id: number, data: { action: 'archive'; remark?: string; overdueReason?: string; followUpAction?: string }) =>
    post<{ id: number; status: string; statusName: string }>(`/applications/${id}/archive`, data),

  recordOverdue: (id: number, data: {
    overdueReason: string
    followUpAction: string
    nodeType?: string
  }) => post(`/applications/${id}/overdue-record`, data),

  batchStatus: (ids: number[]) =>
    post<Array<{ id: number; status: string; statusName: string; currentNode: string; currentNodeName: string; isOverdue: boolean }>>(
      '/applications/batch-status',
      { ids }
    ),
}

export const attachmentApi = {
  upload: (formData: FormData) =>
    post<Attachment>('/attachments/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id: number) => del(`/attachments/${id}`),
}

export const statsApi = {
  getOverview: () => get<Statistics>('/stats/overview'),

  getLogs: (params: { applicationId?: string; page?: number; pageSize?: number }) =>
    get<PageResult<OperationLog>>('/stats/logs', params),
}

export const systemApi = {
  getNodeLimits: () => get<NodeTimeLimit[]>('/node-limits'),
}
