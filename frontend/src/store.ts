import { create } from 'zustand'
import type { User, Appointment, AppointmentDetail, FilterState, Role, AppointmentStatus, ApiError, BatchResult, EvidenceType } from './types'
import * as api from './api'
import { isApiError } from './api'

const ROLE_DEFAULT_FILTER: Record<Role, AppointmentStatus> = {
  registrar: 'rejected_for_correction',
  reviewer: 'pending_review',
  archivist: 'pending_archive',
}

const DEMO_ACCOUNTS: Record<Role, { username: string; password: string; role: Role; display_name: string }> = {
  registrar: { username: 'registrar1', password: '123456', role: 'registrar', display_name: '登记员-张三' },
  reviewer: { username: 'reviewer1', password: '123456', role: 'reviewer', display_name: '审核主管-李四' },
  archivist: { username: 'archivist1', password: '123456', role: 'archivist', display_name: '复核负责人-王五' },
}

interface Toast {
  id: number
  message: string
  type: 'error' | 'success'
}

interface Store {
  user: User | null
  token: string | null
  appointments: Appointment[]
  currentAppointment: AppointmentDetail | null
  selectedIds: Set<string>
  filter: FilterState
  loading: boolean
  toasts: Toast[]
  toastId: number

  showToast: (message: string, type?: 'error' | 'success') => void
  removeToast: (id: number) => void

  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  switchRole: (role: Role) => Promise<boolean>

  setFilter: (filter: Partial<FilterState>) => void
  loadAppointments: () => Promise<void>
  loadAppointmentDetail: (id: string) => Promise<void>
  clearCurrentAppointment: () => void

  toggleSelect: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  removeSelection: (id: string) => void

  createAppointment: (data: {
    visitor_name: string
    visitor_phone: string
    visitor_id_number: string
    exhibition_name: string
  }) => Promise<boolean>

  correctAppointment: (id: string, data: {
    visitor_name: string
    visitor_phone: string
    visitor_id_number: string
    exhibition_name: string
    version: number
  }) => Promise<boolean>

  reviewAppointment: (id: string, action: 'approve' | 'reject', version: number) => Promise<boolean>
  archiveAppointment: (id: string, action: 'archive' | 'reject', version: number) => Promise<boolean>

  batchReview: (action: 'approve' | 'reject') => Promise<BatchResult[] | null>
  batchArchive: (action: 'archive' | 'reject') => Promise<BatchResult[] | null>

  addEvidence: (appointmentId: string, type: EvidenceType, content: string) => Promise<boolean>
}

export { DEMO_ACCOUNTS, ROLE_DEFAULT_FILTER }

