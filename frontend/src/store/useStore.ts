import { create } from 'zustand'
import {
  login as apiLogin,
  getOrders as apiGetOrders,
  type User,
  type Order,
  type OrderStatus,
  type ApiError,
} from '@/lib/api'

interface AppState {
  currentUser: User | null
  token: string | null
  orders: Order[]
  selectedOrderId: string | null
  statusFilter: string
  selectedOrderIds: string[]
  loading: boolean
  error: string | null

  login: (username: string, password: string) => Promise<void>
  logout: () => void
  setOrders: (orders: Order[]) => void
  setSelectedOrderId: (id: string | null) => void
  setStatusFilter: (filter: string) => void
  toggleOrderSelection: (id: string) => void
  clearSelection: () => void
  fetchOrders: () => Promise<void>
  setError: (error: string | null) => void
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: null,
  token: null,
  orders: [],
  selectedOrderId: null,
  statusFilter: 'all',
  selectedOrderIds: [],
  loading: false,
  error: null,

  login: async (username: string, password: string) => {
    try {
      set({ loading: true, error: null })
      const result = await apiLogin(username, password)
      set({
        token: result.token,
        currentUser: result.user,
        loading: false,
        selectedOrderId: null,
        selectedOrderIds: [],
      })
    } catch (err) {
      const apiErr = err as ApiError
      set({ loading: false, error: apiErr.error || '登录失败' })
      throw err
    }
  },

  logout: () => {
    set({
      currentUser: null,
      token: null,
      orders: [],
      selectedOrderId: null,
      statusFilter: 'all',
      selectedOrderIds: [],
      error: null,
    })
  },

  setOrders: (orders) => set({ orders }),

  setSelectedOrderId: (id) => set({ selectedOrderId: id }),

  setStatusFilter: (filter) => set({ statusFilter: filter, selectedOrderIds: [] }),

  toggleOrderSelection: (id) => {
    const current = get().selectedOrderIds
    if (current.includes(id)) {
      set({ selectedOrderIds: current.filter((oid) => oid !== id) })
    } else {
      set({ selectedOrderIds: [...current, id] })
    }
  },

  clearSelection: () => set({ selectedOrderIds: [] }),

  fetchOrders: async () => {
    const { token, statusFilter } = get()
    if (!token) return
    try {
      set({ loading: true })
      const filters: { status?: OrderStatus } = {}
      if (statusFilter !== 'all') {
        filters.status = statusFilter as OrderStatus
      }
      const orders = await apiGetOrders(token, filters)
      set({ orders, loading: false })
    } catch (err) {
      const apiErr = err as ApiError
      set({ loading: false, error: apiErr.error || '获取订单失败' })
    }
  },

  setError: (error) => set({ error }),
}))
