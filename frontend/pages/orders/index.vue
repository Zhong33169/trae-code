<template>
  <div class="page-container">
    <div class="flex items-center justify-between mb-6">
      <h1 class="page-title mb-0">团购订单管理</h1>
      <div class="flex gap-3">
        <button
          v-if="authStore.isRegistrar"
          class="btn btn-primary"
          @click="showCreateModal = true"
        >
          + 新建订单
        </button>
        <button
          v-if="canBatchAction"
          class="btn btn-default"
          :disabled="selectedIds.length === 0"
          @click="showBatchModal = true"
        >
          批量处理 ({{ selectedIds.length }})
        </button>
      </div>
    </div>

    <div class="card p-4 mb-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label class="label">订单编号</label>
          <input v-model="filters.keyword" class="input" placeholder="输入订单编号搜索" />
        </div>
        <div>
          <label class="label">状态</label>
          <select v-model="filters.status" class="input">
            <option value="">全部状态</option>
            <option v-for="(label, key) in OrderStatusLabels" :key="key" :value="key">
              {{ label }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">来源</label>
          <select v-model="filters.source" class="input">
            <option value="">全部来源</option>
            <option v-for="(label, key) in OrderSourceLabels" :key="key" :value="key">
              {{ label }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">异常单</label>
          <select v-model="filters.hasException" class="input">
            <option value="">全部</option>
            <option value="true">仅异常单</option>
            <option value="false">仅正常单</option>
          </select>
        </div>
      </div>
      <div class="flex justify-end gap-3">
        <button class="btn btn-default" @click="resetFilters">重置</button>
        <button class="btn btn-primary" @click="loadOrders">查询</button>
      </div>
    </div>

    <div class="tabs mb-4">
      <div
        v-for="tab in statusTabs"
        :key="tab.value"
        class="tab"
        :class="{ active: activeTab === tab.value }"
        @click="setActiveTab(tab.value)"
      >
        {{ tab.label }}
      </div>
    </div>

    <div class="card overflow-hidden">
      <table>
        <thead>
          <tr>
            <th class="w-10">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate="someSelected"
                @change="toggleAll"
              />
            </th>
            <th>订单编号</th>
            <th>社区名称</th>
            <th>联系人</th>
            <th>商品数量</th>
            <th>总金额</th>
            <th>状态</th>
            <th>来源</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td>
              <input
                type="checkbox"
                :checked="selectedIds.includes(order.id)"
                @change="toggleSelection(order.id)"
              />
            </td>
            <td class="font-mono text-sm text-blue-600 cursor-pointer" @click="viewOrder(order.id)">
              {{ order.orderNo }}
            </td>
            <td>{{ order.communityName }}</td>
            <td>{{ order.contactName || '-' }}</td>
            <td>{{ order.totalQuantity }} 件</td>
            <td class="font-medium">¥{{ order.totalAmount.toFixed(2) }}</td>
            <td>
              <span class="badge" :class="getStatusBadgeClass(order.status)">
                {{ OrderStatusLabels[order.status] }}
              </span>
            </td>
            <td>
              <span class="badge" :class="order.source === 'offline_import' ? 'badge-warning' : 'badge-info'">
                {{ OrderSourceLabels[order.source] }}
              </span>
            </td>
            <td class="text-gray-500 text-sm">
              {{ formatDate(order.createdAt) }}
            </td>
            <td>
              <button class="text-blue-600 hover:text-blue-800 text-sm mr-3" @click="viewOrder(order.id)">
                详情
              </button>
            </td>
          </tr>
          <tr v-if="orders.length === 0">
            <td colspan="10" class="text-center text-gray-400 py-8">
              暂无数据
            </td>
          </tr>
        </tbody>
      </table>

      <div class="flex items-center justify-between p-4 border-t">
        <span class="text-sm text-gray-500">共 {{ total }} 条</span>
        <div class="flex gap-2">
          <button
            class="btn btn-default text-sm"
            :disabled="page <= 1"
            @click="changePage(page - 1)"
          >
            上一页
          </button>
          <span class="px-3 py-2 text-sm">第 {{ page }} / {{ totalPages }} 页</span>
          <button
            class="btn btn-default text-sm"
            :disabled="page >= totalPages"
            @click="changePage(page + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <OrderCreateModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @success="handleCreateSuccess"
    />

    <BatchProcessModal
      v-if="showBatchModal"
      :selected-ids="selectedIds"
      :action-options="batchActionOptions"
      @close="showBatchModal = false"
      @success="handleBatchSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { OrderStatusLabels, OrderSourceLabels, OrderStatus } from '~/types';
import type { Order } from '~/types';

const authStore = useAuthStore();
const api = useApi();

const orders = ref<Order[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);

const filters = reactive({
  keyword: '',
  status: '',
  source: '',
  hasException: '',
});

const activeTab = ref('all');

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '待我处理', value: 'pending' },
  { label: '正常单', value: 'normal' },
  { label: '异常单', value: 'exception' },
  { label: '离线导入', value: 'offline' },
];

