<script lang="ts">
  import { page, goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { ProgressStatus, TimeoutStatus, ProgressStatusLabel, TimeoutStatusLabel, Role } from '$types';
  import { formatDate, formatDateTime } from '$utils/format';
  import { canCreateReport, canEditReport, canSubmitReview, canReview, canVerify, canCorrect, canHandleTimeout, canDeleteReport } from '$utils/permissions';
  import { currentUser, showToast } from '$stores';
  import { progressReportsApi } from '$api';
  import StatusTag from '$components/StatusTag.svelte';
  import Pagination from '$components/Pagination.svelte';
  import Modal from '$components/Modal.svelte';

  export let data: PageData;

  $: reports = data.reports;
  $: users = data.users;
  $: statistics = data.statistics;
  $: queryParams = data.queryParams;
  $: user = $currentUser;

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

  <div class="table-card">
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
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
              <td colspan="9" class="empty-cell">暂无数据</td>
            </tr>
          {/if}
          {#each reports.list as report (report.id)}
            <tr class:timeout-row={report.timeoutStatus === TimeoutStatus.OVERDUE}>
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
                <div class="result-cell" title={report.lastProcessResult}>
                  {report.lastProcessResult || '-'}
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
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: #6b7280;
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
</style>
