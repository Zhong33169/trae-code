import { defineStore } from 'pinia';
import api from '../utils/api.js';

export const useUserStore = defineStore('user', {
  state: () => ({
    currentUser: JSON.parse(localStorage.getItem('zs_user') || 'null'),
    users: []
  }),
  getters: {
    isLoggedIn: state => !!state.currentUser
  },
  actions: {
    async fetchUsers() {
      const res = await api.get('/users');
      if (res.success) {
        this.users = res.data;
        if (!this.currentUser && res.data.length > 0) {
          this.setUser(res.data[0]);
        }
      }
    },
    setUser(user) {
      this.currentUser = user;
      localStorage.setItem('zs_user', JSON.stringify(user));
    },
    logout() {
      this.currentUser = null;
      localStorage.removeItem('zs_user');
    }
  }
});
