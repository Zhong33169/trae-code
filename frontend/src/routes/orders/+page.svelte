<script>
  import { onMount } from 'svelte';
  import { fetchOrders, fetchUsers, STATUS_MAP, RISK_MAP, ROLE_MAP } from '$lib/api';

  let orders = [];
  let users = [];
  let loading = true;
  let filterStatus = '';
  let filterRisk = '';
  let filterHandler = '';

  onMount(async () => {
    await loadUsers();
    await loadOrders();
  });

  async function loadUsers() {
    try {
      users = await fetchUsers();
    } catch (e) {
      console.error(e);
    }
  }

  async function loadOrders() {
    loading = true;
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterRisk) params.risk_level = filterRisk;
      if (filterHandler) params.handler_id = filterHandler;
      orders = await fetchOrders(params);
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  $: {
    filterStatus;
    filterRisk;
    filterHandler;
    loadOrders();
  }

  function statusLabel(s) { return STATUS_MAP[s]?.label || s; }
  function statusColor(s) { return STATUS_MAP[s]?.color || '#666'; }
  function statusBg(s) { return STATUS_MAP[s]?.bg || '#f5f5f5'; }
  function riskLabel(r) { return RISK_MAP[r]?.label || r; }
  function riskColor(r) { return RISK_MAP[r]?.color || '#666'; }
  function riskBg(r) { return RISK_MAP[r]?.bg || '#f5f5f5'; }
  function roleLabel(r) { return ROLE_MAP[r]?.label || r; }

  function evidenceIcons(order) {
    const icons = [];
    if (order.evidence_temperature) icons.push('🌡️');
    if (order.evidence_quality) icons.push('🔬');
    if (order.evidence_quantity) icons.push('📦');
    return icons.length ? icons.join(' ') : '—';
  }
</script>

<div class="page">
  <div class="page-header">
    <h1 class="page-title">入库单队列</h1>
    <a href="/create" class="btn btn-primary">+ 新建入库单</a>
  </div>

  <div class="filters">
    <div class="filter-group">
      <label class="filter-label">状态</label>
      <select class="filter-select" bind:value={filterStatus}>
        <option value="">全部状态</option>
        {#each Object.entries(STATUS_MAP) as [key, val]}
          <option value={key}>{val.label}</option>
        {/each}
      </select>
    </div>
    <div class="filter-group">
      <label class="filter-label">风险</label>
      <select class="filter-select" bind:value={filterRisk}>
        <option value="">全部风险</option>
        {#each Object.entries(RISK_MAP) as [key, val]}
          <option value={key}>{val.label}</option>
        {/each}
      </select>
    </div>
    <div class="filter-group">
      <label class="filter-label">处理人</label>
      <select class="filter-select" bind:value={filterHandler}>
        <option value="">全部处理人</option>
        {#each users as u}
          <option value={u.id}>{u.display_name} ({ROLE_MAP[u.role]?.label || u.role})</option>
        {/each}
      </select>
    </div>
  </div>

  {#if loading}
    <div class="loading">加载中...</div>
  {:else if orders.length === 0}
    <div class="empty">暂无入库单</div>
  {:else}
    <div class="queue-info">
      <span class="queue-hint">💡 队列按风险优先级排列：高风险 → 中风险 → 低风险</span>
    </div>
    <div class="table-wrap">
      <table class="order-table">
        <thead>
          <tr>
            <th>优先</th>
            <th>单号</th>
            <th>产品</th>
            <th>供应商</th>
            <th>温区</th>
            <th>风险等级</th>
            <th>状态</th>
            <th>证据</th>
            <th>当前处理人</th>
            <th>版本</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {#each orders as order, i}
            <tr class:row-high={order.risk_level === 'high'} class:row-medium={order.risk_level === 'medium'} class:row-low={order.risk_level === 'low'}>
              <td class="priority-cell">
                <span class="priority-badge" style="background: {riskColor(order.risk_level)}">
                  {i + 1}
                </span>
              </td>
              <td><a href="/orders/{order.id}" class="order-link">{order.order_no}</a></td>
              <td>{order.product_name}</td>
              <td>{order.supplier}</td>
              <td class="temp-cell">{order.temperature_range}</td>
              <td>
                <span class="badge" style="color: {riskColor(order.risk_level)}; background: {riskBg(order.risk_level)}">
                  {riskLabel(order.risk_level)}
                </span>
              </td>
              <td>
                <span class="badge" style="color: {statusColor(order.status)}; background: {statusBg(order.status)}">
                  {statusLabel(order.status)}
                </span>
              </td>
              <td class="evidence-cell">{evidenceIcons(order)}</td>
              <td>{order.current_handler_name} <span class="role-tag">({roleLabel(order.current_handler_role)})</span></td>
              <td>v{order.version}</td>
              <td class="time-cell">{new Date(order.updated_at).toLocaleString('zh-CN')}</td>
              <td>
                <a href="/orders/{order.id}" class="btn btn-sm">详情</a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 100%;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .page-title {
    font-size: 22px;
    font-weight: 700;
    color: #1e3a5f;
  }

  .btn {
    display: inline-block;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #2563eb;
    color: white;
  }

  .btn-primary:hover {
    background: #1d4ed8;
  }

  .btn-sm {
    padding: 4px 10px;
    font-size: 12px;
    background: #eff6ff;
    color: #2563eb;
    border-radius: 4px;
  }

  .btn-sm:hover {
    background: #dbeafe;
  }

  .filters {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
    background: white;
    padding: 16px;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-label {
    font-size: 12px;
    color: #64748b;
    font-weight: 600;
  }

  .filter-select {
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 13px;
    background: white;
    min-width: 140px;
  }

  .queue-info {
    margin-bottom: 10px;
  }

  .queue-hint {
    font-size: 12px;
    color: #64748b;
    background: #f0f9ff;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #bae6fd;
  }

  .loading, .empty {
    text-align: center;
    padding: 60px;
    color: #64748b;
  }

  .table-wrap {
    overflow-x: auto;
    background: white;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .order-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .order-table th {
    text-align: left;
    padding: 12px 10px;
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
  }

  .order-table td {
    padding: 10px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }

  .row-high { border-left: 3px solid #dc2626; }
  .row-medium { border-left: 3px solid #f59e0b; }
  .row-low { border-left: 3px solid #10b981; }

  .priority-cell {
    text-align: center;
  }

  .priority-badge {
    display: inline-block;
    width: 24px;
    height: 24px;
    line-height: 24px;
    border-radius: 50%;
    color: white;
    font-size: 11px;
    font-weight: 700;
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
    white-space: nowrap;
  }

  .temp-cell {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    color: #0369a1;
  }

  .evidence-cell {
    font-size: 14px;
  }

  .role-tag {
    font-size: 11px;
    color: #94a3b8;
  }

  .time-cell {
    color: #94a3b8;
    font-size: 12px;
    white-space: nowrap;
  }
</style>
