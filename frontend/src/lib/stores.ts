import { writable } from 'svelte/store';
import type { User } from './types';

const stored = localStorage.getItem('current_user');
export const currentUser = writable<User | null>(stored ? JSON.parse(stored) : null);

currentUser.subscribe((v) => {
  if (v) localStorage.setItem('current_user', JSON.stringify(v));
  else localStorage.removeItem('current_user');
});
