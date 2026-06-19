<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold text-gray-900">仪表盘</h2>
    
    <div class="grid grid-cols-4 gap-4">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="text-sm text-gray-500 mb-1">需求单总数</div>
        <div class="text-3xl font-bold text-gray-900">{{ stats?.total || 0 }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <div class="text-sm text-gray-500 mb-1">待审核</div>
        <div class="text-3xl font-bold text-blue-600">{{ stats?.pending_audit || 0 }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <div class="text-sm text-gray-500 mb-1">异常单</div>
        <div class="text-3xl font-bold text-red-600">{{ stats?.abnormal || 0 }}</div>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <div class="text-sm text-gray-500 mb-1">已归档</div>
        <div class="text-3xl font-bold text-gray-600">{{ stats?.archived || 0 }}</div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div v-for="(stage, key) in stats?.by_stage" :key="key" class="bg-white rounded-lg shadow p-6">
        <div class="text-sm text-gray-500 mb-1">{{ stage.label }}</div>
        <div class="text-2xl font-bold text-gray-900">{{ stage.count }}</div>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">快速查看</h3>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div class="space-y-2">
          <div class="text-gray-600">
            <span class="font-medium">正常单示例：</span>
            <span class="text-blue-600 cursor-pointer hover:underline" @click="goToTicket('t1')">REQ-2024-001</span>
            <span class="text-gray-500 ml-2">（待审核）</span>
          </div>
          <div class="text-gray-600">
            <span class="font-medium">缺材料单示例：</span>
            <span class="text-red-600 cursor-pointer hover:underline" @click="goToTicket('t2')">REQ-2024-002</span>
            <span class="text-gray-500 ml-2">（材料缺失）</span>
          </div>
        </div>
        <div class="space-y-2">
          <div class="text-gray-600">
            <span class="font-medium">超时单示例：</span>
            <span class="text-red-600 cursor-pointer hover:underline" @click="goToTicket('t3')">REQ-2024-003</span>
            <span class="text-gray-500 ml-2">（超时未处理）</span>
          </div>
          <div class="text-gray-600">
            <span class="font-medium">退回单示例：</span>
            <span class="text-orange-600 cursor-pointer hover:underline" @click="goToTicket('t4')">REQ-2024-004</span>
            <span class="text-gray-500 ml-2">（退回补正）</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const stats = ref<any>(null);
const { get } = useApi();
const router = useRouter();

const loadStats = async () => {
  try {
    const res: any = await get('/dashboard/stats');
    stats.value = res.data;
  } catch (e) {
    console.error('加载统计数据失败', e);
  }
};

const goToTicket = (id: string) => {
  router.push(`/ticket/${id}`);
};

onMounted(() => {
  loadStats();
});
</script>
