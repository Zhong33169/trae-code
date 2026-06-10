import React from "react";
import type { ToastMessage } from "~/hooks/useToast";

export interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  const getToastStyles = (type: ToastMessage["type"]): React.CSSProperties => {
    const styles: Record<ToastMessage["type"], React.CSSProperties> = {
      success: {
        backgroundColor: "#dcfce7",
        borderLeft: "4px solid #10b981",
        color: "#166534",
      },
      error: {
        backgroundColor: "#fee2e2",
        borderLeft: "4px solid #ef4444",
        color: "#991b1b",
      },
      warning: {
        backgroundColor: "#fef3c7",
        borderLeft: "4px solid #f59e0b",
        color: "#92400e",
      },
      info: {
        backgroundColor: "#dbeafe",
        borderLeft: "4px solid #3b82f6",
        color: "#1e40af",
      },
    };
    return styles[type];
  };

  const getIcon = (type: ToastMessage["type"]): string => {
    const icons: Record<ToastMessage["type"], string> = {
      success: "OK",
      error: "X",
      warning: "!",
      info: "i",
    };
    return icons[type];
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            ...getToastStyles(toast.type),
            padding: "12px 16px",
            borderRadius: "4px",
            minWidth: "300px",
            maxWidth: "500px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
            <span style={{ fontWeight: "bold", fontSize: "18px" }}>
              {getIcon(toast.type)}
            </span>
            <span style={{ fontSize: "14px" }}>{toast.message}</span>
          </div>
          <button
            onClick={() => onClose(toast.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              opacity: 0.6,
              padding: "0 4px",
            }}
          >
            X
          </button>
        </div>
      ))}
    </div>
  );
}
