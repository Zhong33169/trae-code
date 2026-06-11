<script>
  import { page } from '$app/stores';
</script>

<nav class="navbar">
  <div class="nav-brand">
    <span class="nav-icon">❄️</span>
    <span class="nav-title">冷链物流仓 - 风险分级处置入库单系统</span>
  </div>
  <div class="nav-links">
    <a href="/" class="nav-link" class:active={$page.url.pathname === '/'}>仪表盘</a>
    <a href="/orders" class="nav-link" class:active={$page.url.pathname === '/orders'}>入库单队列</a>
    <a href="/workbench" class="nav-link" class:active={$page.url.pathname === '/workbench'}>👔 经理工作台</a>
    <a href="/create" class="nav-link" class:active={$page.url.pathname === '/create'}>新建入库单</a>
  </div>
</nav>

<main class="main-content">
  <slot />
</main>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: #f0f4f8;
    color: #1e293b;
    line-height: 1.6;
  }

  :global(a) {
    text-decoration: none;
    color: inherit;
  }

  .navbar {
    background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
    color: white;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .nav-icon {
    font-size: 24px;
  }

  .nav-title {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .nav-links {
    display: flex;
    gap: 4px;
  }

  .nav-link {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    transition: background 0.2s;
    color: rgba(255,255,255,0.85);
  }

  .nav-link:hover {
    background: rgba(255,255,255,0.15);
    color: white;
  }

  .nav-link.active {
    background: rgba(255,255,255,0.2);
    color: white;
    font-weight: 600;
  }

  .main-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
  }
</style>
