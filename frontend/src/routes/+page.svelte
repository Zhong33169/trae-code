<script>
  import { onMount } from 'svelte';
  import { refreshTrigger, selectedReservationId, currentUser } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import { STATUS_LABELS, STATUS_COLORS, RESERVATION_STATUS } from '$lib/constants.js';
  import ReservationDetail from '$lib/components/ReservationDetail.svelte';
  import EvidencePanel from '$lib/components/EvidencePanel.svelte';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import BatchToolbar from '$lib/components/BatchToolbar.svelte';

  let reservations = [];
  let total = 0;
  let loading = false;
  let error = null;

  let page = 1;
  let pageSize = 20;
  let statusFilter = '';
  let keyword = '';
  let mineOnly = false;

  let selectedIds = new Set();
  let showDetail = false;

  $: if ($selectedReservationId) {
    showDetail = true;
  }

  $: $refreshTrigger;
  $: loadReservations();

  async function loadReservations() {
    loading = true;
    error = null;
    try {
      const params = {
        page,
        page_size: pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      if (keyword) params.keyword = keyword;
      if (mineOnly) params.mine_only = 'true';

      const data = await api.getReservations(params);
      reservations = data.items;
      total = data.total;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function selectReservation(id) {
    selectedReservationId.set(id);
  }

  function closeDetail() {
    showDetail = false;
    selectedReservationId.set(null);
  }

  function toggleSelect(id, event) {
    event.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    selectedIds = newSet;
  }

  function toggleSelectAll() {
    if (selectedIds.size === reservations.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(reservations.map((r) => r.id));
    }
  }

  function handleFilterChange(filters) {
    statusFilter = filters.status;
    keyword = filters.keyword;
    mineOnly = filters.mineOnly;
    page = 1;
    selectedIds = new Set();
  }

  function handleBatchComplete() {
    selectedIds = new Set();
    loadReservations();
  }

  function getStatusClass(status) {
    return `status-badge status-${STATUS_COLORS[status] || 'gray'}`;
  }

  function getEvidenceStatus(r) {
    const items = [];
    items.push(r.has_experiment_plan ? '✓方案' : '✗方案');
    items.push(r.has_material_application ? '✓耗材' : '✗耗材');
    items.push(r.has_safety_confirmation ? '✓安全' : '✗安全');
    return items;
  }

  onMount(() => {
    loadReservations();
  });
</script>

<div class="page-container">
  <div class="left-panel">
    <div class="panel-header">
      <h2>实验预约单队列</h2>
      <span class="count-badge">共 {total} 条</span>
    </div>

    <FilterBar on:change={(e) => handleFilterChange(e.detail)} />

    <BatchToolbar
      {selectedIds}
      {reservations}
      on:complete={handleBatchComplete}
    />

    <div class="reservation-list">
      {#if loading}
        <div class="loading">加载中...</div>
      {:else if error}
        <div class="error">加载失败：{error}</div>
      {:else if reservations.length === 0}
        <div class="empty">暂无预约单</div>
      {:else}
        <div class="list-header">
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={selectedIds.size === reservations.length && reservations.length > 0}
              on:change={toggleSelectAll}
            />
            <span>全选</span>
          </label>
          <span class="header-col">预约单号</span>
          <span class="header-col">状态</span>
          <span class="header-col">证据</span>
        </div>

        {#each reservations as r (r.id)}
          <div
            class="reservation-card"
            class:selected={selectedIds.has(r.id)}
            class:has-supplementary={r.supplementary_count > 0}
            on:click={() => selectReservation(r.id)}
          >
            <div class="card-checkbox" on:click|stopPropagation={(e) => toggleSelect(r.id, e)}>
              <input
                type="checkbox"
                checked={selectedIds.has(r.id)}
                on:change={(e) => toggleSelect(r.id, e)}
              />
            </div>
            <div class="card-main">
              <div class="card-title-row">
                <span class="reservation-no">{r.reservation_no}</span>
                <span class={getStatusClass(r.status)}>{STATUS_LABELS[r.status]}</span>
              </div>
              <div class="card-title">{r.title}</div>
              <div class="card-meta">
                <span>{r.lab_name}</span>
                <span>·</span>
                <span>{r.applicant}</span>
              </div>
              <div class="card-evidence">
                {#each getEvidenceStatus(r) as ev (ev)}
                  <span class="evidence-tag" class:incomplete={ev.startsWith('✗')}>
                    {ev}
                  </span>
                {/each}
                {#if r.supplementary_count > 0}
                  <span class="supplementary-tag">补录{r.supplementary_count}次</span>
                {/if}
              </div>
              {#if r.rejection_reason && (r.status === 'lab_rejected' || r.status === 'college_rejected')}
                <div class="rejection-reason">
                  <strong>退回原因：</strong>{r.rejection_reason}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <div class="right-panel">
    {#if showDetail && $selectedReservationId}
      <ReservationDetail reservationId={$selectedReservationId} on:close={closeDetail} />
    {:else}
      <EvidencePanel />
    {/if}
  </div>
</div>

<style>
  .page-container {
    display: flex;
    gap: 20px;
    height: calc(100vh - 140px);
    min-height: 600px;
  }

  .left-panel {
    flex: 1;
    min-width: 0;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .right-panel {
    width: 480px;
    flex-shrink: 0;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 16px;
    color: #1e3a5f;
  }

  .count-badge {
    background: #e8f0fe;
    color: #1e3a5f;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 13px;
  }

  .reservation-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
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

  .list-header {
    display: grid;
    grid-template-columns: 40px 1fr 100px 120px;
    padding: 8px 12px;
    font-size: 12px;
    color: #666;
    border-bottom: 1px solid #f0f0f0;
    margin-bottom: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }

  .header-col {
    font-weight: 500;
  }

  .reservation-card {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 8px;
    padding: 12px;
    border: 1px solid #eee;
    border-radius: 6px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reservation-card:hover {
    border-color: #2d5a87;
    box-shadow: 0 2px 8px rgba(45, 90, 135, 0.15);
  }

  .reservation-card.selected {
    border-color: #2d5a87;
    background: #f0f6ff;
  }

  .reservation-card.has-supplementary {
    border-left: 3px solid #f39c12;
  }

  .card-checkbox {
    display: flex;
    align-items: flex-start;
    padding-top: 4px;
  }

  .card-main {
    min-width: 0;
  }

  .card-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .reservation-no {
    font-family: monospace;
    font-size: 13px;
    color: #666;
  }

  .status-badge {
    font-size: 12px;
    padding: 2px 8px;
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

  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta {
    font-size: 12px;
    color: #888;
    margin-bottom: 6px;
    display: flex;
    gap: 6px;
  }

  .card-evidence {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 4px;
  }

  .evidence-tag {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #e8f5e9;
    color: #388e3c;
  }

  .evidence-tag.incomplete {
    background: #ffebee;
    color: #d32f2f;
  }

  .supplementary-tag {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #fff3e0;
    color: #f57c00;
    font-weight: 500;
  }

  .rejection-reason {
    font-size: 12px;
    color: #e67e22;
    background: #fff8e1;
    padding: 6px 8px;
    border-radius: 4px;
    margin-top: 6px;
  }

  .rejection-reason strong {
    color: #e65100;
  }
</style>
