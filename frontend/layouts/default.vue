<template>
  <div>
    <header class="header">
      <div class="header-inner">
        <div class="flex" style="align-items: center;">
          <div class="logo">
            <div class="logo-icon">健</div>
            <span>社区健身房 · 会员入会单系统</span>
          </div>
          <nav class="nav" v-if="auth.state.user">
            <NuxtLink to="/" :class="{ active: route.path === '/' }">会员入会单</NuxtLink>
          </nav>
        </div>
        <div class="user-info" v-if="auth.state.user">
          <div class="role-selector">
            <button
              class="role-btn"
              :class="{ active: auth.state.user?.username === 'registrar' }"
              @click="switchRole('registrar')"
            >登记员</button>
            <button
              class="role-btn"
              :class="{ active: auth.state.user?.username === 'supervisor' }"
              @click="switchRole('supervisor')"
            >审核主管</button>
            <button
              class="role-btn"
              :class="{ active: auth.state.user?.username === 'reviewer' }"
              @click="switchRole('reviewer')"
            >复核负责人</button>
          </div>
          <div>
            <div class="user-name">{{ auth.state.user.name }}</div>
            <div class="user-role">{{ roleLabel }}</div>
          </div>
          <div class="user-avatar">{{ auth.state.user.name.charAt(0) }}</div>
          <button class="btn btn-sm" @click="logout">退出</button>
        </div>
      </div>
    </header>
    <main>
      <div class="container">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ROLE_LABELS } from '~/types'

const auth = useAuth()
const route = useRoute()
const router = useRouter()

const roleLabel = computed(() => {
  if (!auth.state.user) return ''
  return ROLE_LABELS[auth.state.user.role] || auth.state.user.role
})

function switchRole(username: string) {
  auth.switchRole(username)
}

function logout() {
  auth.logout()
  router.push('/login')
}

onMounted(() => {
  if (!auth.state.user && route.path !== '/login') {
    router.push('/login')
  }
})
</script>
