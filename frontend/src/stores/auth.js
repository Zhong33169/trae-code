import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as apiLogin } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const role = computed(() => user.value?.role || '')
  const username = computed(() => user.value?.username || '')
  const name = computed(() => user.value?.name || '')
  const shift = computed(() => user.value?.shift || '')
  const isLoggedIn = computed(() => !!token.value)

  async function login(loginData) {
    const res = await apiLogin(loginData)
    token.value = res.token
    user.value = res.user
    localStorage.setItem('token', res.token)
    localStorage.setItem('user', JSON.stringify(res.user))
    return res
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return {
    token,
    user,
    role,
    username,
    name,
    shift,
    isLoggedIn,
    login,
    logout
  }
})
