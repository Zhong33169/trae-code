import React, { useState } from 'react'

const ACTION_LABELS = {
  clerk: [
    { value: 'submit', label: '批量提交登记', status: ['draft', 'pending_clerk', 'rejected'] }
  ],
  foreman: [
    { value: 'verify_foreman', label: '批量现场核验通过', status: ['pending_foreman'] }
  ],
  manager: [
    { value: 'confirm_manager', label: '批量确认通过', status: ['pending_manager'] }
  ]
}

export default function BatchToolbar({ selectedCount, userRole, onProcess, onClear }) {
  const [reason, setReason] = useState('')
  const [showReason, setShowReason] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const actions = ACTION_LABELS[userRole] || []

  const handleAction = (action) => {
    if (action.includes('reject')) {
      setPendingAction(action)
      setShowReason(true)
    } else {
      onProcess(action)
    }
  }

  const confirmWithReason = () => {
    onProcess(pendingAction, reason)
    setShowReason(false)
    setReason('')
    setPendingAction('')
  }

  if (actions.length === 0) {
    return (
      <button className="btn btn-text" onClick={onClear}>
        已选 {selectedCount} 项（当前角色无可批量操作）
      </button>
    )
  }

  return (
    <div className="batch-toolbar">
      <span className="batch-count">已选 {selectedCount} 项</span>
      {actions.map((a) => (
        <button
          key={a.value}
          className="btn btn-sm btn-secondary"
          onClick={() => handleAction(a.value)}
        >
          {a.label}
        </button>
      ))}
      <button className="btn btn-sm btn-text" onClick={onClear}>取消</button>

      {showReason && (
        <div className="modal-overlay">
          <div className="modal small">
            <h3>请输入驳回原因</h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
              rows={4}
              placeholder="必须填写驳回原因"
            />
            <div className="modal-actions">
              <button className="btn btn-text" onClick={() => { setShowReason(false); setReason('') }}>取消</button>
              <button
                className="btn btn-primary"
                onClick={confirmWithReason}
                disabled={!reason.trim()}
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
