<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { loadSystemData, currentUser, currentRole, users, ROLE_LABELS, setCurrentUser } from '$lib/store';

  onMount(() => {
    loadSystemData();
  });

  function handleRoleChange(e) {
    const role = e.target.value;
    const userList = $users.filter(u => u.role === role);
    if (userList.length > 0) {
      setCurrentUser(userList[0]);
    }
  }

  function handleUserChange(e) {
    const userId = parseInt(e.target.value);
    const user = $users.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  }
</script>

<div class="layout">
  <header class="header">
    <div class="header-title">📋 电子元器件工厂 · 附件缺失补正物料变更单系统</div>
    <div class="header-right">
      {#if $currentUser}
        <div class="role-selector">
          <label for="role">角色：</label>
          <select id="role" value={$currentRole} on:change={handleRoleChange}>
            <option value="registrar">物料变更登记员</option>
            <option value="supervisor">物料变更审核主管</option>
            <option value="reviewer">电子元器件工厂复核负责人</option>
          </select>
          <label for="user">用户：</label>
          <select id="user" value={$currentUser.id} on:change={handleUserChange}>
            {#each $users.filter(u => u.role === $currentRole) as user}
              <option value={user.id}>{user.name}</option>
            {/each}
          </select>
          <span class="tag">
            当前身份：{$currentUser.name} · {ROLE_LABELS[$currentRole]}
          </span>
        </div>
      {/if}
    </div>
  </header>
  <main class="container">
    <slot />
  </main>
</div>
