<script>
  import { currentUser, switchUser, DEMO_USERS } from '$lib/stores.js';
  import { ROLE_LABELS } from '$lib/constants.js';
</script>

<div class="app">
  <header class="header">
    <div class="header-left">
      <h1>高校实验室移动补录校验系统</h1>
      <span class="subtitle">实验预约单 · 移动补录 · 流程校验</span>
    </div>
    <div class="header-right">
      <div class="user-switcher">
        <span class="current-role">
          当前角色：{$currentUser?.role_display}
        </span>
        <div class="user-select">
          <label>切换用户：</label>
          <select value={$currentUser?.id} on:change={(e) => switchUser(Number(e.target.value))}>
            {#each DEMO_USERS as user (user.id)}
              <option value={user.id}>
                {user.name} ({ROLE_LABELS[user.role]})
              </option>
            {/each}
          </select>
        </div>
      </div>
    </div>
  </header>

  <main class="main">
    <slot />
  </main>

  <footer class="footer">
    <p>实验助教 → 实验室管理员 → 学院负责人 · 后岗不能替前岗补流程</p>
  </footer>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f5f7fa;
  }

  .header {
    background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
    color: white;
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .header-left h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .subtitle {
    font-size: 13px;
    opacity: 0.8;
    margin-left: 12px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .user-switcher {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .current-role {
    font-size: 13px;
    background: rgba(255, 255, 255, 0.15);
    padding: 4px 10px;
    border-radius: 12px;
  }

  .user-select {
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .user-select select {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    color: white;
    cursor: pointer;
  }

  .user-select select option {
    color: #333;
  }

  .main {
    flex: 1;
    padding: 20px;
  }

  .footer {
    background: #e8ecf1;
    padding: 12px 24px;
    text-align: center;
    font-size: 12px;
    color: #666;
  }

  .footer p {
    margin: 0;
  }
</style>
