<script lang="ts">
  import { page } from '$app/stores';
  import type { User } from '$types';

  export let user: User | null | undefined;
  export let onLogout: () => void;

  const pageTitles: Record<string, string> = {
    '/': '仪表盘',
    '/progress-reports': '进度报告列表',
    '/progress-reports/new': '新建进度报告',
    '/operation-logs': '操作记录',
  };

  $: pathname = $page.url.pathname;
  $: pageTitle = getPageTitle(pathname);

  function getPageTitle(path: string): string {
    if (path.startsWith('/progress-reports/') && path !== '/progress-reports/new') {
      return '进度报告详情';
    }
    if (path.startsWith('/progress-reports/') && path.includes('/edit')) {
      return '编辑进度报告';
    }
    return pageTitles[path] || '进度报告管理系统';
  }
</script>

<header class="header">
  <div class="header-left">
    <h1 class="page-title">{pageTitle}</h1>
  </div>
  <div class="header-right">
    <button class="logout-btn" on:click={onLogout} title="退出登录">
      <span>🚪</span>
      <span>退出登录</span>
    </button>
  </div>
</header>

<style>
  .header {
    height: 60px;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    flex-shrink: 0;
  }

  .header-left {
    flex: 1;
    min-width: 0;
  }

  .page-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .logout-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    color: #374151;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }
</style>
