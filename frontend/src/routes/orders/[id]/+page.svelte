<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import { 
    currentUser, currentRole, STATUS_LABELS, STATUS_COLORS, 
    ATTACHMENT_STATUS_LABELS, ATTACHMENT_STATUS_COLORS, ROLE_LABELS, users
  } from '$lib/store';
  import ProgressFlow from './ProgressFlow.svelte';
  import AuditTimeline from './AuditTimeline.svelte';

  let order = null;
  let loading = true;
  let error = '';
  let success = '';

  let showSubmitModal = false;
  let showReturnModal = false;
  let showSupplementModal = false;
  let showRejectAttachmentModal = false;
  let currentRejectAttachment = null;

  let formData = {
    reason: '',
    audit_remark: '',
    reject_reason: '',
    supplement_note: '',
    supervisor_id: '',
    deadline_days: 7
  };

  let supervisors = [];
  let uploadError = '';

  async function loadOrder() {
    loading = true;
    error = '';
    try {
      const id = $page.params.id;
      order = await api.getOrder(id);
      const usersData = await api.getUsers();
      supervisors = usersData.filter(u => u.role === 'supervisor');
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadOrder();
  });

  function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('zh-CN', { hour12: false });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  function clearMsgs() {
    error = '';
    success = '';
  }

  async function handleSubmit() {
    clearMsgs();
    try {
      if (!formData.supervisor_id) throw new Error('请选择审核主管');
      order = await api.submitOrder(order.id, {
        supervisor_id: parseInt(formData.supervisor_id),
        deadline_days: parseInt(formData.deadline_days)
      });
      showSubmitModal = false;
      formData = { ...formData, supervisor_id: '', deadline_days: 7 };
      success = '已提交审核主管办理';
    } catch (e) {
      error = e.message;
    }
  }

  async function handleSupervisorApprove() {
    clearMsgs();
    try {
      order = await api.supervisorApprove(order.id, {
        reason: formData.reason,
        audit_remark: formData.audit_remark
      });
      formData = { ...formData, reason: '', audit_remark: '' };
      success = '审核通过，已提交复核负责人';
    } catch (e) {
      error = e.message;
    }
  }

  async function handleSupervisorReturn() {
    clearMsgs();
    try {
      if (!formData.reason) throw new Error('请填写退回原因');
      order = await api.supervisorReturn(order.id, {
        reason: formData.reason,
        audit_remark: formData.audit_remark
      });
      showReturnModal = false;
      formData = { ...formData, reason: '', audit_remark: '' };
      success = '已退回登记员补正附件';
    } catch (e) {
      error = e.message;
    }
  }

  async function handleSupplement() {
    clearMsgs();
    try {
      order = await api.supplementOrder(order.id, {
        supplement_note: formData.supplement_note,
        audit_remark: formData.audit_remark
      });
      showSupplementModal = false;
      formData = { ...formData, supplement_note: '', audit_remark: '' };
      success = '已补正并重新提交审核';
    } catch (e) {
      error = e.message;
    }
  }

  async function handleReviewerApprove() {
    clearMsgs();
    try {
      order = await api.reviewerApprove(order.id, {
        reason: formData.reason,
        audit_remark: formData.audit_remark
      });
      formData = { ...formData, reason: '', audit_remark: '' };
      success = '已复核通过并归档';
    } catch (e) {
      error = e.message;
    }
  }

  async function handleReviewerReturn() {
    clearMsgs();
    try {
      if (!formData.reason) throw new Error('请填写退回原因');
      order = await api.reviewerReturn(order.id, {
        reason: formData.reason,
        audit_remark: formData.audit_remark
      });
      showReturnModal = false;
      formData = { ...formData, reason: '', audit_remark: '' };
      success = '复核已退回';
    } catch (e) {
      error = e.message;
    }
  }

  async function handleUpload(e) {
    clearMsgs();
    uploadError = '';
    const file = e.target.files[0];
    if (!file) return;
    try {
      await api.uploadAttachment(order.id, file, $currentUser.id);
      await loadOrder();
      success = `附件「${file.name}」上传成功`;
    } catch (e) {
      uploadError = e.message;
    }
    e.target.value = '';
  }

  async function handleDeleteAttachment(att) {
    if (!confirm(`确定删除附件「${att.file_name}」吗？`)) return;
    clearMsgs();
    try {
      await api.deleteAttachment(att.id);
      await loadOrder();
      success = '附件已删除';
    } catch (e) {
      error = e.message;
    }
  }

  function openRejectAttachment(att) {
    currentRejectAttachment = att;
    formData.reject_reason = '';
    showRejectAttachmentModal = true;
  }

  async function handleRejectAttachment() {
    clearMsgs();
    try {
      if (!formData.reject_reason) throw new Error('请填写驳回原因');
      await api.rejectAttachment(currentRejectAttachment.id, formData.reject_reason, $currentUser.id);
      showRejectAttachmentModal = false;
      currentRejectAttachment = null;
      formData.reject_reason = '';
      await loadOrder();
      success = '附件已驳回';
    } catch (e) {
      error = e.message;
    }
  }

  // 权限判断
  function canEdit() {
    if (!$currentUser || !order) return false;
    return $currentRole === 'registrar' && 
           order.registrar_id === $currentUser.id &&
           ['draft', 'supplement_required'].includes(order.status);
  }

  function canUpload() {
    return canEdit();
  }

  function canDeleteAttachment(att) {
    if (!$currentUser || !order) return false;
    if (!canEdit()) return false;
    return att.uploaded_by_id === $currentUser.id;
  }

  function canSubmit() {
    if (!$currentUser || !order) return false;
    return $currentRole === 'registrar' && 
           order.registrar_id === $currentUser.id &&
           order.status === 'draft';
  }

  function canReSubmitSupplement() {
    if (!$currentUser || !order) return false;
    return $currentRole === 'registrar' && 
           order.registrar_id === $currentUser.id &&
           order.status === 'supplement_required';
  }

  function canSupervisorApprove() {
    if (!$currentUser || !order) return false;
    return $currentRole === 'supervisor' && 
           order.supervisor_id === $currentUser.id &&
           order.status === 'pending_review';
  }

  function canSupervisorReturn() {
    return canSupervisorApprove();
  }

  function canRejectAttachment(att) {
    if (!$currentUser || !order) return false;
    return $currentRole === 'supervisor' && 
           order.supervisor_id === $currentUser.id &&
           order.status === 'pending_review' &&
           att.status !== 'rejected';
  }

  function canReviewerApprove() {
    if (!$currentUser || !order) return false;
    return $currentRole === 'reviewer' && 
           order.reviewer_id === $currentUser.id &&
           order.status === 'pending_final';
  }

  function canReviewerReturn() {
    return canReviewerApprove();
  }

  // 状态说明
  function getProgressNote() {
    if (!order) return '';
    const s = order.status;
    if (s === 'draft') return '📝 单据处于草稿状态，登记员可编辑内容、上传附件，确认无误后提交给审核主管。';
    if (s === 'pending_review') return `🔍 单据等待 ${order.supervisor}（审核主管）办理：核验附件完整性与变更合理性，可通过或退回补正。`;
    if (s === 'supplement_required') return `⚠️ 单据被 ${order.supervisor}（审核主管）退回：需查看下方退回原因，补充材料或替换被驳回的附件后重新提交。`;
    if (s === 'pending_final') return `✅ 单据已通过主管审核，等待 ${order.reviewer}（复核负责人）最终复核并归档。`;
    if (s === 'returned') return `❌ 单据在复核阶段被 ${order.reviewer} 退回，请查看下方退回原因并与相关人员沟通。`;
    if (s === 'archived') return '🎉 单据已完成复核归档，流程结束。';
    if (s === 'overdue') return '⏰ 单据处理超时，系统已标记为异常，请尽快跟进。';
    return '';
  }
