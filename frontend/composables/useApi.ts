// composables/useApi.ts
export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: any
  headers?: Record<string, string>
}

export const useApi = () => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()

  const request = async <T = any>(path: string, opts: ApiOptions = {}): Promise<T> => {
    const base = (import.meta as any).dev ? '' : (config.public.apiBase || '')
    const url = path.startsWith('http') ? path : `${base}/api${path.startsWith('/api') ? path.slice(4) : path.startsWith('/') ? path : '/' + path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`
    }
    try {
      const resp = await $fetch<T>(url, {
        method: opts.method || 'GET',
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: 'include'
      })
      return resp as T
    } catch (e: any) {
      if (e?.status === 401) {
        authStore.logout()
        if (!path.includes('/auth/login')) {
          navigateTo('/login')
        }
      }
      const msg = e?.data?.error || e?.message || '请求失败'
      throw new Error(msg)
    }
  }

  return { request, get: <T>(p: string, o?: ApiOptions) => request<T>(p, { ...o, method: 'GET' }),
    post: <T>(p: string, body?: any, o?: ApiOptions) => request<T>(p, { ...o, method: 'POST', body })
  }
}
