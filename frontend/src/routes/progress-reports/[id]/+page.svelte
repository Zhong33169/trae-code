<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { ProgressStatus, TimeoutStatus, ProgressStatusLabel, TimeoutStatusLabel, OperationTypeLabel } from '$types';
  import { formatDate, formatDateTime } from '$utils/format';
  import {
    canEditReport,
    canSubmitReview,
    canReview,
    canVerify,
    canCorrect,
    canHandleTimeout,
    canDeleteReport,
  } from '$utils/permissions';
  import { currentUser, showToast } from '$stores';
  import { progressReportsApi } from '$api';
  import StatusTag from '$components/StatusTag.svelte';
  import Modal from '$components/Modal.svelte';

  export let data: PageData;

  $: report = data.report;
  $: operationLogs = data.operationLogs;
  $: weeklyReports = data.weeklyReports;
  $: deviationAnalyses = data.deviationAnalyses;
  $: ownerReports = data.ownerReports;
  $: user = $currentUser;
  $: reportId = $page.params.id;

  let activeTab = 'info';
  let showSubmitModal = false;
  let showReviewModal = false;
  let showVerifyModal = false;
  let showCorrectModal = false;
  let showTimeoutModal = false;
  let showDeleteModal = false;

  let submitRemarks = '';
  let reviewApproved = true;
  let reviewOpinion = '';
  let verifyApproved = true;
  let verifyOpinion = '';
  let correctData = {
    title: report.title,
    content: report.content || '',
    abnormalReason: report.abnormalReason || '',
    correctionRemark: '',
  };
  let timeoutData = {
    timeoutReason: '',
    timeoutFollowUp: '',
    remarks: '',
  };

  $: action = $page.url.searchParams.get('action');

  onMount(() => {
    if (action === 'timeout' && canHandleTimeout(user, report) && report.timeoutStatus === TimeoutStatus.OVERDUE) {
      showTimeoutModal = true;
    }
  });

  async function handleSubmit() {
    try {
      await progressReportsApi.submitForReview(reportId, { remarks: submitRemarks });
      showToast('提交审核成功', 'success');
      showSubmitModal = false;
      submitRemarks = '';
      await invalidateAll();
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '提交失败', 'error');
    }
  }

  async function handleStartReview() {
    try {
      await progressReportsApi.startReview(reportId);
      showToast('已开始审核', 'success');
      showReviewModal = true;
      await invalidateAll();
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '操作失败', 'error');
    }
  }

  async function handleReview() {
    if (!reviewOpinion) {
      showToast('请输入审核意见', 'error');
      return;
    }
    try {
      await progressReportsApi.review(reportId, {
        approved: reviewApproved,
        opinion: reviewOpinion,
      });
      showToast(reviewApproved ? '审核通过成功' : '审核驳回成功', 'success');
      showReviewModal = false;
      reviewOpinion = '';
      await invalidateAll();
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '审核失败', 'error');
    }
  }

  async function handleStartVerification() {
    try {
      await progressReportsApi.startVerification(reportId);
      showToast('已开始复核', 'success');
      showVerifyModal = true;
      await invalidateAll();
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '操作失败', 'error');
    }
  }

  async function handleVerify() {
    if (!verifyOpinion) {
      showToast('请输入复核意见', 'error');
      return;
    }
    try {
      await progressReportsApi.verify(reportId, {
        approved: verifyApproved,
        opinion: verifyOpinion,
      });
      showToast(verifyApproved ? '复核通过并归档成功' : '复核驳回成功', 'success');
      showVerifyModal = false;
      verifyOpinion = '';
      await invalidateAll();
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '复核失败', 'error');
    }
  }

  async function handleCorrect() {
    if (!correctData.correctionRemark) {
      showToast('请输入补正说明', 'error');
      return;
    }
    try {
      await progressReportsApi.correct(reportId, correctData);
      showToast('补正成功', 'success');
      showCorrectModal = false;
      correctData.correctionRemark = '';
      await invalidateAll();
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '补正失败', 'error');
    }
  }

  async function handleTimeout() {
    if (!timeoutData.timeoutReason) {
      showToast('请输入超时原因', 'error');
      return;
    }
    if (!timeoutData.timeoutFollowUp) {
      showToast('请输入后续处理方案', 'error');
      return;
    }
    try {
      await progressReportsApi.handleTimeout(reportId, timeoutData);
      showToast('超时处理记录已保存', 'success');
      showTimeoutModal = false;
      timeoutData = { timeoutReason: '', timeoutFollowUp: '', remarks: '' };
      await invalidateAll();
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '处理失败', 'error');
    }
  }

  async function handleDelete() {
    try {
      await progressReportsApi.delete(reportId);
      showToast('删除成功', 'success');
      showDeleteModal = false;
      goto('/progress-reports');
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '删除失败', 'error');
    }
  }

  function openCorrectModal() {
    correctData = {
      title: report.title,
      content: report.content || '',
      abnormalReason: report.abnormalReason || '',
      correctionRemark: '',
    };
    showCorrectModal = true;
  }

  function openTimeoutModal() {
    timeoutData = {
      timeoutReason: report.timeoutReason || '',
      timeoutFollowUp: report.timeoutFollowUp || '',
      remarks: '',
    };
    showTimeoutModal = true;
  }
