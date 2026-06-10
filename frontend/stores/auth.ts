import { defineStore } from 'pinia';
import type { User, UserRole } from '~/types';

interface AuthState {
  user: User | null;
  token: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    userRole: (state): UserRole | null => state.user?.role || null,
    isRegistrar: (state) => state.user?.role === 'registrar',
    isSupervisor: (state) => state.user?.role === 'supervisor',
    isReviewer: (state) => state.user?.role === 'reviewer',
  },

  actions: {
    async login(username: string, password: string) {
      const api = useApi();
      const result = await api.post<any>('/auth/login', { username, password });

      this.token = result.accessToken;
      this.user = result.user;

      const tokenCookie = useCookie('auth_token');
      tokenCookie.value = result.accessToken;

      const userCookie = useCookie('auth_user');
      userCookie.value = JSON.stringify(result.user);

      return result;
    },

    logout() {
      this.token = null;
      this.user = null;

      const tokenCookie = useCookie('auth_token');
      tokenCookie.value = null;

      const userCookie = useCookie('auth_user');
      userCookie.value = null;

      navigateTo('/login');
    },

    loadFromCookie() {
      const tokenCookie = useCookie('auth_token');
      const userCookie = useCookie('auth_user');

      if (tokenCookie.value) {
        this.token = tokenCookie.value;
      }
      if (userCookie.value) {
        try {
          this.user = JSON.parse(userCookie.value);
        } catch (e) {
          this.user = null;
        }
      }
    },

    hasRole(...roles: UserRole[]): boolean {
      if (!this.user) return false;
      return roles.includes(this.user.role);
    },
  },
});
