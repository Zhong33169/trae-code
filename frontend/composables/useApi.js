export const useApi = () => {
  const config = useRuntimeConfig()
  const auth = useAuth()

  const getHeaders = () => {
    const headers = {
      'Content-Type': 'application/json'
    }
    if (auth.user.value) {
      headers['X-User-Id'] = auth.user.value.id
      headers['X-User-Name'] = auth.user.value.name
      headers['X-User-Role'] = auth.user.value.role
    }
    return headers
  }

  const request = async (url, options = {}) => {
    const fullUrl = `${config.public.apiBase}${url}`
    const headers = { ...getHeaders(), ...options.headers }

    try {
      const response = await $fetch(fullUrl, {
        ...options,
        headers
      })
      return response
    } catch (err) {
      const error = new Error(err.data?.message || err.message || '请求失败')
      error.code = err.data?.code
      error.detail = err.data?.detail
      error.data = err.data
      error.status = err.status
      throw error
    }
  }

  const get = (url, params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url
    return request(fullUrl, { method: 'GET' })
  }

  const post = (url, body = {}) => {
    return request(url, { method: 'POST', body })
  }

  return { get, post, request }
}