const selectedIds = ref<string[]>([]);

const showCreateModal = ref(false);
const showBatchModal = ref(false);

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1);

const allSelected = computed(() => orders.value.length > 0 && orders.value.every(o => selectedIds.value.includes(o.id)));
const someSelected = computed(() => selectedIds.value.length > 0 && !allSelected.value);

const canBatchAction = computed(() => {
  return authStore.isSupervisor || authStore.isReviewer;
});

const batchActionOptions = computed(() => {
  const options: { value: string; label: string; needReason?: boolean }[] = [];

  if (authStore.isSupervisor) {
    options.push({ value: 'review_approve', label: '批量审核通过' });
    options.push({ value: 'review_reject', label: '批量审核退回', needReason: true });
    options.push({ value: 'ship', label: '批量发货' });
    options.push({ value: 'deliver', label: '批量配送' });
    options.push({ value: 'materials_missing', label: '标记材料缺失', needReason: true });
    options.push({ value: 'timeout', label: '标记超时', needReason: true });
    options.push({ value: 'return', label: '批量退回', needReason: true });
    options.push({ value: 'rectify', label: '批量补正' });
  }

  if (authStore.isReviewer) {
    options.push({ value: 'final_approve', label: '批量复核通过' });
    options.push({ value: 'final_reject', label: '批量复核退回', needReason: true });
    options.push({ value: 'archive', label: '批量归档' });
  }

  return options;
});

const setActiveTab = (tab: string) => {
  activeTab.value = tab;
  page.value = 1;

  switch (tab) {
    case 'pending':
      if (authStore.isRegistrar) {
        filters.status = '';
      } else if (authStore.isSupervisor) {
        filters.status = 'pending_review';
      } else if (authStore.isReviewer) {
        filters.status = 'pending_final_review';
      }
      filters.hasException = '';
      filters.source = '';
      break;
    case 'normal':
      filters.hasException = 'false';
      filters.status = '';
      filters.source = '';
      break;
    case 'exception':
      filters.hasException = 'true';
      filters.status = '';
      filters.source = '';
      break;
    case 'offline':
      filters.source = 'offline_import';
      filters.status = '';
      filters.hasException = '';
      break;
    default:
      filters.status = '';
      filters.source = '';
      filters.hasException = '';
  }

  loadOrders();
};

const getStatusBadgeClass = (status: OrderStatus): string => {
  const successStatuses: OrderStatus[] = ['signed', 'archived', 'final_approved', 'review_approved'];
  const warningStatuses: OrderStatus[] = ['pending_review', 'pending_final_review', 'shipped', 'delivered', 'processing'];
  const errorStatuses: OrderStatus[] = ['review_rejected', 'final_rejected', 'returned', 'exception', 'materials_missing', 'timeout'];
  const draftStatuses: OrderStatus[] = ['draft'];

  if (successStatuses.includes(status)) return 'badge-success';
  if (warningStatuses.includes(status)) return 'badge-warning';
  if (errorStatuses.includes(status)) return 'badge-error';
  if (draftStatuses.includes(status)) return 'badge-draft';
  return 'badge-info';
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const loadOrders = async () => {
  loading.value = true;
  try {
    const params: any = {
      page: page.value,
      pageSize: pageSize.value,
    };

    if (filters.keyword) params.keyword = filters.keyword;
    if (filters.status) params.status = filters.status;
    if (filters.source) params.source = filters.source;
    if (filters.hasException) params.hasException = filters.hasException;

    const result = await api.get<any>('/orders', params);
    orders.value = result.data;
    total.value = result.total;
  } catch (e) {
    console.error('加载订单失败:', e);
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.keyword = '';
  filters.status = '';
  filters.source = '';
  filters.hasException = '';
  activeTab.value = 'all';
  page.value = 1;
  loadOrders();
};

const changePage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) {
    page.value = p;
    loadOrders();
  }
};

const viewOrder = (id: string) => {
  navigateTo(`/orders/${id}`);
};

const toggleSelection = (id: string) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx > -1) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
};

const toggleAll = () => {
  if (allSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = orders.value.map(o => o.id);
  }
};

const handleCreateSuccess = () => {
  showCreateModal.value = false;
  loadOrders();
};

const handleBatchSuccess = () => {
  showBatchModal.value = false;
  selectedIds.value = [];
  loadOrders();
};

onMounted(() => {
  if (authStore.isLoggedIn) {
    loadOrders();
  }
});

watch(
  () => authStore.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) {
      loadOrders();
    }
  }
);
</script>
