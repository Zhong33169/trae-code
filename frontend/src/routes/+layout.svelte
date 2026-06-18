<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { currentUser } from '$lib/stores';
  import { ROLE_LABEL } from '$lib/types';
  import type { User } from '$lib/types';
  import { apiGet } from '$lib/api';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let users: User[] = [];
  let selectedUserId = '';

  onMount(async () => {
    try {
      users = await apiGet<User[]>('/api/users');
      if (!$currentUser && users.length > 0) {
        $currentUser = users[0];
      }
      if ($currentUser) {
        selectedUserId = $currentUser.id;
      }
    } catch (e) {
      console.error('加载用户失败', e);
    }
  });

  function switchUser() {
    const u = users.find(x => x.id === selectedUserId);
    if (u) {
      $currentUser = u;
      location.reload();
    }
  }

  const navItems = [
    { path: '/', label: '融资申请单处理', icon: '📋', roles: ['REGISTRAR','AUDITOR','REVIEWER'] },
    { path: '/applications', label: '申请单总览', icon: '📊', roles: ['REGISTRAR','AUDITOR','REVIEWER'] },
    { path: '/statistics', label: '统计看板', icon: '📈', roles: ['AUDITOR','REVIEWER'] },
  ];
</script>

<div class="layout">
  <aside class="sidebar">
    <div class="brand">
      <h1>供应链金融平台</h1>
      <p>风险分级处置融资申请单系统</p>
    </div>
    <nav>
      {#each navItems as n}
        {#if !$currentUser || n.roles.includes($currentUser.role)}
          <a href={n.path} class="nav-item {$page.url.pathname === n.path ? 'active' : ''}"
             data-sveltekit-preload-data="hover">
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </a>
        {/if}
      {/each}
    </nav>
  </aside>

  <div class="main-content">
    <div class="topbar">
      <div>
        <h1>{$page.url.pathname === '/' ? '融资申请单处理工作台' : $page.url.pathname === '/applications' ? '申请单总览' : '统计看板'}</h1>
        {#if $currentUser}
          <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">
            当前角色视图：<b style="color: var(--text)">{ROLE_LABEL[$currentUser.role]}</b>
            {#if $currentUser.role === 'REGISTRAR'}
              ，您可以创建、补正、提交融资申请单
            {:else if $currentUser.role === 'AUDITOR'}
              ，您负责核验申请单、处理异常、调整风险等级
            {:else}
              ，您负责复核归档或驳回
            {/if}
          </div>
        {/if}
      </div>
      <div class="topbar-right">
        <div class="user-switcher" title="切换登录身份（演示用）">
          <div class="avatar">{$currentUser ? $currentUser.display_name.charAt(0) : '?'}</div>
          <select bind:value={selectedUserId} on:change={switchUser} disabled={users.length === 0}>
            {#each users as u}
              <option value={u.id}>{u.display_name} · {ROLE_LABEL[u.role]}</option>
            {/each}
          </select>
          {#if $currentUser}
            <span class="role-tag">{ROLE_LABEL[$currentUser.role]}</span>
          {/if}
        </div>
      </div>
    </div>

    <slot />
  </div>
</div>
