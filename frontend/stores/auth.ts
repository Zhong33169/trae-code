// stores/auth.ts
import { defineStore } from 'pinia'

export interface User {
  id: string
  username: string
  realName: string
  role: string
  roleLabel: string
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    user: null as User | null
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    role: (s) => s.user?.role || '',
    isRegistrar: (s) => s.user?.role === 'registrar',
    isAuditor: (s) => s.user?.role === 'auditor',
    isReviewer: (s) => s.user?.role === 'reviewer'
  },
  actions: {
    async login(username: string, password: string) {
      const { post } = useApi()
      const res: any = await post('/api/auth/login', { username, password })
      this.token = res.token
      this.user = res.user
      return res.user
    },
    setAuth(token: string, user: User) {
      this.token = token
      this.user = user
    },
    logout() {
      this.token = ''
      this.user = null
    }
  },
  persist: {
    key: 'news-clue-auth',
    storage: localStorage
  }
})
