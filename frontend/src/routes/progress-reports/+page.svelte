<script lang="ts">
  import { page, goto, invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { ProgressStatus, TimeoutStatus, ProgressStatusLabel, TimeoutStatusLabel, Role } from '$types';
  import type { BatchResult } from '$types';
  import { formatDate, formatDateTime } from '$utils/format';
  import { canCreateReport, canEditReport, canSubmitReview, canReview, canVerify, canCorrect, canHandleTimeout, canDeleteReport, canBatchProcess } from '$utils/permissions';
  import { currentUser, showToast } from '$stores';
  import { progressReportsApi } from '$api';
  import StatusTag from '$components/StatusTag.svelte';
  import Pagination from '$components/Pagination.svelte';
  import Modal from '$components/Modal.svelte';

  export let data: PageData;

  $: reports = data.reports || { list: [], total: 0 };
  $: users = data.users;
  $: statistics = data.statistics;
  $: queryParams = data.queryParams;
  $: user = $currentUser;
  $: batchableReports = reports?.list?.filter((r) => canBatchProcess(user, r)) || [];
  $: hasBatchAccess = batchableReports.length > 0;

  let filters = {
    status: queryParams?.status || '',
    timeoutStatus: queryParams?.timeoutStatus || '',
    keyword: queryParams?.keyword || '',
    responsiblePersonId: queryParams?.responsiblePersonId || '',
    startDate: queryParams?.startDate || '',
    endDate: queryParams?.endDate || '',
  };

  let showDeleteModal = false;
  let deletingReportId: string | null = null;
  let currentPage = queryParams?.page || 1;
  let pageSize = queryParams?.pageSize || 10;

  let selectedIds: Set<string> = new Set();
  let showBatchModal = false;
  let batchAction = 'submit';
  let batchRemarks = '';
  let batchTimeoutReason = '';
  let batchTimeoutFollowUp = '';
  let batchResult: BatchResult | null = null;
  let showBatchResultModal = false;

  function handleFilterChange() {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.timeoutStatus) params.set('timeoutStatus', filters.timeoutStatus);
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.responsiblePersonId) params.set('responsiblePersonId', filters.responsiblePersonId);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    params.set('page', '1');
    params.set('pageSize', pageSize.toString());
    goto(`/progress-reports?${params.toString()}`);
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams($page.url.searchParams);
    params.set('page', newPage.toString());
    goto(`/progress-reports?${params.toString()}`);
  }

  function handlePageSizeChange(newSize: number) {
    const params = new URLSearchParams($page.url.searchParams);
    params.set('page', '1');
    params.set('pageSize', newSize.toString());
    goto(`/progress-reports?${params.toString()}`);
  }

  function resetFilters() {
    filters = {
      status: '',
      timeoutStatus: '',
      keyword: '',
      responsiblePersonId: '',
      startDate: '',
      endDate: '',
    };
    goto('/progress-reports');
  }

  async function confirmDelete(id: string) {
    deletingReportId = id;
    showDeleteModal = true;
  }

  async function handleDelete() {
    if (!deletingReportId) return;
    try {
      await progressReportsApi.delete(deletingReportId);
      showToast('删除成功', 'success');
      showDeleteModal = false;
      deletingReportId = null;
      goto('/progress-reports');
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '删除失败', 'error');
    }
  }

  async function handleQuickSubmit(id: string) {
    try {
      await progressReportsApi.submitForReview(id);
      showToast('提交审核成功', 'success');
      goto('/progress-reports');
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '提交失败', 'error');
    }
  }

  async function handleQuickStartReview(id: string) {
    try {
      await progressReportsApi.startReview(id);
      showToast('开始审核成功', 'success');
      goto('/progress-reports');
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '操作失败', 'error');
    }
  }

  async function handleQuickStartVerification(id: string) {
    try {
      await progressReportsApi.startVerification(id);
      showToast('开始复核成功', 'success');
      goto('/progress-reports');
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '操作失败', 'error');
    }
  }

  function toggleSelect(id: string) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = selectedIds;
  }

  function toggleSelectAll() {
    const batchableIds = batchableReports.map((r) => r.id);
    const allBatchableSelected = batchableIds.every((id) => selectedIds.has(id));
    if (allBatchableSelected || batchableIds.length === 0) {
      for (const id of batchableIds) selectedIds.delete(id);
    } else {
      for (const id of batchableIds) selectedIds.add(id);
    }
    selectedIds = selectedIds;
  }

  $: allBatchableSelected =
    batchableReports.length > 0 &&
    batchableReports.every((r) => selectedIds.has(r.id));

  function openBatchModal() {
    if (selectedIds.size === 0) {
      showToast('请先选择要批量办理的报告', 'error');
      return;
    }
    batchRemarks = '';
    batchTimeoutReason = '';
    batchTimeoutFollowUp = '';
    showBatchModal = true;
  }

  async function handleBatchProcess() {
    const ids = Array.from(selectedIds);
    const data: Record<string, any> = {};
    if (batchRemarks) data.remarks = batchRemarks;
    if (batchAction === 'handle-timeout') {
      if (!batchTimeoutReason || !batchTimeoutFollowUp) {
        showToast('请填写超时原因和后续处理方案', 'error');
        return;
      }
      data.timeoutReason = batchTimeoutReason;
      data.timeoutFollowUp = batchTimeoutFollowUp;
    }

    try {
      const res = await progressReportsApi.batchProcess(ids, batchAction, data);
      batchResult = res.data;
      showBatchModal = false;
      showBatchResultModal = true;
      selectedIds = new Set();
      await invalidateAll();
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '批量办理失败', 'error');
    }
  }
