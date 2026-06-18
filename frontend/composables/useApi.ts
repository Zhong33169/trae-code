interface ApiErrorResponse {
  code: string
  message: string
}

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: any
  params?: Record<string, any>
}

export class ApiError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.code = code
    this.status = status
    this.name = 'ApiError'
  }
}

export function useApi() {
  const config = useRuntimeConfig()
  const userStore = useUserStore()

  const baseUrl = computed(() => config.public.apiBaseUrl)

  const buildUrl = (endpoint: string, params?: Record<string, any>): string => {
    let url = `${baseUrl.value}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }
    return url
  }

  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (userStore.token) {
      headers['Authorization'] = `Bearer ${userStore.token}`
    }
    return headers
  }

  const handleError = async (response: Response): Promise<never> => {
    let errorData: ApiErrorResponse = {
      code: String(response.status),
      message: `HTTP error! status: ${response.status}`
    }

    try {
      const data = await response.json()
      if (data.code && data.message) {
        errorData = data as ApiErrorResponse
      }
    } catch {
      // 如果无法解析 JSON，使用默认错误信息
    }

    if (response.status === 401) {
      userStore.logout()
      if (process.client) {
        navigateTo('/')
      }
    }

    throw new ApiError(errorData.message, errorData.code, response.status)
  }

  const request = async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
    const { method = 'GET', body, params } = options
    const url = buildUrl(endpoint, params)
    const headers = getHeaders()

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      })

      if (!response.ok) {
        await handleError(response)
      }

      const data = await response.json()
      return data as T
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      console.error('API request failed:', error)
      throw new ApiError('网络请求失败', 'NETWORK_ERROR', 0)
    }
  }

  const get = <T>(endpoint: string, params?: Record<string, any>) => {
    return request<T>(endpoint, { method: 'GET', params })
  }

  const post = <T>(endpoint: string, body?: any) => {
    return request<T>(endpoint, { method: 'POST', body })
  }

  const put = <T>(endpoint: string, body?: any) => {
    return request<T>(endpoint, { method: 'PUT', body })
  }

  const del = <T>(endpoint: string) => {
    return request<T>(endpoint, { method: 'DELETE' })
  }

  return {
    baseUrl,
    get,
    post,
    put,
    del,
    request,
    ApiError
  }
}
