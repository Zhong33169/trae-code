<template>
  <div>
    <header v-if="auth.isLoggedIn.value" class="header">
      <div class="header-content">
        <div class="header-title">🏭 生产工单扫码核验系统</div>
        <nav class="nav">
          <NuxtLink to="/" class="nav-link" :class="{ active: route.path === '/' }">工作台</NuxtLink>
          <NuxtLink to="/workorders" class="nav-link" :class="{ active: route.path.startsWith('/workorders') }">工单队列</NuxtLink>
          <NuxtLink to="/scan" class="nav-link" :class="{ active: route.path === '/scan' }">扫码处理</NuxtLink>
          <NuxtLink v-if="auth.userRole.value === 'reviewer'" to="/audit" class="nav-link" :class="{ active: route.path === '/audit' }">审计记录</NuxtLink>
        </nav>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 14px;">{{ auth.userName.value }} ({{ auth.user.value?.roleName }})</span>
          <button @click="handleLogout" class="btn btn-default" style="color: #333;">退出</button>
        </div>
      </div>
    </header>
    <main :style="{ padding: auth.isLoggedIn.value ? '20px 0' : '0' }">
      <div :class="auth.isLoggedIn.value ? 'container' : ''">
        <NuxtPage />
      </div>
    </main>
  </div>
</template>

<script setup>
const auth = useAuth()
const route = useRoute()

onMounted(() => {
  auth.checkAuth()
})

const handleLogout = () => {
  auth.logout()
  navigateTo('/login')
}
</script>
