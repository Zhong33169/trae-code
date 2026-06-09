import { createSignal, onMount, For, Show, createEffect, on } from 'solid-js';
import { useNavigate, useParams, useSearchParams } from '../router';
import { useUser } from '../contexts/UserContext';
import { api } from '../services/api';
import {
  TreatmentPlan,
  AuditLog,
  TreatmentPlanStatus,
  UrgencyLevel,
  statusLabels,
  urgencyLabels,
  UserRole,
  MaterialItem,
} from '../types';
import './PlanDetail.css';

interface PlanDetailProps {
  params?: { id?: string };
}

const PlanDetail = (props: PlanDetailProps) => {
  const routeParams = useParams();
  const searchParams = useSearchParams();
  const planId = routeParams.id || props.params?.id || '';
  const navigate = useNavigate();
  const { currentUser, hasRole } = useUser();
  const [plan, setPlan] = createSignal<TreatmentPlan | null>(null);
  const [auditLogs, setAuditLogs] = createSignal<AuditLog[]>([]);
  const [canEdit, setCanEdit] = createSignal(false);
  const [availableActions, setAvailableActions] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [error, setError] = createSignal('');
  const [successMsg, setSuccessMsg] = createSignal('');

  const activeTab = (): 'info' | 'audit' => {
    const tab = searchParams().get('tab');
    return tab === 'audit' ? 'audit' : 'info';
  };

  const setActiveTab = (tab: 'info' | 'audit') => {
    const params = new URLSearchParams(searchParams());
    if (tab === 'audit') {
      params.set('tab', 'audit');
    } else {
      params.delete('tab');
    }
    const query = params.toString();
    navigate(`/plans/${planId}${query ? '?' + query : ''}`, { replace: true });
  };

  const [editForm, setEditForm] = createSignal<any>({});
  const [verifyForm, setVerifyForm] = createSignal({ opinion: '', rejectReason: '' });
  const [reviewForm, setReviewForm] = createSignal({ opinion: '', rejectReason: '' });

  const loadDetail = async () => {
    if (!currentUser() || !planId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getPlanDetail(planId, currentUser()!.id);
      setPlan(data.plan);
      setAuditLogs(data.auditLogs);
      setCanEdit(data.canEdit);
      setAvailableActions(data.availableActions);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadDetail();
  });

  createEffect(() => {
    if (currentUser() && planId) {
      loadDetail();
    }
  });

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getDaysRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const getUrgencyClass = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case UrgencyLevel.OVERDUE: return 'urgency-overdue';
      case UrgencyLevel.WARNING: return 'urgency-warning';
      default: return 'urgency-normal';
    }
  };

  const getStatusClass = (status: TreatmentPlanStatus) => {
    switch (status) {
      case TreatmentPlanStatus.DRAFT: return 'status-draft';
      case TreatmentPlanStatus.PENDING_VERIFICATION: return 'status-pending';
      case TreatmentPlanStatus.VERIFICATION_REJECTED: return 'status-rejected';
      case TreatmentPlanStatus.PENDING_REVIEW: return 'status-pending';
      case TreatmentPlanStatus.REVIEW_REJECTED: return 'status-rejected';
      case TreatmentPlanStatus.ARCHIVED: return 'status-archived';
      default: return '';
    }
  };

  const startEdit = () => {
    if (!plan()) return;
    setEditForm({
      patientName: plan()!.patientName,
      patientPhone: plan()!.patientPhone,
      deadline: plan()!.deadline.slice(0, 10),
      remarks: plan()!.remarks,
      materials: [...plan()!.materials],
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError('');
  };

  const addMaterial = () => {
    const form = editForm();
    form.materials = [
      ...form.materials,
      { id: `temp-${Date.now()}`, name: '', quantity: 1, checked: false },
    ];
    setEditForm({ ...form });
  };

  const updateMaterial = (idx: number, field: string, value: any) => {
    const form = editForm();
    form.materials[idx] = { ...form.materials[idx], [field]: value };
    setEditForm({ ...form });
  };

  const removeMaterial = (idx: number) => {
    const form = editForm();
    form.materials.splice(idx, 1);
    setEditForm({ ...form });
  };

  const handleSaveEdit = async () => {
    if (!plan() || !currentUser()) return;
    setError('');
    try {
      const form = editForm();
      const updated = await api.updatePlan(
        planId,
        {
          patientName: form.patientName,
          patientPhone: form.patientPhone,
          deadline: new Date(form.deadline).toISOString(),
          remarks: form.remarks,
          materials: form.materials.filter((m: MaterialItem) => m.name.trim()),
          version: plan()!.version,
        },
        currentUser()!.id
      );
      setPlan(updated);
      setEditing(false);
      showSuccess('保存成功');
      loadDetail();
    } catch (e: any) {
      setError(e.message || '保存失败');
    }
  };

  const handleSubmitVerification = async () => {
    if (!plan() || !currentUser()) return;
    setError('');
    try {
      const result = await api.submitVerification(planId, {
        userId: currentUser()!.id,
        version: plan()!.version,
      });
      setPlan(result);
      showSuccess('已提交核验，等待医生处理');
      loadDetail();
    } catch (e: any) {
      setError(e.message || '提交失败');
    }
  };

  const handleVerifyPass = async () => {
    if (!plan() || !currentUser()) return;
    setError('');
    try {
      const allMaterialIds = plan()!.materials.map(m => m.id);
      const result = await api.verifyPlan(planId, {
        userId: currentUser()!.id,
        result: 'pass',
        opinion: verifyForm().opinion,
        verifiedMaterials: allMaterialIds,
        version: plan()!.version,
      });
      setPlan(result);
      setVerifyForm({ opinion: '', rejectReason: '' });
      showSuccess('核验通过，已提交院长复核');
      loadDetail();
    } catch (e: any) {
      setError(e.message || '操作失败');
    }
  };

  const handleVerifyReject = async () => {
    if (!plan() || !currentUser()) return;
    if (!verifyForm().rejectReason.trim()) {
      setError('请填写退回原因');
      return;
    }
    setError('');
    try {
      const result = await api.verifyPlan(planId, {
        userId: currentUser()!.id,
        result: 'reject',
        opinion: verifyForm().opinion,
        rejectReason: verifyForm().rejectReason,
        version: plan()!.version,
      });
      setPlan(result);
      setVerifyForm({ opinion: '', rejectReason: '' });
      showSuccess('已退回，等待前台修改');
      loadDetail();
    } catch (e: any) {
      setError(e.message || '操作失败');
    }
  };

  const handleSubmitReview = async () => {
    if (!plan() || !currentUser()) return;
    setError('');
    try {
      const result = await api.submitReview(planId, {
        userId: currentUser()!.id,
        version: plan()!.version,
      });
      setPlan(result);
      showSuccess('已重新提交复核');
      loadDetail();
    } catch (e: any) {
      setError(e.message || '提交失败');
    }
  };

  const handleReviewPass = async () => {
    if (!plan() || !currentUser()) return;
    setError('');
    try {
      const result = await api.reviewPlan(planId, {
        userId: currentUser()!.id,
        result: 'pass',
        opinion: reviewForm().opinion,
        version: plan()!.version,
      });
      setPlan(result);
      setReviewForm({ opinion: '', rejectReason: '' });
      loadDetail();
    } catch (e: any) {
      setError(e.message || '操作失败');
    }
  };

  const handleReviewReject = async () => {
    if (!plan() || !currentUser()) return;
    if (!reviewForm().rejectReason.trim()) {
      setError('请填写退回原因');
      return;
    }
    setError('');
    try {
      const result = await api.reviewPlan(planId, {
        userId: currentUser()!.id,
        result: 'reject',
        opinion: reviewForm().opinion,
        rejectReason: reviewForm().rejectReason,
        version: plan()!.version,
      });
      setPlan(result);
      setReviewForm({ opinion: '', rejectReason: '' });
      loadDetail();
    } catch (e: any) {
      setError(e.message || '操作失败');
    }
  };

  const handleAddAttachment = async () => {
    if (!currentUser()) return;
    const name = prompt('请输入附件名称：');
    if (!name) return;
    try {
      await api.addAttachment(planId, {
        userId: currentUser()!.id,
        name,
        type: 'document',
      });
      loadDetail();
    } catch (e: any) {
      setError(e.message || '添加失败');
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!currentUser()) return;
    if (!confirm('确定删除此附件吗？')) return;
    try {
      await api.removeAttachment(planId, attachmentId, currentUser()!.id);
      loadDetail();
    } catch (e: any) {
      setError(e.message || '删除失败');
    }
  };

  const isReceptionist = hasRole(UserRole.RECEPTIONIST);
  const isDentist = hasRole(UserRole.DENTIST);
  const isDirector = hasRole(UserRole.DIRECTOR);

  return (
    <div class="plan-detail-page">
      <div class="detail-header">
        <button class="btn-back" onClick={() => navigate('/')}>
          ← 返回列表
        </button>
        <div class="detail-title">
          <h2>治疗计划单详情</h2>
          <span class={`status-tag ${plan() ? getStatusClass(plan()!.status) : ''}`}>
            {plan() ? statusLabels[plan()!.status] : ''}
          </span>
          <Show when={plan()}>
            <span class={`urgency-tag ${getUrgencyClass(plan()!.urgencyLevel)}`}>
              {urgencyLabels[plan()!.urgencyLevel]}
              （{getDaysRemaining(plan()!.deadline) > 0
                ? `剩${getDaysRemaining(plan()!.deadline)}天`
                : `超${Math.abs(getDaysRemaining(plan()!.deadline))}天`}）
            </span>
          </Show>
        </div>
        <div class="detail-actions">
          <button class="btn btn-default btn-sm" onClick={loadDetail}>刷新</button>
          <Show when={canEdit() && !editing() && availableActions().includes('edit')}>
            <button class="btn btn-primary btn-sm" onClick={startEdit}>编辑</button>
          </Show>
          <Show when={editing()}>
            <button class="btn btn-default btn-sm" onClick={cancelEdit}>取消</button>
            <button class="btn btn-primary btn-sm" onClick={handleSaveEdit}>保存</button>
          </Show>
        </div>
      </div>

      {error() && <div class="alert-error">{error()}</div>}

      <div class="detail-tabs">
        <button
          class={activeTab() === 'info' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('info')}
        >
          基本信息
        </button>
        <button
          class={activeTab() === 'audit' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('audit')}
        >
          审计记录 ({auditLogs().length})
        </button>
      </div>

      <Show when={activeTab() === 'info'}>
        <div class="detail-content">
          <Show when={loading()}>
            <div class="loading">加载中...</div>
          </Show>

          <Show when={!loading() && plan()}>
            <div class="info-section">
              <h3 class="section-title">基本信息</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">计划单号</span>
                  <span class="info-value">{plan()!.planNo}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">门店</span>
                  <span class="info-value">{plan()!.store}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">患者姓名</span>
                  <Show when={!editing()}>
                    <span class="info-value">{plan()!.patientName}</span>
                  </Show>
                  <Show when={editing()}>
                    <input
                      type="text"
                      value={editForm().patientName}
                      onInput={(e) => setEditForm({ ...editForm(), patientName: e.target.value })}
                      class="form-input"
                    />
                  </Show>
                </div>
                <div class="info-item">
                  <span class="info-label">联系电话</span>
                  <Show when={!editing()}>
                    <span class="info-value">{plan()!.patientPhone}</span>
                  </Show>
                  <Show when={editing()}>
                    <input
                      type="text"
                      value={editForm().patientPhone}
                      onInput={(e) => setEditForm({ ...editForm(), patientPhone: e.target.value })}
                      class="form-input"
                    />
                  </Show>
                </div>
                <div class="info-item">
                  <span class="info-label">创建时间</span>
                  <span class="info-value">{formatDate(plan()!.createdAt)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">截止日期</span>
                  <Show when={!editing()}>
                    <span class="info-value">{formatDate(plan()!.deadline)}</span>
                  </Show>
                  <Show when={editing()}>
                    <input
                      type="date"
                      value={editForm().deadline}
                      onInput={(e) => setEditForm({ ...editForm(), deadline: e.target.value })}
                      class="form-input"
                    />
                  </Show>
                </div>
                <div class="info-item">
                  <span class="info-label">版本号</span>
                  <span class="info-value">v{plan()!.version}</span>
                </div>
              </div>
            </div>

            <div class="info-section">
              <div class="section-header">
                <h3 class="section-title">材料清单</h3>
                <Show when={editing()}>
                  <button class="btn btn-primary btn-sm" onClick={addMaterial}>+ 添加材料</button>
                </Show>
              </div>
              <div class="material-table">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 50px;">序号</th>
                      <th>材料名称</th>
                      <th style="width: 100px;">数量</th>
                      <th style="width: 100px;">已确认</th>
                      <th style="width: 120px;">核验状态</th>
                      <Show when={editing()}>
                        <th style="width: 80px;">操作</th>
                      </Show>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={editing() ? editForm().materials : plan()!.materials}>
                      {(m, idx) => (
                        <tr>
                          <td>{idx() + 1}</td>
                          <td>
                            <Show when={!editing()}>
                              {m.name}
                            </Show>
                            <Show when={editing()}>
                              <input
                                type="text"
                                value={m.name}
                                onInput={(e) => updateMaterial(idx(), 'name', e.target.value)}
                                class="form-input"
                                placeholder="材料名称"
                              />
                            </Show>
                          </td>
                          <td>
                            <Show when={!editing()}>
                              ×{m.quantity}
                            </Show>
                            <Show when={editing()}>
                              <input
                                type="number"
                                value={m.quantity}
                                onInput={(e) => updateMaterial(idx(), 'quantity', parseInt(e.target.value) || 1)}
                                class="form-input"
                                min="1"
                              />
                            </Show>
                          </td>
                          <td>
                            <Show when={!editing()}>
                              {m.checked ? '是' : '否'}
                            </Show>
                            <Show when={editing()}>
                              <input
                                type="checkbox"
                                checked={m.checked}
                                onChange={(e) => updateMaterial(idx(), 'checked', (e.target as HTMLInputElement).checked)}
                              />
                            </Show>
                          </td>
                          <td>
                            <Show when={m.verified}>
                              <span class="verified-badge">已核验</span>
                            </Show>
                            <Show when={!m.verified}>
                              <span class="unverified-badge">待核验</span>
                            </Show>
                          </td>
                          <Show when={editing()}>
                            <td>
                              <button class="link-btn link-danger" onClick={() => removeMaterial(idx())}>
                                删除
                              </button>
                            </td>
                          </Show>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="info-section">
              <div class="section-header">
                <h3 class="section-title">附件资料</h3>
                <Show when={canEdit() && availableActions().includes('add_attachment')}>
                  <button class="btn btn-primary btn-sm" onClick={handleAddAttachment}>+ 添加附件</button>
                </Show>
              </div>
              <div class="attachment-list">
                <For each={plan()!.attachments}>
                  {(att) => (
                    <div class="attachment-item">
                      <span class="attachment-icon">📎</span>
                      <span class="attachment-name">{att.name}</span>
                      <span class="attachment-time">{formatDate(att.uploadedAt)}</span>
                      <Show when={canEdit()}>
                        <button class="link-btn link-danger" onClick={() => handleRemoveAttachment(att.id)}>
                          删除
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
                {plan()!.attachments.length === 0 && (
                  <div class="empty-text">暂无附件</div>
                )}
              </div>
            </div>

            <div class="info-section">
              <h3 class="section-title">备注</h3>
              <Show when={!editing()}>
                <div class="remarks-content">{plan()!.remarks || '暂无备注'}</div>
              </Show>
              <Show when={editing()}>
                <textarea
                  value={editForm().remarks}
                  onInput={(e) => setEditForm({ ...editForm(), remarks: e.target.value })}
                  class="form-textarea"
                  rows={4}
                  placeholder="请输入备注"
                />
              </Show>
            </div>

            <Show when={plan()!.rejectReason}>
              <div class="info-section reject-section">
                <h3 class="section-title">退回说明</h3>
                <div class="reject-content">
                  <span class="reject-icon">⚠️</span>
                  {plan()!.rejectReason}
                </div>
              </div>
            </Show>

            <Show when={plan()!.verificationOpinion || plan()!.verifiedAt}>
              <div class="info-section">
                <h3 class="section-title">医生核验意见</h3>
                <div class="opinion-block">
                  <div class="opinion-header">
                    <span class="opinion-result">
                      结果：{plan()!.verificationResult === 'pass' ? '通过' : '退回'}
                    </span>
                    <span class="opinion-time">核验时间：{formatDate(plan()!.verifiedAt)}</span>
                  </div>
                  <div class="opinion-content">
                    {plan()!.verificationOpinion || '无核验意见'}
                  </div>
                </div>
              </div>
            </Show>

            <Show when={plan()!.reviewOpinion || plan()!.reviewedAt}>
              <div class="info-section">
                <h3 class="section-title">院长复核意见</h3>
                <div class="opinion-block">
                  <div class="opinion-header">
                    <span class="opinion-result">
                      结果：{plan()!.reviewResult === 'pass' ? '通过归档' : '退回'}
                    </span>
                    <span class="opinion-time">复核时间：{formatDate(plan()!.reviewedAt)}</span>
                  </div>
                  <div class="opinion-content">
                    {plan()!.reviewOpinion || '无复核意见'}
                  </div>
                </div>
              </div>
            </Show>

            <div class="action-section">
              <h3 class="section-title">操作区</h3>

              <Show when={isReceptionist && availableActions().includes('submit_verification')}>
                <div class="action-block">
                  <h4>提交核验</h4>
                  <p class="action-desc">确认材料齐备后，提交给医生进行核验</p>
                  <button class="btn btn-primary" onClick={handleSubmitVerification}>
                    提交核验
                  </button>
                </div>
              </Show>

              <Show when={isDentist && availableActions().includes('verify_pass')}>
                <div class="action-block">
                  <h4>医生核验</h4>
                  <p class="action-desc">核验材料和方案，给出核验意见</p>
                  <div class="form-item">
                    <label class="form-label">核验意见</label>
                    <textarea
                      value={verifyForm().opinion}
                      onInput={(e) => setVerifyForm({ ...verifyForm(), opinion: e.target.value })}
                      class="form-textarea"
                      rows={3}
                      placeholder="请输入核验意见"
                    />
                  </div>
                  <div class="form-item">
                    <label class="form-label">退回原因（退回时必填）</label>
                    <textarea
                      value={verifyForm().rejectReason}
                      onInput={(e) => setVerifyForm({ ...verifyForm(), rejectReason: e.target.value })}
                      class="form-textarea"
                      rows={3}
                      placeholder="退回时请填写具体原因"
                    />
                  </div>
                  <div class="action-buttons">
                    <button class="btn btn-success" onClick={handleVerifyPass}>
                      核验通过
                    </button>
                    <button class="btn btn-warning" onClick={handleVerifyReject}>
                      核验退回
                    </button>
                  </div>
                </div>
              </Show>

              <Show when={isDentist && availableActions().includes('submit_review')}>
                <div class="action-block">
                  <h4>重新提交复核</h4>
                  <p class="action-desc">修改后重新提交给院长复核</p>
                  <button class="btn btn-primary" onClick={handleSubmitReview}>
                    重新提交复核
                  </button>
                </div>
              </Show>

              <Show when={isDirector && availableActions().includes('review_pass')}>
                <div class="action-block">
                  <h4>院长复核</h4>
                  <p class="action-desc">最终复核，通过后归档</p>
                  <div class="form-item">
                    <label class="form-label">复核意见</label>
                    <textarea
                      value={reviewForm().opinion}
                      onInput={(e) => setReviewForm({ ...reviewForm(), opinion: e.target.value })}
                      class="form-textarea"
                      rows={3}
                      placeholder="请输入复核意见"
                    />
                  </div>
                  <div class="form-item">
                    <label class="form-label">退回原因（退回时必填）</label>
                    <textarea
                      value={reviewForm().rejectReason}
                      onInput={(e) => setReviewForm({ ...reviewForm(), rejectReason: e.target.value })}
                      class="form-textarea"
                      rows={3}
                      placeholder="退回时请填写具体原因"
                    />
                  </div>
                  <div class="action-buttons">
                    <button class="btn btn-success" onClick={handleReviewPass}>
                      复核通过并归档
                    </button>
                    <button class="btn btn-warning" onClick={handleReviewReject}>
                      复核退回
                    </button>
                  </div>
                </div>
              </Show>

              <Show when={availableActions().length === 0 ||
                (availableActions().length === 1 && availableActions()[0] === 'edit')}>
                <div class="no-actions">
                  <p>当前状态下没有待执行的操作</p>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={activeTab() === 'audit'}>
        <div class="audit-section">
          <h3 class="section-title">审计记录</h3>
          <div class="audit-timeline">
            <For each={auditLogs()}>
              {(log) => (
                <div class="audit-item">
                  <div class="audit-dot"></div>
                  <div class="audit-content">
                    <div class="audit-header">
                      <span class="audit-action">{log.action}</span>
                      <span class="audit-user">{log.userName}</span>
                      <span class="audit-time">{formatDate(log.timestamp)}</span>
                    </div>
                    <Show when={log.fromStatus || log.toStatus}>
                      <div class="audit-status">
                        状态变化：{log.fromStatus ? statusLabels[log.fromStatus] : '-'}
                        {' → '}
                        {log.toStatus ? statusLabels[log.toStatus] : '-'}
                      </div>
                    </Show>
                    <div class="audit-details">{log.details}</div>
                    <Show when={log.opinion}>
                      <div class="audit-extra">
                        <span class="extra-label">处理意见：</span>
                        <span class="extra-value">{log.opinion}</span>
                      </div>
                    </Show>
                    <Show when={log.rejectReason}>
                      <div class="audit-extra audit-reject">
                        <span class="extra-label">退回原因：</span>
                        <span class="extra-value">{log.rejectReason}</span>
                      </div>
                    </Show>
                    <Show when={log.materialChanges && log.materialChanges.length > 0}>
                      <div class="audit-extra">
                        <div class="extra-label">材料变更：</div>
                        <ul class="material-changes">
                          <For each={log.materialChanges}>
                            {(mc) => (
                              <li>
                                <span class="material-name">{mc.name}</span>
                                <span class="material-status">
                                  <Show when={mc.before && mc.after}>
                                    {(() => {
                                      const before = mc.before!;
                                      const after = mc.after!;
                                      return (
                                        <>
                                          (确认: {before.checked ? '是' : '否'} → {after.checked ? '是' : '否'}，
                                          核验: {before.verified ? '是' : '否'} → {after.verified ? '是' : '否'})
                                        </>
                                      );
                                    })()}
                                  </Show>
                                  <Show when={!mc.before || !mc.after}>
                                    (确认: {mc.checked ? '是' : '否'}，核验: {mc.verified ? '是' : '否'})
                                  </Show>
                                </span>
                              </li>
                            )}
                          </For>
                        </ul>
                      </div>
                    </Show>
                    <Show when={log.attachmentChanges && log.attachmentChanges.length > 0}>
                      <div class="audit-extra">
                        <div class="extra-label">附件变更：</div>
                        <ul class="attachment-changes">
                          <For each={log.attachmentChanges}>
                            {(ac) => (
                              <li>
                                <span class={`attach-change ${ac.changeType}`}>
                                  {ac.changeType === 'add' ? '+' : '-'}
                                </span>
                                <span class="attach-name">{ac.name}</span>
                                <span class="attach-type">({ac.type})</span>
                              </li>
                            )}
                          </For>
                        </ul>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
            {auditLogs().length === 0 && (
              <div class="empty-text">暂无审计记录</div>
            )}
          </div>
        </div>
      </Show>
    </div>
  );
};

export default PlanDetail;
