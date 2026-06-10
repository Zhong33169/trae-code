const appConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8004',
  frontendPort: import.meta.env.VITE_PORT || '3004'
}

const API_BASE = '/api'

async function request(url, options = {}) {
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Base-Url': appConfig.apiBaseUrl,
      'X-Frontend-Port': appConfig.frontendPort
    }
  }

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  }

  if (options.body && typeof options.body !== 'string') {
    finalOptions.body = JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE}${url}`, finalOptions)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || data.message || '请求失败')
  }

  return data
}

export function getAppConfig() {
  return appConfig
}

export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: { username, password } }),

  logout: () =>
    request('/auth/logout', { method: 'POST' }),

  getMe: () =>
    request('/auth/me'),

  getQueue: () =>
    request('/orders/queue'),

  getAllOrders: (status) => {
    const url = status ? `/orders/all?status=${status}` : '/orders/all'
    return request(url)
  },

  getOrderDetail: (orderId) =>
    request(`/orders/${orderId}`),

  transitionOrder: (orderId, targetStatus, version, evidence, remark) =>
    request(`/orders/${orderId}/transition`, {
      method: 'POST',
      body: { target_status: targetStatus, version, evidence, remark }
    }),

  getStats: () =>
    request('/orders/stats'),

  submitAppeal: (orderId, reason, version) =>
    request('/appeals', {
      method: 'POST',
      body: { order_id: orderId, reason, version }
    }),

  getAppealDetail: (appealId) =>
    request(`/appeals/${appealId}`),

  acceptAppeal: (appealId, reviewOpinion, version) =>
    request(`/appeals/${appealId}/accept`, {
      method: 'POST',
      body: { review_opinion: reviewOpinion, version }
    }),

  rejectAppeal: (appealId, rejectReason, version) =>
    request(`/appeals/${appealId}/reject`, {
      method: 'POST',
      body: { reject_reason: rejectReason, version }
    }),

  resubmitAppeal: (appealId, reason, version) =>
    request(`/appeals/${appealId}/resubmit`, {
      method: 'POST',
      body: { reason, version }
    }),

  approveAppeal: (appealId, reviewOpinion, targetOrderStatus, version) =>
    request(`/appeals/${appealId}/approve`, {
      method: 'POST',
      body: { review_opinion: reviewOpinion, target_order_status: targetOrderStatus, version }
    }),

  denyAppeal: (appealId, rejectReason, version) =>
    request(`/appeals/${appealId}/deny`, {
      method: 'POST',
      body: { reject_reason: rejectReason, version }
    }),

  listAppeals: (status, orderId) => {
    let url = '/appeals/list'
    const params = []
    if (status) params.push(`status=${status}`)
    if (orderId) params.push(`order_id=${orderId}`)
    if (params.length) url += '?' + params.join('&')
    return request(url)
  },

  getStatusConfig: () =>
    request('/orders/status-config')
}
