import React from 'react'

export default function BatchResultModal({ result, onClose }) {
  if (!result) return null

  const { total, success_count, fail_count, results } = result

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>批量处理结果</h3>
        <div className="batch-summary">
          <span className="batch-summary-total">共 {total} 项</span>
          <span className="batch-summary-success">成功 {success_count}</span>
          {fail_count > 0 && <span className="batch-summary-fail">失败 {fail_count}</span>}
        </div>
        <div className="batch-result-list">
          {results.map((r, idx) => (
            <div key={idx} className={`batch-result-item ${r.success ? 'success' : 'fail'}`}>
              <div className="batch-result-main">
                <span className={`batch-result-icon ${r.success ? 'icon-ok' : 'icon-fail'}`}>
                  {r.success ? '✓' : '✗'}
                </span>
                <span className="batch-result-code">{r.code}</span>
                {r.success ? (
                  <span className="batch-result-status ok">成功</span>
                ) : (
                  <span className="batch-result-status fail">失败</span>
                )}
              </div>
              {!r.success && (
                <div className="batch-result-reason">
                  <span className="reason-tag">{r.reason}</span>
                  <span className="reason-msg">{r.message}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>确定</button>
        </div>
      </div>
    </div>
  )
}
