import { Component, Show } from "solid-js";

interface ModalProps {
  show: boolean;
  title: string;
  onClose: () => void;
  children: any;
  footer?: any;
  width?: string;
}

export const Modal: Component<ModalProps> = (props) => {
  return (
    <Show when={props.show}>
      <div class="modal-overlay" onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}>
        <div class="modal" style={{ "max-width": props.width || "600px" }}>
          <div class="modal-header">
            <h3>{props.title}</h3>
            <button class="modal-close" onClick={props.onClose}>×</button>
          </div>
          <div class="modal-body">{props.children}</div>
          {props.footer && (
            <div class="modal-footer">{props.footer}</div>
          )}
        </div>
      </div>
    </Show>
  );
};
