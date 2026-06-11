import { useState } from 'preact/hooks';

export default function BatchActionModal({ action, selectedCount, role, meta, onClose, onConfirm, showToast }) {
  const actionLabelMap = {
    approve_verify: '批量核验通过',
    reject_verify: '批量核验退回',
    approve_review: '批量复核归档',
    reject_review: '批量复核退回',
    submit: '批量提交',
  };
  const actionLabel = actionLabelMap[action] || action;
  const isApprove = action?.startsWith('approve');
  const isReject = action?.startsWith('reject');

  const [opinion, setOpinion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sampleOpinion = {
    approve_verify: '批量核验通过：核验材料齐全，价格与供应商确认无误，统一推进至复核。',
    reject_verify: '批量退回：需补充供应商确认回执（附最新盖章版），价格异常单需附说明。',
    approve_review: '批量复核归档：总部预算额度范围内，合规材料齐全，统一归档。',
    reject_review: '批量退回复核：补充财务签字版预算核对单后重新提交。',
    submit: '批量提交：门店常规补货，参考本月销售预测及库存数据测算。',
  };

  async function handleConfirm() {
    if (!opinion.trim() || opinion.trim().length < 5) {
      return showToast('批量处理意见至少5个字符', 'error');
    }
    setSubmitting(true);
    try {
      await onConfirm({ action, opinion: opinion.trim() });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal">
        <div className="modal-header">
          <h3>
            {isApprove && '✅ '}{isReject && '⚠ '}
            {actionLabel}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="alert info" style={{ marginBottom: 12 }}>
            <strong>本次将处理 {selectedCount} 张单据。</strong>
            <div style={{ marginTop: 4 }}>
              系统将逐张检查权限、材料、状态和操作锁；不符合条件的单据会单独报告，不影响其他单据推进。
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
              💬 <span className="required" style={{ color: 'var(--danger)' }}>*</span> 批量处理意见
            </label>
            <textarea
              style={{ width: '100%', minHeight: 100, marginTop: 6 }}
              placeholder={sampleOpinion[action] || '请填写统一处理意见...'}
              value={opinion}
              onInput={(e) => setOpinion(e.target.value)}
            />
            <div className="help-text">💡 建议：{sampleOpinion[action]}</div>
          </div>

          <div className="alert warning" style={{ marginTop: 14 }}>
            <strong>⚠ 注意事项：</strong>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>后端会逐张检查：角色权限、当前状态、材料完整性、操作锁</li>
              <li>任一单据不满足条件时，仅该单据被跳过，其余单据继续处理</li>
              <li>处理完成后会显示成功/失败明细，失败单据可在详情页单独处理</li>
            </ul>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>取消</button>
          <button
            className={isReject ? 'btn-warning' : 'btn-primary'}
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? '批量处理中...' : `确认${actionLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
