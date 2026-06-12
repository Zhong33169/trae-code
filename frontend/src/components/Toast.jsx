import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

let listeners = [];
let current = null;

export function showToast(message, type = 'info', duration = 2500) {
  current = { message, type, id: Date.now() };
  listeners.forEach((fn) => fn(current));
  if (duration > 0) {
    setTimeout(() => {
      current = null;
      listeners.forEach((fn) => fn(null));
    }, duration);
  }
}

export default function Toast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fn = (t) => setToast(t ? { ...t } : null);
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);

  if (!toast) return null;

  return <div class={`toast ${toast.type}`}>{toast.message}</div>;
}
