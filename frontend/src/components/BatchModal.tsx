import { useState } from 'react';
import type { CrossBorderOrder, BatchResult, BlockReason } from '../types';
import * as api from '../api';
import { BLOCK_FIELD_TEXT } from '../types';

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
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

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

  const blockedOrdersCount = orders.filter(o =>
    o.isOverdue || (o.blockReasons && o.blockReasons.some(b => b.level === 'error'))
  ).length;

  const toggleExpand = (idx: number) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(idx)) {
      newSet.delete(idx);
    } else {
      newSet.add(idx);
    }
    setExpandedItems(newSet);
  };

  const renderBlockReasons = (blocks?: BlockReason[]) => {
    if (!blocks || blocks.length === 0) return null;
    return (
      <div className="batch-blocks-box">
        {blocks.map((b, i) => (
          <div
            key={i}
            className={`batch-block-row ${b.level === 'error' ? 'is-error' : 'is-warn'}`}
          >
            <span
              className="block-field-mini"
              style={{
                background: b.level === 'error' ? '#ff4d4f20' : '#faad1420',
                color: b.level === 'error' ? '#cf1322' : '#d46b08',
                border: `1px solid ${b.level === 'error' ? '#ffa39e' : '#ffd591'}`,
              }}
            >
              {BLOCK_FIELD_TEXT[b.field]}
            </span>
            <span style={{ marginLeft: '8px' }}>{b.reason}</span>
          </div>
        ))}
      </div>
    );
  };

  const handleSubmit = async () => {
    if (mode !== 'submit' && !pass && !opinion.trim()) {
      alert('退回必须填写处理意见');
      return;
    }
    if (mode === 'supervisor' && pass && blockedOrdersCount > 0) {
      if (!window.confirm(`选中的 ${orders.length} 单中有 ${blockedOrdersCount} 单存在逾期或硬阻断，通过动作会自动跳过这些订单仅处理正常单。是否继续？`)) {
        return;
      }
    }
    if (mode === 'reviewer' && pass && blockedOrdersCount > 0) {
      if (!window.confirm(`选中的 ${orders.length} 单中有 ${blockedOrdersCount} 单存在逾期或硬阻断，通过动作会自动跳过这些订单仅处理正常单（阻断单请进详情执行人工处置）。是否继续？`)) {
        return;
      }
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
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: '640px', maxWidth: '820px' }}>
        <div className="modal-header">
          <span className="modal-title">{getTitle()}</span>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        <div className="modal-body">
          {!result ? (
            <>
              <div style={{ marginBottom: '12px' }}>
                共选择 <strong>{orders.length}</strong> 个订单进行{getTitle().replace('批量', '')}
                {blockedOrdersCount > 0 && (
                  <span style={{
                    marginLeft: '12px',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    background: '#fff1f0',
                    color: '#cf1322',
                    border: '1px solid #ffa39e',
                    fontSize: '12px',
                  }}>
                    含 {blockedOrdersCount} 单有阻断/逾期（将被批量通过自动跳过）
                  </span>
                )}
              </div>

              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid #e8e8e8',
                borderRadius: '6px',
                padding: '4px 8px',
                marginBottom: '16px',
              }}>
                {orders.map(order => {
                  const hasBlock = order.isOverdue || (order.blockReasons && order.blockReasons.some(b => b.level === 'error'));
                  return (
                    <div key={order.id} style={{
                      padding: '8px 6px',
                      borderBottom: '1px solid #f0f0f0',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div>
                        <span style={{ fontWeight: '500' }}>{order.orderNo}</span>
                        <span style={{ color: '#666', marginLeft: '12px' }}>{order.productName}</span>
                      </div>
                      {hasBlock && (
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: '3px',
                          background: '#fff1f0',
                          color: '#cf1322',
                          border: '1px solid #ffa39e',
                          fontSize: '11px',
                        }}>
                          {order.isOverdue ? '已逾期' : '有阻断'}
                        </span>
                      )}
                    </div>
                  );
                })}
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
                    <label className="form-label">处理意见 {!pass && <span style={{ color: '#ff4d4f' }}>*</span>}</label>
                    <textarea
                      className="form-textarea"
                      value={opinion}
                      onChange={(e) => setOpinion(e.target.value)}
                      placeholder={!pass ? '退回必填：说明退回原因和补正要求' : '通过时可选：填写说明'}
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
                {result.failed > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#cf1322' }}>
                    失败订单会保留逐单原因和下一步建议；可点击单号展开阻断明细。
                  </div>
                )}
              </div>

              <div className="batch-result-list">
                {result.items.map((item, index) => {
                  const expanded = expandedItems.has(index);
                  const hasBlocks = item.blockReasons && item.blockReasons.length > 0;
                  return (
                    <div
                      key={index}
                      className={`batch-result-item ${item.success ? 'success' : 'failed'}`}
                    >
                      <div className="batch-result-item-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          {hasBlocks && !item.success && (
                            <button
                              className="link-btn"
                              onClick={() => toggleExpand(index)}
                              style={{ fontSize: '12px' }}
                            >
                              {expanded ? '▼' : '▶'}
                            </button>
                          )}
                          <span className="batch-result-item-order">{item.orderNo}</span>
                          <span className={`batch-result-item-status ${item.success ? 'success' : 'failed'}`}>
                            {item.success ? '成功' : '失败'}
                          </span>
                        </div>
                      </div>
                      {!item.success && (
                        <>
                          <div className="batch-result-item-reason">
                            <strong>失败原因：</strong>{item.reason}
                          </div>
                          {item.nextStep && (
                            <div className="batch-result-item-next">
                              <strong>下一步建议：</strong>
                              <span style={{ color: '#096dd9' }}>{item.nextStep}</span>
                            </div>
                          )}
                          {expanded && hasBlocks && (
                            <div style={{ marginTop: '8px' }}>
                              {renderBlockReasons(item.blockReasons)}
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
                  );
                })}
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
