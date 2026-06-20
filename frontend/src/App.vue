<script setup>
import { useUserStore } from './stores/user'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-container">
    <header class="app-header" v-if="userStore.isLoggedIn">
      <div class="header-left">
        <h1 class="app-title" @click="router.push('/care-records')">🏥 宠物医院住院护理管理系统</h1>
        <nav class="nav-links">
          <router-link to="/care-records" class="nav-link">住院护理单</router-link>
          <router-link to="/audit" class="nav-link">审计日志</router-link>
        </nav>
      </div>
      <div class="header-right">
        <span class="user-badge" :class="`role-${userStore.role}`">
          {{ userStore.user?.name }} ({{ userStore.roleLabel }})
        </span>
        <button class="btn btn-sm btn-outline" @click="handleLogout">退出</button>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-header {
  background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
  color: white;
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  position: sticky;
  top: 0;
  z-index: 100;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}
.app-title {
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.nav-links {
  display: flex;
  gap: 4px;
}
.nav-link {
  color: rgba(255,255,255,0.75);
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
}
.nav-link:hover, .nav-link.router-link-active {
  color: white;
  background: rgba(255,255,255,0.15);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}
.role-doctor { background: rgba(76,175,80,0.3); }
.role-nurse { background: rgba(33,150,243,0.3); }
.role-reviewer { background: rgba(255,152,0,0.3); }
.role-admin { background: rgba(156,39,176,0.3); }
.app-main {
  flex: 1;
  padding: 20px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
</style>
