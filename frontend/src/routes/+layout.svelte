<script lang="ts">
  import { page } from '$app/stores';
  import { currentUser, toasts, logout as userStoreLogout } from '$stores';
  import { goto } from '$app/navigation';
  import ToastContainer from '$components/ToastContainer.svelte';
  import Sidebar from '$components/Sidebar.svelte';
  import Header from '$components/Header.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  $: isLoginPage = $page.url.pathname === '/login';
  $: currentUser.set(data.user);

  async function handleLogout() {
    await userStoreLogout();
    goto('/login');
  }
</script>

{#if isLoginPage}
  <main class="login-layout">
    <slot />
  </main>
{:else}
  <div class="app-layout">
    <Sidebar />
    <div class="main-content">
      <Header user={data.user} onLogout={handleLogout} />
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
{/if}

<ToastContainer toasts={$toasts} />

<style>
  .login-layout {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .app-layout {
    display: flex;
    min-height: 100vh;
    background: #f5f7fa;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .content {
    flex: 1;
    padding: 24px;
    overflow-x: auto;
  }
</style>
