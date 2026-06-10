<template>
  <div class="page-container">
    <h1 class="page-title">审计日志</h1>

    <div class="card p-4 mb-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label class="label">订单编号</label>
          <input v-model="filters.orderId" class="input" placeholder="输入订单ID" />
        </div>
        <div>
          <label class="label">操作类型</label>
          <select v-model="filters.action" class="input">
            <option value="">全部操作</option>
            <option v-for="(label, key) in AuditActionLabels" :key="key" :value="key">
              {{ label }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">操作结果</label>
          <select v-model="filters.success" class="input">
            <option value="">全部</option>
            <option value="true">成功</option>
            <option value="false">失败</option>
          </select>
        </div>
        <div class="flex items-end">
          <button class="btn btn-primary w-full" @click="loadLogs">查询</button>
        </div>
      </div>
    </div>

    <div class="card overflow-hidden">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>操作人</th>
            <th>操作类型</th>
            <th>描述</th>
            <th>关联订单</th>
            <th>结果</th>
            <th>失败原因</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td class="text-gray-500 text-sm whitespace-nowrap">
              {{ formatDate(log.createdAt) }}
            </td>
            <td>{{ log.user?.name || '-' }}</td>
            <td>
              <span class="badge" :class="log.success ? 'badge-success' : 'badge-error'">
                {{ AuditActionLabels[log.action] }}
              </span>
            </td>
            <td class="max-w-md truncate">{{ log.description || '-' }}</td>
            <td>
              <span
                v-if="log.orderId"
                class="text-blue-600 cursor-pointer text-sm"
                @click="viewOrder(log.orderId)"
              >
                查看
              </span>
              <span v-else>-</span>
            </td>
            <td>
              <span :class="log.success ? 'text-green-600' : 'text-red-600'">
                {{ log.success ? '成功' : '失败' }}
              </span>
            </td>
            <td class="max-w-xs">
              <span v-if="log.failReason" class="text-red-600 text-sm">{{ log.failReason }}</span>
              <span v-else class="text-gray-400">-</span>
            </td>
          </tr>
          <tr v-if="logs.length === 0">
            <td colspan="7" class="text-center text-gray-400 py-8">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { AuditActionLabels } from '~/types';
import type { AuditLog, AuditAction } from '~/types';

const api = useApi();

const logs = ref<AuditLog[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const filters = reactive({
  orderId: '',
  action: '' as AuditAction | '',
  success: '' as '' | 'true' | 'false',
});

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
};

const loadLogs = async () => {
  try {
    const params: any = {
      page: page.value,
      pageSize: pageSize.value,
    };
    if (filters.orderId) params.orderId = filters.orderId;
    if (filters.action) params.action = filters.action;
    if (filters.success) params.success = filters.success;

    const result = await api.get<any>('/audit-logs', params);
    logs.value = result.data;
    total.value = result.total;
  } catch (e) {
    console.error('加载审计日志失败:', e);
  }
};

const viewOrder = (orderId: string) => {
  navigateTo(`/orders/${orderId}`);
};

const changePage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) {
    page.value = p;
    loadLogs();
  }
};

onMounted(() => {
  loadLogs();
});
</script>
