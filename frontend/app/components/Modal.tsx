import React, { useEffect } from "react";

interface ModalProps {
  open: boolean;
  title?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  width?: string | number;
  footer?: React.ReactNode;
  maskClosable?: boolean;
  destroyOnClose?: boolean;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  width = 520,
  footer,
  maskClosable = true,
  destroyOnClose = false,
}: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleMaskClick = () => {
    if (maskClosable) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open && destroyOnClose) {
    return null;
  }

  return (
    <div
      style={{
        display: open ? "block" : "none",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        onClick={handleMaskClick}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          animation: open ? "fadeIn 0.2s ease-out" : "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#fff",
          borderRadius: "8px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
          width: width,
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          animation: open ? "slideInUp 0.2s ease-out" : "none",
        }}
      >
        {title && (
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#111827" }}>
              {title}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "#9ca3af",
                padding: "4px",
                lineHeight: 1,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.color = "#374151";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.color = "#9ca3af";
              }}
            >
              ×
            </button>
          </div>
        )}

        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {open || !destroyOnClose ? children : null}
        </div>

        {footer && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmModalProps extends Omit<ModalProps, "children" | "footer"> {
  content: React.ReactNode;
  okText?: string;
  cancelText?: string;
  onOk: () => void | Promise<void>;
  okButtonProps?: React.CSSProperties;
  cancelButtonProps?: React.CSSProperties;
}

export function ConfirmModal({
  open,
  title = "确认",
  content,
  okText = "确定",
  cancelText = "取消",
  onOk,
  onClose,
  okButtonProps,
  cancelButtonProps,
  ...rest
}: ConfirmModalProps) {
  const [loading, setLoading] = React.useState(false);

  const handleOk = async () => {
    setLoading(true);
    try {
      await onOk();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={416}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "8px 16px",
              border: "1px solid #d1d5db",
              backgroundColor: "#fff",
              color: "#374151",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              transition: "all 0.2s",
              ...cancelButtonProps,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.target as HTMLButtonElement).style.backgroundColor = "#f9fafb";
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "#fff";
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleOk}
            disabled={loading}
            style={{
              padding: "8px 16px",
              border: "none",
              backgroundColor: "#3b82f6",
              color: "#fff",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.2s",
              ...okButtonProps,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.target as HTMLButtonElement).style.backgroundColor = "#2563eb";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                (e.target as HTMLButtonElement).style.backgroundColor = "#3b82f6";
              }
            }}
          >
            {loading ? "处理中..." : okText}
          </button>
        </>
      }
      {...rest}
    >
      <div style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6 }}>
        {content}
      </div>
    </Modal>
  );
}