</script>

<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title">进度报告列表</h1>
      <p class="page-subtitle">共 {reports.total} 条记录</p>
    </div>
    {#if canCreateReport(user)}
      <button class="btn btn-primary" on:click={() => goto('/progress-reports/new')}>
        + 新建进度报告
      </button>
    {/if}
  </div>

  {#if statistics}
    <div class="stats-row">
      <div class="stat-badge">
        <span class="stat-badge-label">总数</span>
        <span class="stat-badge-value">{statistics.totalCount}</span>
      </div>
      <div class="stat-badge">
        <span class="stat-badge-label">超时</span>
        <span class="stat-badge-value danger">{statistics.overdueCount}</span>
      </div>
      <div class="stat-badge">
        <span class="stat-badge-label">待审核</span>
        <span class="stat-badge-value warning">{statistics.statusCounts?.[ProgressStatus.PENDING_REVIEW] || 0}</span>
      </div>
      <div class="stat-badge">
        <span class="stat-badge-label">待复核</span>
        <span class="stat-badge-value info">{statistics.statusCounts?.[ProgressStatus.PENDING_VERIFICATION] || 0}</span>
      </div>
      <div class="stat-badge">
        <span class="stat-badge-label">已归档</span>
        <span class="stat-badge-value success">{statistics.statusCounts?.[ProgressStatus.ARCHIVED] || 0}</span>
      </div>
    </div>
  {/if}

  <div class="filter-card">
    <div class="filter-row">
      <div class="filter-item">
        <label>关键词</label>
        <input
          type="text"
          placeholder="搜索标题、项目名..."
          bind:value={filters.keyword}
          on:change={handleFilterChange}
        />
      </div>
      <div class="filter-item">
        <label>状态</label>
        <select bind:value={filters.status} on:change={handleFilterChange}>
          <option value="">全部</option>
          {#each Object.entries(ProgressStatus) as [key, status]}
            <option value={status}>{ProgressStatusLabel[status]}</option>
          {/each}
        </select>
      </div>
      <div class="filter-item">
        <label>超时状态</label>
        <select bind:value={filters.timeoutStatus} on:change={handleFilterChange}>
          <option value="">全部</option>
          {#each Object.entries(TimeoutStatus) as [key, status]}
            <option value={status}>{TimeoutStatusLabel[status]}</option>
          {/each}
        </select>
      </div>
      <div class="filter-item">
        <label>责任人</label>
        <select bind:value={filters.responsiblePersonId} on:change={handleFilterChange}>
          <option value="">全部</option>
          {#each users as u}
            <option value={u.id}>{u.name}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="filter-row">
      <div class="filter-item">
        <label>开始日期</label>
        <input
          type="date"
          bind:value={filters.startDate}
          on:change={handleFilterChange}
        />
      </div>
      <div class="filter-item">
        <label>结束日期</label>
        <input
          type="date"
          bind:value={filters.endDate}
          on:change={handleFilterChange}
        />
      </div>
      <div class="filter-item filter-actions">
        <button class="btn btn-outline" on:click={resetFilters}>重置</button>
      </div>
    </div>
  </div>

  {#if hasBatchAccess && selectedIds.size > 0}
    <div class="batch-bar">
      <span class="batch-info">已选择 {selectedIds.size} 项 / 可批量办理 {batchableReports.length} 项</span>
      <button class="btn btn-primary btn-sm" on:click={openBatchModal}>批量办理</button>
      <button class="btn btn-outline btn-sm" on:click={() => { selectedIds = new Set(); }}>取消选择</button>
    </div>
  {/if}

  <div class="table-card">
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            {#if hasBatchAccess}
              <th class="checkbox-col">
                <input
                  type="checkbox"
                  checked={allBatchableSelected}
                  on:change={toggleSelectAll}
                />
              </th>
            {/if}
            <th>标题</th>
            <th>项目名称</th>
            <th>责任人</th>
            <th>状态</th>
            <th>超时状态</th>
            <th>截止时间</th>
            <th>异常原因</th>
            <th>最近处理结果</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {#if reports.list.length === 0}
            <tr>
              <td colspan={hasBatchAccess ? "10" : "9"} class="empty-cell">暂无数据</td>
            </tr>
          {/if}
          {#each reports.list as report (report.id)}
            <tr class:timeout-row={report.timeoutStatus === TimeoutStatus.OVERDUE}>
              {#if hasBatchAccess}
                <td class="checkbox-col">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(report.id)}
                    disabled={!canBatchProcess(user, report)}
                    on:change={() => toggleSelect(report.id)}
                  />
                </td>
              {/if}
              <td>
                <div class="cell-title">
                  <a href="/progress-reports/{report.id}" class="link">
                    {report.title}
                  </a>
                </div>
                <div class="cell-subtitle">{formatDate(report.createdAt)}</div>
              </td>
              <td>{report.projectName || '-'}</td>
              <td>
                <div class="user-cell">
                  <span class="user-avatar">{report.responsiblePerson?.name?.charAt(0) || '-'}</span>
                  <span>{report.responsiblePerson?.name || '-'}</span>
                </div>
              </td>
              <td>
                <StatusTag status={report.status} type="progress" />
              </td>
              <td>
                <StatusTag status={report.timeoutStatus} type="timeout" />
                {#if report.timeoutStatus !== TimeoutStatus.NORMAL && report.timeoutDays > 0}
                  <span class="timeout-days">{report.timeoutDays}天</span>
                {/if}
              </td>
              <td>
                <div class={report.timeoutStatus === TimeoutStatus.OVERDUE ? 'text-danger' : ''}>
                  {formatDate(report.deadline)}
                </div>
              </td>
              <td>
                <div class="abnormal-cell" title={report.abnormalReason}>
                  {report.abnormalReason || '-'}
                </div>
              </td>
              <td>
                <div class="result-cell">
                  {#if report.lastProcessResult}
                    <div class="result-row" title={report.lastProcessResult}>
                      {report.lastProcessResult}
                    </div>
                  {/if}
                  {#if report.batchResult}
                    <div class="result-row result-batch" title={report.batchResult}>
                      <span class="batch-tag">批量</span>{report.batchResult}
                    </div>
                  {/if}
                  {#if !report.lastProcessResult && !report.batchResult}-{/if}
                </div>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn btn-text" on:click={() => goto(`/progress-reports/${report.id}`)}>
                    详情
                  </button>
                  {#if canEditReport(user, report)}
                    <button class="btn btn-text" on:click={() => goto(`/progress-reports/${report.id}/edit`)}>
                      编辑
                    </button>
                  {/if}
                  {#if canSubmitReview(user, report)}
                    <button class="btn btn-text btn-primary-text" on:click={() => handleQuickSubmit(report.id)}>
                      提交
                    </button>
                  {/if}
                  {#if report.status === ProgressStatus.PENDING_REVIEW && canReview(user, report)}
                    <button class="btn btn-text btn-primary-text" on:click={() => handleQuickStartReview(report.id)}>
                      审核
                    </button>
                  {/if}
                  {#if report.status === ProgressStatus.PENDING_VERIFICATION && canVerify(user, report)}
                    <button class="btn btn-text btn-primary-text" on:click={() => handleQuickStartVerification(report.id)}>
                      复核
                    </button>
                  {/if}
                  {#if canHandleTimeout(user, report) && report.timeoutStatus === TimeoutStatus.OVERDUE}
                    <button class="btn btn-text btn-warning-text" on:click={() => goto(`/progress-reports/${report.id}?action=timeout`)}>
                      处理超时
                    </button>
                  {/if}
                  {#if canDeleteReport(user, report)}
                    <button class="btn btn-text btn-danger-text" on:click={() => confirmDelete(report.id)}>
                      删除
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <Pagination
      total={reports.total}
      page={currentPage}
      pageSize={pageSize}
      on:pageChange={(e) => handlePageChange(e.detail)}
      on:pageSizeChange={(e) => handlePageSizeChange(e.detail)}
    />
  </div>
</div>

<Modal
  show={showDeleteModal}
  title="确认删除"
  onClose={() => { showDeleteModal = false; deletingReportId = null; }}
  footer={true}
>
  <p>确定要删除这份进度报告吗？此操作不可恢复。</p>
  <div slot="footer">
    <button class="btn btn-outline" on:click={() => { showDeleteModal = false; deletingReportId = null; }}>
      取消
    </button>
    <button class="btn btn-danger" on:click={handleDelete}>
      确认删除
    </button>
  </div>
</Modal>

<!-- 批量办理弹窗 -->
<Modal
  show={showBatchModal}
  title="批量办理进度报告"
  onClose={() => { showBatchModal = false; }}
  footer={true}
  size="large"
>
  <p>将对 {selectedIds.size} 份进度报告执行批量操作</p>
  <div class="form-group">
    <label>操作类型</label>
    <div class="radio-group">
      <label class="radio-item">
        <input type="radio" bind:group={batchAction} value="submit" />
        <span>批量提交审核</span>
      </label>
      <label class="radio-item">
        <input type="radio" bind:group={batchAction} value="handle-timeout" />
        <span>批量处理超时</span>
      </label>
    </div>
  </div>
  {#if batchAction === 'handle-timeout'}
    <div class="form-group">
      <label>超时原因 <span class="required">*</span></label>
      <textarea rows="2" placeholder="请说明超时原因" bind:value={batchTimeoutReason}></textarea>
    </div>
    <div class="form-group">
      <label>后续处理方案 <span class="required">*</span></label>
      <textarea rows="3" placeholder="请说明后续处理措施" bind:value={batchTimeoutFollowUp}></textarea>
    </div>
  {/if}
  <div class="form-group">
    <label>备注（可选）</label>
    <textarea rows="2" placeholder="备注信息" bind:value={batchRemarks}></textarea>
  </div>
  <div slot="footer">
    <button class="btn btn-outline" on:click={() => { showBatchModal = false; }}>取消</button>
    <button class="btn btn-primary" on:click={handleBatchProcess}>确认批量办理</button>
  </div>
</Modal>

<!-- 批量办理结果弹窗 -->
<Modal
  show={showBatchResultModal}
  title="批量办理结果"
  onClose={() => { showBatchResultModal = false; batchResult = null; }}
  footer={true}
>
  {#if batchResult}
    <div class="batch-result-summary">
      <div class="batch-result-stat success">
        成功：{batchResult.results.filter(r => r.success).length} 项
      </div>
      <div class="batch-result-stat error">
        失败：{batchResult.results.filter(r => !r.success).length} 项
      </div>
    </div>
    <div class="batch-result-list">
      {#each batchResult.results as item}
        <div class="batch-result-item" class:success={item.success} class:failed={!item.success}>
          <span class="batch-result-icon">{item.success ? '✓' : '✗'}</span>
          <span class="batch-result-id">{item.id.substring(0, 8)}...</span>
          <span class="batch-result-msg">{item.message}</span>
        </div>
      {/each}
    </div>
  {/if}
  <div slot="footer">
    <button class="btn btn-primary" on:click={() => { showBatchResultModal = false; batchResult = null; }}>关闭</button>
  </div>
</Modal>

<style>
  .page-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 4px 0;
  }

  .page-subtitle {
    color: #6b7280;
    font-size: 14px;
    margin: 0;
  }

  .stats-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .stat-badge {
    background: white;
    padding: 12px 20px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .stat-badge-label {
    font-size: 12px;
    color: #6b7280;
  }

  .stat-badge-value {
    font-size: 20px;
    font-weight: 700;
    color: #1f2937;
  }

  .stat-badge-value.danger { color: #ef4444; }
  .stat-badge-value.warning { color: #f59e0b; }
  .stat-badge-value.info { color: #3b82f6; }
  .stat-badge-value.success { color: #10b981; }

  .filter-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .filter-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .filter-row:last-child {
    margin-bottom: 0;
  }

  .filter-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-item label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
  }

  .filter-item input,
  .filter-item select {
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
  }

  .filter-actions {
    justify-content: flex-end;
  }

  .table-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .table-responsive {
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th {
    background: #f9fafb;
    padding: 12px 16px;
    text-align: left;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
  }

  .data-table td {
    padding: 14px 16px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 14px;
    color: #374151;
    vertical-align: top;
  }

  .data-table tr:hover {
    background: #f9fafb;
  }

  .data-table tr.timeout-row {
    background: #fef2f2;
  }

  .data-table tr.timeout-row:hover {
    background: #fee2e2;
  }

  .empty-cell {
    text-align: center;
    padding: 40px !important;
    color: #9ca3af !important;
  }

  .cell-title {
    font-weight: 500;
    color: #1f2937;
  }

  .cell-subtitle {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 2px;
  }

  .link {
    color: #3b82f6;
    text-decoration: none;
  }

  .link:hover {
    text-decoration: underline;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .user-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #3b82f6;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
  }

  .timeout-days {
    display: inline-block;
    margin-left: 4px;
    padding: 2px 6px;
    background: #fef2f2;
    color: #dc2626;
    font-size: 11px;
    border-radius: 4px;
  }

  .abnormal-cell,
  .result-cell {
    max-width: 180px;
    font-size: 13px;
    color: #6b7280;
  }

  .result-row {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.6;
  }

  .result-batch {
    color: #8b5cf6;
    font-size: 12px;
  }

  .batch-tag {
    display: inline-block;
    padding: 1px 6px;
    margin-right: 4px;
    background: #8b5cf6;
    color: #fff;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .text-danger {
    color: #ef4444;
    font-weight: 500;
  }

  .action-buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .btn-text {
    padding: 4px 8px;
    font-size: 13px;
  }

  .checkbox-col {
    width: 40px;
    text-align: center;
  }

  .checkbox-col input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .batch-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
  }

  .batch-info {
    font-size: 14px;
    font-weight: 500;
    color: #1e40af;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 13px;
  }

  .batch-result-summary {
    display: flex;
    gap: 20px;
    margin-bottom: 16px;
  }

  .batch-result-stat {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
  }

  .batch-result-stat.success {
    background: #dcfce7;
    color: #15803d;
  }

  .batch-result-stat.error {
    background: #fef2f2;
    color: #dc2626;
  }

  .batch-result-list {
    max-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .batch-result-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
  }

  .batch-result-item.success {
    background: #f0fdf4;
    color: #15803d;
  }

  .batch-result-item.failed {
    background: #fef2f2;
    color: #dc2626;
  }

  .batch-result-icon {
    font-weight: bold;
  }

  .batch-result-id {
    font-family: monospace;
    color: #6b7280;
  }

  .batch-result-msg {
    flex: 1;
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

  .required {
    color: #ef4444;
  }
</style>
