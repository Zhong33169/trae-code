import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { userApi, orderApi } from '../api';
import type {
  User,
  SparePartOrder,
  ProcessRecord,
  UserRole,
  OrderStatus,
  EvidenceItem,
} from '../types';
import {
  STATUS_LABELS,
  ROLE_LABELS,
  statusClass,
  formatTime,
  canSubmit,
  canVerify,
  canReview,
  canArchive,
} from '../utils';

const CURRENT_USER_KEY = 'sp_current_user';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [order, setOrder] = useState<SparePartOrder | null>(null);
  const [records, setRecords] = useState<ProcessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opinion, setOpinion] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [evidenceName, setEvidenceName] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [newEvidence, setNewEvidence] = useState<EvidenceItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const currentUser = users.find((u) => u.id === currentUserId);
  const currentRole = (currentUser?.role as UserRole) || 'registrar';

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [o, r, u] = await Promise.all([
        orderApi.detail(id),
        orderApi.records(id),
        userApi.listUsers(),
      ]);
      setOrder(o);
      setRecords(r);
      setUsers(u);
      if (!currentUserId && u.length > 0) {
        const saved = localStorage.getItem(CURRENT_USER_KEY);
        const defaultId = saved && u.find((x) => x.id === saved) ? saved : u[0].id;
        setCurrentUserId(defaultId);
        localStorage.setItem(CURRENT_USER_KEY, defaultId);
      }
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const switchUser = (uid: string) => {
    setCurrentUserId(uid);
    localStorage.setItem(CURRENT_USER_KEY, uid);
  };

  const resetForm = () => {
    setOpinion('');
    setAppealReason('');
    setEvidenceName('');
    setEvidenceUrl('');
    setNewEvidence([]);
  };

  const addEvidence = () => {
    if (!evidenceName.trim()) return;
    setNewEvidence([
      ...newEvidence,
      {
        name: evidenceName.trim(),
        url: evidenceUrl.trim() || `/demo/evidence/${Date.now()}`,
        uploaded_at: new Date().toISOString(),
      },
    ]);
    setEvidenceName('');
    setEvidenceUrl('');
  };

  const removeEvidence = (idx: number) => {
    setNewEvidence(newEvidence.filter((_, i) => i !== idx));
  };

  const checkPrereq = () => {
    if (!order || !currentUser) return false;
    if (order.current_handler_id !== currentUser.id) {
      setError(`当前处理人为 ${order.current_handler_name}，您不是当前处理人`);
      return false;
    }
    if (order.current_handler_role !== currentUser.role) {
      setError(`角色不匹配，当前需要 ${ROLE_LABELS[order.current_handler_role]}`);
      return false;
    }
    return true;
  };

  const handleAction = async (
    fn: () => Promise<any>,
    needOpinion = false,
    minEvidence = 0,
    needAppealReason = false,
  ) => {
    setError('');
    if (!order || !currentUser) return;
    if (!checkPrereq()) return;
    if (needOpinion && !opinion.trim()) {
      setError('请填写处理意见');
      return;
    }
    if (needAppealReason && !appealReason.trim()) {
      setError('请填写申诉/补正说明');
      return;
    }
    const totalEvidence = (order?.evidence.length || 0) + newEvidence.length;
    if (totalEvidence < minEvidence) {
      setError(`至少需要 ${minEvidence} 份证据，当前共 ${totalEvidence} 份（已有 ${order?.evidence.length} + 新增 ${newEvidence.length}）`);
      return;
    }
    setActionLoading(true);
    try {
      await fn();
      resetForm();
      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data || e?.message || '操作失败';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setActionLoading(false);
    }
  };

  const doSubmit = () => {
    const needReason = ['verify_returned', 'appeal_rejected_correction', 'review_returned'].includes(status);
    return handleAction(
      () =>
        orderApi.submit({
          order_id: order!.id,
          version: order!.version,
          handler_id: currentUser!.id,
          opinion: needReason ? appealReason : opinion,
          evidence: newEvidence.length ? newEvidence : undefined,
          appeal_reason: needReason ? appealReason : undefined,
        }),
      false,
      2,
      needReason,
    );
  };

  const doVerifyPass = () =>
    handleAction(
      () =>
        orderApi.verify({
          order_id: order!.id,
          version: order!.version,
          handler_id: currentUser!.id,
          opinion: opinion || '核验通过，提交复核。',
          decision: 'pass',
        }),
      false,
      2,
    );

  const doVerifyReturn = () =>
    handleAction(
      () =>
        orderApi.verify({
          order_id: order!.id,
          version: order!.version,
          handler_id: currentUser!.id,
          opinion,
          decision: 'return',
        }),
      true,
      0,
    );

  const doReviewAccept = () =>
    handleAction(
      () =>
        orderApi.review({
          order_id: order!.id,
          version: order!.version,
          handler_id: currentUser!.id,
          opinion: opinion || '申诉受理，证据充分，进入复核。',
          decision: 'accept',
        }),
      false,
      2,
    );

  const doReviewConfirm = () =>
    handleAction(
      () =>
        orderApi.review({
          order_id: order!.id,
          version: order!.version,
          handler_id: currentUser!.id,
          opinion: opinion || '复核通过，同意归档。',
          decision: 'confirm',
        }),
      false,
      2,
    );

  const doReviewReturn = () =>
    handleAction(
      () =>
        orderApi.review({
          order_id: order!.id,
          version: order!.version,
          handler_id: currentUser!.id,
          opinion,
          decision: 'return',
        }),
      true,
      0,
    );

  const doReviewRejectCorrection = () =>
    handleAction(
      () =>
        orderApi.review({
          order_id: order!.id,
          version: order!.version,
          handler_id: currentUser!.id,
          opinion,
          decision: 'reject_correction',
        }),
      true,
      0,
    );

  const doArchive = () =>
    handleAction(
      () =>
        orderApi.archive({
          order_id: order!.id,
          version: order!.version,
          handler_id: currentUser!.id,
          opinion: opinion || '复核通过，流程合规，同意归档。',
        }),
      false,
      2,
    );

  if (loading) return <div className="empty-state">加载中...</div>;
  if (!order) return <div className="empty-state">单据不存在</div>;

  const isMyTurn = currentUser?.id === order.current_handler_id && currentUser?.role === order.current_handler_role;
  const status = order.status as OrderStatus;

  return (
    <div>
      <div className="back-link" onClick={() => navigate('/')}>
        ← 返回列表
      </div>

      <div className="page-header">
        <h1 className="page-title">
          备件更换单详情
          <span style={{ marginLeft: 12, fontSize: 14, color: '#6b7280', fontFamily: 'monospace' }}>
            {order.order_no}
          </span>
        </h1>
        <div className="user-switcher">
          <label>当前角色：</label>
          <select value={currentUserId} onChange={(e) => switchUser(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({ROLE_LABELS[u.role]})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {!isMyTurn && order.status !== 'archived' && (
        <div className="info-alert">
          当前处理人为 <b>{order.current_handler_name}</b>（{ROLE_LABELS[order.current_handler_role]}），您现在是查看视角。切换用户可办理。
        </div>
      )}

      <div className="detail-layout">
        <div>
          <div className="card">
            <div className="card-title">基本信息</div>
            <div className="field-row">
              <div className="field-label">当前状态</div>
              <div className="field-value">
                <span className={statusClass(order.status)}>
                  {STATUS_LABELS[order.status] || order.status}
                </span>
                {order.is_overdue && <span className="badge badge-overdue">逾期</span>}
                {order.is_evidence_missing && <span className="badge badge-missing">缺证据</span>}
                <span style={{ marginLeft: 12, color: '#6b7280', fontSize: 13 }}>
                  版本号 v{order.version}
                </span>
              </div>
            </div>
            <div className="field-row">
              <div className="field-label">标题</div>
              <div className="field-value">{order.title}</div>
            </div>
            <div className="field-row">
              <div className="field-label">电站名称</div>
              <div className="field-value">{order.station_name}</div>
            </div>
            <div className="field-row">
              <div className="field-label">备件名称</div>
              <div className="field-value">{order.part_name}</div>
            </div>
            <div className="field-row">
              <div className="field-label">备件型号</div>
              <div className="field-value">{order.part_model}</div>
            </div>
            <div className="field-row">
              <div className="field-label">数量</div>
              <div className="field-value">{order.quantity}</div>
            </div>
            <div className="field-row">
              <div className="field-label">更换原因</div>
              <div className="field-value">{order.reason}</div>
            </div>
            <div className="field-row">
              <div className="field-label">登记员</div>
              <div className="field-value">{order.registrar_name}</div>
            </div>
            <div className="field-row">
              <div className="field-label">当前处理人</div>
              <div className="field-value">
                {order.current_handler_name}（{ROLE_LABELS[order.current_handler_role]}）
              </div>
            </div>
            {order.deadline && (
              <div className="field-row">
                <div className="field-label">办理截止</div>
                <div className="field-value">{formatTime(order.deadline)}</div>
              </div>
            )}
            <div className="field-row">
              <div className="field-label">创建时间</div>
              <div className="field-value">{formatTime(order.created_at)}</div>
            </div>
            <div className="field-row">
              <div className="field-label">更新时间</div>
              <div className="field-value">{formatTime(order.updated_at)}</div>
            </div>
          </div>

          {(order.appeal_reason || order.review_opinion || order.reject_reason || order.original_status) && (
            <div className="card">
              <div className="card-title">申诉与复核信息</div>
              {order.original_status && (
                <div className="field-row">
                  <div className="field-label">原状态</div>
                  <div className="field-value">
                    <span className={statusClass(order.original_status)}>
                      {STATUS_LABELS[order.original_status] || order.original_status}
                    </span>
                  </div>
                </div>
              )}
              {order.appeal_reason && (
                <div className="field-row">
                  <div className="field-label">申诉理由</div>
                  <div className="field-value" style={{ background: '#fffbeb', padding: 8, borderRadius: 6 }}>
                    {order.appeal_reason}
                  </div>
                </div>
              )}
              {order.reject_reason && (
                <div className="field-row">
                  <div className="field-label">驳回/退回原因</div>
                  <div className="field-value" style={{ background: '#fef2f2', padding: 8, borderRadius: 6 }}>
                    {order.reject_reason}
                  </div>
                </div>
              )}
              {order.review_opinion && (
                <div className="field-row">
                  <div className="field-label">复核意见</div>
                  <div className="field-value" style={{ background: '#ecfdf5', padding: 8, borderRadius: 6 }}>
                    {order.review_opinion}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="card-title">证据材料（{order.evidence.length}）</div>
            {order.evidence.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>暂无证据</div>
            ) : (
              <div className="evidence-list">
                {order.evidence.map((ev, i) => (
                  <div key={i} className="evidence-item">
                    <span>📎</span>
                    <span style={{ flex: 1 }}>{ev.name}</span>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{formatTime(ev.uploaded_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">处理记录</div>
            <div className="timeline">
              {records.map((r) => (
                <div key={r.id} className="timeline-item">
                  <div className="timeline-action">{r.action}</div>
                  <div className="timeline-meta">
                    {r.handler_name}（{ROLE_LABELS[r.handler_role]}）· {formatTime(r.created_at)}
                  </div>
                  {(r.from_status || r.to_status) && (
                    <div className="timeline-meta">
                      {r.from_status && (
                        <span className="timeline-status">
                          <span className={statusClass(r.from_status)}>
                            {STATUS_LABELS[r.from_status] || r.from_status}
                          </span>
                        </span>
                      )}
                      {r.from_status && r.to_status && <span style={{ margin: '0 6px' }}>→</span>}
                      {r.to_status && (
                        <span className="timeline-status">
                          <span className={statusClass(r.to_status)}>
                            {STATUS_LABELS[r.to_status] || r.to_status}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                  {r.opinion && <div className="timeline-opinion">{r.opinion}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {order.status !== 'archived' && isMyTurn && (
            <div className="card">
              <div className="card-title">办理操作</div>

              {(canSubmit(status, currentRole) || canVerify(status, currentRole) || canReview(status, currentRole) || canArchive(status, currentRole)) && (
                <>
                  {canSubmit(status, currentRole) && (
                    <>
                      <div className="info-alert">
                        {status === 'appeal_rejected_correction'
                          ? '申诉被驳回补正，补充证据和理由后可重新提交。'
                          : status === 'verify_returned'
                          ? '核验退回，可补充材料后发起申诉。'
                          : status === 'review_returned'
                          ? '复核退回补正，补充材料后可重新提交复核。'
                          : '草稿已创建，补充证据后提交登记。'}
                      </div>
                      {status !== 'draft' && (
                        <div className="form-group">
                          <label>
                            {status === 'appeal_rejected_correction' || status === 'review_returned'
                              ? '补正说明'
                              : '申诉理由'}
                            <span style={{ color: '#dc2626' }}> *</span>
                          </label>
                          <textarea
                            value={appealReason}
                            onChange={(e) => setAppealReason(e.target.value)}
                            placeholder={status === 'appeal_rejected_correction' || status === 'review_returned' ? '请填写补正说明（必填）' : '请填写申诉理由（必填）'}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {(canVerify(status, currentRole) || canReview(status, currentRole) || canArchive(status, currentRole)) && (
                    <div className="form-group">
                      <label>
                        处理意见
                        {(status === 'verify_returned' || status === 'review_returned' || status === 'appeal_rejected_correction') && (
                          <span style={{ color: '#dc2626' }}> *</span>
                        )}
                      </label>
                      <textarea
                        value={opinion}
                        onChange={(e) => setOpinion(e.target.value)}
                        placeholder="请填写处理意见（退回/驳回必填）"
                      />
                    </div>
                  )}

                  {(canSubmit(status, currentRole)) && (
                    <>
                      <div className="form-group">
                        <label>补充证据材料（可选）</label>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <input
                            type="text"
                            placeholder="证据名称（如：现场照片2.jpg）"
                            value={evidenceName}
                            onChange={(e) => setEvidenceName(e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button className="btn btn-default" onClick={addEvidence}>
                            添加
                          </button>
                        </div>
                        {newEvidence.length > 0 && (
                          <div className="evidence-list">
                            {newEvidence.map((ev, i) => (
                              <div key={i} className="evidence-item">
                                <span>📎</span>
                                <span style={{ flex: 1 }}>{ev.name}</span>
                                <button className="link-btn" onClick={() => removeEvidence(i)}>
                                  移除
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="form-hint">
                          提交登记至少需要 2 份证据（已有 {order.evidence.length}，已新增 {newEvidence.length}）
                        </div>
                      </div>
                      <div className="section-sep" />
                    </>
                  )}

                  <div className="btn-group">
                    {canSubmit(status, currentRole) && (
                      <button
                        className="btn btn-primary"
                        onClick={doSubmit}
                        disabled={actionLoading}
                      >
                        {status === 'appeal_rejected_correction'
                          ? '补正后重新提交'
                          : status === 'verify_returned'
                          ? '提交申诉'
                          : status === 'review_returned'
                          ? '补正后重新提交复核'
                          : '提交登记'}
                      </button>
                    )}

                    {canVerify(status, currentRole) && (
                      <>
                        <button
                          className="btn btn-success"
                          onClick={doVerifyPass}
                          disabled={actionLoading}
                        >
                          核验通过
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={doVerifyReturn}
                          disabled={actionLoading}
                        >
                          核验退回补正
                        </button>
                      </>
                    )}

                    {canReview(status, currentRole) && (
                      <>
                        {status === 'appeal_submitted' && (
                          <button
                            className="btn btn-success"
                            onClick={doReviewAccept}
                            disabled={actionLoading}
                          >
                            受理申诉
                          </button>
                        )}
                        {(status === 'appeal_submitted' || status === 'appeal_accepted' || status === 'appeal_resubmitted') && (
                          <button
                            className="btn btn-warning"
                            onClick={doReviewRejectCorrection}
                            disabled={actionLoading}
                          >
                            驳回补正
                          </button>
                        )}
                        {(status === 'appeal_accepted' || status === 'appeal_resubmitted' || status === 'reviewing') && (
                          <button
                            className="btn btn-success"
                            onClick={doReviewConfirm}
                            disabled={actionLoading}
                          >
                            复核确认通过
                          </button>
                        )}
                        {(status === 'appeal_accepted' || status === 'appeal_resubmitted' || status === 'reviewing') && (
                          <button
                            className="btn btn-danger"
                            onClick={doReviewReturn}
                            disabled={actionLoading}
                          >
                            复核退回补正
                          </button>
                        )}
                      </>
                    )}

                    {canArchive(status, currentRole) && (
                      <button
                        className="btn btn-primary"
                        onClick={doArchive}
                        disabled={actionLoading}
                      >
                        复核归档
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {order.status === 'archived' && (
            <div className="card">
              <div className="card-title">办理结果</div>
              <div className="info-alert">该单据已归档，流程已闭环完成。</div>
              {order.review_opinion && (
                <div className="field-row" style={{ marginTop: 10 }}>
                  <div className="field-label">归档意见</div>
                  <div className="field-value">{order.review_opinion}</div>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="card-title">流程说明</div>
            <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.8 }}>
              <p><b>办理边界：</b></p>
              <p>① 备件更换登记员：创建草稿、提交登记、补正申诉、再次提交</p>
              <p>② 备件更换审核主管：核验通过 / 核验退回补正</p>
              <p>③ 复核负责人：受理申诉、复核确认、驳回补正、复核退回、归档</p>
              <div className="section-sep" />
              <p><b>主流程：</b></p>
              <p>登记 → 核验 → 复核 → 归档</p>
              <div className="section-sep" />
              <p><b>异常申诉路径：</b></p>
              <p>核验退回 → 申诉提交 → 受理 / 驳回补正 → 补正重提 → 复核确认 → 归档</p>
              <p>复核退回补正 → 补正后重新提交复核 → 复核确认 → 归档</p>
              <div className="section-sep" />
              <p><b>校验失败留痕：</b></p>
              <p>版本/处理人/角色/状态/证据校验失败时，原状态保留，并写入处理记录（from=to）。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
