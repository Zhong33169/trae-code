<script>
  import { createEventDispatcher } from 'svelte';
  import { currentUser } from '$lib/stores.js';
  import { RESERVATION_STATUS, STATUS_LABELS, ROLES } from '$lib/constants.js';

  const dispatch = createEventDispatcher();

  let status = '';
  let keyword = '';
  let mineOnly = false;

  function handleChange() {
    dispatch('change', {
      status,
      keyword,
      mineOnly,
    });
  }

  $: status, handleChange();
  $: keyword, handleChange();
  $: mineOnly, handleChange();
</script>

<div class="filter-bar">
  <div class="filter-group">
    <label>状态筛选</label>
    <select bind:value={status}>
      <option value="">全部状态</option>
      {#each Object.entries(STATUS_LABELS) as [value, label]}
        <option value={value}>{label}</option>
      {/each}
    </select>
  </div>

  <div class="filter-group search-group">
    <label>搜索</label>
    <input
      type="text"
      bind:value={keyword}
      placeholder="搜索预约单号、标题、实验名..."
    />
  </div>

  {#if $currentUser?.role === ROLES.TEACHING_ASSISTANT}
    <div class="filter-group checkbox-group">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={mineOnly} />
        <span>只看我的</span>
      </label>
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    background: #fafbfc;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
  }

  .filter-group label {
    color: #666;
    font-size: 12px;
  }

  .filter-group select,
  .filter-group input[type='text'] {
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    min-width: 150px;
  }

  .search-group {
    flex: 1;
    min-width: 200px;
  }

  .search-group input {
    width: 100%;
  }

  .checkbox-group {
    justify-content: flex-end;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding-top: 20px;
  }
</style>
