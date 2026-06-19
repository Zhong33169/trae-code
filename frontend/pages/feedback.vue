<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-gray-900">需求反馈</h2>
    </div>
    
    <TicketList
      ref="listRef"
      title="需求反馈阶段"
      stage="feedback"
      :show-create="true"
      @create="showCreateModal = true"
    />

    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div class="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold">新建需求单</h3>
          <button @click="showCreateModal = false" class="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
            <input v-model="form.title" type="text" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea v-model="form.description" rows="3" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">客户名称</label>
              <input v-model="form.customer_name" type="text" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">客户联系方式</label>
              <input v-model="form.customer_contact" type="text" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">优先级</label>
              <select v-model="form.priority" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">产品版本</label>
              <input v-model="form.product_version" type="text" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
            <input v-model="form.deadline" type="date" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
        </div>
        <div class="p-4 border-t border-gray-200 flex justify-end gap-3">
          <button @click="showCreateModal = false" class="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
            取消
          </button>
          <button @click="handleCreate" class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            创建
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const listRef = ref<any>(null);
const showCreateModal = ref(false);
const { post } = useApi();

const form = ref({
  title: '',
  description: '',
  customer_name: '',
  customer_contact: '',
  priority: 'medium',
  product_version: '',
  deadline: '',
});

const handleCreate = async () => {
  if (!form.value.title) {
    alert('请输入标题');
    return;
  }
  
  try {
    await post('/tickets', form.value);
    showCreateModal.value = false;
    form.value = {
      title: '',
      description: '',
      customer_name: '',
      customer_contact: '',
      priority: 'medium',
      product_version: '',
      deadline: '',
    };
    listRef.value?.loadData();
  } catch (e: any) {
    alert(e?.data?.error || '创建失败');
  }
};
</script>
