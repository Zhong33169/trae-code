import { useState } from 'react';
import type { CrossBorderOrder, BatchResult } from '../types';
import * as api from '../api';

interface BatchModalProps {
  mode: 'submit' | 'supervisor' | 'reviewer';
  orders: CrossBorderOrder[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BatchModal({ mode, orders, onClose, onSuccess }: BatchModalProps) {
  const [opinion, setOpinion] = useState('');
  const [pass, setPass] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  const getTitle = () => {
    switch (mode) {
      case 'submit':
        return '批量提交审核';
      case 'supervisor':
        return '批量审核订单';
      case 'reviewer':
        return '批量复核订单';
    }
  };

  const handleSubmit = async () => {
    if (mode !== 'submit' && !opinion.trim()) {
      alert('请输入处理意见');
      return;
    }

    setLoading(true);
    try {
      const orderIds = orders.map(o => o.id);
      const versions = orders.map(o => o.version);
      let res;

      switch (mode) {
        case 'submit':
          res = await api.batchSubmit(orderIds, versions);
          break;
        case 'supervisor':
          res = await api.batchSupervisorProcess(orderIds, opinion, pass, versions);
          break;
        case 'reviewer':
          res = await api.batchReviewerProcess(orderIds, opinion, pass, versions);
          break;
      }

      setResult(res);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (result && result.success > 0) {
      onSuccess();
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: '560px' }}>
        <div className="modal-header">
          <span className="modal-title">{getTitle()}</span>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        <div className="modal-body">
          {!result ? (
            <>
              <div style={{ marginBottom: '16px' }}>
                共选择 <strong>{orders.length}</strong> 个订单进行{getTitle().replace('批量', '')}
              </div>

              <div style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid #e8e8e8',
                borderRadius: '6px',
                padding: '8px',
                marginBottom: '16px',
              }}>
                {orders.map(order => (
                  <div key={order.id} style={{
                    padding: '6px 8px',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '13px',
                  }}>
                    <span style={{ fontWeight: '500' }}>{order.orderNo}</span>
                    <span style={{ color: '#666', marginLeft: '12px' }}>{order.productName}</span>
                  </div>
                ))}
              </div>

              {mode !== 'submit' && (
                <>
                  <div className="form-item">
                    <label className="form-label">处理方式</label>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          checked={pass}
                          onChange={() => setPass(true)}
                        />
                        <span>通过</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          checked={!pass}
                          onChange={() => setPass(false)}
                        />
                        <span>{mode === 'supervisor' ? '退回补正' : '退回'}</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-item">
                    <label className="form-label">处理意见</label>
                    <textarea
                      className="form-textarea"
                      value={opinion}
                      onChange={(e) => setOpinion(e.target.value)}
                      placeholder="请输入处理意见"
                      rows={4}
                    />
                  </div>
                </>
              )}

              {mode === 'submit' && (
                <div style={{
                  padding: '12px',
                  background: '#fffbe6',
                  border: '1px solid #ffe58f',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#d48806',
                }}>
                  提示：提交后订单将进入审核队列，请确保材料齐全后再提交。
                  如材料不齐，可能会被审核退回。
                </div>
              )}
            </>
          ) : (
            <>
              <div className={`batch-result-summary ${result.failed > 0 ? 'has-failure' : ''}`}>
                <div className="batch-result-summary-title">
                  批量处理完成
                </div>
                <div className="batch-result-summary-stats">
                  <span>总数：{result.total}</span>
                  <span style={{ color: '#52c41a' }}>成功：{result.success}</span>
                  <span style={{ color: '#ff4d4f' }}>失败：{result.failed}</span>
                </div>
              </div>

              <div className="batch-result-list">
                {result.items.map((item, index) => (
                  <div
                    key={index}
                    className={`batch-result-item ${item.success ? 'success' : 'failed'}`}
                  >
                    <div className="batch-result-item-header">
                      <span className="batch-result-item-order">{item.orderNo}</span>
                      <span className={`batch-result-item-status ${item.success ? 'success' : 'failed'}`}>
                        {item.success ? '成功' : '失败'}
                      </span>
                    </div>
                    {!item.success && (
                      <>
                        <div className="batch-result-item-reason">
                          <strong>原因：</strong>{item.reason}
                        </div>
                        {item.nextStep && (
                          <div className="batch-result-item-next">
                            <strong>下一步：</strong>{item.nextStep}
                          </div>
                        )}
                      </>
                    )}
                    {item.success && item.reason && (
                      <div className="batch-result-item-reason" style={{ color: '#faad14' }}>
                        {item.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          {!result ? (
            <>
              <button className="btn btn-default" onClick={handleClose}>取消</button>
              <button
                className={`btn ${pass ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? '处理中...' : '确认提交'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleClose}>
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
