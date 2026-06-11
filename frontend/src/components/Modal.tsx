import { Component, createSignal } from "solid-js";

interface ModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmType?: "primary" | "danger" | "warning";
  loading?: boolean;
}

const Modal: Component<ModalProps> = (props) => {
  if (!props.visible) return null;

  return (
    <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">{props.title}</span>
          <button class="modal-close" onClick={props.onClose}>
            ×
          </button>
        </div>
        <div class="modal-body">{props.children}</div>
        <div class="modal-footer">
          <button class="btn btn-default" onClick={props.onClose}>
            {props.cancelText || "取消"}
          </button>
          <button
            class={`btn btn-${props.confirmType || "primary"}`}
            onClick={props.onConfirm}
            disabled={props.loading}
          >
            {props.loading ? "处理中..." : props.confirmText || "确定"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
