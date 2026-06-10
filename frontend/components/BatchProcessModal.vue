<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content p-6" style="max-width: 720px">
      <h3 class="text-lg font-bold mb-4">批量处理</h3>

      <p class="text-gray-600 mb-4">
        已选择 <span class="font-bold text-blue-600">{{ selectedIds.length }}</span> 条订单
      </p>

      <div class="form-group">
        <label class="label">操作类型</label>
        <select v-model="selectedAction" class="input">
          <option value="">请选择操作</option>
          <option v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div v-if="needReason" class="form-group">
        <label class="label">原因/备注</label>
        <textarea v-model="reason" class="input" rows="3" :placeholder="reasonPlaceholder"></textarea>
      </div>

      <div v-if="loading" class="text-center py-4 text-gray-500">处理中...</div>

      <div v-if="result" class="mt-4 p-4 bg-gray-50 rounded-md space-y-3">
        <div class="flex gap-6 mb-2">
          <p class="text-green-600 font-medium">成功：{{ result.successCount }} 条</p>
          <p class="text-red-600 font-medium">失败：{{ result.failedCount }} 条</p>
        </div>

        <div v-if="result.results && result.results.length > 0" class="space-y-2 max-h-[45vh] overflow-y-auto">
          <div
            v-for="(r, idx) in result.results"
            :key="idx"
            class="p-3 rounded text-sm border"
            :class="r.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'"
          >
            <div class="flex items-center gap-2 mb-1">
              <span
                class="inline-block w-5 h-5 rounded-full text-center text-white text-xs leading-5 flex-shrink-0"
                :class="r.success ? 'bg-green-500' : 'bg-red-500'"
              >
                {{ r.success ? '✓' : '✗' }}
              </span>
              <span class="font-medium">{{ r.orderNo || r.id }}</span>
              <span v-if="r.action" class="text-gray-500 text-xs">操作：{{ actionLabel(r.action) }}</span>
            </div>

            <div v-if="r.success" class="ml-7 text-green-700">
              <span>{{ beforeStatusLabel(r.beforeStatus) }} → {{ beforeStatusLabel(r.afterStatus) }}</span>
              <span v-if="r.operatorName" class="text-gray-400 ml-2 text-xs">操作者：{{ r.operatorName }}</span>
            </div>

            <div v-else class="ml-7">
              <div class="flex items-center gap-2">
                <span class="inline-block px-1.5 py-0.5 rounded text-xs font-medium" :class="failTypeClass(r.reason)">
                  {{ failTypeLabel(r.reason) }}
                </span>
                <span class="text-red-700">{{ r.reason }}</span>
              </div>
              <div class="mt-1 text-gray-500 text-xs flex gap-4">
                <span v-if="r.beforeStatus">状态：{{ beforeStatusLabel(r.beforeStatus) }}</span>
                <span v-if="r.operatorName">操作者：{{ r.operatorName }}（{{ roleLabel(r.operatorRole) }}）</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <button class="btn btn-default" @click="$emit('close')">关闭</button>
        <button
          v-if="!result"
          class="btn btn-primary"
          :disabled="!selectedAction || loading"
          @click="handleBatch"
        >
          确认处理
        </button>
        <button v-else class="btn btn-primary" @click="$emit('success')">完成</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { OrderStatusLabels } from '~/types';

interface BatchResultItem {
  id: string;
  orderNo: string;
  action: string;
  success: boolean;
  reason?: string;
  beforeStatus?: string;
  afterStatus?: string;
  operatorRole?: string;
  operatorName?: string;
}

interface BatchResult {
  successCount: number;
  failedCount: number;
  results: BatchResultItem[];
}

const props = defineProps<{
  selectedIds: string[];
  actionOptions: { value: string; label: string; needReason?: boolean }[];
}>();

const emit = defineEmits<{
  close: [];
  success: [];
}>();

const selectedAction = ref('');
const reason = ref('');
const loading = ref(false);
const result = ref<BatchResult | null>(null);

const needReason = computed(() => {
  const opt = props.actionOptions.find(o => o.value === selectedAction.value);
  return opt?.needReason;
});

const reasonPlaceholder = computed(() => {
  if (selectedAction.value.includes('reject') || selectedAction.value.includes('return')) {
    return '请输入退回原因';
  }
  if (selectedAction.value === 'materials_missing') {
    return '请输入缺失材料说明';
  }
  if (selectedAction.value === 'timeout') {
    return '请输入超时原因';
  }
  if (selectedAction.value === 'exception') {
    return '请输入异常原因';
  }
  return '请输入备注';
});

const actionLabel = (action: string) => {
  const map: Record<string, string> = {
    submit: '提交审核', review_approve: '审核通过', review_reject: '审核退回',
    submit_final: '提交复核', final_approve: '复核通过', final_reject: '复核退回',
    ship: '发货', deliver: '配送', sign: '签收', archive: '归档',
    exception: '标记异常', materials_missing: '材料缺失', timeout: '标记超时',
    return: '退回', rectify: '补正',
  };
  return map[action] || action;
};

const beforeStatusLabel = (status?: string) => {
  if (!status) return '-';
  return (OrderStatusLabels as any)[status] || status;
};

const roleLabel = (role?: string) => {
  const map: Record<string, string> = {
    registrar: '登记员', supervisor: '主管', reviewer: '复核负责人',
  };
  return map[role || ''] || role || '-';
};

const failTypeLabel = (reason?: string) => {
  if (!reason) return '未知';
  if (reason.includes('权限')) return '权限拒绝';
  if (reason.includes('状态') || reason.includes('无法')) return '状态不匹配';
  if (reason.includes('不能为空') || reason.includes('缺少')) return '缺少原因';
  return '操作失败';
};

const failTypeClass = (reason?: string) => {
  if (!reason) return 'bg-gray-100 text-gray-600';
  if (reason.includes('权限')) return 'bg-orange-100 text-orange-700';
  if (reason.includes('状态') || reason.includes('无法')) return 'bg-yellow-100 text-yellow-700';
  if (reason.includes('不能为空') || reason.includes('缺少')) return 'bg-purple-100 text-purple-700';
  return 'bg-red-100 text-red-700';
};

const api = useApi();

const handleBatch = async () => {
  if (!selectedAction.value) return;
  if (needReason.value && !reason.value) {
    alert('请填写原因');
    return;
  }

  loading.value = true;
  try {
    const res = await api.post<BatchResult>('/orders/batch', {
      ids: props.selectedIds,
      action: selectedAction.value,
      reason: reason.value || undefined,
    });
    result.value = res;
  } catch (e: any) {
    alert(e.data?.message || '操作失败');
  } finally {
    loading.value = false;
  }
};
</script>
