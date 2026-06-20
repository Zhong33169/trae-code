import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.code === 0) {
      return response.data.data
    }
    return Promise.reject(response.data || { message: '请求失败' })
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      if (!error.config?.url?.includes('/auth/')) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }
    }
    const message = error.response?.data?.message || error.message || '网络错误'
    return Promise.reject({ message, ...error.response?.data })
  }
)

export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  getUsers: () => api.get('/users'),
}

export const ticketApi = {
  list: (params) => api.get('/tickets', { params }),
  get: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets', data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  startProcess: (id) => api.post(`/tickets/${id}/process`),
  submitReview: (id, data) => api.post(`/tickets/${id}/submit-review`, data),
  returnTicket: (id, returnReason) => api.post(`/tickets/${id}/return`, { return_reason: returnReason }),
  resubmit: (id) => api.post(`/tickets/${id}/resubmit`),
  archive: (id, data) => api.post(`/tickets/${id}/archive`, data),
  getTransitions: () => api.get('/tickets/transitions'),
}

export const attachmentApi = {
  list: (ticketId) => api.get(`/tickets/${ticketId}/attachments`),
  upload: (ticketId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/tickets/${ticketId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  remove: (ticketId, attachmentId) => api.delete(`/tickets/${ticketId}/attachments/${attachmentId}`),
}

export const auditApi = {
  listByTicket: (ticketId) => api.get(`/tickets/${ticketId}/audit-logs`),
  listAll: () => api.get('/audit-logs'),
  listFailures: () => api.get('/audit-logs/failures'),
}

export const importApi = {
  importTickets: (data) => api.post('/import', data),
  listBatches: () => api.get('/import/batches'),
  getBatch: (id) => api.get(`/import/batches/${id}`),
  listRecords: (batchId) => api.get(`/import/batches/${batchId}/records`),
}

export default api
