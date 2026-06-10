<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { currentUser, refreshAll, detailData } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import {
    STATUS_LABELS,
    STATUS_COLORS,
    EVIDENCE_LABELS,
    ROLES,
    EVIDENCE_TYPES,
  } from '$lib/constants.js';

  const dispatch = createEventDispatcher();

  export let reservationId;

  let activeTab = 'info';

  let operating = false;
  let operateError = '';
  let showRejectDialog = false;
  let rejectReason = '';
  let rejectType = '';

  let showSupplementDialog = false;
  let supplementType = EVIDENCE_TYPES.EXPERIMENT_PLAN;
  let supplementTitle = '';
  let supplementDesc = '';

  $: reservation = $detailData.reservation;
  $: evidences = $detailData.evidences;
  $: supplementaryRecords = $detailData.supplementaryRecords;
  $: auditLogs = $detailData.auditLogs;
  $: loading = $detailData.loading;
  $: error = $detailData.error;

  function getStatusClass(status) {
    return `status-badge status-${STATUS_COLORS[status] || 'gray'}`;
  }

  async function handleSubmit() {
    if (!reservation?.can_submit) return;
    operating = true;
    operateError = '';
    try {
      await api.submitReservation(reservation.id, reservation.version);
      refreshAll();
    } catch (e) {
      operateError = e.message + (e.errors?.length ? '\n' + e.errors.join('\n') : '');
    } finally {
      operating = false;
    }
  }

  function openRejectDialog(type) {
    rejectType = type;
    rejectReason = '';
    operateError = '';
    showRejectDialog = true;
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      operateError = '请填写退回原因';
      return;
    }

    operating = true;
    operateError = '';

    try {
      if (rejectType === 'lab') {
        await api.labReview(
          reservation.id,
          false,
          rejectReason,
          reservation.version
        );
      } else {
        await api.collegeConfirm(
          reservation.id,
          false,
          rejectReason,
          reservation.version
        );
      }
      showRejectDialog = false;
      refreshAll();
    } catch (e) {
      operateError = e.message + (e.errors?.length ? '\n' + e.errors.join('\n') : '');
    } finally {
      operating = false;
    }
  }

  async function handleLabPass() {
    if (!reservation?.can_lab_review) return;
    operating = true;
    operateError = '';
    try {
      await api.labReview(
        reservation.id,
        true,
        '审核通过，材料齐全',
        reservation.version
      );
      refreshAll();
    } catch (e) {
      operateError = e.message + (e.errors?.length ? '\n' + e.errors.join('\n') : '');
    } finally {
      operating = false;
    }
  }

  async function handleCollegePass() {
    if (!reservation?.can_college_confirm) return;
    operating = true;
    operateError = '';
    try {
      await api.collegeConfirm(
        reservation.id,
        true,
        '学院确认通过',
        reservation.version
      );
      refreshAll();
    } catch (e) {
      operateError = e.message + (e.errors?.length ? '\n' + e.errors.join('\n') : '');
    } finally {
      operating = false;
    }
  }

  function openSupplementDialog() {
    supplementType = EVIDENCE_TYPES.EXPERIMENT_PLAN;
    supplementTitle = '';
    supplementDesc = '';
    operateError = '';
    showSupplementDialog = true;
  }

  async function handleSupplement() {
    if (!supplementTitle.trim()) {
      operateError = '请填写材料标题';
      return;
    }

    operating = true;
    operateError = '';

    try {
      await api.supplementEvidence(reservation.id, {
        evidence_type: supplementType,
        title: supplementTitle,
        description: supplementDesc,
        expected_version: reservation.version,
      });
      showSupplementDialog = false;
      refreshAll();
    } catch (e) {
      operateError = e.message + (e.errors?.length ? '\n' + e.errors.join('\n') : '');
    } finally {
      operating = false;
    }
  }

  function closeDetail() {
    dispatch('close');
  }

  function formatTime(dt) {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getEvidenceLabel(type) {
    return EVIDENCE_LABELS[type] || type;
  }
</script>

<div class="detail-panel">
  <div class="panel-header">
    <h3>预约单详情</h3>
    <button class="close-btn" on:click={closeDetail}>×</button>
  </div>

  {#if loading}
    <div class="loading">加载中...</div>
  {:else if error}
    <div class="error">加载失败：{error}</div>
  {:else if reservation}
    <div class="detail-content">
      <div class="detail-header">
        <div class="reservation-no">{reservation.reservation_no}</div>
        <span class={getStatusClass(reservation.status)}>
          {STATUS_LABELS[reservation.status]}
        </span>
      </div>

      <h4 class="detail-title">{reservation.title}</h4>

      <div class="info-grid">
        <div class="info-item">
          <span class="label">实验室</span>
          <span class="value">{reservation.lab_name}</span>
        </div>
        <div class="info-item">
          <span class="label">实验项目</span>
          <span class="value">{reservation.experiment_name}</span>
        </div>
        <div class="info-item">
          <span class="label">申请人</span>
          <span class="value">{reservation.applicant}</span>
        </div>
        <div class="info-item">
          <span class="label">所属学院</span>
          <span class="value">{reservation.department}</span>
        </div>
        <div class="info-item">
          <span class="label">开始时间</span>
          <span class="value">{formatTime(reservation.start_time)}</span>
        </div>
        <div class="info-item">
          <span class="label">结束时间</span>
          <span class="value">{formatTime(reservation.end_time)}</span>
        </div>
        <div class="info-item">
          <span class="label">学生人数</span>
          <span class="value">{reservation.student_count}人</span>
        </div>
        <div class="info-item">
          <span class="label">版本号</span>
          <span class="value">v{reservation.version}</span>
        </div>
      </div>

      <div class="evidence-section">
        <h4>证据材料状态</h4>
        <div class="evidence-list">
          <div
            class="evidence-item"
            class:ok={reservation.has_experiment_plan}
            class:missing={!reservation.has_experiment_plan}
          >
            <span class="ev-icon">{reservation.has_experiment_plan ? '✓' : '✗'}</span>
            <span class="ev-label">实验预约方案</span>
          </div>
          <div
            class="evidence-item"
            class:ok={reservation.has_material_application}
            class:missing={!reservation.has_material_application}
          >
            <span class="ev-icon">{reservation.has_material_application ? '✓' : '✗'}</span>
            <span class="ev-label">耗材申领单</span>
          </div>
          <div
            class="evidence-item"
            class:ok={reservation.has_safety_confirmation}
            class:missing={!reservation.has_safety_confirmation}
          >
            <span class="ev-icon">{reservation.has_safety_confirmation ? '✓' : '✗'}</span>
            <span class="ev-label">安全确认书</span>
          </div>
        </div>
        {#if reservation.missing_evidence?.length > 0}
          <div class="missing-hint">
            缺少：{reservation.missing_evidence.map(getEvidenceLabel).join('、')}
          </div>
        {/if}
      </div>

      {#if reservation.flow_steps?.length > 0}
        <div class="flow-section">
          <h4>审批流程</h4>
          <div class="flow-steps">
            {#each reservation.flow_steps as step (step.key)}
              <div class="flow-step" class:{step.status}>
                <div class="step-dot" />
                <div class="step-content">
                  <div class="step-label">{step.label}</div>
                  {#if step.actor}
                    <div class="step-actor">{step.actor}</div>
                  {/if}
                  {#if step.time}
                    <div class="step-time">{formatTime(step.time)}</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="tabs">
        <button
          class="tab-btn"
          class:active={activeTab === 'info'}
          on:click={() => (activeTab = 'info')}
        >
          流程记录
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'supplementary'}
          on:click={() => (activeTab = 'supplementary')}
        >
          补录记录 ({supplementaryRecords.length})
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'evidences'}
          on:click={() => (activeTab = 'evidences')}
        >
          证据详情
        </button>
      </div>

      <div class="tab-content">
        {#if activeTab === 'info'}
          <div class="timeline">
            {#each auditLogs as log (log.id)}
              <div class="timeline-item">
                <div class="timeline-dot" />
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="log-action">{log.action_display}</span>
                    <span class="log-time">{formatTime(log.action_time)}</span>
                  </div>
                  <div class="log-actor">操作人：{log.actor}</div>
                  {#if log.comment}
                    <div class="log-comment">说明：{log.comment}</div>
                  {/if}
                  {#if log.reason}
                    <div class="log-reason">原因：{log.reason}</div>
                  {/if}
                  {#if log.previous_status && log.new_status}
                    <div class="log-status-change">
                      {STATUS_LABELS[log.previous_status] || '-'} → {STATUS_LABELS[log.new_status]}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        {#if activeTab === 'supplementary'}
          {#if supplementaryRecords.length === 0}
            <div class="empty">暂无补录记录</div>
          {:else}
            <div class="supplementary-list">
              {#each supplementaryRecords as record (record.id)}
                <div class="supp-item">
                  <div class="supp-header">
                    <span class="supp-action">{record.action_display}</span>
                    <span class="supp-time">{formatTime(record.supplementary_at)}</span>
                  </div>
                  <div class="supp-person">补录人：{record.supplementer}</div>
                  <div class="supp-desc">{record.description}</div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}

        {#if activeTab === 'evidences'}
          {#if evidences.length === 0}
            <div class="empty">暂无证据材料</div>
          {:else}
            <div class="evidences-list">
              {#each evidences as ev (ev.id)}
                <div class="ev-card" class:supplementary={ev.is_supplementary}>
                  <div class="ev-header">
                    <span class="ev-type">{ev.evidence_type_display}</span>
                    <span class="ev-version">v{ev.version}</span>
                    {#if ev.is_supplementary}
                      <span class="ev-supp-tag">补录</span>
                    {/if}
                  </div>
                  <div class="ev-title">{ev.title}</div>
                  {#if ev.description}
                    <div class="ev-desc">{ev.description}</div>
                  {/if}
                  <div class="ev-meta">
                    <span>上传人：{ev.uploaded_by}</span>
                    <span>{formatTime(ev.uploaded_at)}</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      {#if operateError}
        <div class="operate-error">
          <strong>操作失败：</strong>
          <pre>{operateError}</pre>
        </div>
      {/if}

      <div class="action-bar">
        {#if reservation.can_submit}
          <button
            class="btn btn-primary"
            on:click={handleSubmit}
            disabled={operating}
          >
            提交审核
          </button>
        {:else if reservation.submit_errors?.length > 0}
          <div class="cannot-do-hint">
            不能提交：{reservation.submit_errors[0]}
          </div>
        {/if}

        {#if reservation.can_lab_review}
          <button
            class="btn btn-success"
            on:click={handleLabPass}
            disabled={operating}
          >
            审核通过
          </button>
          <button
            class="btn btn-warning"
            on:click={() => openRejectDialog('lab')}
            disabled={operating}
          >
            退回
          </button>
        {:else if reservation.lab_review_errors?.length > 0 && $currentUser?.role === ROLES.LAB_ADMIN}
          <div class="cannot-do-hint">
            不能审核：{reservation.lab_review_errors[0]}
          </div>
        {/if}

        {#if reservation.can_college_confirm}
          <button
            class="btn btn-success"
            on:click={handleCollegePass}
            disabled={operating}
          >
            确认通过
          </button>
          <button
            class="btn btn-danger"
            on:click={() => openRejectDialog('college')}
            disabled={operating}
          >
            退回
          </button>
        {:else if reservation.college_confirm_errors?.length > 0 && $currentUser?.role === ROLES.COLLEGE_HEAD}
          <div class="cannot-do-hint">
            不能确认：{reservation.college_confirm_errors[0]}
          </div>
        {/if}

        {#if reservation.can_supplement}
          <button
            class="btn btn-outline"
            on:click={openSupplementDialog}
            disabled={operating}
          >
            补录材料
          </button>
        {:else if reservation.supplement_errors?.length > 0 && $currentUser?.role === ROLES.TEACHING_ASSISTANT}
          <div class="cannot-do-hint">
            不能补录：{reservation.supplement_errors[0]}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if showRejectDialog}
  <div class="dialog-overlay" on:click={() => (showRejectDialog = false)}>
    <div class="dialog" on:click|stopPropagation>
      <h3>{rejectType === 'lab' ? '实验室退回' : '学院退回'}</h3>
      <div class="dialog-body">
        <div class="form-group">
          <label>退回原因 *</label>
          <textarea
            bind:value={rejectReason}
            rows="4"
            placeholder="请详细说明退回原因..."
          ></textarea>
        </div>
      </div>
      <div class="dialog-footer">
        <button
          class="btn btn-default"
          on:click={() => (showRejectDialog = false)}
          disabled={operating}
        >
          取消
        </button>
        <button
          class="btn btn-danger"
          on:click={handleReject}
          disabled={operating}
        >
          {operating ? '处理中...' : '确认退回'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showSupplementDialog}
  <div class="dialog-overlay" on:click={() => (showSupplementDialog = false)}>
    <div class="dialog" on:click|stopPropagation>
      <h3>补录材料</h3>
      <div class="dialog-body">
        <div class="form-group">
          <label>材料类型</label>
          <select bind:value={supplementType}>
            {#each Object.entries(EVIDENCE_LABELS) as [value, label]}
              <option value={value}>{label}</option>
            {/each}
          </select>
        </div>
        <div class="form-group">
          <label>材料标题 *</label>
          <input
            type="text"
            bind:value={supplementTitle}
            placeholder="请输入材料标题"
          />
        </div>
        <div class="form-group">
          <label>补充说明</label>
          <textarea
            bind:value={supplementDesc}
            rows="3"
            placeholder="请输入补充说明..."
          ></textarea>
        </div>
        <div class="supplement-notice">
          <strong>注意：</strong>补录记录将独立保存，不会覆盖原始记录，所有补录操作都会留下痕迹。
        </div>
      </div>
      <div class="dialog-footer">
        <button
          class="btn btn-default"
          on:click={() => (showSupplementDialog = false)}
          disabled={operating}
        >
          取消
        </button>
        <button
          class="btn btn-primary"
          on:click={handleSupplement}
          disabled={operating}
        >
          {operating ? '处理中...' : '确认补录'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .detail-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #eee;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    color: #1e3a5f;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #999;
    line-height: 1;
  }

  .close-btn:hover {
    color: #333;
  }

  .loading,
  .empty,
  .error {
    text-align: center;
    padding: 40px 20px;
    color: #999;
  }

  .error {
    color: #e74c3c;
  }

  .detail-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .reservation-no {
    font-family: monospace;
    font-size: 13px;
    color: #666;
  }

  .status-badge {
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 10px;
    font-weight: 500;
  }

  .status-gray {
    background: #f0f0f0;
    color: #666;
  }

  .status-blue {
    background: #e3f2fd;
    color: #1976d2;
  }

  .status-purple {
    background: #f3e5f5;
    color: #7b1fa2;
  }

  .status-orange {
    background: #fff3e0;
    color: #f57c00;
  }

  .status-green {
    background: #e8f5e9;
    color: #388e3c;
  }

  .status-red {
    background: #ffebee;
    color: #d32f2f;
  }

  .detail-title {
    font-size: 18px;
    margin: 0 0 16px;
    color: #1e3a5f;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .info-item .label {
    font-size: 12px;
    color: #999;
  }

  .info-item .value {
    font-size: 13px;
    color: #333;
    font-weight: 500;
  }

  .evidence-section {
    margin-bottom: 20px;
  }

  .evidence-section h4 {
    font-size: 14px;
    margin: 0 0 12px;
    color: #1e3a5f;
  }

  .evidence-list {
    display: flex;
    gap: 10px;
  }

  .evidence-item {
    flex: 1;
    padding: 10px;
    border-radius: 6px;
    text-align: center;
    font-size: 12px;
  }

  .evidence-item.ok {
    background: #e8f5e9;
    color: #388e3c;
  }

  .evidence-item.missing {
    background: #ffebee;
    color: #d32f2f;
  }

  .ev-icon {
    display: block;
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 4px;
  }

  .missing-hint {
    margin-top: 8px;
    font-size: 12px;
    color: #e67e22;
    background: #fff8e1;
    padding: 6px 10px;
    border-radius: 4px;
  }

  .flow-section {
    margin-bottom: 20px;
  }

  .flow-section h4 {
    font-size: 14px;
    margin: 0 0 12px;
    color: #1e3a5f;
  }

  .flow-steps {
    display: flex;
    gap: 0;
  }

  .flow-step {
    flex: 1;
    position: relative;
    padding: 10px;
    text-align: center;
  }

  .flow-step .step-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    margin: 0 auto 8px;
    background: #ddd;
    position: relative;
    z-index: 1;
  }

  .flow-step.done .step-dot {
    background: #27ae60;
  }

  .flow-step.current .step-dot {
    background: #f39c12;
    box-shadow: 0 0 0 4px rgba(243, 156, 18, 0.3);
  }

  .flow-step.rejected .step-dot {
    background: #e74c3c;
  }

  .step-label {
    font-size: 12px;
    font-weight: 500;
    color: #333;
  }

  .step-actor {
    font-size: 11px;
    color: #666;
    margin-top: 4px;
  }

  .step-time {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid #eee;
    margin-bottom: 16px;
  }

  .tab-btn {
    flex: 1;
    padding: 10px;
    background: none;
    border: none;
    font-size: 13px;
    color: #666;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab-btn.active {
    color: #2d5a87;
    border-bottom-color: #2d5a87;
    font-weight: 500;
  }

  .tab-content {
    min-height: 150px;
    max-height: 250px;
    overflow-y: auto;
  }

  .timeline {
    padding-left: 8px;
  }

  .timeline-item {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    position: relative;
  }

  .timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #2d5a87;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .timeline-content {
    flex: 1;
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .log-action {
    font-size: 13px;
    font-weight: 500;
    color: #1e3a5f;
  }

  .log-time {
    font-size: 11px;
    color: #999;
  }

  .log-actor,
  .log-comment,
  .log-reason,
  .log-status-change {
    font-size: 12px;
    color: #666;
    margin-top: 2px;
  }

  .log-reason {
    color: #e67e22;
  }

  .log-status-change {
    color: #27ae60;
    font-weight: 500;
  }

  .supplementary-list .supp-item {
    padding: 12px;
    border: 1px solid #f0e6d6;
    background: #fffaf0;
    border-radius: 6px;
    margin-bottom: 10px;
  }

  .supp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .supp-action {
    font-size: 13px;
    font-weight: 500;
    color: #f57c00;
  }

  .supp-time {
    font-size: 11px;
    color: #999;
  }

  .supp-person {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
  }

  .supp-desc {
    font-size: 12px;
    color: #333;
  }

  .evidences-list .ev-card {
    padding: 12px;
    border: 1px solid #eee;
    border-radius: 6px;
    margin-bottom: 10px;
  }

  .ev-card.supplementary {
    border-color: #f0e6d6;
    background: #fffaf0;
  }

  .ev-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .ev-type {
    font-size: 12px;
    font-weight: 500;
    color: #1e3a5f;
  }

  .ev-version {
    font-size: 11px;
    color: #999;
  }

  .ev-supp-tag {
    font-size: 10px;
    padding: 1px 6px;
    background: #f39c12;
    color: white;
    border-radius: 3px;
  }

  .ev-title {
    font-size: 13px;
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
  }

  .ev-desc {
    font-size: 12px;
    color: #666;
    margin-bottom: 6px;
  }

  .ev-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #999;
  }

  .operate-error {
    margin: 12px 0;
    padding: 10px;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    font-size: 12px;
    color: #c33;
  }

  .operate-error pre {
    margin: 4px 0 0;
    white-space: pre-wrap;
    font-size: 11px;
  }

  .action-bar {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    padding-top: 16px;
    border-top: 1px solid #eee;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #2d5a87;
    color: white;
  }

  .btn-primary:hover {
    background: #1e3a5f;
  }

  .btn-success {
    background: #27ae60;
    color: white;
  }

  .btn-success:hover {
    background: #1e8449;
  }

  .btn-warning {
    background: #f39c12;
    color: white;
  }

  .btn-warning:hover {
    background: #d68910;
  }

  .btn-danger {
    background: #e74c3c;
    color: white;
  }

  .btn-danger:hover {
    background: #c0392b;
  }

  .btn-outline {
    background: transparent;
    color: #2d5a87;
    border: 1px solid #2d5a87;
  }

  .btn-outline:hover {
    background: #f0f6ff;
  }

  .btn-default {
    background: #ecf0f1;
    color: #333;
  }

  .btn-default:hover {
    background: #bdc3c7;
  }

  .cannot-do-hint {
    font-size: 12px;
    color: #999;
    padding: 8px 12px;
    background: #f5f5f5;
    border-radius: 4px;
  }

  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: white;
    border-radius: 8px;
    width: 420px;
    max-width: 90vw;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .dialog h3 {
    margin: 0;
    padding: 16px 20px;
    border-bottom: 1px solid #eee;
    font-size: 16px;
    color: #1e3a5f;
  }

  .dialog-body {
    padding: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .form-group label {
    font-size: 13px;
    color: #333;
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }

  .supplement-notice {
    font-size: 12px;
    color: #e67e22;
    background: #fff8e1;
    padding: 8px 10px;
    border-radius: 4px;
    margin-top: 8px;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 20px;
    border-top: 1px solid #eee;
  }
</style>