</script>

<div class="detail-page">
  <div class="page-header">
    <div>
      <div class="breadcrumb">
        <a href="/progress-reports" class="link">进度报告列表</a>
        <span class="separator">/</span>
        <span class="current">详情</span>
      </div>
      <h1 class="page-title">{report.title}</h1>
      <div class="status-row">
        <StatusTag status={report.status} type="progress" size="large" />
        <StatusTag status={report.timeoutStatus} type="timeout" size="large" />
        {#if report.timeoutStatus !== TimeoutStatus.NORMAL && report.timeoutDays > 0}
          <span class="timeout-badge">已超时 {report.timeoutDays} 天</span>
        {/if}
      </div>
    </div>
    <div class="header-actions">
      {#if canEditReport(user, report)}
        <button class="btn btn-outline" on:click={() => goto(`/progress-reports/${reportId}/edit`)}>
          编辑
        </button>
      {/if}
      {#if canSubmitReview(user, report)}
        <button class="btn btn-primary" on:click={() => showSubmitModal = true}>
          提交审核
        </button>
      {/if}
      {#if report.status === ProgressStatus.PENDING_REVIEW && canReview(user, report)}
        <button class="btn btn-primary" on:click={handleStartReview}>
          开始审核
        </button>
      {/if}
      {#if report.status === ProgressStatus.UNDER_REVIEW && canReview(user, report)}
        <button class="btn btn-primary" on:click={() => showReviewModal = true}>
          审核
        </button>
      {/if}
      {#if report.status === ProgressStatus.PENDING_VERIFICATION && canVerify(user, report)}
        <button class="btn btn-primary" on:click={handleStartVerification}>
          开始复核
        </button>
      {/if}
      {#if report.status === ProgressStatus.UNDER_VERIFICATION && canVerify(user, report)}
        <button class="btn btn-primary" on:click={() => showVerifyModal = true}>
          复核归档
        </button>
      {/if}
      {#if canCorrect(user, report)}
        <button class="btn btn-warning" on:click={openCorrectModal}>
          补正
        </button>
      {/if}
      {#if canHandleTimeout(user, report) && report.timeoutStatus === TimeoutStatus.OVERDUE}
        <button class="btn btn-warning" on:click={openTimeoutModal}>
          处理超时
        </button>
      {/if}
      {#if canDeleteReport(user, report)}
        <button class="btn btn-danger" on:click={() => showDeleteModal = true}>
          删除
        </button>
      {/if}
    </div>
  </div>

  <div class="info-cards">
    <div class="info-card">
      <div class="info-label">项目名称</div>
      <div class="info-value">{report.projectName || '-'}</div>
    </div>
    <div class="info-card">
      <div class="info-label">报告日期</div>
      <div class="info-value">{report.reportDate ? formatDate(report.reportDate) : '-'}</div>
    </div>
    <div class="info-card">
      <div class="info-label">截止时间</div>
      <div class="info-value" class:danger={report.timeoutStatus === TimeoutStatus.OVERDUE}>
        {formatDate(report.deadline)}
      </div>
    </div>
    <div class="info-card">
      <div class="info-label">责任人</div>
      <div class="info-value">
        {#if report.responsiblePerson}
          <span class="user-badge">
            <span class="user-avatar">{report.responsiblePerson.name.charAt(0)}</span>
            {report.responsiblePerson.name}
          </span>
        {:else}
          -
        {/if}
      </div>
    </div>
    <div class="info-card">
      <div class="info-label">审核次数</div>
      <div class="info-value">{report.reviewCount} 次</div>
    </div>
    <div class="info-card">
      <div class="info-label">复核次数</div>
      <div class="info-value">{report.verificationCount} 次</div>
    </div>
  </div>

  {#if report.timeoutStatus !== TimeoutStatus.NORMAL}
    <div class="timeout-alert">
      <div class="alert-icon">⚠️</div>
      <div class="alert-content">
        <div class="alert-title">
          {report.timeoutStatus === TimeoutStatus.OVERDUE ? '该报告已超时' : '该报告即将超时'}
        </div>
        {#if report.timeoutReason}
          <div class="alert-row"><strong>超时原因：</strong>{report.timeoutReason}</div>
        {/if}
        {#if report.timeoutFollowUp}
          <div class="alert-row"><strong>后续处理：</strong>{report.timeoutFollowUp}</div>
        {/if}
        {#if report.timeoutHandledAt}
          <div class="alert-row"><strong>处理时间：</strong>{formatDateTime(report.timeoutHandledAt)}</div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="tabs">
    <button
      class:tab-active={activeTab === 'info'}
      class="tab-btn"
      on:click={() => activeTab = 'info'}
    >
      基本信息
    </button>
    <button
      class:tab-active={activeTab === 'related'}
      class="tab-btn"
      on:click={() => activeTab = 'related'}
    >
      关联模块
      {#if weeklyReports.length + deviationAnalyses.length + ownerReports.length > 0}
        <span class="tab-badge">{weeklyReports.length + deviationAnalyses.length + ownerReports.length}</span>
      {/if}
    </button>
    <button
      class:tab-active={activeTab === 'logs'}
      class="tab-btn"
      on:click={() => activeTab = 'logs'}
    >
      操作记录
      {#if operationLogs.length > 0}
        <span class="tab-badge">{operationLogs.length}</span>
      {/if}
    </button>
  </div>

  <div class="tab-content">
    {#if activeTab === 'info'}
      <div class="content-card">
        <h3 class="section-title">报告内容</h3>
        <div class="content-text">
          {report.content || '暂无内容'}
        </div>

        {#if report.abnormalReason}
          <h3 class="section-title">异常原因</h3>
          <div class="content-text abnormal">
            {report.abnormalReason}
          </div>
        {/if}

        {#if report.lastProcessResult}
          <h3 class="section-title">最近处理结果</h3>
          <div class="content-text result">
            {report.lastProcessResult}
          </div>
        {/if}

        <div class="meta-info">
          <div><span>创建时间：</span>{formatDateTime(report.createdAt)}</div>
          <div><span>更新时间：</span>{formatDateTime(report.updatedAt)}</div>
          {#if report.currentNodeEnteredAt}
            <div><span>进入当前节点时间：</span>{formatDateTime(report.currentNodeEnteredAt)}</div>
          {/if}
        </div>
      </div>
    {/if}

    {#if activeTab === 'related'}
      <div class="content-card">
        <div class="related-section">
          <h3 class="section-title">
            进度周报
            {#if weeklyReports.length > 0}
              <span class="count-badge">{weeklyReports.length}</span>
            {/if}
          </h3>
          {#if weeklyReports.length === 0}
            <div class="empty-text">暂无周报数据</div>
          {:else}
            <div class="related-list">
              {#each weeklyReports as wr}
                <div class="related-item">
                  <div class="related-item-header">
                    <span class="related-item-title">
                      {formatDate(wr.weekStartDate)} ~ {formatDate(wr.weekEndDate)}
                    </span>
                    <span class="completion-rate">完成率 {wr.completionRate}%</span>
                  </div>
                  {#if wr.weekProgress}
                    <div class="related-item-row"><strong>本周进度：</strong>{wr.weekProgress}</div>
                  {/if}
                  {#if wr.nextWeekPlan}
                    <div class="related-item-row"><strong>下周计划：</strong>{wr.nextWeekPlan}</div>
                  {/if}
                  {#if wr.existingProblems}
                    <div class="related-item-row"><strong>存在问题：</strong>{wr.existingProblems}</div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="related-section">
          <h3 class="section-title">
            偏差分析
            {#if deviationAnalyses.length > 0}
              <span class="count-badge">{deviationAnalyses.length}</span>
            {/if}
          </h3>
          {#if deviationAnalyses.length === 0}
            <div class="empty-text">暂无偏差分析数据</div>
          {:else}
            <div class="related-list">
              {#each deviationAnalyses as da}
                <div class="related-item">
                  <div class="related-item-header">
                    <span class="related-item-title">偏差率 {da.deviationPercentage}%</span>
                    <span class="status-badge" class:approved={da.isApproved}>
                      {da.isApproved ? '已批准' : '待批准'}
                    </span>
                  </div>
                  <div class="related-item-row"><strong>偏差描述：</strong>{da.deviationDescription}</div>
                  <div class="related-item-row"><strong>原因分析：</strong>{da.causeAnalysis}</div>
                  <div class="related-item-row"><strong>影响评估：</strong>{da.impactAssessment}</div>
                  <div class="related-item-row"><strong>纠正措施：</strong>{da.correctionMeasures}</div>
                  {#if da.approvalOpinion}
                    <div class="related-item-row"><strong>审批意见：</strong>{da.approvalOpinion}</div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="related-section">
          <h3 class="section-title">
            业主汇报
            {#if ownerReports.length > 0}
              <span class="count-badge">{ownerReports.length}</span>
            {/if}
          </h3>
          {#if ownerReports.length === 0}
            <div class="empty-text">暂无业主汇报数据</div>
          {:else}
            <div class="related-list">
              {#each ownerReports as or}
                <div class="related-item">
                  <div class="related-item-header">
                    <span class="related-item-title">{or.reportTitle}</span>
                    <span class="status-badge" class:acknowledged={or.ownerAcknowledged}>
                      {or.ownerAcknowledged ? '已确认' : '待确认'}
                    </span>
                  </div>
                  <div class="related-item-row"><strong>汇报日期：</strong>{formatDate(or.reportDate)}</div>
                  <div class="related-item-row"><strong>汇报内容：</strong>{or.reportContent}</div>
                  {#if or.ownerFeedback}
                    <div class="related-item-row"><strong>业主反馈：</strong>{or.ownerFeedback}</div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if activeTab === 'logs'}
      <div class="content-card">
        {#if operationLogs.length === 0}
          <div class="empty-text">暂无操作记录</div>
        {:else}
          <div class="timeline">
            {#each operationLogs as log}
              <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="operation-type">{OperationTypeLabel[log.operationType]}</span>
                    <span class="operation-time">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <div class="timeline-operator">
                    操作人：{log.operator?.name || '-'}
                  </div>
                  {#if log.fromStatus || log.toStatus}
                    <div class="timeline-status">
                      {#if log.fromStatus}
                        <StatusTag status={log.fromStatus} type="progress" size="small" />
                      {/if}
                      {#if log.toStatus}
                        <span class="arrow">→</span>
                        <StatusTag status={log.toStatus} type="progress" size="small" />
                      {/if}
                    </div>
                  {/if}
                  {#if log.operationDetail}
                    <div class="timeline-detail">{log.operationDetail}</div>
                  {/if}
                  {#if log.remarks}
                    <div class="timeline-remarks">备注：{log.remarks}</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- 提交审核弹窗 -->
<Modal
  show={showSubmitModal}
  title="提交审核"
  onClose={() => { showSubmitModal = false; submitRemarks = ''; }}
  footer={true}
>
  <p>确定要将这份进度报告提交审核吗？</p>
  <div class="form-group">
    <label>备注（可选）</label>
    <textarea rows="3" placeholder="请输入备注信息" bind:value={submitRemarks}></textarea>
  </div>
  <div slot="footer">
    <button class="btn btn-outline" on:click={() => { showSubmitModal = false; submitRemarks = ''; }}>取消</button>
    <button class="btn btn-primary" on:click={handleSubmit}>确认提交</button>
  </div>
</Modal>

<!-- 审核弹窗 -->
<Modal
  show={showReviewModal}
  title="审核进度报告"
  onClose={() => { showReviewModal = false; reviewOpinion = ''; }}
  footer={true}
>
  <div class="form-group">
    <label>审核结果</label>
    <div class="radio-group">
      <label class="radio-item">
        <input type="radio" bind:group={reviewApproved} value={true} />
        <span>通过</span>
      </label>
      <label class="radio-item">
        <input type="radio" bind:group={reviewApproved} value={false} />
        <span>驳回</span>
      </label>
    </div>
  </div>
  <div class="form-group">
    <label>审核意见 <span class="required">*</span></label>
    <textarea rows="4" placeholder="请输入审核意见" bind:value={reviewOpinion}></textarea>
  </div>
  <div slot="footer">
    <button class="btn btn-outline" on:click={() => { showReviewModal = false; reviewOpinion = ''; }}>取消</button>
    <button class="btn btn-primary" on:click={handleReview}>
      确认{reviewApproved ? '通过' : '驳回'}
    </button>
  </div>
</Modal>

<!-- 复核弹窗 -->
<Modal
  show={showVerifyModal}
  title="复核进度报告"
  onClose={() => { showVerifyModal = false; verifyOpinion = ''; }}
  footer={true}
>
  <div class="form-group">
    <label>复核结果</label>
    <div class="radio-group">
      <label class="radio-item">
        <input type="radio" bind:group={verifyApproved} value={true} />
        <span>通过并归档</span>
      </label>
      <label class="radio-item">
        <input type="radio" bind:group={verifyApproved} value={false} />
        <span>驳回</span>
      </label>
    </div>
  </div>
  <div class="form-group">
    <label>复核意见 <span class="required">*</span></label>
    <textarea rows="4" placeholder="请输入复核意见" bind:value={verifyOpinion}></textarea>
  </div>
  <div slot="footer">
    <button class="btn btn-outline" on:click={() => { showVerifyModal = false; verifyOpinion = ''; }}>取消</button>
    <button class="btn btn-primary" on:click={handleVerify}>
      确认{verifyApproved ? '归档' : '驳回'}
    </button>
  </div>
</Modal>

<!-- 补正弹窗 -->
<Modal
  show={showCorrectModal}
  title="补正进度报告"
  onClose={() => { showCorrectModal = false; }}
  footer={true}
  size="large"
>
  <div class="form-row">
    <div class="form-group">
      <label>报告标题</label>
      <input type="text" bind:value={correctData.title} />
    </div>
  </div>
  <div class="form-group">
    <label>报告内容</label>
    <textarea rows="4" bind:value={correctData.content}></textarea>
  </div>
  <div class="form-group">
    <label>异常原因</label>
    <textarea rows="3" bind:value={correctData.abnormalReason}></textarea>
  </div>
  <div class="form-group">
    <label>补正说明 <span class="required">*</span></label>
    <textarea rows="3" placeholder="请说明补正的原因和内容" bind:value={correctData.correctionRemark}></textarea>
  </div>
  <div slot="footer">
    <button class="btn btn-outline" on:click={() => { showCorrectModal = false; }}>取消</button>
    <button class="btn btn-primary" on:click={handleCorrect}>确认补正</button>
  </div>
</Modal>

<!-- 超时处理弹窗 -->
<Modal
  show={showTimeoutModal}
  title="处理超时"
  onClose={() => { showTimeoutModal = false; }}
  footer={true}
  size="large"
>
  <div class="form-group">
    <label>超时原因 <span class="required">*</span></label>
    <textarea rows="3" placeholder="请详细说明超时的原因" bind:value={timeoutData.timeoutReason}></textarea>
  </div>
  <div class="form-group">
    <label>后续处理方案 <span class="required">*</span></label>
    <textarea rows="4" placeholder="请说明后续的处理计划和措施" bind:value={timeoutData.timeoutFollowUp}></textarea>
  </div>
  <div class="form-group">
    <label>备注（可选）</label>
    <textarea rows="2" placeholder="其他需要说明的内容" bind:value={timeoutData.remarks}></textarea>
  </div>
  <div slot="footer">
    <button class="btn btn-outline" on:click={() => { showTimeoutModal = false; }}>取消</button>
    <button class="btn btn-primary" on:click={handleTimeout}>确认处理</button>
  </div>
</Modal>

<!-- 删除确认弹窗 -->
<Modal
  show={showDeleteModal}
  title="确认删除"
  onClose={() => { showDeleteModal = false; }}
  footer={true}
>
  <p>确定要删除这份进度报告吗？此操作不可恢复，相关的操作记录也将被删除。</p>
  <div slot="footer">
    <button class="btn btn-outline" on:click={() => { showDeleteModal = false; }}>取消</button>
    <button class="btn btn-danger" on:click={handleDelete}>确认删除</button>
  </div>
</Modal>

<style>
  .detail-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    flex-wrap: wrap;
  }

  .breadcrumb {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 8px;
  }

  .breadcrumb .link {
    color: #3b82f6;
    text-decoration: none;
  }

  .breadcrumb .link:hover {
    text-decoration: underline;
  }

  .breadcrumb .separator {
    margin: 0 8px;
  }

  .breadcrumb .current {
    color: #374151;
  }

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 12px 0;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .timeout-badge {
    padding: 4px 12px;
    background: #fef2f2;
    color: #dc2626;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .info-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }

  .info-card {
    background: white;
    padding: 16px 20px;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .info-label {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 4px;
  }

  .info-value {
    font-size: 15px;
    font-weight: 500;
    color: #1f2937;
  }

  .info-value.danger {
    color: #ef4444;
  }

  .user-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .user-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #3b82f6;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 500;
  }

  .timeout-alert {
    display: flex;
    gap: 16px;
    padding: 20px;
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-radius: 10px;
  }

  .alert-icon {
    font-size: 28px;
  }

  .alert-content {
    flex: 1;
  }

  .alert-title {
    font-weight: 600;
    color: #92400e;
    margin-bottom: 8px;
  }

  .alert-row {
    font-size: 14px;
    color: #78350f;
    margin-top: 4px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    background: white;
    padding: 6px;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .tab-btn {
    flex: 1;
    padding: 10px 20px;
    border: none;
    background: transparent;
    border-radius: 6px;
    font-size: 14px;
    color: #6b7280;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    background: #f3f4f6;
  }

  .tab-active {
    background: #3b82f6;
    color: white;
  }

  .tab-active:hover {
    background: #2563eb;
  }

  .tab-badge {
    padding: 2px 8px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    font-size: 12px;
  }

  .tab-active .tab-badge {
    background: rgba(255, 255, 255, 0.2);
  }

  .tab-content {
    min-height: 400px;
  }

  .content-card {
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .count-badge {
    padding: 2px 8px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
  }

  .content-text {
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
    line-height: 1.8;
    color: #374151;
    margin-bottom: 20px;
  }

  .content-text.abnormal {
    background: #fef2f2;
    border-left: 3px solid #ef4444;
  }

  .content-text.result {
    background: #f0fdf4;
    border-left: 3px solid #10b981;
  }

  .meta-info {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    flex-wrap: wrap;
    gap: 16px 32px;
    font-size: 13px;
    color: #6b7280;
  }

  .meta-info span {
    color: #9ca3af;
  }

  .empty-text {
    text-align: center;
    padding: 40px;
    color: #9ca3af;
    font-size: 14px;
  }

  .related-section {
    margin-bottom: 32px;
  }

  .related-section:last-child {
    margin-bottom: 0;
  }

  .related-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .related-item {
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .related-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .related-item-title {
    font-weight: 500;
    color: #1f2937;
  }

  .completion-rate {
    padding: 4px 10px;
    background: #dcfce7;
    color: #15803d;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-badge {
    padding: 4px 10px;
    background: #fef3c7;
    color: #92400e;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-badge.approved,
  .status-badge.acknowledged {
    background: #dcfce7;
    color: #15803d;
  }

  .related-item-row {
    font-size: 13px;
    color: #374151;
    margin-top: 6px;
    line-height: 1.6;
  }

  .timeline {
    position: relative;
    padding-left: 24px;
  }

  .timeline::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: #e5e7eb;
  }

  .timeline-item {
    position: relative;
    margin-bottom: 24px;
  }

  .timeline-item:last-child {
    margin-bottom: 0;
  }

  .timeline-dot {
    position: absolute;
    left: -22px;
    top: 4px;
    width: 12px;
    height: 12px;
    background: #3b82f6;
    border: 3px solid #eff6ff;
    border-radius: 50%;
  }

  .timeline-content {
    padding: 12px 16px;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .operation-type {
    font-weight: 600;
    color: #1f2937;
  }

  .operation-time {
    font-size: 12px;
    color: #9ca3af;
  }

  .timeline-operator {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 8px;
  }

  .timeline-status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .arrow {
    color: #9ca3af;
  }

  .timeline-detail {
    font-size: 13px;
    color: #374151;
    padding: 8px 12px;
    background: white;
    border-radius: 6px;
    margin-top: 8px;
  }

  .timeline-remarks {
    font-size: 13px;
    color: #6b7280;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed #e5e7eb;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 8px;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    box-sizing: border-box;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .required {
    color: #ef4444;
  }

  .radio-group {
    display: flex;
    gap: 24px;
  }

  .radio-item {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .radio-item input {
    width: auto;
    margin: 0;
  }
</style>
