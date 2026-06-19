<template>
  <div class="bg-white rounded-lg shadow">
    <div class="p-4 border-b border-gray-200 flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
      <button
        v-if="showCreate && isRegistrar"
        @click="$emit('create')"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
      >
        新建需求单
      </button>
    </div>
    
    <div class="p-4 border-b border-gray-200 flex items-center gap-4 flex-wrap">
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-600">状态：</label>
        <select v-model="filters.status" @change="loadData" class="border border-gray-300 rounded px-3 py-1.5 text-sm">
          <option value="">全部</option>
          <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
      </div>
      
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-600">异常：</label>
        <select v-model="filters.is_abnormal" @change="loadData" class="border border-gray-300 rounded px-3 py-1.5 text-sm">
          <option value="">全部</option>
          <option value="1">仅异常</option>
          <option value="0">仅正常</option>
        </select>
      </div>
      
      <div class="flex items-center gap-2 flex-1 max-w-md">
        <input
          v-model="filters.keyword"
          @keyup.enter="loadData"
          type="text"
          placeholder="搜索单号、标题、客户..."
          class="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
        />
        <button @click="loadData" class="px-4 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
          搜索
        </button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单号</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">优先级</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">截止日期</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr
            v-for="ticket in tickets"
            :key="ticket.id"
            @click="goToDetail(ticket.id)"
            class="hover:bg-gray-50 cursor-pointer"
          >
            <td class="px-4 py-3 whitespace-nowrap">
              <span class="text-sm font-medium text-blue-600">{{ ticket.ticket_no }}</span>
              <span v-if="ticket.is_abnormal" class="abnormal-badge ml-2">异常</span>
            </td>
            <td class="px-4 py-3">
              <div class="text-sm text-gray-900">{{ ticket.title }}</div>
              <div v-if="ticket.source === 'offline_import'" class="text-xs text-gray-500 mt-1">
                来源：离线导入
              </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{{ ticket.customer_name }}</td>
            <td class="px-4 py-3 whitespace-nowrap">
              <span class="status-tag" :class="ticket.status_color">{{ ticket.status_label }}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm">
              <span :class="priorityClass(ticket.priority)">{{ priorityLabel(ticket.priority) }}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{{ ticket.deadline }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{{ ticket.created_at }}</td>
          </tr>
          <tr v-if="tickets.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-gray-500">
              暂无数据
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Ticket {
  id: string;
  ticket_no: string;
  title: string;
  customer_name: string;
  status: string;
  status_label: string;
  status_color: string;
  priority: string;
  deadline: string;
  created_at: string;
  is_abnormal: number;
  source: string;
}

const props = defineProps<{
  title: string;
  stage?: string;
  showCreate?: boolean;
}>();

const emit = defineEmits<{
  (e: 'create'): void;
}>();

const tickets = ref<Ticket[]>([]);
const statusOptions = ref<any[]>([]);
const { get } = useApi();
const router = useRouter();
const { isRegistrar } = useAuth();

const filters = ref({
  status: '',
  is_abnormal: '',
  keyword: '',
});

const loadStatusOptions = async () => {
  try {
    const res: any = await get('/status-options');
    statusOptions.value = res.data.statuses;
  } catch (e) {
    console.error('加载状态选项失败', e);
  }
};

const loadData = async () => {
  try {
    const params: any = {};
    if (props.stage) params.stage = props.stage;
    if (filters.value.status) params.status = filters.value.status;
    if (filters.value.is_abnormal !== '') params.is_abnormal = filters.value.is_abnormal;
    if (filters.value.keyword) params.keyword = filters.value.keyword;
    
    const res: any = await get('/tickets', params);
    tickets.value = res.data;
  } catch (e) {
    console.error('加载需求单失败', e);
  }
};

const goToDetail = (id: string) => {
  router.push(`/ticket/${id}`);
};

const priorityLabel = (p: string) => {
  const map: Record<string, string> = { high: '高', medium: '中', low: '低' };
  return map[p] || p;
};

const priorityClass = (p: string) => {
  const map: Record<string, string> = {
    high: 'text-red-600 font-medium',
    medium: 'text-orange-600',
    low: 'text-gray-600',
  };
  return map[p] || '';
};

onMounted(() => {
  loadStatusOptions();
  loadData();
});

defineExpose({ loadData });
</script>
