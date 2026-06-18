<script lang="ts">
  import { page, goto } from '$app/navigation';
  import type { PageData } from './$types';
  import { OperationType, OperationTypeLabel, ProgressStatusLabel } from '$types';
  import { formatDateTime } from '$utils/format';
  import StatusTag from '$components/StatusTag.svelte';
  import Pagination from '$components/Pagination.svelte';

  export let data: PageData;

  $: logs = data.logs;
  $: users = data.users;
  $: queryParams = data.queryParams;

  let filters = {
    operationType: queryParams?.operationType || '',
    operatorId: queryParams?.operatorId || '',
    startDate: queryParams?.startDate || '',
    endDate: queryParams?.endDate || '',
  };

  let currentPage = queryParams?.page || 1;
  let pageSize = queryParams?.pageSize || 20;

  function handleFilterChange() {
    const params = new URLSearchParams();
    if (filters.operationType) params.set('operationType', filters.operationType);
    if (filters.operatorId) params.set('operatorId', filters.operatorId);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    params.set('page', '1');
    params.set('pageSize', pageSize.toString());
    goto(`/operation-logs?${params.toString()}`);
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams($page.url.searchParams);
    params.set('page', newPage.toString());
    goto(`/operation-logs?${params.toString()}`);
  }

  function handlePageSizeChange(newSize: number) {
    const params = new URLSearchParams($page.url.searchParams);
    params.set('page', '1');
    params.set('pageSize', newSize.toString());
    goto(`/operation-logs?${params.toString()}`);
  }

  function resetFilters() {
    filters = {
      operationType: '',
      operatorId: '',
      startDate: '',
      endDate: '',
    };
    goto('/operation-logs');
  }
</script>

<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title">操作记录</h1>
      <p class="page-subtitle">共 {logs.total} 条记录</p>
    </div>
  </div>

  <div class="filter-card">
    <div class="filter-row">
      <div class="filter-item">
        <label>操作类型</label>
        <select bind:value={filters.operationType} on:change={handleFilterChange}>
          <option value="">全部</option>
          {#each Object.entries(OperationType) as [key, type]}
            <option value={type}>{OperationTypeLabel[type]}</option>
          {/each}
        </select>
      </div>
      <div class="filter-item">
        <label>操作人</label>
        <select bind:value={filters.operatorId} on:change={handleFilterChange}>
          <option value="">全部</option>
          {#each users as u}
            <option value={u.id}>{u.name}</option>
          {/each}
        </select>
      </div>
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
            <th>操作时间</th>
            <th>操作类型</th>
            <th>操作人</th>
            <th>关联报告</th>
            <th>状态变更</th>
            <th>操作详情</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {#if logs.list.length === 0}
            <tr>
              <td colspan="7" class="empty-cell">暂无数据</td>
            </tr>
          {/if}
          {#each logs.list as log (log.id)}
            <tr>
              <td class="time-cell">
                <div class="time-main">{formatDateTime(log.createdAt).split(' ')[0]}</div>
                <div class="time-sub">{formatDateTime(log.createdAt).split(' ')[1]}</div>
              </td>
              <td>
                <span class="op-type-badge">{OperationTypeLabel[log.operationType]}</span>
              </td>
              <td>
                <div class="user-cell">
                  <span class="user-avatar">{log.operator?.name?.charAt(0) || '-'}</span>
                  <span>{log.operator?.name || '-'}</span>
                </div>
              </td>
              <td>
                <a href="/progress-reports/{log.progressReportId}" class="link">
                  查看报告
                </a>
              </td>
              <td>
                {#if log.fromStatus || log.toStatus}
                  <div class="status-change">
                    {#if log.fromStatus}
                      <StatusTag status={log.fromStatus} type="progress" size="small" />
                    {/if}
                    {#if log.toStatus}
                      <span class="arrow">→</span>
                      <StatusTag status={log.toStatus} type="progress" size="small" />
                    {/if}
                  </div>
                {:else}
                  -
                {/if}
              </td>
              <td>
                <div class="detail-cell" title={log.operationDetail}>
                  {log.operationDetail || '-'}
                </div>
              </td>
              <td>
                <div class="detail-cell" title={log.remarks}>
                  {log.remarks || '-'}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <Pagination
      total={logs.total}
      page={currentPage}
      pageSize={pageSize}
      on:pageChange={(e) => handlePageChange(e.detail)}
      on:pageSizeChange={(e) => handlePageSizeChange(e.detail)}
    />
  </div>
</div>

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

  .filter-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .filter-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    align-items: end;
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

  .empty-cell {
    text-align: center;
    padding: 40px !important;
    color: #9ca3af !important;
  }

  .time-cell {
    white-space: nowrap;
  }

  .time-main {
    font-weight: 500;
    color: #1f2937;
  }

  .time-sub {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 2px;
  }

  .op-type-badge {
    display: inline-block;
    padding: 4px 10px;
    background: #eff6ff;
    color: #2563eb;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
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

  .link {
    color: #3b82f6;
    text-decoration: none;
    font-size: 13px;
  }

  .link:hover {
    text-decoration: underline;
  }

  .status-change {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .arrow {
    color: #9ca3af;
    font-size: 12px;
  }

  .detail-cell {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: #6b7280;
  }
</style>
