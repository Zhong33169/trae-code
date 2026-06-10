import React, { useState } from 'react';
import api from '../api';

function BatchOperationModal({ visible, onClose, selectedIds, role, onSuccess }) {
  const [opinion, setOpinion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  if (!visible) return null;

  const isReviewer = role === 'reviewer';
  const actionText = isReviewer ? '审核' : '复核';
  const endpoint = isReviewer ? '/orders/batch/review' : '/orders/batch/finalize';

  const handleBatchAction = async (approved) => {
    if (selectedIds.length === 0) {
      alert('请先选择要处理的服务单');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.post(endpoint, {
        order_ids: selectedIds,
        approved,
        opinion,
      });
      setResult(res.data);
      if (res.data.failed.length === 0) {
        setTimeout(() => {
          onSuccess && onSuccess({
            success_count: res.data.success.length,
            skipped_count: res.data.failed.length,
          });
        }, 1500);
      } else {
        onSuccess && onSuccess({
          success_count: res.data.success.length,
          skipped_count: res.data.failed.length,
        });
      }
    } catch (err) {
      alert(err.response?.data?.detail || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📦 批量{actionText}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info">
            共选择 <strong>{selectedIds.length}</strong> 条服务单进行批量{actionText}
          </div>

          <div className="form-group">
            <label>处理意见（选填）</label>
            <textarea
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              placeholder={`请输入${actionText}意见`}
              rows={4}
            />
          </div>

          {result && (
            <div>
              {result.success.length > 0 && (
                <div className="alert alert-success">
                  ✅ 成功 {result.success.length} 条
                </div>
              )}
              {result.failed.length > 0 && (
                <div className="alert alert-error">
                  ❌ 失败 {result.failed.length} 条
                  <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    {result.failed.map((f, i) => (
                      <li key={i} style={{ fontSize: '12px' }}>
                        ID {f.id}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ color: '#888', fontSize: '13px', marginTop: '12px' }}>
            ⚠️ 只有状态匹配的服务单才会被处理，状态不对或材料不全的会跳过
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button 
            className="btn btn-danger" 
            onClick={() => handleBatchAction(false)}
            disabled={submitting}
            style={{ width: 'auto' }}
          >
            批量驳回
          </button>
          <button 
            className="btn btn-success" 
            onClick={() => handleBatchAction(true)}
            disabled={submitting}
            style={{ width: 'auto' }}
          >
            批量通过
          </button>
        </div>
      </div>
    </div>
  );
}

export default BatchOperationModal;
