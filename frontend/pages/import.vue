<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">离线台账导入</h2>
      <button
        v-if="isRegistrar"
        @click="showImportModal = true"
        class="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
      >
        新建导入
      </button>
    </div>

    <div class="bg-white rounded-lg shadow">
      <div class="p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">导入批次列表</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">批次号</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">总数</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">成功</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">失败</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">冲突</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">导入人</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">导入时间</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="batch in batches" :key="batch.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-blue-600">{{ batch.batch_no }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ sourceLabel(batch.source) }}</td>
              <td class="px-4 py-3 text-sm text-gray-900">{{ batch.total_count }}</td>
              <td class="px-4 py-3 text-sm text-green-600">{{ batch.success_count }}</td>
              <td class="px-4 py-3 text-sm text-red-600">{{ batch.failure_count }}</td>
              <td class="px-4 py-3 text-sm text-orange-600">{{ batch.conflict_count }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ batch.imported_by }}</td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ batch.imported_at }}</td>
              <td class="px-4 py-3 text-sm">
                <button @click="viewDetail(batch.id)" class="text-blue-600 hover:underline">
                  查看详情
                </button>
              </td>
            </tr>
            <tr v-if="batches.length === 0">
              <td colspan="9" class="px-4 py-8 text-center text-gray-500">
                暂无导入批次
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showImportModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div class="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold">离线台账导入</h3>
          <button @click="showImportModal = false" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">导入来源</label>
            <select v-model="importForm.source" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
              <option value="offline_excel">离线 Excel 台账</option>
              <option value="offline_manual">手工录入</option>
              <option value="third_party">第三方系统</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">导入数据（JSON 格式）</label>
            <textarea
              v-model="importForm.ticketsJson"
              rows="12"
              class="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              placeholder='[
  {
    "ticket_no": "REQ-OFFLINE-001",
    "title": "测试需求",
    "description": "需求描述",
    "customer_name": "客户名称",
    "customer_contact": "联系方式",
    "priority": "medium",
    "product_version": "v1.0",
    "deadline": "2024-12-31"
  }
]'
            />
            <p class="text-xs text-gray-500 mt-1">
              请输入 JSON 数组格式的需求数据。包含 ticket_no, title, description, customer_name 等字段。
            </p>
          </div>

          <div class="bg-yellow-50 border border-yellow-200 rounded p-3">
            <h4 class="text-sm font-medium text-yellow-800 mb-1">冲突处理说明</h4>
            <ul class="text-xs text-yellow-700 space-y-1">
              <li>• 如果单号已存在且线上状态不是草稿，则标记为冲突，不覆盖</li>
              <li>• 重复回填时，只有草稿状态的需求单会被更新</li>
              <li>• 线下线上状态冲突时，不会静默覆盖，会记录冲突日志</li>
            </ul>
          </div>
        </div>
        <div class="p-4 border-t border-gray-200 flex justify-end gap-3">
          <button @click="showImportModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
            取消
          </button>
          <button @click="handleImport" class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            开始导入
          </button>
        </div>
      </div>
    </div>

    <div v-if="showDetailModal && selectedBatch" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
        <div class="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold">批次详情 - {{ selectedBatch.batch_no }}</h3>
          <button @click="showDetailModal = false" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-4 flex-1 overflow-y-auto">
          <div class="grid grid-cols-4 gap-4 mb-4">
            <div class="bg-gray-50 rounded p-3 text-center">
              <div class="text-2xl font-bold text-gray-900">{{ selectedBatch.total_count }}</div>
              <div class="text-xs text-gray-500">总数</div>
            </div>
            <div class="bg-green-50 rounded p-3 text-center">
              <div class="text-2xl font-bold text-green-600">{{ selectedBatch.success_count }}</div>
              <div class="text-xs text-green-600">成功</div>
            </div>
            <div class="bg-red-50 rounded p-3 text-center">
              <div class="text-2xl font-bold text-red-600">{{ selectedBatch.failure_count }}</div>
              <div class="text-xs text-red-600">失败</div>
            </div>
            <div class="bg-orange-50 rounded p-3 text-center">
              <div class="text-2xl font-bold text-orange-600">{{ selectedBatch.conflict_count }}</div>
              <div class="text-xs text-orange-600">冲突</div>
            </div>
          </div>

          <h4 class="font-medium text-gray-900 mb-2">导入明细</h4>
          <div class="space-y-2">
            <div
              v-for="record in selectedBatch.records"
              :key="record.id"
              class="border rounded p-3"
              :class="{
                'border-green-200 bg-green-50': record.status === 'success',
                'border-red-200 bg-red-50': record.status === 'failure',
                'border-orange-200 bg-orange-50': record.status === 'conflict',
              }"
            >
              <div class="flex items-center justify-between">
                <div class="font-medium text-sm">{{ record.source_ticket_no }}</div>
                <span
                  class="text-xs px-2 py-0.5 rounded"
                  :class="{
                    'bg-green-100 text-green-700': record.status === 'success',
                    'bg-red-100 text-red-700': record.status === 'failure',
                    'bg-orange-100 text-orange-700': record.status === 'conflict',
                  }"
                >
                  {{ record.result }}
                </span>
              </div>
              <div v-if="record.diff_detail" class="text-xs mt-1" :class="{
                'text-orange-700': record.status === 'conflict',
                'text-red-700': record.status === 'failure',
              }">
                差异说明：{{ record.diff_detail }}
              </div>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-gray-200 flex justify-end">
          <button @click="showDetailModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const batches = ref<any[]>([]);
const showImportModal = ref(false);
const showDetailModal = ref(false);
const selectedBatch = ref<any>(null);
const { get, post } = useApi();
const { isRegistrar } = useAuth();

const importForm = ref({
  source: 'offline_excel',
  ticketsJson: '',
});

const loadBatches = async () => {
  try {
    const res: any = await get('/import-batches');
    batches.value = res.data;
  } catch (e) {
    console.error('加载导入批次失败', e);
  }
};

const viewDetail = async (id: string) => {
  try {
    const res: any = await get(`/import-batches/${id}`);
    selectedBatch.value = res.data;
    showDetailModal.value = true;
  } catch (e) {
    console.error('加载批次详情失败', e);
  }
};

const handleImport = async () => {
  let tickets;
  try {
    tickets = JSON.parse(importForm.value.ticketsJson);
  } catch (e) {
    alert('JSON 格式错误，请检查');
    return;
  }

  if (!Array.isArray(tickets)) {
    alert('请输入 JSON 数组格式');
    return;
  }

  try {
    const res: any = await post('/import-batches', {
      source: importForm.value.source,
      tickets,
    });
    
    showImportModal.value = false;
    importForm.value = { source: 'offline_excel', ticketsJson: '' };
    
    selectedBatch.value = res.data;
    showDetailModal.value = true;
    
    await loadBatches();
  } catch (e: any) {
    alert(e?.data?.error || '导入失败');
  }
};

const sourceLabel = (s: string) => {
  const map: Record<string, string> = {
    offline_excel: '离线 Excel',
    offline_manual: '手工录入',
    third_party: '第三方系统',
  };
  return map[s] || s;
};

onMounted(() => {
  loadBatches();
});
</script>
