const BASE_URL = '/api/glasses'

function getHeaders() {
  const currentUser = localStorage.getItem('currentUser') || 'wang_ling'
  const currentRole = localStorage.getItem('currentRole') || 'registrar'
  return {
    'Content-Type': 'application/json',
    'X-Current-User': currentUser,
    'X-Current-Role': currentRole,
  }
}

async function request(url, options = {}) {
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || `请求失败: ${response.status}`)
  }
  return response.json()
}

export const api = {
  getQueueStats: () => request('/queue-stats'),
  getFilterOptions: () => request('/filter-options'),
  getUsers: () => request('/users'),

  listOrders: (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, v)
      }
    })
    const qs = query.toString()
    return request(`/orders${qs ? `?${qs}` : ''}`)
  },

  getOrderDetail: (id) => request(`/orders/${id}`),

  createOrder: (data) =>
    request('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateOrder: (id, data) =>
    request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  submitOrder: (id) =>
    request(`/orders/${id}/submit`, { method: 'POST' }),

  reviewPass: (id, data = {}) =>
    request(`/orders/${id}/review-pass`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reviewReturn: (id, data) =>
    request(`/orders/${id}/review-return`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  finalPass: (id, data = {}) =>
    request(`/orders/${id}/final-pass`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  finalReturn: (id, data) =>
    request(`/orders/${id}/final-return`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  batchSubmit: (orderIds) =>
    request('/orders/batch-submit', {
      method: 'POST',
      body: JSON.stringify(orderIds),
    }),

  batchReview: (orderIds) =>
    request('/orders/batch-review', {
      method: 'POST',
      body: JSON.stringify(orderIds),
    }),

  listAttachments: (orderId) => request(`/orders/${orderId}/attachments`),

  createAttachment: (orderId, data) =>
    request(`/orders/${orderId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAttachment: (orderId, attachmentId) =>
    request(`/orders/${orderId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),

  listAuditLogs: (orderId) => request(`/orders/${orderId}/audit-logs`),

  listAllAuditLogs: (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, v)
      }
    })
    const qs = query.toString()
    return request(`/audit-logs${qs ? `?${qs}` : ''}`)
  },

  checkAnomalies: (orderId) => request(`/orders/${orderId}/anomalies/check`),
}
