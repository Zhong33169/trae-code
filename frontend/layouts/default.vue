<template>
  <div class="workbench-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2 class="logo">贷款展期系统</h2>
      </div>
      <nav class="nav-menu">
        <NuxtLink to="/workbench" class="nav-item">
          <span class="nav-icon">📊</span>
          <span>工作台</span>
        </NuxtLink>
        <NuxtLink to="/applications" class="nav-item">
          <span class="nav-icon">📋</span>
          <span>展期申请</span>
        </NuxtLink>
        <NuxtLink to="/scan" class="nav-item">
          <span class="nav-icon">📱</span>
          <span>扫码核验</span>
        </NuxtLink>
        <NuxtLink v-if="showBatchMenu" to="/batch" class="nav-item">
          <span class="nav-icon">⚙️</span>
          <span>批量处理</span>
        </NuxtLink>
        <div class="nav-divider"></div>
        <NuxtLink to="/audit" class="nav-item">
          <span class="nav-icon">📝</span>
          <span>审计日志</span>
        </NuxtLink>
      </nav>
    </aside>

    <div class="main-container">
      <header class="top-header">
        <div class="header-left">
          <h1 class="page-title">{{ pageTitle }}</h1>
        </div>
        <div class="header-right">
          <div class="user-info">
            <span class="user-avatar">👤</span>
            <div class="user-detail">
              <span class="user-name">{{ userStore.user?.username || '未登录' }}</span>
              <span class="user-role">{{ userStore.user?.role_name || '' }}</span>
            </div>
          </div>
          <button class="logout-btn" @click="handleLogout">
            退出
          </button>
        </div>
      </header>

      <main class="content-area">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore, type UserRole } from '~/stores/user'

const userStore = useUserStore()
const route = useRoute()

const pageTitle = computed(() => {
  const path = route.path
  if (path === '/workbench') return '工作台'
  if (path.startsWith('/applications')) return '展期申请'
  if (path === '/scan') return '扫码核验'
  if (path === '/batch') return '批量处理'
  if (path === '/audit') return '审计日志'
  return '工作台'
})

const showBatchMenu = computed(() => {
  return userStore.hasRole(['reviewer', 'final_reviewer', 'admin'] as UserRole[])
})

const handleLogout = () => {
  userStore.logout()
  navigateTo('/')
}
</script>

<style scoped>
.workbench-layout {
  display: flex;
  min-height: 100vh;
  background-color: #f0f2f5;
}

.sidebar {
  width: 240px;
  background: linear-gradient(180deg, #1e3a5f 0%, #152942 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #fff;
}

.nav-menu {
  flex: 1;
  padding: 16px 12px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s;
  font-size: 14px;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.router-link-active {
  background: #3b82f6;
  color: #fff;
}

.nav-icon {
  font-size: 18px;
}

.nav-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 12px 8px;
}

.main-container {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
}

.top-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  font-size: 32px;
}

.user-detail {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.user-role {
  font-size: 12px;
  color: #6b7280;
}

.logout-btn {
  padding: 8px 16px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #374151;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: #e5e7eb;
}

.content-area {
  flex: 1;
  padding: 24px;
}
</style>
