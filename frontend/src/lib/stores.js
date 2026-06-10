import { writable, derived } from 'svelte/store';
import { DEMO_USERS as _DEMO_USERS, ROLE_LABELS } from './constants.js';

export const DEMO_USERS = _DEMO_USERS;

export const currentUserId = writable(1);

export const currentUser = derived(currentUserId, ($id) => {
  const user = DEMO_USERS.find((u) => u.id === $id);
  return user
    ? {
        ...user,
        role_display: ROLE_LABELS[user.role],
      }
    : null;
});

export const selectedReservationId = writable(null);

export const refreshTrigger = writable(0);

export function refreshData() {
  refreshTrigger.update((n) => n + 1);
}

export function switchUser(userId) {
  currentUserId.set(userId);
  selectedReservationId.set(null);
  refreshData();
}
