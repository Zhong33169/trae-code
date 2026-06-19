import { h } from 'preact';
import { useState } from 'preact/hooks';
import { changeRiskLevel } from '../api/client';

function triggerGlobalRefresh() {
  try {
    window.dispatchEvent(new CustomEvent('aftersales:refresh'));
  } catch (e) {}
}

export default function RiskChangeModal({ currentLevel, orderId, currentUser, onClose, onSuccess }) {
  const [newLevel, setNewLevel] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newLevel) {
      setError('请选择新的风险等级');
      return;
    }
    if (newLevel === currentLevel) {
      setError('新等级与当前等级相同');
      return;
    }
    if (!reason.trim()) {
      setError('请填写变更原因');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await changeRiskLevel(orderId, {
        new_level: newLevel,
        reason: reason.trim(),
        operator_id: currentUser ? currentUser.id : 1,
      });
      triggerGlobalRefresh();
      onSuccess();
    } catch (e) {
      setError(e.message || '变更失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()}>
        <div class="modal-title">变更风险等级</div>

        <div class="form-group">
          <label>当前等级</label>
          <div style="font-size:14px;padding:8px 0;">
            {currentLevel === 'high' ? '高风险' : currentLevel === 'medium' ? '中风险' : '低风险'}
          </div>
        </div>

        <div class="form-group">
          <label>新风险等级</label>
          <select value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
            <option value="">请选择</option>
            <option value="low">低风险</option>
            <option value="medium">中风险</option>
            <option value="high">高风险</option>
          </select>
        </div>

        <div class="form-group">
          <label>变更原因（必填）</label>
          <textarea
            value={reason}
            onInput={(e) => setReason(e.target.value)}
            placeholder="请输入变更原因..."
          />
        </div>

        {error && <div style="color:#ff4d4f;font-size:12px;margin-bottom:12px;">{error}</div>}

        <div class="modal-actions">
          <button class="btn-cancel" onClick={onClose}>取消</button>
          <button class="btn-primary" disabled={submitting} onClick={handleSubmit}>
            确认变更
          </button>
        </div>
      </div>
    </div>
  );
}
