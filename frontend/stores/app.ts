import { defineStore } from 'pinia'
import type { User, TradeOrder, BatchOperation, OrderHistory, Evidence, BatchItemResult } from '~/types'

const API_BASE = 'http://localhost:8005/api'

interface AppState {
  currentUser: User | null
  allUsers: User[]
  orders: TradeOrder[]
  selectedOrderIds: number[]
  lastBatchResult: BatchOperation | null
  batchHistory: BatchOperation[]
}

function getHeaders(user: User | null): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (user) {
    h['x-user-id'] = String(user.id)
    h['x-role'] = user.role
  }
  return h
}

async function handleApiError(res: Response) {
  let data: any = null
  try {
    data = await res.json()
  } catch {}
  const msg = data?.detail?.message || data?.detail || `请求失败(${res.status})`
  throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    currentUser: null,
    allUsers: [],
    orders: [],
    selectedOrderIds: [],
    lastBatchResult: null,
    batchHistory: [],
  }),

  getters: {
    isSales: (s) => s.currentUser?.role === 'sales',
    isDoc: (s) => s.currentUser?.role === 'doc_supervisor',
    isManager: (s) => s.currentUser?.role === 'biz_manager',
  },

  actions: {
    async loadUsers() {
      const res = await fetch(`${API_BASE}/orders/users`)
      if (!res.ok) await handleApiError(res)
      this.allUsers = await res.json()
    },

    setUser(user: User) {
      this.currentUser = user
    },

    async loadOrders(status?: string, keyword?: string) {
      if (!this.currentUser) {
        this.orders = []
        return
      }
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (keyword) params.set('keyword', keyword)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`${API_BASE}/orders${qs}`, {
        headers: getHeaders(this.currentUser),
      })
      if (!res.ok) await handleApiError(res)
      this.orders = await res.json()
    },

    async getOrder(orderId: number): Promise<TradeOrder> {
      const res = await fetch(`${API_BASE}/orders/${orderId}`, {
        headers: getHeaders(this.currentUser),
      })
      if (!res.ok) await handleApiError(res)
      return await res.json()
    },

    async createOrder(payload: any): Promise<TradeOrder> {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: getHeaders(this.currentUser),
        body: JSON.stringify(payload),
      })
      if (!res.ok) await handleApiError(res)
      const order = await res.json()
      await this.loadOrders()
      return order
    },

    async updateOrder(orderId: number, payload: any): Promise<TradeOrder> {
      const res = await fetch(`${API_BASE}/orders/${orderId}`, {
        method: 'PUT',
        headers: getHeaders(this.currentUser),
        body: JSON.stringify(payload),
      })
      if (!res.ok) await handleApiError(res)
      const order = await res.json()
      await this.loadOrders()
      return order
    },

    async addEvidence(orderId: number, payload: any): Promise<Evidence> {
      const res = await fetch(`${API_BASE}/orders/${orderId}/evidences`, {
        method: 'POST',
        headers: getHeaders(this.currentUser),
        body: JSON.stringify(payload),
      })
      if (!res.ok) await handleApiError(res)
      const ev = await res.json()
      await this.loadOrders()
      return ev
    },

    async deleteEvidence(evidenceId: number) {
      const res = await fetch(`${API_BASE}/orders/evidences/${evidenceId}`, {
        method: 'DELETE',
        headers: getHeaders(this.currentUser),
      })
      if (!res.ok) await handleApiError(res)
      await this.loadOrders()
    },

    async submitToDoc(orderId: number, version: number, remark = ''): Promise<TradeOrder> {
      const res = await fetch(`${API_BASE}/orders/${orderId}/submit-to-doc`, {
        method: 'POST',
        headers: getHeaders(this.currentUser),
        body: JSON.stringify({ version, remark }),
      })
      if (!res.ok) await handleApiError(res)
      const order = await res.json()
      await this.loadOrders()
      return order
    },

    async docAction(orderId: number, action: 'approve' | 'reject' | 'mark-exception', version: number, remark = ''): Promise<TradeOrder> {
      const urlMap: Record<string, string> = {
        approve: 'doc-approve',
        reject: 'doc-reject',
        'mark-exception': 'doc-mark-exception',
      }
      const res = await fetch(`${API_BASE}/orders/${orderId}/${urlMap[action]}`, {
        method: 'POST',
        headers: getHeaders(this.currentUser),
        body: JSON.stringify({ version, remark }),
      })
      if (!res.ok) await handleApiError(res)
      const order = await res.json()
      await this.loadOrders()
      return order
    },

    async confirmAction(orderId: number, action: 'approve' | 'reject' | 'mark-exception', version: number, remark = ''): Promise<TradeOrder> {
      const urlMap: Record<string, string> = {
        approve: 'confirm-approve',
        reject: 'confirm-reject',
        'mark-exception': 'confirm-mark-exception',
      }
      const res = await fetch(`${API_BASE}/orders/${orderId}/${urlMap[action]}`, {
        method: 'POST',
        headers: getHeaders(this.currentUser),
        body: JSON.stringify({ version, remark }),
      })
      if (!res.ok) await handleApiError(res)
      const order = await res.json()
      await this.loadOrders()
      return order
    },

    async getHistories(orderId: number): Promise<OrderHistory[]> {
      const res = await fetch(`${API_BASE}/orders/${orderId}/histories`, {
        headers: getHeaders(this.currentUser),
      })
      if (!res.ok) await handleApiError(res)
      return await res.json()
    },

    setSelectedOrderIds(ids: number[]) {
      this.selectedOrderIds = ids
    },

    async batchOperation(action: string, orderItems: { order_id: number; version: number }[], remark = ''): Promise<BatchOperation> {
      const res = await fetch(`${API_BASE}/orders/ops/batches`, {
        method: 'POST',
        headers: getHeaders(this.currentUser),
        body: JSON.stringify({ action, order_items: orderItems, remark }),
      })
      if (!res.ok) await handleApiError(res)
      const batch = await res.json()
      this.lastBatchResult = batch
      await this.loadOrders()
      await this.loadBatchHistory()
      return batch
    },

    async loadBatchHistory() {
      const res = await fetch(`${API_BASE}/orders/ops/batches`, {
        headers: getHeaders(this.currentUser),
      })
      if (!res.ok) return
      this.batchHistory = await res.json()
    },

    async getLatestBatchItems(orderIds: number[]): Promise<BatchItemResult[]> {
      if (orderIds.length === 0) return []
      const ids = orderIds.join(',')
      const res = await fetch(`${API_BASE}/orders/ops/batch-items/latest?order_ids=${ids}`, {
        headers: getHeaders(this.currentUser),
      })
      if (!res.ok) return []
      return await res.json()
    },

    async getOrderBatchItems(orderId: number): Promise<BatchItemResult[]> {
      const res = await fetch(`${API_BASE}/orders/ops/orders/${orderId}/batch-items`, {
        headers: getHeaders(this.currentUser),
      })
      if (!res.ok) return []
      return await res.json()
    },
  },
})
