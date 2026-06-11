<script>
  import { onMount } from 'svelte';
  import { fetchStats, fetchOrders, STATUS_MAP, RISK_MAP, ROLE_MAP } from '$lib/api';

  let stats = { total: 0, by_status: {}, by_risk_level: {}, high_risk_pending: 0, overdue: 0, reviewing_count: 0, rejected_count: 0 };
  let recentOrders = [];
  let loading = true;

  onMount(async () => {
    try {
      const [s, o] = await Promise.all([fetchStats(), fetchOrders()]);
      stats = s;
      recentOrders = (o || []).slice(0, 8);
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  });

  function statusLabel(s) { return STATUS_MAP[s]?.label || s; }
  function statusColor(s) { return STATUS_MAP[s]?.color || '#666'; }
  function riskLabel(r) { return RISK_MAP[r]?.label || r; }
  function riskColor(r) { return RISK_MAP[r]?.color || '#666'; }
  function roleLabel(r) { return ROLE_MAP[r]?.label || r; }
</script>

{#if loading}
  <div class="loading">加载中...</div>
{:else}
  <div class="dashboard">
    <h1 class="page-title">风险分级处置仪表盘</h1>

    <div class="stats-grid">
      <div class="stat-card stat-total">
        <div class="stat-value">{stats.total}</div>
        <div class="stat-label">入库单总数</div>
      </div>
      <div class="stat-card stat-high">
        <div class="stat-value">{stats.high_risk_pending}</div>
        <div class="stat-label">高风险待处理</div>
      </div>
      <div class="stat-card stat-reviewing">
        <div class="stat-value">{stats.reviewing_count || 0}</div>
        <div class="stat-label">待经理复核</div>
      </div>
      <div class="stat-card stat-rejected">
        <div class="stat-value">{stats.rejected_count || 0}</div>
        <div class="stat-label">经理驳回</div>
      </div>
      <div class="stat-card stat-overdue">
        <div class="stat-value">{stats.overdue}</div>
        <div class="stat-label">逾期单</div>
      </div>
      <div class="stat-card stat-archived">
        <div class="stat-value">{stats.by_status?.archived || 0}</div>
        <div class="stat-label">已归档</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <h3 class="chart-title">状态分布</h3>
        <div class="status-bars">
          {#each Object.entries(stats.by_status || {}) as [status, count]}
            <div class="bar-row">
              <span class="bar-label" style="color: {statusColor(status)}">{statusLabel(status)}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width: {stats.total ? (count / stats.total * 100) : 0}%; background: {statusColor(status)}"></div>
              </div>
              <span class="bar-count">{count}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="chart-card">
        <h3 class="chart-title">风险分级</h3>
        <div class="risk-bars">
          {#each Object.entries(stats.by_risk_level || {}) as [risk, count]}
            <div class="bar-row">
              <span class="bar-label" style="color: {riskColor(risk)}">{riskLabel(risk)}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width: {stats.total ? (count / stats.total * 100) : 0}%; background: {riskColor(risk)}"></div>
              </div>
              <span class="bar-count">{count}</span>
            </div>
          {/each}
        </div>
        <div class="risk-note">
          <p>⚠️ 高风险：队列最前、需全部证据</p>
          <p>⚡ 中风险：队列居中、需温度证据</p>
          <p>✅ 低风险：队列靠后、标准流程</p>
        </div>
      </div>
    </div>

    <div class="recent-card">
      <div class="recent-header">
        <h3 class="chart-title">最近入库单</h3>
        <a href="/orders" class="view-all">查看全部 →</a>
      </div>
      <div class="recent-table-wrap">
        <table class="recent-table">
          <thead>
            <tr>
              <th>单号</th>
              <th>产品</th>
              <th>风险</th>
              <th>状态</th>
              <th>当前处理人</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {#each recentOrders as order}
              <tr>
                <td><a href="/orders/{order.id}" class="order-link">{order.order_no}</a></td>
                <td>{order.product_name}</td>
                <td>
                  <span class="badge" style="color: {riskColor(order.risk_level)}; background: {RISK_MAP[order.risk_level]?.bg || '#f5f5f5'}">
                    {riskLabel(order.risk_level)}
                  </span>
                </td>
                <td>
                  <span class="badge" style="color: {statusColor(order.status)}; background: {STATUS_MAP[order.status]?.bg || '#f5f5f5'}">
                    {statusLabel(order.status)}
                  </span>
                </td>
                <td>{order.current_handler_name} ({roleLabel(order.current_handler_role)})</td>
                <td class="time-cell">
                  {new Date(order.updated_at).toLocaleString('zh-CN')}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
{/if}

<style>
  .loading {
    text-align: center;
    padding: 60px;
    font-size: 16px;
    color: #64748b;
  }

  .page-title {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 20px;
    color: #1e3a5f;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    border-top: 3px solid;
  }

  .stat-total { border-top-color: #3b82f6; }
  .stat-high { border-top-color: #dc2626; }
  .stat-reviewing { border-top-color: #6366f1; }
  .stat-rejected { border-top-color: #b91c1c; }
  .stat-overdue { border-top-color: #f59e0b; }
  .stat-archived { border-top-color: #10b981; }

  .stat-value {
    font-size: 32px;
    font-weight: 800;
    line-height: 1.2;
  }

  .stat-total .stat-value { color: #3b82f6; }
  .stat-high .stat-value { color: #dc2626; }
  .stat-reviewing .stat-value { color: #6366f1; }
  .stat-rejected .stat-value { color: #b91c1c; }
  .stat-overdue .stat-value { color: #f59e0b; }
  .stat-archived .stat-value { color: #10b981; }

  .stat-label {
    font-size: 13px;
    color: #64748b;
    margin-top: 4px;
  }

  .charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
  }

  .chart-card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .chart-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 16px;
    color: #334155;
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .bar-label {
    width: 70px;
    font-size: 13px;
    font-weight: 500;
    text-align: right;
  }

  .bar-track {
    flex: 1;
    height: 20px;
    background: #f1f5f9;
    border-radius: 10px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 10px;
    transition: width 0.5s ease;
    min-width: 2px;
  }

  .bar-count {
    width: 30px;
    font-size: 14px;
    font-weight: 600;
    text-align: center;
  }

  .risk-note {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    font-size: 12px;
    color: #64748b;
    line-height: 1.8;
  }

  .recent-card {
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .recent-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .view-all {
    font-size: 13px;
    color: #3b82f6;
  }

  .view-all:hover {
    text-decoration: underline;
  }

  .recent-table-wrap {
    overflow-x: auto;
  }

  .recent-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .recent-table th {
    text-align: left;
    padding: 10px 12px;
    background: #f8fafc;
    color: #64748b;
    font-weight: 600;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }

  .recent-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #f1f5f9;
  }

  .order-link {
    color: #2563eb;
    font-weight: 500;
  }

  .order-link:hover {
    text-decoration: underline;
  }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .time-cell {
    color: #94a3b8;
    font-size: 12px;
    white-space: nowrap;
  }

  @media (max-width: 1024px) {
    .stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (max-width: 640px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .charts-row {
      grid-template-columns: 1fr;
    }
  }
</style>
