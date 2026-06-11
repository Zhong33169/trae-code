import { useState, useEffect, useMemo } from 'preact/hooks';
import { api } from '../api.js';

export default function BatchActionModal({ action, orderIds, role, meta, onClose, onConfirm, showToast }) {
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
  const isSubmitLike = action === 'submit' || action === 'correct_submit';

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opinion, setOpinion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sampleOpinion = {
    approve_verify: '批量核验通过：核验材料齐全，价格与供应商确认无误，统一推进至复核。',
    reject_verify: '批量退回：需补充供应商确认回执（附最新盖章版），价格异常单需附说明。',
    approve_review: '批量复核归档：总部预算额度范围内，合规材料齐全，统一归档。',
    reject_review: '批量退回复核：补充财务签字版预算核对单后重新提交。',
    submit: '批量提交：门店常规补货，参考本月销售预测及库存数据测算。',
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.previewBatch({ action, orderIds });
        if (!cancelled) setPreview(res);
      } catch (e) {
        if (!cancelled) showToast(`预检失败：${e.message}`, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [action, orderIds.join(',')]);

  const versionMap = useMemo(() => {
    const m = {};
    if (preview?.orders) {
      for (const o of preview.orders) {
        if (o.orderId && o.version != null) m[o.orderId] = o.version;
      }
    }
    return m;
  }, [preview]);

  const mixedSubmit = preview?.summary?.mixedSubmitStatuses;
  const canProcessCount = preview?.summary?.canProcess ?? 0;
  const blockedCount = preview?.summary?.blocked ?? 0;
  const overdueCount = preview?.summary?.overdue ?? 0;
  const missingMatCount = preview?.summary?.missingMaterials ?? 0;
  const permissionCount = preview?.summary?.permissionDenied ?? 0;

  function canConfirm() {
    if (loading || !preview) return false;
    if (mixedSubmit) return false;
    if (!opinion.trim() || opinion.trim().length < 5) return false;
    if (canProcessCount === 0) return false;
    return true;
  }

  async function handleConfirm() {
    if (!canConfirm()) return;
    setSubmitting(true);
    try {
      const versions = orderIds.map(id => versionMap[id] ?? null);
      await onConfirm({ action, opinion: opinion.trim(), versions });
    } finally {
      setSubmitting(false);
    }
  }

  function statusColor(status) {
    const map = {
      draft: 'gray', pending_verification: 'blue', verification_rejected: 'orange',
      pending_review: 'purple', review_rejected: 'red', archived: 'green', cancelled: 'gray',
    };
    return map[status] || 'gray';
  }

  return (
    <div className="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal" style={{ width: 920, maxWidth: '95vw' }}>
        <div className="modal-header">
          <h3>
            {isApprove && '✅ '}{isReject && '⚠ '}{isSubmitLike && '📋 '}
            {actionLabel}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="alert info">正在逐单预检可推进性...</div>
          ) : (
            <>
              {mixedSubmit && (
                <div className="alert danger" style={{ marginBottom: 12 }}>
                  <strong>❌ 状态混用，无法批量提交</strong>
                  <div style={{ marginTop: 6 }}>
                    当前选中单据包含：
                    {preview.summary.mixedSubmitStatusList.map((s, i) => (
                      <span key={s.value} style={{ marginRight: 8 }}>
                        <span className={`tag ${statusColor(s.value)}`}>{s.label}</span>
                        {i < preview.summary.mixedSubmitStatusList.length - 1 && ' + '}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    草稿单（初次提交）和核验退回单（补正后重提交）的动作语义不同，必须分开批量。请在列表中按状态筛选后再执行批量。
                  </div>
                </div>
              )}

              <div className="batch-summary-row">
                <div className="stat-chip primary">共 {orderIds.length} 张</div>
                <div className="stat-chip success">可推进 {canProcessCount}</div>
                <div className="stat-chip danger">被阻断 {blockedCount}</div>
                {overdueCount > 0 && <div className="stat-chip warning">⏰ 逾期 {overdueCount}</div>}
                {missingMatCount > 0 && <div className="stat-chip warning">📎 缺材料 {missingMatCount}</div>}
                {permissionCount > 0 && <div className="stat-chip danger">🚫 无权 {permissionCount}</div>}
              </div>

              {preview && preview.summary.statusDistribution && (
                <div style={{ fontSize: 12, color: 'var(--gray-600)', margin: '6px 0 12px' }}>
                  状态分布：
                  {Object.entries(preview.summary.statusDistribution).map(([s, c]) => (
                    <span key={s} style={{ marginRight: 12 }}>
                      <span className={`tag ${statusColor(s)}`} style={{ marginRight: 4 }}>
                        {meta?.statusNames?.[s] || s}
                      </span>
                      {c}张
                    </span>
                  ))}
                </div>
              )}

              <div className="preview-table-wrap">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>单号 / 标题</th>
                      <th style={{ width: 80 }}>当前状态</th>
                      <th style={{ width: 60 }}>版本</th>
                      <th style={{ width: 120 }}>将执行动作 → 目标</th>
                      <th style={{ width: 110 }}>材料</th>
                      <th style={{ width: 110 }}>时限</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview?.orders?.map(o => (
                      <tr key={o.orderId} className={o.canProcess ? '' : 'blocked-row'}>
                        <td style={{ textAlign: 'center' }}>
                          {o.canProcess ? <span style={{ color: 'var(--success)' }}>✅</span> : <span style={{ color: 'var(--danger)' }}>❌</span>}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{o.orderNo || '不存在'}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{o.title || '-'}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{o.store || ''}</div>
                          {!o.canProcess && o.blockReasons && o.blockReasons.length > 0 && (
                            <div className="block-reasons" style={{ marginTop: 4 }}>
                              {o.blockReasons.map((r, i) => (
                                <div key={i} style={{ fontSize: 11, color: 'var(--danger)' }}>• {r}</div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          {o.status ? (
                            <span className={`tag ${statusColor(o.status)}`}>{o.statusName}</span>
                          ) : <span className="tag gray">-</span>}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--gray-600)' }}>
                            v{o.version ?? '-'}
                          </span>
                        </td>
                        <td>
                          {o.canProcess ? (
                            <>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{o.effectiveActionName}</div>
                              <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                                → <span className={`tag ${statusColor(o.nextStatus)}`} style={{ marginTop: 2 }}>{o.nextStatusName}</span>
                              </div>
                            </>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>不执行</span>
                          )}
                        </td>
                        <td>
                          {o.missingMaterials && o.missingMaterials.length > 0 ? (
                            <>
                              <div style={{ color: 'var(--warning)', fontSize: 12, fontWeight: 600 }}>
                                ❌ 缺 {o.missingMaterials.length} 项
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--gray-600)', lineHeight: 1.4 }}>
                                {o.missingMaterials.join('、')}
                              </div>
                            </>
                          ) : o.canProcess ? (
                            <span style={{ color: 'var(--success)', fontSize: 12 }}>✅ 齐全</span>
                          ) : (
                            <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>-</span>
                          )}
                        </td>
                        <td>
                          {o.overdue ? (
                            <>
                              <div style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>⏰ 已逾期</div>
                              <div style={{ fontSize: 11, color: 'var(--gray-600)', lineHeight: 1.4 }}>
                                {o.overdueReason?.slice(0, 40)}{o.overdueReason?.length > 40 ? '...' : ''}
                              </div>
                            </>
                          ) : o.canProcess ? (
                            <span style={{ color: 'var(--success)', fontSize: 12 }}>✅ 正常</span>
                          ) : (
                            <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
                  💬 <span className="required" style={{ color: 'var(--danger)' }}>*</span> 批量处理意见（至少5字符）
                </label>
                <textarea
                  style={{ width: '100%', minHeight: 80, marginTop: 6 }}
                  placeholder={sampleOpinion[action] || '请填写统一处理意见...'}
                  value={opinion}
                  onInput={(e) => setOpinion(e.target.value)}
                  disabled={!canConfirm() && !opinion}
                />
                <div className="help-text">💡 建议：{sampleOpinion[action]}</div>
              </div>

              <div className="alert info" style={{ marginTop: 12, fontSize: 12 }}>
                <strong>📌 执行说明：</strong>
                <ul style={{ margin: '6px 0 0 18px', padding: 0, lineHeight: 1.6 }}>
                  <li>每张单据独立校验：角色权限、状态顺序、材料完整性、时限逾期、<strong>版本乐观锁</strong>、操作锁token</li>
                  <li>提交时携带每张单的版本号（如上表 v 列），若版本不一致则该单被阻断，不影响其余单据</li>
                  <li>版本冲突说明单据已被他人修改，请刷新列表获取最新版本后重试</li>
                  <li>草稿与核验退回单必须分开批量（动作语义不同：初次提交 vs 补正重提交）</li>
                </ul>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>取消</button>
          <button
            className={isReject ? 'btn-warning' : 'btn-primary'}
            disabled={!canConfirm() || submitting}
            onClick={handleConfirm}
          >
            {submitting
              ? '批量处理中...'
              : mixedSubmit
                ? '状态混用，不可执行'
                : canProcessCount === 0
                  ? '无可推进单据'
                  : `确认${actionLabel}（${canProcessCount}张）`}
          </button>
        </div>
      </div>
    </div>
  );
}
