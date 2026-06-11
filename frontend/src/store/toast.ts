import { createSignal } from "solid-js";

interface Toast {
  id: number;
  type: "success" | "error" | "warning";
  message: string;
}

const [toasts, setToasts] = createSignal<Toast[]>([]);
let toastId = 0;

export function showToast(message: string, type: "success" | "error" | "warning" = "success") {
  const id = ++toastId;
  setToasts([...toasts(), { id, type, message }]);

  setTimeout(() => {
    setToasts(toasts().filter((t) => t.id !== id));
  }, 3000);
}

export const toastStore = {
  toasts,
  show: showToast,
};
