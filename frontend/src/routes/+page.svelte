<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';
  import { ProgressStatus, TimeoutStatus, ProgressStatusLabel, TimeoutStatusLabel, TimeoutStatusColor } from '$types';
  import { canCreateReport } from '$utils/permissions';
  import { currentUser } from '$stores';

  export let data: PageData;

  $: statistics = data.statistics;
  $: user = $currentUser;
</script>

<div class="dashboard">
  <div class="page-header">
    <div>
      <h1 class="page-title">仪表盘</h1>
      <p class="page-subtitle">欢迎回来，{$currentUser?.name}！</p>
    </div>
    {#if canCreateReport(user)}
      <button class="btn btn-primary" on:click={() => goto('/progress-reports/new')}>
        + 新建进度报告
      </button>
    {/if}
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon total">📊</div>
      <div class="stat-content">
        <div class="stat-value">{statistics?.totalCount || 0}</div>
        <div class="stat-label">报告总数</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon month">📅</div>
      <div class="stat-content">
        <div class="stat-value">{statistics?.thisMonthCount || 0}</div>
        <div class="stat-label">本月新增</div>
      </div>
    </div>

    <div class="stat-card warning">
      <div class="stat-icon overdue">⏰</div>
      <div class="stat-content">
        <div class="stat-value">{statistics?.overdueCount || 0}</div>
        <div class="stat-label">超时报告</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon pending">📋</div>
      <div class="stat-content">
        <div class="stat-value">
          {(statistics?.statusCounts?.[ProgressStatus.PENDING_REVIEW] || 0) +
           (statistics?.statusCounts?.[ProgressStatus.PENDING_VERIFICATION] || 0)}
        </div>
        <div class="stat-label">待处理</div>
      </div>
    </div>
  </div>

  <div class="dashboard-sections">
    <div class="dashboard-card">
      <h3 class="card-title">状态分布</h3>
      <div class="status-list">
        {#each Object.entries(ProgressStatus) as [key, status]}
          {#if statistics?.statusCounts?.[status]}
            <div class="status-item">
              <span class="status-dot" style="background: {ProgressStatusColor[status]}"></span>
              <span class="status-name">{ProgressStatusLabel[status]}</span>
              <span class="status-count">{statistics.statusCounts[status]}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <div class="dashboard-card">
      <h3 class="card-title">超时情况</h3>
      <div class="timeout-list">
        {#each Object.entries(TimeoutStatus) as [key, status]}
          {#if statistics?.timeoutCounts?.[status]}
            <div class="timeout-item">
              <span class="timeout-bar">
                <span
                  class="timeout-bar-fill"
                  style="width: {statistics.timeoutCounts[status]! / (statistics.totalCount || 1) * 100}%; background: {TimeoutStatusColor[status]};"
                ></span>
              </span>
              <div class="timeout-info">
                <span class="timeout-name">{TimeoutStatusLabel[status]}</span>
                <span class="timeout-count">{statistics.timeoutCounts[status]}</span>
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <div class="quick-actions">
    <h3 class="card-title">快捷操作</h3>
    <div class="action-grid">
      <button class="action-card" on:click={() => goto('/progress-reports')}>
        <span class="action-icon">📁</span>
        <span class="action-name">全部报告</span>
      </button>
      {#if canCreateReport(user)}
        <button class="action-card" on:click={() => goto('/progress-reports/new')}>
          <span class="action-icon">➕</span>
          <span class="action-name">新建报告</span>
        </button>
      {/if}
      <button class="action-card" on:click={() => goto('/progress-reports?timeoutStatus=overdue')}>
        <span class="action-icon">⚠️</span>
        <span class="action-name">超时处理</span>
      </button>
      <button class="action-card" on:click={() => goto('/operation-logs')}>
        <span class="action-icon">📝</span>
        <span class="action-name">操作记录</span>
      </button>
    </div>
  </div>
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 24px;
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

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .stat-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .stat-card.warning {
    border-left: 4px solid #ef4444;
  }

  .stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    background: #eff6ff;
  }

  .stat-icon.total { background: #eff6ff; }
  .stat-icon.month { background: #f0fdf4; }
  .stat-icon.overdue { background: #fef2f2; }
  .stat-icon.pending { background: #fef3c7; }

  .stat-content {
    flex: 1;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #1f2937;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 13px;
    color: #6b7280;
    margin-top: 4px;
  }

  .dashboard-sections {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
  }

  .dashboard-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 16px 0;
  }

  .status-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .status-item:last-child {
    border-bottom: none;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-name {
    flex: 1;
    font-size: 14px;
    color: #374151;
  }

  .status-count {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
  }

  .timeout-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .timeout-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .timeout-bar {
    height: 8px;
    background: #f3f4f6;
    border-radius: 4px;
    overflow: hidden;
  }

  .timeout-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s;
  }

  .timeout-info {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  }

  .timeout-name {
    color: #6b7280;
  }

  .timeout-count {
    font-weight: 600;
    color: #1f2937;
  }

  .quick-actions {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    margin-top: 16px;
  }

  .action-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 16px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-card:hover {
    background: #eff6ff;
    border-color: #3b82f6;
    transform: translateY(-2px);
  }

  .action-icon {
    font-size: 32px;
  }

  .action-name {
    font-size: 14px;
    color: #374151;
    font-weight: 500;
  }
</style>
