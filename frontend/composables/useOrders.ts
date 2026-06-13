import type {
  MembershipOrder, OrderListResponse, OrderStatus,
  BatchResponse, BatchSupplementItem
} from '~/types'

export function useOrders() {
  const { $apiFetch } = useNuxtApp()

  async function fetchList(params?: {
    status?: OrderStatus
    is_overdue?: boolean
    keyword?: string
    skip?: number
    limit?: number
  }): Promise<OrderListResponse> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.is_overdue !== undefined) query.set('is_overdue', String(params.is_overdue))
    if (params?.keyword) query.set('keyword', params.keyword)
    if (params?.skip) query.set('skip', String(params.skip))
    if (params?.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    return await $apiFetch<OrderListResponse>(`/orders${qs ? '?' + qs : ''}`)
  }

  async function fetchDetail(id: number): Promise<MembershipOrder> {
    return await $apiFetch<MembershipOrder>(`/orders/${id}`)
  }

  async function createOrder(data: {
    member_name: string
    member_phone?: string
    member_id_no?: string
    membership_type: string
    membership_duration: number
    amount: number
  }): Promise<MembershipOrder> {
    return await $apiFetch<MembershipOrder>('/orders', {
      method: 'POST',
      body: data
    })
  }

  async function submitOrder(id: number, remark?: string, operatorId?: number) {
    return await $apiFetch<any>(`/orders/${id}/submit`, {
      method: 'POST',
      body: { remark, operator_id: operatorId }
    })
  }

  async function approveOrder(id: number, remark?: string) {
    return await $apiFetch<any>(`/orders/${id}/approve`, {
      method: 'POST',
      body: { remark }
    })
  }

  async function requestSupplement(id: number, items: { required_attachment_id: number; reject_reason?: string }[], remark?: string) {
    return await $apiFetch<any>(`/orders/${id}/request-supplement`, {
      method: 'POST',
      body: { items, remark }
    })
  }

  async function rejectOrder(id: number, rejectReason: string, remark?: string) {
    return await $apiFetch<any>(`/orders/${id}/reject`, {
      method: 'POST',
      body: { reject_reason: rejectReason, remark }
    })
  }

  async function reviewOrder(id: number, remark?: string) {
    return await $apiFetch<any>(`/orders/${id}/review`, {
      method: 'POST',
      body: { remark }
    })
  }

  async function archiveOrder(id: number, remark?: string) {
    return await $apiFetch<any>(`/orders/${id}/archive`, {
      method: 'POST',
      body: { remark }
    })
  }

  async function uploadAttachment(orderId: number, data: {
    required_attachment_id?: number
    file_type: string
    file_name: string
    file_size?: number
    operator_id?: number
  }) {
    return await $apiFetch<any>(`/orders/${orderId}/attachments`, {
      method: 'POST',
      body: data
    })
  }

  async function deleteAttachment(orderId: number, attachmentId: number, operatorId?: number) {
    const qs = operatorId ? `?operator_id=${operatorId}` : ''
    return await $apiFetch<any>(`/orders/${orderId}/attachments/${attachmentId}${qs}`, {
      method: 'DELETE'
    })
  }

  async function batchSubmit(orderIds: number[], remark?: string): Promise<BatchResponse> {
    return await $apiFetch<BatchResponse>('/orders/batch/submit', {
      method: 'POST',
      body: { order_ids: orderIds, remark }
    })
  }

  async function batchApprove(orderIds: number[], remark?: string): Promise<BatchResponse> {
    return await $apiFetch<BatchResponse>('/orders/batch/approve', {
      method: 'POST',
      body: { order_ids: orderIds, remark }
    })
  }

  async function batchRequestSupplement(orders: BatchSupplementItem[]): Promise<BatchResponse> {
    return await $apiFetch<BatchResponse>('/orders/batch/request-supplement', {
      method: 'POST',
      body: { orders }
    })
  }

  async function batchReject(orderIds: number[], rejectReason: string, remark?: string): Promise<BatchResponse> {
    return await $apiFetch<BatchResponse>('/orders/batch/reject', {
      method: 'POST',
      body: { order_ids: orderIds, reject_reason: rejectReason, remark }
    })
  }

  async function batchReview(orderIds: number[], remark?: string): Promise<BatchResponse> {
    return await $apiFetch<BatchResponse>('/orders/batch/review', {
      method: 'POST',
      body: { order_ids: orderIds, remark }
    })
  }

  async function batchArchive(orderIds: number[], remark?: string): Promise<BatchResponse> {
    return await $apiFetch<BatchResponse>('/orders/batch/archive', {
      method: 'POST',
      body: { order_ids: orderIds, remark }
    })
  }

  return {
    fetchList,
    fetchDetail,
    createOrder,
    submitOrder,
    approveOrder,
    requestSupplement,
    rejectOrder,
    reviewOrder,
    archiveOrder,
    uploadAttachment,
    deleteAttachment,
    batchSubmit,
    batchApprove,
    batchRequestSupplement,
    batchReject,
    batchReview,
    batchArchive
  }
}
