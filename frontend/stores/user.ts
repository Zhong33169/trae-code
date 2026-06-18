import { defineStore } from 'pinia'

export interface User {
  id: number
  username: string
  role_code: string
  role_name: string
  department: string
}

export type UserRole = 'registrar' | 'reviewer' | 'final_reviewer' | 'admin'

export const roleLabels: Record<UserRole, string> = {
  registrar: '展期登记员',
  reviewer: '展期审核主管',
  final_reviewer: '小贷公司复核负责人',
  admin: '系统管理员'
}

interface LoginResponse {
  token: string
  user: User
}

interface UserState {
  user: User | null
  token: string | null
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    user: null,
    token: null
  }),

  getters: {
    isLoggedIn: (state): boolean => !!state.token && !!state.user,
    userRole: (state): string | null => state.user?.role_code || null,
    userRoleName: (state): string | null => state.user?.role_name || null
  },

  actions: {
    async login(username: string) {
      const { post } = useApi()
      const response = await post<LoginResponse>('/auth/login', { username })
      this.token = response.token
      this.user = response.user

      if (process.client) {
        localStorage.setItem('user', JSON.stringify(response.user))
        localStorage.setItem('token', response.token)
      }
    },

    async fetchUser() {
      const { get } = useApi()
      const user = await get<User>('/auth/user')
      this.user = user

      if (process.client) {
        localStorage.setItem('user', JSON.stringify(user))
      }
    },

    logout() {
      this.user = null
      this.token = null
      if (process.client) {
        localStorage.removeItem('user')
        localStorage.removeItem('token')
      }
    },

    loadFromStorage() {
      if (process.client) {
        const storedUser = localStorage.getItem('user')
        const storedToken = localStorage.getItem('token')
        if (storedUser && storedToken) {
          this.user = JSON.parse(storedUser)
          this.token = storedToken
        }
      }
    },

    hasRole(role: UserRole | UserRole[]): boolean {
      if (!this.user) return false
      const roles = Array.isArray(role) ? role : [role]
      return roles.includes(this.user.role_code as UserRole)
    }
  }
})
