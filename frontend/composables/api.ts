import { useAuthStore } from '~/stores/auth'

const BASE_URL = 'http://localhost:8001/api'

interface RequestOptions {
  method?: string
  body?: any
  headers?: Record<string, string>
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const authStore = useAuthStore()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.message || '请求失败')
  }

  return data.data as T
}

export const api = {
  auth: {
    login: (username: string, password: string) => 
      request('/auth/login', { method: 'POST', body: { username, password } }),
    
    me: () => request('/auth/me')
  },

  plans: {
    list: (status?: string, page = 1, pageSize = 20) => {
      let url = `/plans/list?page=${page}&page_size=${pageSize}`
      if (status) url += `&status=${status}`
      return request(url)
    },
    
    get: (id: string) => request(`/plans/${id}`),
    
    create: (data: any) => 
      request('/plans/create', { method: 'POST', body: data }),
    
    update: (id: string, data: any) => 
      request(`/plans/${id}`, { method: 'PUT', body: data }),
    
    updateAssessment: (id: string, data: any) =>
      request(`/plans/${id}/assessment`, { method: 'PUT', body: data }),
    
    updateFamilyConfirm: (id: string, data: any) =>
      request(`/plans/${id}/family-confirm`, { method: 'PUT', body: data }),
    
    transition: (id: string, data: any) =>
      request(`/plans/${id}/transition`, { method: 'POST', body: data }),
    
    logs: (id: string) => request(`/plans/${id}/logs`),
    
    handovers: (id: string) => request(`/plans/${id}/handovers`)
  },

  statistics: {
    summary: () => request('/statistics/summary')
  },

  users: {
    list: () => request('/users/list')
  }
}
