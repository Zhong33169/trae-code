import { createSignal } from 'solid-js';

const [toasts, setToasts] = createSignal([]);
let toastId = 0;

export const useToast = () => {
  const showToast = (message, type = 'info', duration = 3000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const success = (msg) => showToast(msg, 'success');
  const error = (msg) => showToast(msg, 'error');
  const warning = (msg) => showToast(msg, 'warning');
  const info = (msg) => showToast(msg, 'info');

  return {
    toasts,
    showToast,
    success,
    error,
    warning,
    info,
  };
};