export const useStore = create<Store>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  appointments: [],
  currentAppointment: null,
  selectedIds: new Set<string>(),
  filter: { status: '', keyword: '' },
  loading: false,
  toasts: [],
  toastId: 0,

  showToast: (message, type = 'error') => {
    const id = get().toastId + 1
    set((s) => ({ toastId: id, toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  login: async (username, password) => {
    const result = await api.login(username, password)
    if (isApiError(result)) {
      get().showToast(result.message)
      return false
    }
    const { token, user } = result
    const role = user.role as Role
    const fullUser: User = { username: user.username, role, display_name: user.display_name }
    localStorage.setItem('token', token)
    set({
      token,
      user: fullUser,
      filter: { status: ROLE_DEFAULT_FILTER[role], keyword: '' },
      selectedIds: new Set(),
      currentAppointment: null,
    })
    get().loadAppointments()
    return true
  },

  logout: () => {
    localStorage.removeItem('token')
    set({
      user: null,
      token: null,
      appointments: [],
      currentAppointment: null,
      selectedIds: new Set(),
      filter: { status: '', keyword: '' },
    })
  },

  switchRole: async (role) => {
    const account = DEMO_ACCOUNTS[role]
    if (!account) return false
    return get().login(account.username, account.password)
  },

  setFilter: (partial) => {
    set((s) => ({ filter: { ...s.filter, ...partial } }))
    get().loadAppointments()
  },

  loadAppointments: async () => {
    set({ loading: true })
    const { filter } = get()
    const result = await api.fetchAppointments({ status: filter.status, keyword: filter.keyword })
    set({ loading: false })
    if (isApiError(result)) {
      get().showToast(result.message)
      return
    }
    set({ appointments: result })
  },

  loadAppointmentDetail: async (id) => {
    const result = await api.fetchAppointmentDetail(id)
    if (isApiError(result)) {
      get().showToast(result.message)
      return
    }
    set({ currentAppointment: result })
  },

  clearCurrentAppointment: () => set({ currentAppointment: null }),

  toggleSelect: (id) => {
    set((s) => {
      const next = new Set(s.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedIds: next }
    })
  },

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),

  clearSelection: () => set({ selectedIds: new Set() }),

  removeSelection: (id) => {
    set((s) => {
      const next = new Set(s.selectedIds)
      next.delete(id)
      return { selectedIds: next }
    })
  },

  createAppointment: async (data) => {
    const result = await api.createAppointment(data)
    if (isApiError(result)) {
      get().showToast(result.message)
      return false
    }
    get().showToast('预约单创建成功', 'success')
    get().loadAppointments()
    return true
  },

  correctAppointment: async (id, data) => {
    const result = await api.correctAppointment(id, data)
    if (isApiError(result)) {
      if (result.code === 'VERSION_CONFLICT') {
        get().showToast('单据已被他人操作，请刷新')
      } else {
        get().showToast(result.message)
      }
      return false
    }
    get().showToast('补正成功', 'success')
    get().removeSelection(id)
    get().loadAppointments()
    if (get().currentAppointment?.id === id) {
      get().loadAppointmentDetail(id)
    }
    return true
  },

  reviewAppointment: async (id, action, version) => {
    const result = await api.reviewAppointment(id, { action, version })
    if (isApiError(result)) {
      if (result.code === 'VERSION_CONFLICT') {
        get().showToast('单据已被他人操作，请刷新')
      } else {
        get().showToast(result.message)
      }
      return false
    }
    get().showToast(action === 'approve' ? '审核通过' : '已退回', 'success')
    get().removeSelection(id)
    get().loadAppointments()
    if (get().currentAppointment?.id === id) {
      get().loadAppointmentDetail(id)
    }
    return true
  },

  archiveAppointment: async (id, action, version) => {
    const result = await api.archiveAppointment(id, { action, version })
    if (isApiError(result)) {
      if (result.code === 'VERSION_CONFLICT') {
        get().showToast('单据已被他人操作，请刷新')
      } else {
        get().showToast(result.message)
      }
      return false
    }
    get().showToast(action === 'archive' ? '归档成功' : '已退回', 'success')
    get().removeSelection(id)
    get().loadAppointments()
    if (get().currentAppointment?.id === id) {
      get().loadAppointmentDetail(id)
    }
    return true
  },

  batchReview: async (action) => {
    const { appointments, selectedIds } = get()
    const items = appointments
      .filter((a) => selectedIds.has(a.id))
      .map((a) => ({ id: a.id, version: a.version }))
    if (items.length === 0) return null
    const result = await api.batchReview({ items, action })
    if (isApiError(result)) {
      get().showToast(result.message)
      return null
    }
    get().loadAppointments()
    return result
  },

  batchArchive: async (action) => {
    const { appointments, selectedIds } = get()
    const items = appointments
      .filter((a) => selectedIds.has(a.id))
      .map((a) => ({ id: a.id, version: a.version }))
    if (items.length === 0) return null
    const result = await api.batchArchive({ items, action })
    if (isApiError(result)) {
      get().showToast(result.message)
      return null
    }
    get().loadAppointments()
    return result
  },

  addEvidence: async (appointmentId, type, content) => {
    const result = await api.addEvidence(appointmentId, { type, content })
    if (isApiError(result)) {
      get().showToast(result.message)
      return false
    }
    get().showToast('证据添加成功', 'success')
    if (get().currentAppointment?.id === appointmentId) {
      get().loadAppointmentDetail(appointmentId)
    }
    return true
  },
}))
