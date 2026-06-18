<style>
  :root {
    --primary: #2563eb;
    --primary-dark: #1d4ed8;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
    --info: #3b82f6;
    --bg: #f1f5f9;
    --card: #ffffff;
    --border: #e2e8f0;
    --text: #1e293b;
    --text-muted: #64748b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.5;
  }
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
  button {
    padding: 8px 16px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s;
  }
  button:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button.primary { background: var(--primary); color: #fff; border-color: var(--primary); }
  button.primary:hover:not(:disabled) { background: var(--primary-dark); border-color: var(--primary-dark); color: #fff; }
  button.danger { background: var(--danger); color: #fff; border-color: var(--danger); }
  button.danger:hover:not(:disabled) { background: #dc2626; border-color: #dc2626; color: #fff; }
  button.warning { background: var(--warning); color: #fff; border-color: var(--warning); }
  button.success { background: var(--success); color: #fff; border-color: var(--success); }
  input, select, textarea {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    background: #fff;
  }
  input:focus, select:focus, textarea:focus { border-color: var(--primary); }
  label { display: block; margin-bottom: 4px; color: var(--text-muted); font-size: 13px; }
  .layout { display: flex; min-height: 100vh; }
  .sidebar {
    width: 240px;
    background: #1e293b;
    color: #cbd5e1;
    padding: 20px 0;
    flex-shrink: 0;
  }
  .sidebar h2 { color: #fff; padding: 0 20px 20px; font-size: 18px; border-bottom: 1px solid #334155; }
  .sidebar nav { margin-top: 16px; }
  .sidebar a {
    display: block;
    padding: 12px 20px;
    color: #cbd5e1;
    text-decoration: none;
  }
  .sidebar a:hover { background: #334155; color: #fff; }
  .sidebar a.active { background: var(--primary); color: #fff; }
  .main { flex: 1; padding: 24px; overflow-x: auto; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .header h1 { font-size: 22px; }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: var(--card);
    border-radius: 10px;
    padding: 18px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .stat-card .label { color: var(--text-muted); font-size: 13px; margin-bottom: 6px; }
  .stat-card .value { font-size: 26px; font-weight: 600; }
  .stat-card.overdue .value { color: var(--danger); }
  .stat-card.completed .value { color: var(--success); }
  .stat-card.pending .value { color: var(--warning); }
  .filters {
    background: var(--card);
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: end;
  }
  .filter-item { display: flex; flex-direction: column; min-width: 140px; }
  .table-wrap {
    background: var(--card);
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    overflow: hidden;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); }
  th { background: #f8fafc; color: var(--text-muted); font-weight: 600; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f8fafc; }
  .tag {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
  .tag.overdue { background: #fef2f2; color: var(--danger); border: 1px solid #fecaca; }
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
  }
  .card {
    background: var(--card);
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    margin-bottom: 20px;
  }
  .card h3 { margin-bottom: 14px; font-size: 16px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
  .field { margin-bottom: 12px; }
  .field .label { color: var(--text-muted); font-size: 13px; margin-bottom: 2px; }
  .field .value { font-size: 14px; }
  .actions-bar {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }
  .timeline { position: relative; padding-left: 28px; }
  .timeline::before {
    content: '';
    position: absolute;
    left: 9px;
    top: 4px;
    bottom: 4px;
    width: 2px;
    background: var(--border);
  }
  .timeline-item { position: relative; padding-bottom: 18px; }
  .timeline-item::before {
    content: '';
    position: absolute;
    left: -23px;
    top: 4px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--primary);
    border: 2px solid #fff;
    box-shadow: 0 0 0 2px var(--primary);
  }
  .timeline-item .head {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 4px;
  }
  .timeline-item .actor { font-weight: 600; }
  .timeline-item .time { color: var(--text-muted); font-size: 12px; }
  .timeline-item .meta { color: var(--text-muted); font-size: 13px; margin-bottom: 6px; }
  .timeline-item .body { background: #f8fafc; padding: 10px 12px; border-radius: 6px; }
  .timeline-item .body .opinion { margin-bottom: 6px; }
  .timeline-item .body .result { color: var(--text-muted); font-size: 13px; }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .evidence-list { display: flex; flex-direction: column; gap: 6px; }
  .evidence-item { display: flex; align-items: center; gap: 8px; }
  .evidence-item input { width: auto; }
  .alert {
    padding: 12px 16px;
    border-radius: 6px;
    margin-bottom: 16px;
  }
  .alert.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .alert.success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .alert.warning { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
  .role-switch { display: flex; align-items: center; gap: 10px; }
  .role-switch select { width: auto; min-width: 150px; }
  .breadcrumb { margin-bottom: 16px; color: var(--text-muted); font-size: 13px; }
  .breadcrumb a { color: var(--primary); }
</style>

<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { api } from '$lib/api';
  import type { User } from '$lib/types';
  import { ROLE_LABEL } from '$lib/types';

  let users: User[] = [];
  let currentUserId: string = '';

  onMount(async () => {
    users = await api.getUsers();
    if (browser) {
      const saved = localStorage.getItem('currentUserId');
      currentUserId = saved && users.find(u => u.id === saved) ? saved : users[0]?.id || '';
      if (!saved && currentUserId) localStorage.setItem('currentUserId', currentUserId);
    }
  });

  function switchRole(e: Event) {
    const target = e.target as HTMLSelectElement;
    currentUserId = target.value;
    if (browser) localStorage.setItem('currentUserId', currentUserId);
    location.reload();
  }

  $: currentUser = users.find(u => u.id === currentUserId);
</script>

<div class="layout">
  <aside class="sidebar">
    <h2>交易核查单系统</h2>
    <nav>
      <a href="/" class:active={$page.url.pathname === '/'}>核查队列</a>
      <a href="/register" class:active={$page.url.pathname === '/register'}>登记核查单</a>
    </nav>
  </aside>
  <main class="main">
    <div class="header">
      <h1>
        {#if $page.url.pathname === '/'}核查队列{:else if $page.url.pathname === '/register'}登记交易核查单{:else}核查单详情{/if}
      </h1>
      <div class="role-switch">
        <label for="roleSwitch">当前身份：</label>
        <select id="roleSwitch" value={currentUserId} on:change={switchRole}>
          {#each users as u}
            <option value={u.id}>{u.name}（{ROLE_LABEL[u.role]}）</option>
          {/each}
        </select>
      </div>
    </div>
    <slot />
  </main>
</div>
