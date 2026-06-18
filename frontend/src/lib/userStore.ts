import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { api } from './api';
import type { User } from './types';

interface UserState {
  users: User[];
  currentUserId: string;
  loading: boolean;
}

const initialState: UserState = {
  users: [],
  currentUserId: '',
  loading: true,
};

function createUserStore() {
  const { subscribe, set, update } = writable<UserState>(initialState);

  return {
    subscribe,

    async init() {
      try {
        const users = await api.getUsers();
        let currentUserId = '';
        if (browser) {
          const saved = localStorage.getItem('currentUserId');
          currentUserId = saved && users.find((u: User) => u.id === saved) ? saved : users[0]?.id || '';
          if (!saved && currentUserId) localStorage.setItem('currentUserId', currentUserId);
        } else if (users.length > 0) {
          currentUserId = users[0].id;
        }
        set({ users, currentUserId, loading: false });
      } catch (e) {
        set({ users: [], currentUserId: '', loading: false });
      }
    },

    switchUser(userId: string) {
      update(state => {
        const newState = { ...state, currentUserId: userId };
        if (browser) localStorage.setItem('currentUserId', userId);
        return newState;
      });
    },

    getCurrentUser(state: UserState): User | undefined {
      return state.users.find(u => u.id === state.currentUserId);
    },

    refresh() {
      return this.init();
    },
  };
}

export const userStore = createUserStore();
