import { route } from 'preact-router'

export default function BatchResultModal({ result, onClose, type = 'audit' }) {
  if (!result) return null

  const title = type === 'audit' ? '批量审核结果' : '批量复核结果'
  const successRecords = result.success_records || []
  const failedItems = result.failed_items || []

  const responsibleRoleName = type === 'audit' ? '晨检审核主管' : '幼儿园复核负责人'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {result.batch_no && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#ecf5ff', borderRadius: '6px', border: '1px solid #d9ecff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#606266' }}>批次号：</span>
                  <span style={{ fontWeight: 600, color: '#409eff', fontFamily: 'monospace' }}>{result.batch_no}</span>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#606266' }}>责任岗位：</span>
                  <span className={`role-badge role-${type === 'audit' ? 'auditor' : 'reviewer'}`}>
                    {responsibleRoleName}
                  </span>
                </div>
                {result.operator_name && (
                  <div>
                    <span style={{ fontSize: '12px', color: '#606266' }}>操作人：</span>
                    <span style={{ color: '#303133' }}>{result.operator_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="batch-summary">
            <div className="summary-item total">
              <div className="summary-label">总计</div>
              <div className="summary-value">{result.total_count !== undefined ? result.total_count : (result.success_count || 0) + (result.fail_count || 0)}</div>
            </div>
            <div className="summary-item success">
              <div className="summary-label">成功</div>
              <div className="summary-value">{result.success_count || 0}</div>
            </div>
            <div className="summary-item failed">
              <div className="summary-label">失败</div>
              <div className="summary-value">{result.fail_count || 0}</div>
            </div>
          </div>

          {failedItems.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '10px', color: '#f56c6c' }}>失败列表</h4>
              <div className="failed-list">
                {failedItems.map((item, idx) => (
                  <div key={idx} className="failed-item">
                    <span className="failed-id">#{item.id}</span>
                    <span className="failed-name" style={{ marginLeft: '8px', color: '#606266' }}>
                      {item.child_name}
                    </span>
                    <span className="failed-error" style={{ marginLeft: 'auto' }}>{item.error}</span>
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
                    {item.to_status_name && (
                      <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#67c23a' }}>
                        {item.to_status_name}
                      </span>
                    )}
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
