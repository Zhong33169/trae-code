// composables/useApi.ts
export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: any
  headers?: Record<string, string>
}

export interface ApiError {
  status: number
  message: string
  data?: any
  code?: string
}

let toastShown: Record<number, number> = {}

const showOnceToast = (msg: string, key: number) => {
  const now = Date.now()
  if (toastShown[key] && now - toastShown[key] < 2000) return
  toastShown[key] = now
  if (typeof window !== 'undefined') {
    const ev = new CustomEvent('api-toast', { detail: msg })
    window.dispatchEvent(ev)
  }
}

const broadcast = (evt: string, detail?: any) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(evt, { detail }))
  }
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
      const status = e?.status || 500
      const data = e?.data || {}
      const message = data?.error || data?.message || e?.message || '请求失败'

      if (status === 401) {
        authStore.logout()
        if (!path.includes('/auth/login')) {
          navigateTo('/login')
        }
      }
      if (status === 403) {
        showOnceToast('🚫 ' + message, 403)
        broadcast('api:forbidden', { path, message })
      }
      if (status === 409) {
        showOnceToast('⚠️ ' + message, 409)
        broadcast('api:conflict', { path, message })
      }
      if (status === 400 && (message.includes('证据') || message.includes('缺少'))) {
        showOnceToast('📎 ' + message, 400)
      }

      const err: ApiError = { status, message, data }
      if (data?.code) err.code = data.code
      throw err
    }
  }

  return {
    request,
    get: <T>(p: string, o?: ApiOptions) => request<T>(p, { ...o, method: 'GET' }),
    post: <T>(p: string, body?: any, o?: ApiOptions) => request<T>(p, { ...o, method: 'POST', body })
  }
}
