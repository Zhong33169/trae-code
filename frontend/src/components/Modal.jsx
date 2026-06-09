import { useEffect } from 'react'

export default function Modal({ title, visible, onClose, onOk, okText = '确定', okDisabled = false, cancelText = '取消', children, width = 520 }) {
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-wrapper" onClick={(e) => e.stopPropagation()} style={{ width }}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
          <button
            className={`btn btn-primary ${okDisabled ? 'btn-disabled' : ''}`}
            onClick={onOk}
            disabled={okDisabled}
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  )
}
