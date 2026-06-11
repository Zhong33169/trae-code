import { useState, useMemo } from 'preact/hooks';
import { api } from '../api.js';

export default function ActionModal({ action, order, lockToken, role, meta, onClose, onConfirm, showToast }) {
  const actionLabel = meta?.actionNames?.[action] || action;
  const isApprove = action?.startsWith('approve');
  const isReject = action?.startsWith('reject');
  const isSubmit = action === 'submit' || action === 'correct_submit';

  const stages = meta?.stages || [];
  const stageMap = {
    submit: stages[0],
    correct_submit: stages[0],
    approve_verify: stages[1],
    reject_verify: stages[1],
    approve_review: stages[2],
    reject_review: stages[2],
  };
  const currentStage = stageMap[action] || '';
  const requiredMaterials = meta?.requiredMaterials?.[currentStage] || [];
  const existingMaterials = order?.materials?.[currentStage]?.items || [];

  const nextStatusMap = {
    submit: 'pending_verification',
    correct_submit: 'pending_verification',
    approve_verify: 'pending_review',
    reject_verify: 'verification_rejected',
    approve_review: 'archived',
    reject_review: 'review_rejected',
  };
  const nextStatus = nextStatusMap[action];

  const [opinion, setOpinion] = useState('');
  const [materials, setMaterials] = useState([...existingMaterials]);
  const [submitting, setSubmitting] = useState(false);

  const sampleHints = {
    submit: '说明：本周销量环比上涨20%，按1.2倍系数补货；参考上月同期及库存快照测算；预计6月15日前到货满足端午客流。',
    correct_submit: '补正说明：1.已补充「历史订货参考数据」（附上月3次同品类订货记录）；2.一次性餐盒数量调整为12箱（核对外卖订单增长后测算）；3.补充上月库存消耗明细表。',
    approve_verify: '核验通过：库存核验显示门店库存安全水位线以下，补货合理；3家供应商比价后价格合理；供应商确认3日内送达；价格核对与预算额度一致。',
    reject_verify: '退回原因（分号分隔）：1.缺少「供应商确认回执」，供应商无法保证3日内到货；2.冷鲜猪五花肉单价较上次上涨12%，需附价格异常说明；3.订货量超出月度预算剩余额度。',
    approve_review: '复核归档通过：1.采购金额在门店月度预算剩余额度内；2.总部库房无相同品类可调配，同意门店直采；3.供应商资质、食品检疫证明合规；4.财务入账口径确认无误。',
    reject_review: '复核退回原因（分号分隔）：1.缺少「财务预算核对单」签字版；2.采购品类与总部Q2集采品类冲突，需走调配流程；3.订货量与销售预测偏离度超30%，需门店重核。',
  };

  const missingMaterials = requiredMaterials.filter(m => !materials.includes(m));

  function toggleMaterial(m) {
    setMaterials(prev => {
      const has = prev.includes(m);
      return has ? prev.filter(x => x !== m) : [...prev, m];
    });
  }

  async function handleConfirm() {
    if (!opinion.trim() || opinion.trim().length < 10) {
      return showToast('处理意见至少10个字符', 'error');
    }
    if (isApprove || isSubmit) {
      if (missingMaterials.length > 0) {
        return showToast(`材料不全，缺失：${missingMaterials.join('、')}`, 'error');
      }
    }
    if (order.overdue) {
      return showToast('该单据已逾期，请先申请延期或刷新后重试', 'error');
    }
    setSubmitting(true);
    try {
      await api.doAction(order.id, {
        action,
        opinion: opinion.trim(),
        lockToken,
        version: order.version,
        materials: requiredMaterials.length > 0 ? materials : undefined,
      });
      onConfirm?.();
    } catch (e) {
      if (e.concurrencyError) {
        showToast('并发冲突：' + e.message + '。请刷新页面重新获取操作锁', 'error');
      } else if (e.versionError) {
        showToast(`版本冲突：${e.message}。当前最新版本 v${e.currentVersion}，请刷新后重试`, 'error');
      } else {
        showToast(e.message + (e.detail ? '（' + e.detail + '）' : ''), 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal">
        <div className="modal-header">
          <h3>
            {isApprove && '✅ '}{isReject && '⚠ '}{isSubmit && '📨 '}
            {actionLabel}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 12, padding: 10, background: 'var(--gray-50)', borderRadius: 6, fontSize: 12 }}>
            单据：<strong>{order.orderNo}</strong> · {order.title}
            <div style={{ marginTop: 4, color: 'var(--gray-600)' }}>
              当前状态：<span className="tag gray">{meta?.statusNames?.[order.status]}</span>
              → 下一状态：<span className={isReject ? 'tag orange' : isApprove ? 'tag green' : 'tag blue'}>{meta?.statusNames?.[nextStatus]}</span>
              <span style={{ marginLeft: 10 }}>版本 v{order.version}</span>
            </div>
          </div>

          <div className={`alert ${isReject ? 'warning' : 'info'}`}>
            <strong>操作提示：</strong>
            <div style={{ marginTop: 4 }}>
              {isSubmit && '提交后将进入「过程核验」队列，由门店订货审核主管核验。'}
              {isApprove && action === 'approve_verify' && '核验通过后将进入「复核归档」队列，由餐饮连锁总部复核负责人进行最终复核。'}
              {isApprove && action === 'approve_review' && '复核通过后订货单将正式归档，进入财务和供应链执行流程，不可回退。'}
              {isReject && action === 'reject_verify' && '退回后单据将回到门店订货登记员队列，需按退回原因补正后重新提交。'}
              {isReject && action === 'reject_review' && '退回后单据将回到门店订货审核主管队列，需按退回原因重核后再次提交复核。'}
            </div>
          </div>

          {requiredMaterials.length > 0 && (
            <div style={{ margin: '12px 0' }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
                📎 「{currentStage}」阶段材料
                <span style={{ marginLeft: 6, fontWeight: 'normal', fontSize: 12, color: isApprove || isSubmit ? 'var(--danger)' : 'var(--gray-500)' }}>
                  {isApprove || isSubmit ? '（推进需全部齐全）' : '（退回无强制要求，但建议勾选已核验材料）'}
                </span>
              </label>
              <div className="checkbox-group" style={{ marginTop: 6 }}>
                {requiredMaterials.map(m => (
                  <label key={m} className={materials.includes(m) ? 'checked' : ''}>
                    <input type="checkbox" checked={materials.includes(m)} onChange={() => toggleMaterial(m)} />
                    {m}
                    {existingMaterials.includes(m) && !materials.includes(m) && <span style={{ color: 'var(--warning)', marginLeft: 4, fontSize: 11 }}>（原已上传）</span>}
                  </label>
                ))}
              </div>
              {(isApprove || isSubmit) && missingMaterials.length > 0 && (
                <div className="alert error" style={{ marginTop: 8, padding: '8px 10px' }}>
                  ❌ 材料缺失：{missingMaterials.join('、')}
                </div>
              )}
              {(isApprove || isSubmit) && missingMaterials.length === 0 && requiredMaterials.length > 0 && (
                <div className="alert success" style={{ marginTop: 8, padding: '8px 10px' }}>
                  ✅ 本阶段材料齐全，可推进
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
              💬 <span className="required" style={{ color: 'var(--danger)' }}>*</span> 处理意见
              <span style={{ marginLeft: 6, fontWeight: 'normal', fontSize: 12, color: 'var(--gray-500)' }}>（至少10个字符，越详细越便于后续追溯）</span>
            </label>
            <textarea
              style={{ width: '100%', minHeight: 120, marginTop: 6 }}
              placeholder={sampleHints[action] || '请详细说明处理依据和原因...'}
              value={opinion}
              onInput={(e) => setOpinion(e.target.value)}
            />
            <div className="help-text" style={{ marginTop: 4 }}>
              💡 参考示例：{sampleHints[action]}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: opinion.length >= 10 ? 'var(--success)' : 'var(--warning)' }}>
              当前字数：{opinion.length} / 建议 20-200 字符
            </div>
          </div>

          <div className="alert warning" style={{ marginTop: 14, padding: '8px 10px' }}>
            <strong>🛡 安全校验：</strong>
            提交时后端将再次校验①角色权限 ②操作顺序 ③材料齐全 ④版本号（v{order.version}） ⑤操作锁（lockToken） ⑥时限是否逾期。任一条件不满足将拒绝推进。
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>取消</button>
          <button
            className={isReject ? 'btn-warning' : 'btn-primary'}
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? '提交中...' : `确认${actionLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
