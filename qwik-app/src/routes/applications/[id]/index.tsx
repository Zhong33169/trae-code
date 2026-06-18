import { component$, useSignal, useTask$, $, useComputed$ } from '@builder.io/qwik';
import { useNavigate, routeLoader$ } from '@builder.io/qwik-city';
import type { Application, Material } from '~/types';
import {
  getApplication,
  submitApplication,
  startAudit,
  auditPass,
  auditReject,
  reviewPass,
  reviewReject,
  archiveApplication,
  requestCorrection,
  statusLabels,
  materialTypeLabels,
  formatDate,
} from '~/utils/api';

export const useAppId = routeLoader$(({ params }) => {
  return { id: params.id ? parseInt(params.id) : 0 };
});

export default component$(() => {
  const nav = useNavigate();
  const params = useAppId();

  const application = useSignal<Application | null>(null);
  const loading = useSignal(true);
  const message = useSignal<{ type: string; text: string } | null>(null);

  const showStartAuditModal = useSignal(false);
  const showCorrectionModal = useSignal(false);
  const showAuditPassModal = useSignal(false);
  const showAuditRejectModal = useSignal(false);
  const showReviewPassModal = useSignal(false);
  const showReviewRejectModal = useSignal(false);
  const showArchiveModal = useSignal(false);
  const showSubmitModal = useSignal(false);

  const opinion = useSignal('');
  const startAuditRemark = useSignal('');
  const correctionRequest = useSignal('');
  const submitRemark = useSignal('');
  const materialReviews = useSignal<
    Record<number, { is_approved: boolean; review_comment: string }>
  >({});

  const showMessage = $((type: string, text: string) => {
    message.value = { type, text };
    setTimeout(() => (message.value = null), 3000);
  });

  const loadDetail = $(async () => {
    if (!params.value.id) return;
    loading.value = true;
    try {
      const data = await getApplication(params.value.id);
      application.value = data;
      const reviews: Record<number, { is_approved: boolean; review_comment: string }> = {};
      data.materials.forEach((m: Material) => {
        reviews[m.id] = {
          is_approved: m.is_approved !== null ? !!m.is_approved : true,
          review_comment: m.review_comment || '',
        };
      });
      materialReviews.value = reviews;
    } catch (e: any) {
      showMessage('error', e.message || '加载失败');
    } finally {
      loading.value = false;
    }
  });

  useTask$(({ track }) => {
    track(() => params.value.id);
    loadDetail();
  });

  const app = application.value;

  const userStr =
    typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
  const user = userStr ? JSON.parse(userStr) : null;
  const role = user?.role || 'registrar';

  // 角色权限 - 严格按角色+状态显示按钮
  const canEdit = useComputed$(
    () => role === 'registrar' && (app?.status === 'draft' || app?.status === 'correction_requested')
  );
  const canSubmit = useComputed$(
    () => role === 'registrar' && (app?.status === 'draft' || app?.status === 'correction_requested')
  );
  const canStartAudit = useComputed$(
    () =>
      role === 'audit_supervisor' &&
      (app?.status === 'submitted' || app?.status === 'corrected')
  );
  const canRequestCorrection = useComputed$(
    () => role === 'audit_supervisor' && app?.status === 'under_review'
  );
  const canAuditPass = useComputed$(
    () => role === 'audit_supervisor' && app?.status === 'under_review'
  );
  const canAuditReject = useComputed$(
    () => role === 'audit_supervisor' && app?.status === 'under_review'
  );
  const canReviewPass = useComputed$(
    () => role === 'review_leader' && app?.status === 'audit_passed'
  );
  const canReviewReject = useComputed$(
    () => role === 'review_leader' && app?.status === 'audit_passed'
  );
  const canArchive = useComputed$(
    () => role === 'review_leader' && app?.status === 'review_passed'
  );

  const handleError = $((e: any) => {
    if (e.code === 'VERSION_CONFLICT' || e.statusCode === 409) {
      showMessage('error', '申请已被其他操作修改，正在刷新数据...');
      loadDetail();
    } else {
      showMessage('error', e.message || '操作失败');
    }
  });

  // 登记员提交/补正提交
  const handleSubmit = $(async () => {
    if (!app) return;
    if (app.is_overdue && !submitRemark.value.trim()) {
      showMessage('error', '该申请已逾期，请填写逾期处理说明后再提交');
      return;
    }
    try {
      await submitApplication(params.value.id, app.version);
      showSubmitModal.value = false;
      submitRemark.value = '';
      showMessage('success', app.status === 'draft' ? '已提交，等待审核' : '已补正提交，等待审核');
      loadDetail();
    } catch (e: any) {
      handleError(e);
    }
  });

  // 操作处理
  const handleStartAudit = $(async () => {
    if (!app) return;
    if (app.is_overdue && !startAuditRemark.value.trim()) {
      showMessage('error', '该申请已逾期，请填写逾期处理说明');
      return;
    }
    try {
      await startAudit(params.value.id, app.version, startAuditRemark.value || undefined);
      showStartAuditModal.value = false;
      startAuditRemark.value = '';
      showMessage('success', '已开始审核');
      loadDetail();
    } catch (e: any) {
      handleError(e);
    }
  });

  const handleRequestCorrection = $(async () => {
    if (!app) return;
    if (!correctionRequest.value) {
      showMessage('error', '请填写补正要求');
      return;
    }
    try {
      await requestCorrection(
        params.value.id,
        app.version,
        correctionRequest.value,
        materialReviews.value
      );
      showCorrectionModal.value = false;
      correctionRequest.value = '';
      showMessage('success', '补正要求已发送');
      loadDetail();
    } catch (e: any) {
      handleError(e);
    }
  });

  const handleAuditPass = $(async () => {
    if (!app) return;
    if (app.is_overdue && !opinion.value.trim()) {
      showMessage('error', '该申请已逾期，审核通过必须填写逾期处理说明');
      return;
    }
    try {
      await auditPass(
        params.value.id,
        app.version,
        opinion.value || undefined,
        materialReviews.value
      );
      showAuditPassModal.value = false;
      opinion.value = '';
      showMessage('success', '审核通过');
      loadDetail();
    } catch (e: any) {
      handleError(e);
    }
  });

  const handleAuditReject = $(async () => {
    if (!app) return;
    if (!opinion.value) {
      showMessage('error', '请填写拒绝理由');
      return;
    }
    try {
      await auditReject(params.value.id, app.version, opinion.value);
      showAuditRejectModal.value = false;
      opinion.value = '';
      showMessage('success', '已拒绝');
      loadDetail();
    } catch (e: any) {
      handleError(e);
    }
  });

  const handleReviewPass = $(async () => {
    if (!app) return;
    if (app.is_overdue && !opinion.value.trim()) {
      showMessage('error', '该申请已逾期，复核通过必须填写逾期处理说明');
      return;
    }
    try {
      await reviewPass(params.value.id, app.version, opinion.value || undefined);
      showReviewPassModal.value = false;
      opinion.value = '';
      showMessage('success', '复核通过');
      loadDetail();
    } catch (e: any) {
      handleError(e);
    }
  });

  const handleReviewReject = $(async () => {
    if (!app) return;
    if (!opinion.value) {
      showMessage('error', '请填写复核退回意见');
      return;
    }
    try {
      await reviewReject(params.value.id, app.version, opinion.value);
      showReviewRejectModal.value = false;
      opinion.value = '';
      showMessage('success', '已退回');
      loadDetail();
    } catch (e: any) {
      handleError(e);
    }
  });

  const handleArchive = $(async () => {
    if (!app) return;
    if (app.is_overdue && !opinion.value.trim()) {
      showMessage('error', '该申请已逾期，归档必须填写逾期处理说明');
      return;
    }
    try {
      await archiveApplication(params.value.id, app.version, opinion.value || undefined);
      showArchiveModal.value = false;
      opinion.value = '';
      showMessage('success', '已归档');
      loadDetail();
    } catch (e: any) {
      handleError(e);
    }
  });

  const openAuditPassModal = $(() => {
    opinion.value = '';
    showAuditPassModal.value = true;
  });

  const openAuditRejectModal = $(() => {
    opinion.value = '';
    showAuditRejectModal.value = true;
  });

  const openReviewPassModal = $(() => {
    opinion.value = '';
    showReviewPassModal.value = true;
  });

  const openReviewRejectModal = $(() => {
    opinion.value = '';
    showReviewRejectModal.value = true;
  });

  const openArchiveModal = $(() => {
    opinion.value = '';
    showArchiveModal.value = true;
  });

  if (loading.value || !app) {
    return (
      <div>
        <button class="btn btn-default" style={{ marginBottom: '16px' }} onClick$={() => nav('/applications')}>
          ← 返回列表
        </button>
        <div class="card">
          <div class="empty-state">加载中...</div>
        </div>
      </div>
    );
  }

  const isOverdue = app.is_overdue;

  return (
    <div>
      {message.value && (
        <div class={`message message-${message.value.type}`}>{message.value.text}</div>
      )}

      <button
        class="btn btn-default"
        style={{ marginBottom: '16px' }}
        onClick$={() => nav('/applications')}
      >
        ← 返回列表
      </button>

      <div class="card">
        <div class="action-bar">
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>
              {app.company_name}
              {isOverdue && <span class="overdue-tag" style={{ marginLeft: '12px' }}>已逾期</span>}
            </h2>
            <div style={{ color: '#888', fontSize: '13px' }}>
              申请编号：{app.application_no}
              <span style={{ marginLeft: '16px' }}>
                状态：
                <span class={`status-tag status-${app.status}`}>
                  {statusLabels[app.status] || app.status}
                </span>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {canEdit.value && (
              <button
                class="btn btn-default"
                onClick$={() => nav(`/applications/${params.value.id}/edit`)}
              >
                {app.status === 'correction_requested' ? '补正材料' : '编辑'}
              </button>
            )}
            {canSubmit.value && (
              <button
                class="btn btn-primary"
                onClick$={() => {
                  showSubmitModal.value = true;
                  submitRemark.value = '';
                }}
              >
                {app.status === 'correction_requested' ? '补正提交' : '提交申请'}
                {isOverdue ? '（逾期）' : ''}
              </button>
            )}
            {canStartAudit.value && (
              <button
                class="btn btn-primary"
                onClick$={() => (showStartAuditModal.value = true)}
              >
                开始审核{isOverdue ? '（逾期）' : ''}
              </button>
            )}
            {canRequestCorrection.value && (
              <button
                class="btn btn-warning"
                onClick$={() => (showCorrectionModal.value = true)}
              >
                要求补正
              </button>
            )}
            {canAuditPass.value && (
              <button class="btn btn-success" onClick$={openAuditPassModal}>
                审核通过
              </button>
            )}
            {canAuditReject.value && (
              <button class="btn btn-danger" onClick$={openAuditRejectModal}>
                审核拒绝
              </button>
            )}
            {canReviewPass.value && (
              <button class="btn btn-success" onClick$={openReviewPassModal}>
                复核通过
              </button>
            )}
            {canReviewReject.value && (
              <button class="btn btn-danger" onClick$={openReviewRejectModal}>
                复核退回
              </button>
            )}
            {canArchive.value && (
              <button class="btn btn-primary" onClick$={openArchiveModal}>
                归档
              </button>
            )}
          </div>
        </div>
      </div>

      {isOverdue && (
        <div class="alert alert-error" style={{ marginBottom: '16px' }}>
          <strong>⚠ 已逾期</strong>
          <div style={{ marginTop: '4px', fontSize: '13px' }}>
            逾期原因：{app.overdue_reason || '原因未知'}
          </div>
          <div style={{ marginTop: '4px', fontSize: '13px' }}>
            后续动作：推进该申请需填写逾期处理说明
          </div>
        </div>
      )}

      <div class="card">
        <div class="detail-section">
          <h3>基本信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <div class="detail-label">公司名称：</div>
              <div class="detail-value">{app.company_name}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">所属行业：</div>
              <div class="detail-value">{app.industry || '-'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">联系人：</div>
              <div class="detail-value">{app.contact_person}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">联系电话：</div>
              <div class="detail-value">{app.contact_phone}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">邮箱：</div>
              <div class="detail-value">{app.contact_email || '-'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">展位类型：</div>
              <div class="detail-value">{app.booth_type || '-'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">展位尺寸：</div>
              <div class="detail-value">{app.booth_size || '-'}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">预计面积：</div>
              <div class="detail-value">{app.expected_area || '-'} ㎡</div>
            </div>
          </div>
          {app.product_description && (
            <div class="detail-item" style={{ marginTop: '12px' }}>
              <div class="detail-label">产品描述：</div>
              <div class="detail-value">{app.product_description}</div>
            </div>
          )}
        </div>
      </div>

      <div class="card">
        <div class="detail-section">
          <h3>申请材料</h3>
          <div class="material-list">
            {app.materials.length === 0 ? (
              <div class="empty-state">暂无材料</div>
            ) : (
              app.materials.map((m) => (
                <div key={m.id} class="material-item">
                  <div class="material-info">
                    <span>📄</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{m.material_name}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        {materialTypeLabels[m.material_type] || m.material_type}
                      </div>
                    </div>
                  </div>
                  <span
                    class={`material-status ${
                      m.is_approved === true
                        ? 'approved'
                        : m.is_approved === false
                          ? 'rejected'
                          : 'pending'
                    }`}
                  >
                    {m.is_approved === true
                      ? '已通过'
                      : m.is_approved === false
                        ? '不通过'
                        : '待审核'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {(app.audit_opinion || app.review_opinion || app.correction_request) && (
        <div class="card">
          <div class="detail-section">
            <h3>处理意见</h3>
            <div class="detail-grid">
              {app.correction_request && (
                <div class="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div class="detail-label">补正要求：</div>
                  <div class="detail-value" style={{ color: '#ff4d4f' }}>
                    {app.correction_request}
                  </div>
                </div>
              )}
              {app.audit_opinion && (
                <div class="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div class="detail-label">审核意见：</div>
                  <div class="detail-value">{app.audit_opinion}</div>
                </div>
              )}
              {app.review_opinion && (
                <div class="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div class="detail-label">复核意见：</div>
                  <div class="detail-value">{app.review_opinion}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div class="card">
        <div class="detail-section">
          <h3>审计记录</h3>
          <div class="audit-log-list">
            {app.audit_logs && app.audit_logs.length > 0 ? (
              app.audit_logs.map((log) => (
                <div key={log.id} class="audit-log-item">
                  <div class="audit-log-header">
                    <span class="audit-log-action">{log.action_name}</span>
                    <span class="audit-log-operator">{log.operator_name || '系统'}</span>
                    <span class="audit-log-time">{formatDate(log.created_at)}</span>
                  </div>
                  {(log.from_status || log.to_status) && (
                    <div class="audit-log-status">
                      {log.from_status && (
                        <span class={`status-tag status-${log.from_status}`}>
                          {statusLabels[log.from_status] || log.from_status}
                        </span>
                      )}
                      {log.from_status && log.to_status && <span> → </span>}
                      {log.to_status && (
                        <span class={`status-tag status-${log.to_status}`}>
                          {statusLabels[log.to_status] || log.to_status}
                        </span>
                      )}
                    </div>
                  )}
                  {log.remark && (
                    <div class="audit-log-remark">{log.remark}</div>
                  )}
                </div>
              ))
            ) : (
              <div class="empty-state">暂无审计记录</div>
            )}
          </div>
        </div>
      </div>

      {/* 开始审核弹窗 */}
      {showStartAuditModal.value && (
        <div
          class="modal-overlay"
          onClick$={() => (showStartAuditModal.value = false)}
        >
          <div
            class="modal"
            style={{ width: '480px' }}
            onClick$={(e) => e.stopPropagation()}
          >
            <div class="modal-header">
              <span class="modal-title">
                开始审核
                {isOverdue && (
                  <span style={{ color: '#cf1322', marginLeft: '8px' }}>
                    （逾期，需填处理说明）
                  </span>
                )}
              </span>
              <span
                class="modal-close"
                onClick$={() => (showStartAuditModal.value = false)}
              >
                ×
              </span>
            </div>
            <div class="modal-body">
              {isOverdue && (
                <div
                  class="alert alert-warning"
                  style={{ marginBottom: '16px', fontSize: '13px' }}
                >
                  <strong>⚠ 注意：</strong>该申请已逾期，
                  <span style={{ color: '#cf1322' }}>必须填写逾期处理说明</span>
                  后才能开始审核。
                  <div style={{ marginTop: '6px', color: '#873800' }}>
                    逾期原因：{app.overdue_reason || '原因未知'}
                  </div>
                </div>
              )}
              <div class="form-item">
                <label class="form-label">
                  处理说明
                  {isOverdue && <span style={{ color: '#ff4d4f' }}> *</span>}
                </label>
                <textarea
                  class="form-input form-textarea"
                  value={startAuditRemark.value}
                  onInput$={(e) =>
                    (startAuditRemark.value = (e.target as HTMLTextAreaElement).value)
                  }
                  placeholder={
                    isOverdue ? '请填写逾期处理说明（必填）...' : '可选，填写审核备注'
                  }
                  rows={isOverdue ? 4 : 3}
                />
              </div>
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => (showStartAuditModal.value = false)}
              >
                取消
              </button>
              <button class="btn btn-primary" onClick$={handleStartAudit}>
                确认开始审核
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 审核通过弹窗 */}
      {showAuditPassModal.value && (
        <div
          class="modal-overlay"
          onClick$={() => (showAuditPassModal.value = false)}
        >
          <div
            class="modal"
            style={{ width: '480px' }}
            onClick$={(e) => e.stopPropagation()}
          >
            <div class="modal-header">
              <span class="modal-title">
                审核通过
                {isOverdue && (
                  <span style={{ color: '#cf1322', marginLeft: '8px' }}>
                    （逾期，需填处理说明）
                  </span>
                )}
              </span>
              <span
                class="modal-close"
                onClick$={() => (showAuditPassModal.value = false)}
              >
                ×
              </span>
            </div>
            <div class="modal-body">
              {isOverdue && (
                <div
                  class="alert alert-warning"
                  style={{ marginBottom: '16px', fontSize: '13px' }}
                >
                  <strong>⚠ 注意：</strong>该申请已逾期，
                  <span style={{ color: '#cf1322' }}>必须填写逾期处理说明</span>
                  后才能审核通过。
                  <div style={{ marginTop: '6px', color: '#873800' }}>
                    逾期原因：{app.overdue_reason || '原因未知'}
                  </div>
                </div>
              )}
              <p style={{ marginBottom: '16px' }}>
                确认该展商申请审核通过？通过后将进入复核阶段。
              </p>
              <div class="form-item">
                <label class="form-label">
                  审核意见
                  {isOverdue && (
                    <span style={{ color: '#ff4d4f' }}> *（逾期必填）</span>
                  )}
                </label>
                <textarea
                  class="form-input form-textarea"
                  value={opinion.value}
                  onInput$={(e) =>
                    (opinion.value = (e.target as HTMLTextAreaElement).value)
                  }
                  placeholder={
                    isOverdue
                      ? '请填写逾期处理说明（必填）...'
                      : '请输入审核意见（可选）'
                  }
                  rows={isOverdue ? 4 : 3}
                />
              </div>
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => (showAuditPassModal.value = false)}
              >
                取消
              </button>
              <button class="btn btn-success" onClick$={handleAuditPass}>
                确认通过
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 审核拒绝弹窗 */}
      {showAuditRejectModal.value && (
        <div
          class="modal-overlay"
          onClick$={() => (showAuditRejectModal.value = false)}
        >
          <div
            class="modal"
            style={{ width: '440px' }}
            onClick$={(e) => e.stopPropagation()}
          >
            <div class="modal-header">
              <span class="modal-title">审核拒绝</span>
              <span
                class="modal-close"
                onClick$={() => (showAuditRejectModal.value = false)}
              >
                ×
              </span>
            </div>
            <div class="modal-body">
              <p style={{ marginBottom: '16px' }}>
                确认拒绝该展商申请？拒绝后申请将终止。
              </p>
              <div class="form-item">
                <label class="form-label">拒绝理由 *</label>
                <textarea
                  class="form-input form-textarea"
                  value={opinion.value}
                  onInput$={(e) =>
                    (opinion.value = (e.target as HTMLTextAreaElement).value)
                  }
                  placeholder="请填写拒绝理由"
                  rows={3}
                />
              </div>
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => (showAuditRejectModal.value = false)}
              >
                取消
              </button>
              <button class="btn btn-danger" onClick$={handleAuditReject}>
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 要求补正弹窗 */}
      {showCorrectionModal.value && (
        <div
          class="modal-overlay"
          onClick$={() => (showCorrectionModal.value = false)}
        >
          <div
            class="modal"
            style={{ width: '560px' }}
            onClick$={(e) => e.stopPropagation()}
          >
            <div class="modal-header">
              <span class="modal-title">要求补正</span>
              <span
                class="modal-close"
                onClick$={() => (showCorrectionModal.value = false)}
              >
                ×
              </span>
            </div>
            <div class="modal-body">
              <div class="form-item">
                <label class="form-label">补正要求 *</label>
                <textarea
                  class="form-input form-textarea"
                  value={correctionRequest.value}
                  onInput$={(e) =>
                    (correctionRequest.value = (e.target as HTMLTextAreaElement).value)
                  }
                  placeholder="请详细说明需要补正的内容"
                  rows={4}
                />
              </div>
              {app.materials.length > 0 && (
                <div class="form-item">
                  <label class="form-label">材料审核</label>
                  {app.materials.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '10px 0',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>{m.material_name}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <input
                              type="radio"
                              checked={
                                materialReviews.value[m.id]?.is_approved === true
                              }
                              onChange$={() => {
                                materialReviews.value = {
                                  ...materialReviews.value,
                                  [m.id]: {
                                    ...(materialReviews.value[m.id] || {}),
                                    is_approved: true,
                                  },
                                };
                              }}
                            />
                            通过
                          </label>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <input
                              type="radio"
                              checked={
                                materialReviews.value[m.id]?.is_approved === false
                              }
                              onChange$={() => {
                                materialReviews.value = {
                                  ...materialReviews.value,
                                  [m.id]: {
                                    ...(materialReviews.value[m.id] || {}),
                                    is_approved: false,
                                  },
                                };
                              }}
                            />
                            不通过
                          </label>
                        </div>
                      </div>
                      <input
                        class="form-input"
                        type="text"
                        style={{ marginTop: '6px' }}
                        placeholder="审核意见（可选）"
                        value={materialReviews.value[m.id]?.review_comment || ''}
                        onInput$={(e) => {
                          const val = (e.target as HTMLInputElement).value;
                          materialReviews.value = {
                            ...materialReviews.value,
                            [m.id]: {
                              ...(materialReviews.value[m.id] || {
                                is_approved: true,
                              }),
                              review_comment: val,
                            },
                          };
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => (showCorrectionModal.value = false)}
              >
                取消
              </button>
              <button class="btn btn-warning" onClick$={handleRequestCorrection}>
                发送补正要求
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 复核通过弹窗 */}
      {showReviewPassModal.value && (
        <div
          class="modal-overlay"
          onClick$={() => (showReviewPassModal.value = false)}
        >
          <div
            class="modal"
            style={{ width: '480px' }}
            onClick$={(e) => e.stopPropagation()}
          >
            <div class="modal-header">
              <span class="modal-title">
                复核通过
                {isOverdue && (
                  <span style={{ color: '#cf1322', marginLeft: '8px' }}>
                    （逾期，需填处理说明）
                  </span>
                )}
              </span>
              <span
                class="modal-close"
                onClick$={() => (showReviewPassModal.value = false)}
              >
                ×
              </span>
            </div>
            <div class="modal-body">
              {isOverdue && (
                <div
                  class="alert alert-warning"
                  style={{ marginBottom: '16px', fontSize: '13px' }}
                >
                  <strong>⚠ 注意：</strong>该申请已逾期，
                  <span style={{ color: '#cf1322' }}>必须填写逾期处理说明</span>
                  后才能复核通过。
                  <div style={{ marginTop: '6px', color: '#873800' }}>
                    逾期原因：{app.overdue_reason || '原因未知'}
                  </div>
                </div>
              )}
              <p style={{ marginBottom: '16px' }}>
                确认复核通过？通过后可进行归档操作。
              </p>
              <div class="form-item">
                <label class="form-label">
                  复核意见
                  {isOverdue && (
                    <span style={{ color: '#ff4d4f' }}> *（逾期必填）</span>
                  )}
                </label>
                <textarea
                  class="form-input form-textarea"
                  value={opinion.value}
                  onInput$={(e) =>
                    (opinion.value = (e.target as HTMLTextAreaElement).value)
                  }
                  placeholder={
                    isOverdue
                      ? '请填写逾期处理说明（必填）...'
                      : '请输入复核意见（可选）'
                  }
                  rows={isOverdue ? 4 : 3}
                />
              </div>
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => (showReviewPassModal.value = false)}
              >
                取消
              </button>
              <button class="btn btn-success" onClick$={handleReviewPass}>
                确认通过
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 复核退回弹窗 */}
      {showReviewRejectModal.value && (
        <div
          class="modal-overlay"
          onClick$={() => (showReviewRejectModal.value = false)}
        >
          <div
            class="modal"
            style={{ width: '440px' }}
            onClick$={(e) => e.stopPropagation()}
          >
            <div class="modal-header">
              <span class="modal-title">复核退回</span>
              <span
                class="modal-close"
                onClick$={() => (showReviewRejectModal.value = false)}
              >
                ×
              </span>
            </div>
            <div class="modal-body">
              <p style={{ marginBottom: '16px' }}>
                确认退回该申请？退回后将回到待审核状态。
              </p>
              <div class="form-item">
                <label class="form-label">退回理由 *</label>
                <textarea
                  class="form-input form-textarea"
                  value={opinion.value}
                  onInput$={(e) =>
                    (opinion.value = (e.target as HTMLTextAreaElement).value)
                  }
                  placeholder="请填写退回理由"
                  rows={3}
                />
              </div>
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => (showReviewRejectModal.value = false)}
              >
                取消
              </button>
              <button class="btn btn-danger" onClick$={handleReviewReject}>
                确认退回
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 归档弹窗 */}
      {showArchiveModal.value && (
        <div
          class="modal-overlay"
          onClick$={() => (showArchiveModal.value = false)}
        >
          <div
            class="modal"
            style={{ width: '460px' }}
            onClick$={(e) => e.stopPropagation()}
          >
            <div class="modal-header">
              <span class="modal-title">
                归档
                {isOverdue && (
                  <span style={{ color: '#cf1322', marginLeft: '8px' }}>
                    （逾期，需填处理说明）
                  </span>
                )}
              </span>
              <span
                class="modal-close"
                onClick$={() => (showArchiveModal.value = false)}
              >
                ×
              </span>
            </div>
            <div class="modal-body">
              {isOverdue && (
                <div
                  class="alert alert-warning"
                  style={{ marginBottom: '16px', fontSize: '13px' }}
                >
                  <strong>⚠ 注意：</strong>该申请已逾期，
                  <span style={{ color: '#cf1322' }}>必须填写逾期处理说明</span>
                  后才能归档。
                  <div style={{ marginTop: '6px', color: '#873800' }}>
                    逾期原因：{app.overdue_reason || '原因未知'}
                  </div>
                </div>
              )}
              <p style={{ marginBottom: '16px' }}>
                确认归档该申请？归档后流程结束。
              </p>
              <div class="form-item">
                <label class="form-label">
                  归档备注
                  {isOverdue && (
                    <span style={{ color: '#ff4d4f' }}> *（逾期必填）</span>
                  )}
                </label>
                <textarea
                  class="form-input form-textarea"
                  value={opinion.value}
                  onInput$={(e) =>
                    (opinion.value = (e.target as HTMLTextAreaElement).value)
                  }
                  placeholder={
                    isOverdue
                      ? '请填写逾期处理说明（必填）...'
                      : '归档备注（可选）'
                  }
                  rows={isOverdue ? 4 : 2}
                />
              </div>
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => (showArchiveModal.value = false)}
              >
                取消
              </button>
              <button class="btn btn-primary" onClick$={handleArchive}>
                确认归档
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提交/补正提交弹窗 */}
      {showSubmitModal.value && (
        <div
          class="modal-overlay"
          onClick$={() => (showSubmitModal.value = false)}
        >
          <div
            class="modal"
            style={{ width: '480px' }}
            onClick$={(e) => e.stopPropagation()}
          >
            <div class="modal-header">
              <span class="modal-title">
                {app.status === 'correction_requested' ? '补正提交' : '提交申请'}
                {isOverdue && (
                  <span style={{ color: '#cf1322', marginLeft: '8px' }}>
                    （逾期，需填处理说明）
                  </span>
                )}
              </span>
              <span
                class="modal-close"
                onClick$={() => (showSubmitModal.value = false)}
              >
                ×
              </span>
            </div>
            <div class="modal-body">
              {isOverdue && (
                <div
                  class="alert alert-warning"
                  style={{ marginBottom: '16px', fontSize: '13px' }}
                >
                  <strong>⚠ 注意：</strong>该申请已逾期，
                  <span style={{ color: '#cf1322' }}>必须填写逾期处理说明</span>
                  后才能提交。
                  <div style={{ marginTop: '6px', color: '#873800' }}>
                    逾期原因：{app.overdue_reason || '原因未知'}
                  </div>
                </div>
              )}
              <p style={{ marginBottom: '16px' }}>
                {app.status === 'correction_requested'
                  ? '确认补正完成并重新提交？提交后将进入审核队列。'
                  : '确认提交该展商申请？提交后将进入审核队列，无法再编辑。'}
              </p>
              {app.correction_request && (
                <div
                  class="alert alert-info"
                  style={{ marginBottom: '16px', fontSize: '13px' }}
                >
                  <strong>补正要求：</strong>
                  <div style={{ marginTop: '4px' }}>{app.correction_request}</div>
                </div>
              )}
              <div class="form-item">
                <label class="form-label">
                  处理说明
                  {isOverdue && <span style={{ color: '#ff4d4f' }}> *</span>}
                </label>
                <textarea
                  class="form-input form-textarea"
                  value={submitRemark.value}
                  onInput$={(e) =>
                    (submitRemark.value = (e.target as HTMLTextAreaElement).value)
                  }
                  placeholder={
                    isOverdue ? '请填写逾期处理说明（必填）...' : '可选，填写提交备注'
                  }
                  rows={isOverdue ? 4 : 3}
                />
              </div>
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => (showSubmitModal.value = false)}
              >
                取消
              </button>
              <button class="btn btn-primary" onClick$={handleSubmit}>
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const head = {
  title: '申请详情 - 展商申请管理系统',
};
