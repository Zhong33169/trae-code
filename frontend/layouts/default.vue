<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-bold text-gray-800">🌍 外贸订单管理系统</h1>
          <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            业务员 → 单证主管 → 业务经理
          </span>
        </div>

        <div class="flex items-center gap-4">
          <div v-if="store.currentUser" class="flex items-center gap-3">
            <span class="text-sm text-gray-500">当前角色:</span>
            <USelect
              :model-value="store.currentUser.id"
              :options="userSelectOptions"
              size="sm"
              class="w-56"
              @update:model-value="onUserChange"
            />
            <span class="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
              {{ RoleLabels[store.currentUser.role] }}
            </span>
          </div>
          <div v-else class="text-sm text-gray-400">请选择登录角色</div>
        </div>
      </div>
    </header>

    <main class="flex-1 max-w-[1800px] mx-auto w-full px-6 py-4">
      <slot />
    </main>

    <footer class="border-t border-gray-200 bg-white py-3 text-center text-xs text-gray-400">
      外贸订单管理系统 · Nuxt 3 + Django Ninja
    </footer>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAppStore } from '~/stores/app'
import { RoleLabels } from '~/types'

const store = useAppStore()
const { allUsers, currentUser } = storeToRefs(store)

const userSelectOptions = computed(() =>
  allUsers.value.map(u => ({
    label: `${u.display_name} (${RoleLabels[u.role]})`,
    value: u.id,
  }))
)

function onUserChange(userId: number | string) {
  const user = allUsers.value.find(u => u.id === Number(userId))
  if (user) {
    store.setUser(user)
    store.selectedOrderIds = []
    store.loadOrders()
    store.loadBatchHistory()
  }
}

onMounted(async () => {
  await store.loadUsers()
  if (!store.currentUser && store.allUsers.length > 0) {
    store.setUser(store.allUsers[0])
  }
  if (store.currentUser) {
    await store.loadOrders()
    await store.loadBatchHistory()
  }
})
</script>
