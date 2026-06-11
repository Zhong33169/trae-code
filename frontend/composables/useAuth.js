export const useAuth = () => {
  const user = useState('auth_user', () => null)
  const config = useRuntimeConfig()

  const login = async (userId, role) => {
    try {
      const data = await $fetch(`${config.public.apiBase}/auth/login`, {
        method: 'POST',
        body: { userId, role }
      })

      if (data?.success) {
        user.value = data.data.user
        if (process.client) {
          localStorage.setItem('workorder_user', JSON.stringify(data.data.user))
        }
        return data.data
      }
      throw new Error('登录失败')
    } catch (err) {
      throw new Error(err.data?.message || err.message || '登录失败')
    }
  }

  const logout = () => {
    user.value = null
    if (process.client) {
      localStorage.removeItem('workorder_user')
    }
  }

  const checkAuth = () => {
    if (process.client) {
      const stored = localStorage.getItem('workorder_user')
      if (stored) {
        try {
          user.value = JSON.parse(stored)
        } catch (e) {
          user.value = null
        }
      }
    }
    return !!user.value
  }

  const isLoggedIn = computed(() => !!user.value)
  const userRole = computed(() => user.value?.role || '')
  const userName = computed(() => user.value?.name || '')

  return {
    user,
    login,
    logout,
    checkAuth,
    isLoggedIn,
    userRole,
    userName
  }
}
