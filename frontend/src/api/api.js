const API_BASE = '/api'

function getHeaders() {
  const user = JSON.parse(localStorage.getItem('currentUser') || 'null')
  return {
    'Content-Type': 'application/json',
    'X-User-Name': user?.username || 'registrar',
    'X-User-Real-Name': encodeURIComponent(user?.name || '张登记'),
    'X-User-Role': user?.role || 'registrar',
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const config = {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  }

  if (options.body && typeof options.body !== 'string') {
    config.body = JSON.stringify(options.body)
  }

  const response = await fetch(url, config)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.detail || data.message || '请求失败')
  }

  return data
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
}

export const reservationApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.get(`/reservations?${query}`)
  },
  get: (id) => api.get(`/reservations/${id}`),
  create: (data) => api.post('/reservations', data),
  update: (id, data) => api.put(`/reservations/${id}`, data),
  delete: (id) => api.delete(`/reservations/${id}`),
  submit: (id, data = {}) => api.post(`/reservations/${id}/submit`, data),
  audit: (id, action, data = {}) => api.post(`/reservations/${id}/audit/${action}`, data),
  confirmUsage: (id, data = {}) => api.post(`/reservations/${id}/usage-confirm`, data),
  review: (id, action, data = {}) => api.post(`/reservations/${id}/review/${action}`, data),
  reconcile: (id, data = {}) => api.post(`/reservations/${id}/reconcile`, data),
  statuses: () => api.get('/reservations/statuses'),
  exceptions: () => api.get('/reservations/exceptions'),
}

export const userApi = {
  list: () => api.get('/users'),
  current: () => api.get('/users/current'),
  get: (username) => api.get(`/users/${username}`),
}

export const auditApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.get(`/audit?${query}`)
  },
  blocks: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.get(`/audit/blocks?${query}`)
  },
  failures: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return api.get(`/audit/failures?${query}`)
  },
  traceReservation: (id) => api.get(`/audit/reservation/${id}`),
  traceBatch: (batchNo) => api.get(`/audit/batch/${encodeURIComponent(batchNo)}`),
}

export const batchApi = {
  list: () => api.get('/batches'),
  check: (batchNo) => api.get(`/batches/check?batch_no=${encodeURIComponent(batchNo)}`),
  get: (batchNo) => api.get(`/batches/${encodeURIComponent(batchNo)}`),
  reconcile: (data) => api.post('/batches/reconcile', data),
  statusCheck: (data) => api.post('/batches/status-check', data),
}

export const statusMap = {
  draft: '草稿',
  pending_audit: '待审核',
  approved: '审核通过',
  usage_confirmed: '使用确认',
  archived: '已归档',
  returned: '已退回',
  overdue: '已超时',
}

export const exceptionMap = {
  missing_materials: '材料缺失',
  info_error: '信息错误',
  overdue: '超时未处理',
  batch_mismatch: '批次不一致',
  status_mismatch: '状态不一致',
}

export const roleMap = {
  registrar: '会议预约登记员',
  auditor: '会议预约审核主管',
  reviewer: '行政后勤中心复核负责人',
}
