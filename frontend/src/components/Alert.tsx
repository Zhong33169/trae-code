import { Component, Show } from "solid-js";

interface AlertProps {
  type?: "success" | "error" | "warning" | "info";
  message: string;
  show?: boolean;
  onClose?: () => void;
}

export const Alert: Component<AlertProps> = (props) => {
  const type = props.type || "info";
  const visible = props.show !== false;

  return (
    <Show when={visible}>
      <div class={`alert alert-${type}`}>
        {props.message}
      </div>
    </Show>
  );
};
