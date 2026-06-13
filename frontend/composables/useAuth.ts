import { reactive, computed } from 'vue'
import type { User } from '~/types'

interface AuthState {
  user: User | null
  token: string | null
}

const state = reactive<AuthState>({
  user: null,
  token: null
})

export function useAuth() {
  if (typeof window !== 'undefined') {
    if (!state.user) {
      const savedUser = localStorage.getItem('auth_user')
      const savedToken = localStorage.getItem('auth_token')
      if (savedUser && savedToken) {
        try {
          state.user = JSON.parse(savedUser)
          state.token = savedToken
        } catch (e) {
          localStorage.removeItem('auth_user')
          localStorage.removeItem('auth_token')
        }
      }
    }
  }

  async function login(username: string) {
    const { $apiFetch } = useNuxtApp()
    const res = await $apiFetch<any>('/auth/login', {
      method: 'POST',
      body: { username }
    })
    state.user = res.user
    state.token = res.token
    localStorage.setItem('auth_user', JSON.stringify(res.user))
    localStorage.setItem('auth_token', res.token)
    return res
  }

  function logout() {
    state.user = null
    state.token = null
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_token')
  }

  async function switchRole(username: string) {
    await login(username)
  }

  const isRegistrar = computed(() => state.user?.role === 'registrar')
  const isSupervisor = computed(() => state.user?.role === 'supervisor')
  const isReviewer = computed(() => state.user?.role === 'reviewer')

  return {
    state,
    login,
    logout,
    switchRole,
    isRegistrar,
    isSupervisor,
    isReviewer
  }
}
