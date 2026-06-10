import { route } from 'preact-router'

export default function BatchResultModal({ result, onClose, type = 'audit' }) {
  if (!result) return null

  const title = type === 'audit' ? '批量审核结果' : '批量复核结果'
  const successRecords = result.success_records || []
  const failedItems = result.failed_items || []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="batch-summary">
            <div className="summary-item success">
              <div className="summary-label">成功</div>
              <div className="summary-value">{result.success_count || 0}</div>
            </div>
            <div className="summary-item failed">
              <div className="summary-label">失败</div>
              <div className="summary-value">{result.fail_count || 0}</div>
            </div>
            <div className="summary-item total">
              <div className="summary-label">总计</div>
              <div className="summary-value">{(result.success_count || 0) + (result.fail_count || 0)}</div>
            </div>
          </div>

          {failedItems.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '10px', color: '#f56c6c' }}>失败列表</h4>
              <div className="failed-list">
                {failedItems.map((item, idx) => (
                  <div key={idx} className="failed-item">
                    <span className="failed-id">#{item.id}</span>
                    <span className="failed-error">{item.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {successRecords.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '10px', color: '#67c23a' }}>成功列表</h4>
              <div className="success-list">
                {successRecords.map((item) => (
                  <div
                    key={item.id}
                    className="success-item"
                    onClick={() => {
                      onClose()
                      route(`/records/${item.id}`)
                    }}
                  >
                    <span className="success-id">#{item.id}</span>
                    <span className="success-name">{item.child_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>确定</button>
        </div>
      </div>
    </div>
  )
}
