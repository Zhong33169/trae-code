<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-8">
          <h1 class="text-xl font-bold text-gray-900">需求跟踪单系统</h1>
          <nav class="flex space-x-1">
            <NuxtLink to="/" class="px-3 py-2 rounded-md text-sm font-medium" :class="{ 'bg-blue-100 text-blue-700': $route.path === '/' }">
              仪表盘
            </NuxtLink>
            <NuxtLink to="/feedback" class="px-3 py-2 rounded-md text-sm font-medium" :class="{ 'bg-blue-100 text-blue-700': $route.path === '/feedback' }">
              需求反馈
            </NuxtLink>
            <NuxtLink to="/product-review" class="px-3 py-2 rounded-md text-sm font-medium" :class="{ 'bg-blue-100 text-blue-700': $route.path === '/product-review' }">
              产品评审
            </NuxtLink>
            <NuxtLink to="/release-visit" class="px-3 py-2 rounded-md text-sm font-medium" :class="{ 'bg-blue-100 text-blue-700': $route.path === '/release-visit' }">
              发布回访
            </NuxtLink>
            <NuxtLink to="/import" class="px-3 py-2 rounded-md text-sm font-medium" :class="{ 'bg-blue-100 text-blue-700': $route.path === '/import' }">
              台账导入
            </NuxtLink>
            <NuxtLink to="/audit-logs" class="px-3 py-2 rounded-md text-sm font-medium" :class="{ 'bg-blue-100 text-blue-700': $route.path === '/audit-logs' }">
              审计日志
            </NuxtLink>
          </nav>
        </div>
        <div class="flex items-center space-x-4">
          <div class="text-sm text-gray-600">
            <span class="text-gray-500">当前角色：</span>
            <span class="font-medium text-gray-900">{{ currentUser?.role_label || '未选择' }}</span>
          </div>
          <select
            v-if="users.length > 0"
            :value="currentUser?.id"
            @change="handleSwitchUser"
            class="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.name }} ({{ user.role_label }})
            </option>
          </select>
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 py-6">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
const { currentUser, users, loadUsers, switchUser } = useAuth();

onMounted(async () => {
  await loadUsers();
});

const handleSwitchUser = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  switchUser(target.value);
};
</script>
