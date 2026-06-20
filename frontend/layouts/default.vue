<template>
  <div v-if="authStore.isLoggedIn" class="layout">
    <aside class="sidebar">
      <div class="logo">
        <h2>新闻采编中心</h2>
        <small>线索管理系统 v1.0</small>
      </div>
      <ul class="menu">
        <li>
          <NuxtLink to="/" exact-active-class="active">📊 综合大屏</NuxtLink>
        </li>
        <li>
          <NuxtLink to="/clues" active-class="active">📋 线索单管理</NuxtLink>
        </li>
        <li v-if="authStore.isRegistrar">
          <NuxtLink to="/clues/new" active-class="active">➕ 新建线索单</NuxtLink>
        </li>
      </ul>
    </aside>
    <main class="main">
      <div class="topbar">
        <div>
          <b style="font-size:14px;">
            <NuxtLink to="/">新闻采编中心 · 线索管理系统</NuxtLink>
          </b>
        </div>
        <div class="user">
          <span>
            <span class="badge-role" :class="`badge-${authStore.role}`">{{ authStore.user?.roleLabel }}</span>
            &nbsp; {{ authStore.user?.realName }}
          </span>
          <div class="avatar">{{ authStore.user?.realName?.[0] || 'U' }}</div>
          <button class="btn btn-sm" @click="onLogout">退出</button>
        </div>
      </div>
      <div class="content">
        <slot />
      </div>
    </main>
  </div>
  <div v-else>
    <slot />
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const route = useRoute()

onMounted(() => {
  if (!authStore.isLoggedIn && route.path !== '/login') {
    navigateTo('/login')
  }
})

watch(() => route.path, (p) => {
  if (!authStore.isLoggedIn && p !== '/login') {
    navigateTo('/login')
  }
})

const onLogout = () => {
  authStore.logout()
  navigateTo('/login')
}
</script>
