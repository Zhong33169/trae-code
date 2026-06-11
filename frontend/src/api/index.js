import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
}

export const applicationAPI = {
  list: (params) => api.get('/applications', { params }),
  get: (id) => api.get(`/applications/${id}`),
  create: (data) => api.post('/applications', data),
  update: (id, data) => api.put(`/applications/${id}`, data),
  process: (id, data) => api.post(`/applications/${id}/process`, data),
  batchProcess: (data) => api.post('/applications/batch-process', data),
  scan: (id, data) => api.post(`/applications/${id}/scan`, data),
  history: (id) => api.get(`/applications/${id}/history`),
  statistics: () => api.get('/statistics'),
}

export const auditAPI = {
  list: (params) => api.get('/audit-logs', { params }),
}

export default api
