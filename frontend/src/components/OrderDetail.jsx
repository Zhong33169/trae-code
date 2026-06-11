import { useState, useEffect } from 'preact/hooks';
import { api } from '../api.js';
import ActionModal from './ActionModal.jsx';

function formatAmount(n) {
  return '¥' + Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  } catch (e) { return iso; }
}

function remainingTimeText(deadline, now = new Date()) {
  const diffMs = deadline - now;
  const absMs = Math.abs(diffMs);
  const h = Math.floor(absMs / (60 * 60 * 1000));
  const m = Math.floor((absMs % (60 * 60 * 1000)) / (60 * 1000));
  const prefix = diffMs >= 0 ? '剩' : '已逾期';
  if (h > 0) return `${prefix} ${h}小时${m}分`;
  return `${prefix} ${m}分钟`;
}

export default function OrderDetail({ id, meta, user, navigate, showToast }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAction, setShowAction] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [extendHours, setExtendHours] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [extending, setExtending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [d, logs] = await Promise.all([
        api.getOrder(id),
        api.auditLogsByOrder(id),
      ]);
      setData(d);
      setAuditLogs(logs.data || []);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id, refreshKey]);

  if (loading || !data) {
    return <div className="empty">加载中...</div>;
  }

  const { order, lockToken, allowedActions, role: respRole, roleName } = data;
  const statusLabel = meta?.statusNames?.[order.status] || order.status;
  const colorMap = {
    draft: 'gray', pending_verification: 'blue', verification_rejected: 'orange',
    pending_review: 'purple', review_rejected: 'red', archived: 'green', cancelled: 'gray',
  };

  const stageTimeout = meta?.stageTimeoutHours?.[order.status];
  const deadline = stageTimeout && order.stageEnteredAt
    ? new Date(new Date(order.stageEnteredAt).getTime() + stageTimeout * 60 * 60 * 1000)
    : null;

  function countTotalAmount(items) {
    return (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  }

  function isMaterialComplete(stage) {
    const required = meta?.requiredMaterials?.[stage] || [];
    const uploaded = order.materials?.[stage]?.items || [];
    const missing = required.filter(r => !uploaded.includes(r));
    return {
      complete: missing.length === 0,
      missing,
      required,
      uploaded,
    };
  }

  function getStageProgressInfo() {
    const stages = meta?.stages || [];
    const curIdx = stages.indexOf(order.currentStage);
    const stageMap = {
      [stages[0]]: ['draft', 'pending_verification', 'verification_rejected'],
      [stages[1]]: ['pending_verification', 'verification_rejected', 'pending_review', 'review_rejected'],
      [stages[2]]: ['pending_review', 'review_rejected', 'archived'],
    };
    return stages.map((s, idx) => {
      const inStage = stageMap[s]?.includes(order.status);
      let state = 'pending';
      if (order.status === 'archived' || order.status === 'cancelled' || idx < curIdx) {
        state = 'done';
      } else if (order.currentStage === s) {
        state = order.status.includes('rejected') ? 'rejected' : 'current';
      }
      const op = order.stageOpinions?.[s];
      return { stage: s, idx, state, inStage, opinion: op };
    });
  }

  function getBlockReasons() {
    const reasons = [];
    if (order.overdue) {
      reasons.push(`⏰ ${order.overdueReason || '已超过当前阶段时限'}`);
    }
    const curStage = order.currentStage;
    if (allowedActions.length === 0 && order.status !== 'archived' && order.status !== 'cancelled') {
      reasons.push(`🛡 当前角色「${roleName}」在本状态下无操作权限`);
    }
    const regCheck = isMaterialComplete((meta?.stages || [])[0]);
    const verCheck = isMaterialComplete((meta?.stages || [])[1]);
    const revCheck = isMaterialComplete((meta?.stages || [])[2]);
    if ((order.status === 'draft' || order.status === 'verification_rejected') && !regCheck.complete) {
      reasons.push(`📎 登记阶段材料缺失：${regCheck.missing.join('、')}`);
    }
    if ((order.status === 'pending_verification' || order.status === 'review_rejected') && !verCheck.complete) {
      reasons.push(`📎 核验阶段材料缺失：${verCheck.missing.join('、')}`);
    }
    if (order.status === 'pending_review' && !revCheck.complete) {
      reasons.push(`📎 复核阶段材料缺失：${revCheck.missing.join('、')}`);
    }
    return reasons;
  }

  function getProgressReasons() {
    const reasons = [];
    const stages = meta?.stages || [];
    const curCheck = isMaterialComplete(order.currentStage);
    if (curCheck.complete && !order.overdue && stages.includes(order.currentStage)) {
      reasons.push(`✅ 当前阶段「${order.currentStage}」材料全部齐全`);
    }
    const prevStages = stages.slice(0, stages.indexOf(order.currentStage));
    for (const s of prevStages) {
      const c = isMaterialComplete(s);
      const op = order.stageOpinions?.[s];
      reasons.push(`✅ 「${s}」${c.complete ? '材料齐全' : '材料处理中'}${op?.opinion ? '；处理意见：' + op.opinion.slice(0, 30) + (op.opinion.length > 30 ? '...' : '') : ''}`);
    }
    if (!order.overdue && deadline) {
      reasons.push(`⏳ 本阶段时限内，${remainingTimeText(deadline)}`);
    }
    if (allowedActions.length > 0) {
      reasons.push(`🛠 当前角色「${roleName}」可执行操作：${allowedActions.map(a => meta?.actionNames?.[a] || a).join('、')}`);
    }
    return reasons;
  }

  const blockReasons = getBlockReasons();
  const progressReasons = getProgressReasons();

  async function handleActionDone() {
    setShowAction(null);
    setRefreshKey(k => k + 1);
    showToast('操作成功', 'success');
  }

  async function handleExtend() {
    const hours = Number(extendHours);
    if (!hours || hours <= 0) {
      showToast('请输入有效延期小时数', 'error');
      return;
    }
    if (!extendReason.trim()) {
      showToast('请填写延期理由', 'error');
      return;
    }
    setExtending(true);
    try {
      await api.doAction(order.id, {
        action: 'overdue_extend',
        opinion: extendReason,
        lockToken,
        version: order.version,
        extendHours: hours,
      });
      setExtendHours('');
      setExtendReason('');
      setRefreshKey(k => k + 1);
      showToast('延期申请已提交', 'success');
    } catch (e) {
      showToast(e.message + (e.detail ? '：' + e.detail : ''), 'error');
    } finally {
      setExtending(false);
    }
  }

  return (
    <div>
      <div className="back-btn" onClick={() => navigate('list')}>← 返回列表</div>

      <div className="page-title-row">
        <h2>
          {order.orderNo} · {order.title}
          <span className={`tag ${colorMap[order.status] || 'gray'}`} style={{ marginLeft: 10 }}>{statusLabel}</span>
          {order.overdue && <span className="tag danger" style={{ marginLeft: 6 }}>⚠ 已逾期</span>}
        </h2>
        <div>
          <button onClick={() => setRefreshKey(k => k + 1)}>🔄 刷新</button>
          {allowedActions.length > 0 && allowedActions.map(a => (
            a === 'overdue_extend' ? (
              <button
                key={a}
                className="btn-warning"
                onClick={() => setShowAction('__extend__')}
                style={{ marginLeft: 6 }}
              >
                {meta?.actionNames?.[a] || a}
              </button>
            ) : (
              <button
                key={a}
                className={a.startsWith('approve') ? 'btn-success' : a.startsWith('reject') ? 'btn-warning' : 'btn-primary'}
                onClick={() => setShowAction(a)}
                style={{ marginLeft: 6 }}
              >
                {meta?.actionNames?.[a] || a}
              </button>
            )
          ))}
        </div>
      </div>

      {(blockReasons.length > 0 || progressReasons.length > 0) && (
        <div style={{ marginBottom: 16 }}>
          {blockReasons.length > 0 && (
            <div className="progress-reason-card block">
              <div className="pr-title">❌ 暂不能推进的原因</div>
              <ul>{blockReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
          {progressReasons.length > 0 && (
            <div className="progress-reason-card">
              <div className="pr-title">✅ 可以推进的依据</div>
              <ul>{progressReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {deadline && (
        <div className={`detail-card full-width`} style={{ marginBottom: 16, padding: '12px 16px' }}>
          <div className={`stage-time-card ${order.overdue ? 'overdue' : ''}`}>
            <div style={{ flex: 1 }}>
              <span className="time-label">当前阶段「{order.currentStage}」时限：</span>
              <span className="time-deadline">
                {stageTimeout} 小时 · 截止 {formatTime(deadline.toISOString())}
              </span>
              <span style={{ marginLeft: 12, fontWeight: 600 }}>
                {remainingTimeText(deadline)}
              </span>
            </div>
            {order.overdue && respRole && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  placeholder="延期小时数"
                  style={{ width: 120 }}
                  value={extendHours}
                  onInput={(e) => setExtendHours(e.target.value)}
                />
                <input
                  placeholder="延期理由"
                  style={{ width: 220 }}
                  value={extendReason}
                  onInput={(e) => setExtendReason(e.target.value)}
                />
                <button className="btn-primary btn-sm" disabled={extending} onClick={handleExtend}>
                  {extending ? '提交中...' : '申请延期'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="tabs">
        <div className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>基本信息</div>
        <div className={`tab ${activeTab === 'workflow' ? 'active' : ''}`} onClick={() => setActiveTab('workflow')}>审批流程 · 推进/退回原因</div>
        <div className={`tab ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>材料证据</div>
        <div className={`tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>审计日志 ({auditLogs.length})</div>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="detail-grid">
            <div className="detail-card">
              <h3>📋 订货单信息</h3>
              <div className="info-list">
                <div className="info-label">单号</div>
                <div className="info-value" style={{ fontWeight: 600 }}>{order.orderNo}</div>
                <div className="info-label">标题</div>
                <div className="info-value">{order.title}</div>
                <div className="info-label">门店</div>
                <div className="info-value">{order.store}</div>
                <div className="info-label">品类</div>
                <div className="info-value">{order.category}</div>
                <div className="info-label">供应商</div>
                <div className="info-value">{order.supplier}</div>
                <div className="info-label">总金额</div>
                <div className="info-value amount">{formatAmount(order.totalAmount)}</div>
                <div className="info-label">状态</div>
                <div className="info-value">
                  <span className={`tag ${colorMap[order.status] || 'gray'}`}>{statusLabel}</span>
                  <span style={{ marginLeft: 8 }} className="tag purple">{order.currentStage}</span>
                </div>
                <div className="info-label">创建人</div>
                <div className="info-value">{order.createdBy} · {formatTime(order.createdAt)}</div>
                <div className="info-label">更新时间</div>
                <div className="info-value">{formatTime(order.updatedAt)}</div>
                {order.archivedAt && (
                  <>
                    <div className="info-label">归档时间</div>
                    <div className="info-value">{formatTime(order.archivedAt)}</div>
                  </>
                )}
                <div className="info-label">版本</div>
                <div className="info-value">v{order.version}</div>
              </div>
            </div>

            <div className="detail-card">
              <h3>🔀 流程状态</h3>
              <div className="timeline">
                {getStageProgressInfo().map(({ stage, state, opinion }) => (
                  <div key={stage} className="timeline-item">
                    <div className={`timeline-dot ${state}`} />
                    <div className="timeline-title">
                      {stage}
                      {state === 'done' && <span className="tag green">已通过</span>}
                      {state === 'current' && <span className="tag blue">进行中</span>}
                      {state === 'rejected' && <span className="tag orange">退回待补正</span>}
                      {state === 'pending' && <span className="tag gray">未开始</span>}
                    </div>
                    <div className="timeline-meta">
                      {opinion
                        ? `${opinion.operatorName || opinion.operator}（${meta?.roleNames?.[opinion.operatorRole] || opinion.operatorRole}）· ${formatTime(opinion.createdAt)}`
                        : state === 'pending' ? '等待前序阶段完成' : '暂无处理意见'}
                    </div>
                    {opinion && (
                      <>
                        <div className={`timeline-opinion ${opinion.action?.startsWith('approve') ? 'approve' : opinion.action?.startsWith('reject') ? 'reject' : ''}`}>
                          <strong>{meta?.actionNames?.[opinion.action] || opinion.action || '处理意见'}：</strong>
                          {opinion.opinion}
                        </div>
                        <div className="timeline-checks">
                          <span className={`check-tag ${opinion.materialsVerified ? 'ok' : 'fail'}`}>
                            {opinion.materialsVerified ? '✓' : '✗'} 材料齐全
                          </span>
                          <span className={`check-tag ${opinion.timelineVerified ? 'ok' : 'fail'}`}>
                            {opinion.timelineVerified ? '✓' : '✗'} 时限合规
                          </span>
                        </div>
                        {opinion.rejectReasons && opinion.rejectReasons.length > 0 && (
                          <div className="timeline-reject-reasons">
                            <div className="reason-title">⚠ 退回原因明细：</div>
                            <ul>{opinion.rejectReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-card full-width">
              <h3>🛒 订货明细</h3>
              <table className="items-table">
                <thead>
                  <tr>
                    <th>商品名称</th>
                    <th>规格</th>
                    <th>数量</th>
                    <th>单位</th>
                    <th style={{ textAlign: 'right' }}>单价</th>
                    <th style={{ textAlign: 'right' }}>小计</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((it, i) => (
                    <tr key={i}>
                      <td>{it.name}</td>
                      <td>{it.spec}</td>
                      <td>{it.qty}</td>
                      <td>{it.unit}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(it.price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatAmount(Number(it.qty) * Number(it.price))}
                      </td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan="5" style={{ textAlign: 'right' }}>合计</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)', fontSize: 15 }}>
                      {formatAmount(countTotalAmount(order.items))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'workflow' && (
        <div className="detail-card full-width">
          <h3>🔀 完整审批流程 · 推进/退回原因明细</h3>
          <div className="timeline" style={{ marginTop: 8 }}>
            {getStageProgressInfo().map(({ stage, state, opinion }) => (
              <div key={stage} className="timeline-item">
                <div className={`timeline-dot ${state}`} />
                <div className="timeline-title">
                  {stage}
                  {state === 'done' && <span className="tag green">已完成 · 推进到下一阶段</span>}
                  {state === 'current' && !order.status.includes('rejected') && <span className="tag blue">当前阶段 · 待推进</span>}
                  {state === 'rejected' && <span className="tag orange">本阶段退回 · 待补正</span>}
                  {state === 'pending' && <span className="tag gray">未开始</span>}
                </div>
                <div className="timeline-meta">
                  {opinion
                    ? `${opinion.operatorName || opinion.operator}（${meta?.roleNames?.[opinion.operatorRole] || opinion.operatorRole}）· ${formatTime(opinion.createdAt)}`
                    : state === 'pending' ? '等待前序阶段完成' : '暂无处理意见'}
                </div>

                {!opinion && state === 'current' && (
                  <div style={{ marginTop: 8 }}>
                    <div className="alert info" style={{ margin: 0 }}>
                      <strong>本阶段为何能推进？</strong>
                      <div style={{ marginTop: 6 }}>
                        {progressReasons.length > 0
                          ? <ul style={{ margin: 0, paddingLeft: 18 }}>{progressReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                          : '满足条件：角色权限匹配、材料齐全、时限未过期、版本号匹配。'}
                      </div>
                    </div>
                  </div>
                )}

                {opinion && (
                  <div style={{ marginTop: 8 }}>
                    {opinion.action?.startsWith('approve') && (
                      <div className="progress-reason-card" style={{ margin: '6px 0' }}>
                        <div className="pr-title">✅ 为何能推进？— 通过依据</div>
                        <ul>
                          <li>动作：{meta?.actionNames?.[opinion.action] || opinion.action}</li>
                          <li>处理意见：{opinion.opinion}</li>
                          {opinion.materialsVerified && <li>材料齐全，核验通过</li>}
                          {opinion.timelineVerified && <li>时限合规，未逾期</li>}
                        </ul>
                      </div>
                    )}
                    {opinion.action?.startsWith('reject') && (
                      <div className="progress-reason-card block" style={{ margin: '6px 0' }}>
                        <div className="pr-title">❌ 为何被退回？— 退回原因</div>
                        <ul>
                          <li>动作：{meta?.actionNames?.[opinion.action] || opinion.action}</li>
                          <li>处理意见：{opinion.opinion}</li>
                          {opinion.rejectReasons?.length > 0 && opinion.rejectReasons.map((r, i) => (
                            <li key={i}>退回明细 {i + 1}：{r}</li>
                          ))}
                          {!opinion.materialsVerified && <li>材料缺失，核验未通过</li>}
                        </ul>
                      </div>
                    )}
                    <div className="timeline-checks">
                      <span className={`check-tag ${opinion.materialsVerified ? 'ok' : 'fail'}`}>
                        {opinion.materialsVerified ? '✓' : '✗'} 材料校验
                      </span>
                      <span className={`check-tag ${opinion.timelineVerified ? 'ok' : 'fail'}`}>
                        {opinion.timelineVerified ? '✓' : '✗'} 时限校验
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="detail-card full-width">
          <h3>📎 各阶段材料证据（材料不齐将导致无法推进）</h3>
          <div className="material-list" style={{ marginTop: 8 }}>
            {(meta?.stages || []).map(stage => {
              const info = isMaterialComplete(stage);
              const uploadedAt = order.materials?.[stage]?.uploadedAt;
              return (
                <div key={stage} className="material-stage">
                  <div className="material-stage-title">
                    <span>
                      第 {(meta?.stages || []).indexOf(stage) + 1} 阶段 · {stage}
                    </span>
                    <span className="stage-state">
                      {info.complete
                        ? <span className="tag green">✅ 材料齐全，可推进</span>
                        : <span className="tag orange">⚠ 缺失 {info.missing.length} 项，暂不能推进</span>}
                    </span>
                  </div>
                  <div className="help-text" style={{ marginBottom: 6 }}>
                    需要材料：{info.required.join('、')}
                  </div>
                  <div className="material-items">
                    {info.required.map(req => (
                      <span
                        key={req}
                        className={`material-item ${info.uploaded.includes(req) ? 'uploaded' : 'missing'}`}
                      >
                        {info.uploaded.includes(req) ? '✔' : '✗'} {req}
                      </span>
                    ))}
                  </div>
                  {uploadedAt && (
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>
                      上传时间：{formatTime(uploadedAt)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="detail-card full-width">
          <h3>📜 审计日志（按时间倒序）</h3>
          <table className="audit-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ width: 80 }}>时间</th>
                <th style={{ width: 140 }}>操作人 / 角色</th>
                <th style={{ width: 120 }}>动作</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 && (
                <tr><td colSpan="4" className="empty">暂无日志</td></tr>
              )}
              {auditLogs.map(l => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{formatTime(l.createdAt)}</td>
                  <td>
                    <div>{l.operator}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                      {meta?.roleNames?.[l.operatorRole] || l.operatorRole}
                    </div>
                  </td>
                  <td>
                    <span className="tag blue">{meta?.actionNames?.[l.action] || l.actionName || l.action}</span>
                  </td>
                  <td style={{ lineHeight: 1.6 }}>{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAction && showAction !== '__extend__' && (
        <ActionModal
          action={showAction}
          order={order}
          lockToken={lockToken}
          role={respRole}
          meta={meta}
          onClose={() => setShowAction(null)}
          onConfirm={handleActionDone}
          showToast={showToast}
        />
      )}
    </div>
  );
}
