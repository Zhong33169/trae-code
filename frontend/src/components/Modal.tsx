import { Show } from 'solid-js';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: any;
  width?: string;
}

export default function Modal(props: ModalProps) {
  return (
    <Show when={props.open}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={props.onClose}
      >
        <div
          style={{
            background: 'var(--white)',
            borderRadius: 'var(--radius)',
            width: props.width || '480px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '16px', fontWeight: 600 }}>{props.title}</span>
            <button
              onClick={props.onClose}
              style={{
                background: 'none',
                fontSize: '18px',
                color: 'var(--text-light)',
                padding: '4px',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ padding: '20px' }}>
            {props.children}
          </div>
        </div>
      </div>
    </Show>
  );
}
