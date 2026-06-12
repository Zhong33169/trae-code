import { h } from 'preact';
import { useEffect } from 'preact/hooks';

export default function Modal({ title, visible, onClose, onOk, okText = '确定', cancelText = '取消', width, children, footer = true, loading = false }) {
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
      const onKey = (e) => e.key === 'Escape' && onClose && onClose();
      window.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div class="modal-mask" onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div class="modal-box" style={{ width: width || 520 }}>
        <div class="modal-header">
          <h3>{title}</h3>
          <button class="modal-close" onClick={onClose}>×</button>
        </div>
        <div class="modal-body">{children}</div>
        {footer && (
          <div class="modal-footer">
            <button class="btn-default" onClick={onClose} disabled={loading}>{cancelText}</button>
            {onOk && (
              <button class="btn-primary" onClick={onOk} disabled={loading}>
                {loading ? '提交中...' : okText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
