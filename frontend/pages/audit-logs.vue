<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">审计日志</h2>
    </div>

    <div class="bg-white rounded-lg shadow">
      <div class="p-4 border-b border-gray-200 flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600">失败记录：</label>
          <select v-model="filters.is_failure" @change="loadLogs" class="border border-gray-300 rounded px-3 py-1.5 text-sm">
            <option value="">全部</option>
            <option value="1">仅失败</option>
            <option value="0">仅成功</option>
          </select>
        </div>
        <div class="flex items-center gap-2 flex-1 max-w-md">
          <input
            v-model="filters.keyword"
            @keyup.enter="loadLogs"
            type="text"
            placeholder="搜索操作、详情、操作人..."
            class="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
          <button @click="loadLogs" class="px-4 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
            搜索
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">需求单</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作人</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">详情</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{{ log.created_at }}</td>
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ log.action }}</td>
              <td class="px-4 py-3 text-sm">
                <span v-if="log.ticket_no" class="text-blue-600 cursor-pointer hover:underline" @click="goToTicket(log.ticket_id)">
                  {{ log.ticket_no }}
                </span>
                <span v-else class="text-gray-400">-</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ log.operator_name }}</td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ log.operator_role_label }}</td>
              <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" :title="log.detail">
                {{ log.detail }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span
                  v-if="log.is_failure"
                  class="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700"
                >
                  失败
                </span>
                <span v-else class="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                  成功
                </span>
              </td>
            </tr>
            <tr v-if="logs.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                暂无日志
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showFailureDetail" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold">失败原因详情</h3>
        </div>
        <div class="p-4">
          <p class="text-sm text-gray-700">{{ selectedFailureReason }}</p>
        </div>
        <div class="p-4 border-t border-gray-200 flex justify-end">
          <button @click="showFailureDetail = false" class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const logs = ref<any[]>([]);
const showFailureDetail = ref(false);
const selectedFailureReason = ref('');
const { get } = useApi();
const router = useRouter();

const filters = ref({
  is_failure: '',
  keyword: '',
});

const loadLogs = async () => {
  try {
    const params: any = {};
    if (filters.value.is_failure !== '') params.is_failure = filters.value.is_failure;
    if (filters.value.keyword) params.keyword = filters.value.keyword;
    
    const res: any = await get('/audit-logs', params);
    logs.value = res.data;
  } catch (e) {
    console.error('加载审计日志失败', e);
  }
};

const goToTicket = (id: string) => {
  router.push(`/ticket/${id}`);
};

const viewFailure = (reason: string) => {
  selectedFailureReason.value = reason;
  showFailureDetail.value = true;
};

onMounted(() => {
  loadLogs();
});
</script>
