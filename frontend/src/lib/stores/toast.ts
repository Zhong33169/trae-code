import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

let toastId = 0;

export const toasts = writable<ToastItem[]>([]);

export function showToast(
  message: string,
  type: ToastType = 'info',
  duration: number = 3000,
): number {
  const id = ++toastId;
  const toast: ToastItem = { id, type, message, duration };
  toasts.update((items) => [...items, toast]);

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  return id;
}

export function removeToast(id: number): void {
  toasts.update((items) => items.filter((item) => item.id !== id));
}

export function success(message: string, duration?: number): number {
  return showToast(message, 'success', duration);
}

export function error(message: string, duration?: number): number {
  return showToast(message, 'error', duration);
}

export function warning(message: string, duration?: number): number {
  return showToast(message, 'warning', duration);
}

export function info(message: string, duration?: number): number {
  return showToast(message, 'info', duration);
}
