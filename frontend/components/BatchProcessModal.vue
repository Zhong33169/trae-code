<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content p-6" style="max-width: 500px">
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

      <div v-if="result" class="mt-4 p-4 bg-gray-50 rounded-md">
        <p class="text-green-600 font-medium mb-2">成功：{{ result.success.length }} 条</p>
        <p class="text-red-600 font-medium mb-2">失败：{{ result.failed.length }} 条</p>
        <div v-if="result.failed.length > 0" class="text-sm text-red-500 space-y-1">
          <div v-for="(f, idx) in result.failed" :key="idx">
            {{ f.id }}：{{ f.reason }}
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
const result = ref<{ success: string[]; failed: { id: string; reason: string }[] } | null>(null);

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

const api = useApi();

const handleBatch = async () => {
  if (!selectedAction.value) return;
  if (needReason.value && !reason.value) {
    alert('请填写原因');
    return;
  }

  loading.value = true;
  try {
    const res = await api.post('/orders/batch', {
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