</script>

<div>
  <button on:click={() => goto('/')} style="margin-bottom:16px;">← 返回列表</button>

  {#if loading}
    <div class="empty-state">加载中...</div>
  {:else if error && !order}
    <div class="alert alert-danger">加载失败：{error}</div>
  {:else if order}
    {#if error}
      <div class="alert alert-danger">{error}</div>
    {/if}
    {#if success}
      <div class="alert alert-success">{success}</div>
    {/if}

    <ProgressFlow currentStatus={order.status} isReturned={order.status === 'returned' || order.status === 'supplement_required'} />

    <div class="alert alert-info">
      {getProgressNote()}
    </div>

    <!-- 基本信息 -->
    <div class="card">
      <div class="card-title">
        <span>基本信息</span>
        <span class="badge" style="background:{STATUS_COLORS[order.status]}">
          {#if order.is_overdue}⚠️ {/if}{STATUS_LABELS[order.status]}
        </span>
      </div>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="label">变更单号</div>
          <div class="value"><strong>{order.order_no}</strong></div>
        </div>
        <div class="detail-item">
          <div class="label">标题</div>
          <div class="value">{order.title}</div>
        </div>
        <div class="detail-item">
          <div class="label">物料编码</div>
          <div class="value">{order.material_code}</div>
        </div>
        <div class="detail-item">
          <div class="label">物料名称</div>
          <div class="value">{order.material_name}</div>
        </div>
        <div class="detail-item">
          <div class="label">变更类型</div>
          <div class="value">{order.change_type}</div>
        </div>
        <div class="detail-item">
          <div class="label">登记人</div>
          <div class="value">{order.registrar}（物料变更登记员）</div>
        </div>
        <div class="detail-item">
          <div class="label">审核主管</div>
          <div class="value">{order.supervisor ? order.supervisor + '（物料变更审核主管）' : '-'}</div>
        </div>
        <div class="detail-item">
          <div class="label">复核负责人</div>
          <div class="value">{order.reviewer ? order.reviewer + '（电子元器件工厂复核负责人）' : '-'}</div>
        </div>
        <div class="detail-item">
          <div class="label">创建时间</div>
          <div class="value">{formatDate(order.created_at)}</div>
        </div>
        <div class="detail-item">
          <div class="label">提交时间</div>
          <div class="value">{formatDate(order.submitted_at)}</div>
        </div>
        <div class="detail-item">
          <div class="label">截止时间</div>
          <div class="value" style="color:{order.deadline && new Date(order.deadline) < new Date() ? '#dc2626' : ''}">
            {formatDate(order.deadline)}
          </div>
        </div>
        <div class="detail-item">
          <div class="label">归档时间</div>
          <div class="value">{formatDate(order.archived_at)}</div>
        </div>
      </div>
      {#if order.description}
        <div style="margin-top:16px;">
          <div class="detail-item">
            <div class="label">变更说明</div>
            <div class="value">{order.description}</div>
          </div>
        </div>
      {/if}
    </div>

    <!-- 退回原因 / 补正说明 / 审计备注 -->
    {#if order.return_reason || order.supplement_note || order.audit_remark}
      <div class="card">
        <div class="card-title">原因与备注</div>
        {#if order.return_reason}
          <div class="info-block">
            <div class="info-block-title" style="color:#dc2626">❌ 退回原因</div>
            <div class="info-block-content">{order.return_reason}</div>
          </div>
        {/if}
        {#if order.supplement_note}
          <div class="info-block">
            <div class="info-block-title" style="color:#d97706">📝 补正说明</div>
            <div class="info-block-content">{order.supplement_note}</div>
          </div>
        {/if}
        {#if order.audit_remark}
          <div class="info-block">
            <div class="info-block-title">📌 审计备注</div>
            <div class="info-block-content">{order.audit_remark}</div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- 附件管理 -->
    <div class="card">
      <div class="card-title">
        <span>📎 附件管理（{order.attachments.length} 个）</span>
        {#if canUpload()}
          <span style="font-size:12px;color:#6b7280;font-weight:normal">
            提示：被驳回的附件需要删除并重新上传后，才能重新提交
          </span>
        {/if}
      </div>

      {#if canUpload()}
        {#if uploadError}
          <div class="alert alert-danger">{uploadError}</div>
        {/if}
        <label class="attachment-upload-area">
          <input type="file" on:change={handleUpload} />
          <div>📤 点击或拖拽附件文件到此处上传</div>
          <div style="font-size:12px;margin-top:4px;color:#6b7280">支持 PDF、Word、Excel、图片等格式</div>
        </label>
        <div style="height:12px"></div>
      {/if}

      {#if order.attachments.length === 0}
        <div class="empty-state">暂无附件</div>
      {:else}
        {#each order.attachments as att}
          <div class="attachment-item">
            <div class="info">
              <div style="font-size:20px">📄</div>
              <div style="flex:1">
                <div style="font-weight:500">
                  {att.file_name}
                  <span class="badge" style="background:{ATTACHMENT_STATUS_COLORS[att.status]};margin-left:8px">
                    {ATTACHMENT_STATUS_LABELS[att.status]}
                  </span>
                </div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px">
                  {att.file_type} · {formatSize(att.file_size)} · 上传人：{att.uploaded_by} · {formatDate(att.created_at)}
                  {#if att.rejected_by}
                     · 驳回人：{att.rejected_by} · {formatDate(att.rejected_at)}
                  {/if}
                </div>
                {#if att.status === 'rejected' && att.reject_reason}
                  <div class="reject-reason">
                    ❌ 驳回原因：{att.reject_reason}
                  </div>
                {/if}
              </div>
            </div>
            <div class="actions">
              <a href="http://localhost:8004{att.file_path}" target="_blank" class="btn btn-sm">预览</a>
              {#if canDeleteAttachment(att)}
                <button class="btn-sm btn-danger" on:click={() => handleDeleteAttachment(att)}>删除</button>
              {/if}
              {#if canRejectAttachment(att)}
                <button class="btn-sm btn-warning" on:click={() => openRejectAttachment(att)}>驳回此附件</button>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- 操作区 -->
    <div class="card">
      <div class="card-title">
        <span>🛠 操作区（当前身份：{$currentUser ? $currentUser.name + ' · ' + ROLE_LABELS[$currentRole] : '-'}）</span>
      </div>

      {#if !$currentUser}
        <div class="empty-state">请先在右上角选择角色和用户</div>
      {:else}
        <!-- 登记员操作 -->
        {#if canSubmit()}
          <div class="alert alert-info">
            <strong>说明：</strong>您是登记人，确认附件齐全后可提交给审核主管办理。
          </div>
          <div class="actions-bar">
            <button class="btn-primary" on:click={() => showSubmitModal = true}>提交审核</button>
          </div>
        {/if}

        {#if canReSubmitSupplement()}
          <div class="alert alert-warning">
            <strong>说明：</strong>您是登记人，请先补充缺失的附件（或删除被驳回附件后重新上传），确认齐全后重新提交。
          </div>
          <div class="actions-bar">
            <button class="btn-primary" on:click={() => showSupplementModal = true}>补正并重新提交</button>
          </div>
        {/if}

        <!-- 审核主管操作 -->
        {#if canSupervisorApprove()}
          <div class="alert alert-info">
            <strong>说明：</strong>您是本单审核主管，请核验附件完整性与变更合理性。可驳回单个附件，或整体通过/退回。
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>审核意见（选填）</label>
              <textarea bind:value={formData.reason} placeholder="请填写审核通过的说明或要点"></textarea>
            </div>
            <div class="form-item">
              <label>审计备注（选填，将永久留痕）</label>
              <textarea bind:value={formData.audit_remark} placeholder="审计备注，可留空"></textarea>
            </div>
          </div>
          <div class="actions-bar">
            <button class="btn-success" on:click={handleSupervisorApprove}>✅ 审核通过，提交复核</button>
            <button class="btn-danger" on:click={() => { formData.reason = ''; showReturnModal = true; }}>❌ 退回补正</button>
          </div>
        {/if}

        <!-- 复核负责人操作 -->
        {#if canReviewerApprove()}
          <div class="alert alert-info">
            <strong>说明：</strong>您是本单复核负责人，请做最终复核。通过后将直接归档，流程结束。
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>复核意见（选填）</label>
              <textarea bind:value={formData.reason} placeholder="请填写复核通过的说明"></textarea>
            </div>
            <div class="form-item">
              <label>审计备注（选填，将永久留痕）</label>
              <textarea bind:value={formData.audit_remark} placeholder="审计备注，可留空"></textarea>
            </div>
          </div>
          <div class="actions-bar">
            <button class="btn-success" on:click={handleReviewerApprove}>✅ 复核通过并归档</button>
            <button class="btn-danger" on:click={() => { formData.reason = ''; showReturnModal = true; }}>❌ 复核退回</button>
          </div>
        {/if}

        <!-- 无权操作 -->
        {#if !canEdit() && !canSubmit() && !canReSubmitSupplement() && !canSupervisorApprove() && !canReviewerApprove()}
          <div class="empty-state">
            当前身份下无可用操作。请切换到正确的角色或用户，或联系相关人员处理。
          </div>
        {/if}
      {/if}
    </div>

    <!-- 审计日志 -->
    <div class="card">
      <AuditTimeline logs={order.audit_logs} />
    </div>
  {/if}
</div>

<!-- 提交审核弹窗 -->
{#if showSubmitModal}
  <div class="modal-backdrop" on:click|self={() => showSubmitModal = false}>
    <div class="modal">
      <div class="modal-header">提交审核主管办理
        <button class="link-btn" on:click={() => showSubmitModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label>选择审核主管 *</label>
          <select bind:value={formData.supervisor_id}>
            <option value="">请选择</option>
            {#each supervisors as s}
              <option value={s.id}>{s.name}</option>
            {/each}
          </select>
        </div>
        <div class="form-item">
          <label>处理时限（天）</label>
          <input type="number" bind:value={formData.deadline_days} min="1" />
        </div>
      </div>
      <div class="modal-footer">
        <button on:click={() => showSubmitModal = false}>取消</button>
        <button class="btn-primary" on:click={handleSubmit}>确认提交</button>
      </div>
    </div>
  </div>
{/if}

<!-- 退回弹窗 -->
{#if showReturnModal}
  <div class="modal-backdrop" on:click|self={() => showReturnModal = false}>
    <div class="modal">
      <div class="modal-header">{order && order.status === 'pending_review' ? '退回补正附件' : '复核退回'}
        <button class="link-btn" on:click={() => showReturnModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label>退回原因 *</label>
          <textarea bind:value={formData.reason} placeholder="请详细说明退回原因，便于登记员补正（将作为审计记录永久留痕）"></textarea>
        </div>
        <div class="form-item">
          <label>审计备注（选填）</label>
          <textarea bind:value={formData.audit_remark}></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button on:click={() => showReturnModal = false}>取消</button>
        <button class="btn-danger" on:click={order && order.status === 'pending_review' ? handleSupervisorReturn : handleReviewerReturn}>
          确认退回
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 补正提交弹窗 -->
{#if showSupplementModal}
  <div class="modal-backdrop" on:click|self={() => showSupplementModal = false}>
    <div class="modal">
      <div class="modal-header">补正并重新提交
        <button class="link-btn" on:click={() => showSupplementModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label>补正说明（选填）</label>
          <textarea bind:value={formData.supplement_note} placeholder="说明补正了哪些内容，便于审核主管快速核验"></textarea>
        </div>
        <div class="form-item">
          <label>审计备注（选填）</label>
          <textarea bind:value={formData.audit_remark}></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button on:click={() => showSupplementModal = false}>取消</button>
        <button class="btn-primary" on:click={handleSupplement}>确认重新提交</button>
      </div>
    </div>
  </div>
{/if}

<!-- 驳回附件弹窗 -->
{#if showRejectAttachmentModal}
  <div class="modal-backdrop" on:click|self={() => showRejectAttachmentModal = false}>
    <div class="modal">
      <div class="modal-header">驳回附件：{currentRejectAttachment && currentRejectAttachment.file_name}
        <button class="link-btn" on:click={() => showRejectAttachmentModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="form-item">
          <label>驳回原因 *</label>
          <textarea bind:value={formData.reject_reason} placeholder="请详细说明此附件被驳回的原因，登记员需据此补正"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button on:click={() => showRejectAttachmentModal = false}>取消</button>
        <button class="btn-warning" on:click={handleRejectAttachment}>确认驳回</button>
      </div>
    </div>
  </div>
{/if}
