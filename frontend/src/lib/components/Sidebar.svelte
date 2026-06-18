<script lang="ts">
  import { page } from '$app/stores';
  import { currentUser } from '$stores';
  import { Role, RoleLabel } from '$types';

  const menuItems = [
    { path: '/', label: '仪表盘', icon: '📊', roles: [Role.REGISTRAR, Role.SUPERVISOR, Role.SUPERVISOR_ENGINEER] },
    { path: '/progress-reports', label: '进度报告', icon: '📋', roles: [Role.REGISTRAR, Role.SUPERVISOR, Role.SUPERVISOR_ENGINEER] },
    { path: '/operation-logs', label: '操作记录', icon: '📝', roles: [Role.SUPERVISOR, Role.SUPERVISOR_ENGINEER] },
  ];

  function isActive(path: string): boolean {
    if (path === '/') {
      return $page.url.pathname === '/';
    }
    return $page.url.pathname.startsWith(path);
  }

  function canView(item: typeof menuItems[0]): boolean {
    if (!$currentUser) return false;
    return item.roles.includes($currentUser.role);
  }
</script>

<aside class="sidebar">
  <div class="sidebar-header">
    <div class="logo">📈</div>
    <div class="app-name">进度报告管理系统</div>
  </div>

  <nav class="sidebar-nav">
    {#each menuItems.filter((item) => canView(item)) as item}
      <a href={item.path} class="nav-item {isActive(item.path) ? 'active' : ''}">
        <span class="nav-icon">{item.icon}</span>
        <span class="nav-label">{item.label}</span>
      </a>
    {/each}
  </nav>

  <div class="sidebar-footer">
    {#if $currentUser}
      <div class="user-info">
        <div class="user-avatar">{$currentUser.name.charAt(0)}</div>
        <div class="user-details">
          <div class="user-name">{$currentUser.name}</div>
          <div class="user-role">{RoleLabel[$currentUser.role]}</div>
        </div>
      </div>
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    width: 240px;
    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
    color: white;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo {
    font-size: 28px;
  }

  .app-name {
    font-size: 16px;
    font-weight: 600;
  }

  .sidebar-nav {
    flex: 1;
    padding: 16px 0;
    overflow-y: auto;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.2s;
    cursor: pointer;
    border-left: 3px solid transparent;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }

  .nav-item.active {
    background: rgba(59, 130, 246, 0.2);
    color: white;
    border-left-color: #3b82f6;
  }

  .nav-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }

  .nav-label {
    font-size: 14px;
  }

  .sidebar-footer {
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
  }

  .user-details {
    min-width: 0;
  }

  .user-name {
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-role {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
