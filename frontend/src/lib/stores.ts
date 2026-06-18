import { writable } from 'svelte/store';
import type { User } from './types';

const hasLocalStorage = typeof localStorage !== 'undefined';
const stored = hasLocalStorage ? localStorage.getItem('current_user') : null;
export const currentUser = writable<User | null>(stored ? JSON.parse(stored) : null);

currentUser.subscribe((v) => {
  if (!hasLocalStorage) return;
  if (v) localStorage.setItem('current_user', JSON.stringify(v));
  else localStorage.removeItem('current_user');
});
