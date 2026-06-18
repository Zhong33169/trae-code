import { useState, useCallback } from "react";

export function useToast() {
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const show = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  const ToastComponent = toast ? (
    <div className={`toast ${toast.type}`}>{toast.message}</div>
  ) : null;

  return { show, ToastComponent };
}
