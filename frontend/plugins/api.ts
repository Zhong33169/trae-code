export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase

  const apiFetch = $fetch.create({
    baseURL: apiBase,
    onRequest({ request, options }) {
      const token = localStorage.getItem('auth_token')
      if (token) {
        options.headers = options.headers || {}
        options.headers.Authorization = `Bearer ${token}`
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
    }
  })

  return {
    provide: {
      apiFetch
    }
  }
})
