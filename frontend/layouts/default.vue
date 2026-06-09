<template>
  <div v-if="authStore.isLoggedIn" class="layout-wrapper">
    <div class="navbar">
      <div class="navbar-title">养老护理院-跨班组交接确认护理计划单系统</div>
      <div class="navbar-user">
        <span>{{ authStore.user?.real_name }}</span>
        <span class="role-tag">{{ ROLE_MAP[authStore.role] }}</span>
        <button class="navbar-btn" @click="handleLogout">退出</button>
      </div>
    </div>
    <div class="layout">
      <div class="sidebar">
        <ul class="sidebar-menu">
          <li 
            v-for="item in menuItems" 
            :key="item.path"
            :class="{ active: route.path === item.path }"
            @click="navigateTo(item.path)"
          >
            {{ item.label }}
          </li>
        </ul>
      </div>
      <div class="main-content">
        <slot />
      </div>
    </div>
  </div>
  <div v-else>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { ROLE_MAP } from '~/types'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const menuItems = computed(() => {
  const items: { path: string; label: string }[] = [
    { path: '/plans', label: '护理计划单列表' },
  ]
  
  if (authStore.role === 'registrar') {
    items.unshift({ path: '/plans/create', label: '新建护理计划' })
  }
  
  items.push({ path: '/statistics', label: '统计概览' })
  
  return items
})

function handleLogout() {
  authStore.logout()
  navigateTo('/login')
}

onMounted(() => {
  if (!authStore.isLoggedIn && route.path !== '/login') {
    navigateTo('/login')
  }
})
</script>

<style scoped>
.layout-wrapper {
  min-height: 100vh;
}

.role-tag {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
