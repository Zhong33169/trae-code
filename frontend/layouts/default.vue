<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-8">
          <h1 class="text-xl font-bold text-blue-600">社区团购订单管理系统</h1>
          <nav class="flex gap-1" v-if="authStore.isLoggedIn">
            <NuxtLink to="/orders" class="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100" :class="{ 'bg-blue-50 text-blue-600': route.path.startsWith('/orders') }">
              团购订单
            </NuxtLink>
            <NuxtLink to="/products" class="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100" :class="{ 'bg-blue-50 text-blue-600': route.path.startsWith('/products') }">
              商品管理
            </NuxtLink>
            <NuxtLink to="/imports" class="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100" :class="{ 'bg-blue-50 text-blue-600': route.path.startsWith('/imports') }">
              离线台账回填
            </NuxtLink>
            <NuxtLink to="/audit-logs" class="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100" :class="{ 'bg-blue-50 text-blue-600': route.path.startsWith('/audit-logs') }" v-if="authStore.isSupervisor || authStore.isReviewer">
              审计日志
            </NuxtLink>
          </nav>
        </div>
        <div class="flex items-center gap-4" v-if="authStore.isLoggedIn">
          <span class="text-sm text-gray-600">
            {{ authStore.user?.name }}
            <span class="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
              {{ roleLabel }}
            </span>
          </span>
          <button class="btn btn-default text-sm" @click="authStore.logout()">
            退出登录
          </button>
        </div>
      </div>
    </header>
    <main class="py-6">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { UserRoleLabels } from '~/types';

const authStore = useAuthStore();
const route = useRoute();

const roleLabel = computed(() => {
  if (!authStore.user) return '';
  return UserRoleLabels[authStore.user.role];
});

onMounted(() => {
  authStore.loadFromCookie();
});

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (!loggedIn && route.path !== '/login') {
      navigateTo('/login');
    }
  },
  { immediate: true }
);
</script>
