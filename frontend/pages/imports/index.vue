<template>
  <div class="page-container">
    <div class="flex items-center justify-between mb-6">
      <h1 class="page-title mb-0">离线台账回填</h1>
      <div class="flex gap-3">
        <button
          v-if="authStore.isRegistrar || authStore.isSupervisor"
          class="btn btn-primary"
          @click="showImportModal = true"
        >
          + 导入台账
        </button>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="card p-4">
        <p class="text-gray-500 text-sm">导入批次</p>
        <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats.totalBatches || 0 }}</p>
      </div>
      <div class="card p-4">
        <p class="text-gray-500 text-sm">总记录数</p>
        <p class="text-2xl font-bold text-blue-600 mt-1">{{ stats.totalRecords || 0 }}</p>
      </div>
      <div class="card p-4">
        <p class="text-gray-500 text-sm">成功导入</p>
        <p class="text-2xl font-bold text-green-600 mt-1">{{ stats.totalSuccess || 0 }}</p>
      </div>
      <div class="card p-4">
        <p class="text-gray-500 text-sm">冲突/失败</p>
        <p class="text-2xl font-bold text-red-600 mt-1">{{ (stats.totalFailed || 0) + (stats.totalConflict || 0) }}</p>
      </div>
    </div>

    <div class="card p-4 mb-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label class="label">批次编号</label>
          <input v-model="filters.keyword" class="input" placeholder="输入批次编号搜索" />
        </div>
        <div>
          <label class="label">状态</label>
          <select v-model="filters.status" class="input">
            <option value="">全部状态</option>
            <option v-for="(label, key) in ImportBatchStatusLabels" :key="key" :value="key">
              {{ label }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">来源</label>
          <select v-model="filters.source" class="input">
            <option value="">全部来源</option>
            <option v-for="(label, key) in ImportSourceLabels" :key="key" :value="key">
              {{ label }}
            </option>
          </select>
        </div>
        <div class="flex items-end">
          <button class="btn btn-primary w-full" @click="loadBatches">查询</button>
        </div>
      </div>
    </div>

    <div v-if="!selectedBatch" class="card overflow-hidden">
      <table>
        <thead>
          <tr>
            <th>批次编号</th>
            <th>文件名</th>
            <th>来源</th>
            <th>总记录数</th>
            <th>成功</th>
            <th>失败</th>
            <th>冲突</th>
            <th>状态</th>
            <th>导入人</th>
            <th>导入时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="batch in batches" :key="batch.id">
            <td class="font-mono text-sm text-blue-600 cursor-pointer" @click="viewBatch(batch.id)">
              {{ batch.batchNo }}
            </td>
            <td>{{ batch.filename }}</td>
            <td>{{ ImportSourceLabels[batch.source] }}</td>
            <td>{{ batch.totalRecords }}</td>
            <td class="text-green-600">{{ batch.successCount }}</td>
            <td class="text-red-600">{{ batch.failedCount }}</td>
            <td class="text-orange-600">{{ batch.conflictCount }}</td>
            <td>
              <span class="badge" :class="getBatchStatusBadgeClass(batch.status)">
                {{ ImportBatchStatusLabels[batch.status] }}
              </span>
            </td>
            <td>{{ batch.importedBy?.name || '-' }}</td>
            <td class="text-gray-500 text-sm">{{ formatDate(batch.createdAt) }}</td>
            <td>
              <button class="text-blue-600 hover:text-blue-800 text-sm" @click="viewBatch(batch.id)">
                查看详情
              </button>
            </td>
          </tr>
          <tr v-if="batches.length === 0">
            <td colspan="11" class="text-center text-gray-400 py-8">
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

    <div v-else class="card overflow-hidden">
      <div class="p-4 border-b flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button class="btn btn-default text-sm" @click="selectedBatch = null">
            ← 返回列表
          </button>
          <div>
            <h3 class="font-bold">{{ selectedBatch.batchNo }}</h3>
            <p class="text-sm text-gray-500">{{ selectedBatch.filename }}</p>
          </div>
          <span class="badge" :class="getBatchStatusBadgeClass(selectedBatch.status)">
            {{ ImportBatchStatusLabels[selectedBatch.status] }}
          </span>
        </div>
        <div class="flex gap-4 text-sm">
          <div>
            <span class="text-gray-500">总数：</span>
            <span class="font-medium">{{ selectedBatch.totalRecords }}</span>
          </div>
          <div>
            <span class="text-green-600">成功：</span>
            <span class="font-medium text-green-600">{{ selectedBatch.successCount }}</span>
          </div>
          <div>
            <span class="text-red-600">失败：</span>
            <span class="font-medium text-red-600">{{ selectedBatch.failedCount }}</span>
          </div>
          <div>
            <span class="text-orange-600">冲突：</span>
            <span class="font-medium text-orange-600">{{ selectedBatch.conflictCount }}</span>
          </div>
        </div>
      </div>

      <div class="p-4 border-b">
        <div class="flex gap-2">
          <button
            class="btn btn-default text-sm"
            :class="{ 'btn-primary': recordFilter === '' }"
            @click="recordFilter = ''"
          >
            全部
          </button>
          <button
            class="btn btn-default text-sm"
            :class="{ 'bg-green-50 text-green-600': recordFilter === 'success' }"
            @click="recordFilter = 'success'"
          >
            成功
          </button>
          <button
            class="btn btn-default text-sm"
            :class="{ 'bg-red-50 text-red-600': recordFilter === 'failed' }"
            @click="recordFilter = 'failed'"
          >
            失败
          </button>
          <button
            class="btn btn-default text-sm"
            :class="{ 'bg-orange-50 text-orange-600': recordFilter === 'conflict' }"
            @click="recordFilter = 'conflict'"
          >
            冲突
          </button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>行号</th>
            <th>源订单号</th>
            <th>社区名称</th>
            <th>状态</th>
            <th>失败/冲突原因</th>
            <th>关联订单</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in batchRecords" :key="record.id">
            <td>{{ record.rowNumber }}</td>
            <td class="font-mono text-sm">{{ record.sourceOrderNo || '-' }}</td>
            <td>{{ record.rawData?.communityName || '-' }}</td>
            <td>
              <span class="badge" :class="getRecordStatusBadgeClass(record.status)">
                {{ ImportRecordStatusLabels[record.status] }}
              </span>
            </td>
            <td class="max-w-xs">
              <span v-if="record.failReason" class="text-red-600 text-sm">{{ record.failReason }}</span>
              <span v-else-if="record.conflictDescription" class="text-orange-600 text-sm">{{ record.conflictDescription }}</span>
              <span v-else class="text-gray-400">-</span>
            </td>
            <td>
              <span
                v-if="record.orderId"
                class="text-blue-600 cursor-pointer text-sm"
                @click="viewOrder(record.orderId)"
              >
                查看订单
              </span>
              <span v-else class="text-gray-400">-</span>
            </td>
            <td>
              <button
                v-if="(record.status === 'failed' || record.status === 'conflict') && (authStore.isRegistrar || authStore.isSupervisor)"
                class="text-blue-600 hover:text-blue-800 text-sm"
                @click="retryRecord(record.id)"
              >
                重试
              </button>
            </td>
          </tr>
          <tr v-if="batchRecords.length === 0">
            <td colspan="7" class="text-center text-gray-400 py-8">
              暂无数据
            </td>
          </tr>
        </tbody>
      </table>

      <div class="flex items-center justify-between p-4 border-t">
        <span class="text-sm text-gray-500">共 {{ recordsTotal }} 条</span>
        <div class="flex gap-2">
          <button
            class="btn btn-default text-sm"
            :disabled="recordPage <= 1"
            @click="changeRecordPage(recordPage - 1)"
          >
            上一页
          </button>
          <span class="px-3 py-2 text-sm">第 {{ recordPage }} / {{ recordTotalPages }} 页</span>
          <button
            class="btn btn-default text-sm"
            :disabled="recordPage >= recordTotalPages"
            @click="changeRecordPage(recordPage + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <div v-if="showImportModal" class="modal-overlay" @click.self="showImportModal = false">
      <div class="modal-content p-6" style="max-width: 500px">
        <h3 class="text-lg font-bold mb-4">导入离线台账</h3>

        <div class="form-group">
          <label class="label">导入来源</label>
          <select v-model="importSource" class="input">
            <option value="excel">Excel 文件</option>
            <option value="csv">CSV 文件</option>
          </select>
        </div>

        <div class="form-group">
          <label class="label">选择文件</label>
          <div
            class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            @click="triggerFileInput"
            @dragover.prevent
            @drop.prevent="handleDrop"
          >
            <div v-if="importFile">
              <p class="font-medium text-blue-600">{{ importFile.name }}</p>
              <p class="text-sm text-gray-500 mt-1">{{ formatFileSize(importFile.size) }}</p>
            </div>
            <div v-else>
              <p class="text-4xl mb-2">📁</p>
              <p class="text-gray-500">点击或拖拽文件到此处</p>
              <p class="text-xs text-gray-400 mt-1">支持 .xlsx, .xls, .csv 格式</p>
            </div>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            accept=".xlsx,.xls,.csv"
            @change="handleFileChange"
          />
        </div>

        <div class="form-group">
          <label class="label">备注（可选）</label>
          <textarea v-model="importRemark" class="input" rows="2" placeholder="请输入备注"></textarea>
        </div>

        <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <p class="text-sm text-yellow-700 font-medium">导入说明：</p>
          <ul class="text-xs text-yellow-600 mt-1 space-y-1">
            <li>• Excel 第一行是表头，包含：订单编号、社区名称、联系人、联系电话、配送地址、商品名称、单价、数量、单位、备注</li>
            <li>• 同一订单的多个商品会自动合并</li>
            <li>• 已存在的线下订单不会重复导入（冲突跳过）</li>
            <li>• 线上订单与线下台账冲突时不会静默覆盖</li>
          </ul>
        </div>

        <div class="flex justify-end gap-3">
          <button class="btn btn-default" @click="showImportModal = false">取消</button>
          <button
            class="btn btn-primary"
            :disabled="!importFile || importing"
            @click="handleImport"
          >
            {{ importing ? '导入中...' : '开始导入' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { useAuthStore } from '~/stores/auth';
import {
  ImportBatchStatusLabels,
  ImportSourceLabels,
  ImportRecordStatusLabels,
} from '~/types';
import type { ImportBatch, ImportRecord, ImportBatchStatus, ImportSource, ImportRecordStatus } from '~/types';

const authStore = useAuthStore();
const api = useApi();

const batches = ref<ImportBatch[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const stats = ref<any>({});

const filters = reactive({
  keyword: '',
  status: '' as ImportBatchStatus | '',
  source: '' as ImportSource | '',
});

const selectedBatch = ref<ImportBatch | null>(null);
const batchRecords = ref<ImportRecord[]>([]);
const recordsTotal = ref(0);
const recordPage = ref(1);
const recordPageSize = ref(20);
const recordFilter = ref<ImportRecordStatus | ''>('');

const showImportModal = ref(false);
const importFile = ref<File | null>(null);
const importSource = ref<ImportSource>('excel');
const importRemark = ref('');
const importing = ref(false);

const fileInputRef = ref<HTMLInputElement | null>(null);

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1);
const recordTotalPages = computed(() => Math.ceil(recordsTotal.value / recordPageSize.value) || 1);

const getBatchStatusBadgeClass = (status: ImportBatchStatus): string => {
  switch (status) {
    case 'success': return 'badge-success';
    case 'partial_success': return 'badge-warning';
    case 'failed': return 'badge-error';
    case 'processing': return 'badge-info';
    default: return 'badge-draft';
  }
};

const getRecordStatusBadgeClass = (status: ImportRecordStatus): string => {
  switch (status) {
    case 'success': return 'badge-success';
    case 'failed': return 'badge-error';
    case 'conflict': return 'badge-warning';
    case 'skipped': return 'badge-draft';
    default: return 'badge-info';
  }
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

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const loadBatches = async () => {
  try {
    const params: any = {
      page: page.value,
      pageSize: pageSize.value,
    };
    if (filters.keyword) params.keyword = filters.keyword;
    if (filters.status) params.status = filters.status;
    if (filters.source) params.source = filters.source;

    const result = await api.get<any>('/imports/batches', params);
    batches.value = result.data;
    total.value = result.total;
  } catch (e) {
    console.error('加载导入批次失败:', e);
  }
};

const loadStats = async () => {
  try {
    stats.value = await api.get<any>('/imports/statistics/summary');
  } catch (e) {
    console.error('加载统计数据失败:', e);
  }
};

const viewBatch = async (id: string) => {
  try {
    selectedBatch.value = await api.get<ImportBatch>(`/imports/batches/${id}`);
    recordPage.value = 1;
    recordFilter.value = '';
    loadBatchRecords();
  } catch (e) {
    console.error('加载批次详情失败:', e);
  }
};

const loadBatchRecords = async () => {
  if (!selectedBatch.value) return;

  try {
    const params: any = {
      page: recordPage.value,
      pageSize: recordPageSize.value,
    };
    if (recordFilter.value) params.status = recordFilter.value;

    const result = await api.get<any>(`/imports/batches/${selectedBatch.value.id}/records`, params);
    batchRecords.value = result.data;
    recordsTotal.value = result.total;
  } catch (e) {
    console.error('加载导入记录失败:', e);
  }
};

const viewOrder = (orderId: string) => {
  navigateTo(`/orders/${orderId}`);
};

const changePage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) {
    page.value = p;
    loadBatches();
  }
};

const changeRecordPage = (p: number) => {
  if (p >= 1 && p <= recordTotalPages.value) {
    recordPage.value = p;
    loadBatchRecords();
  }
};

const retryRecord = async (recordId: string) => {
  if (!confirm('确定要重试这条记录吗？')) return;

  try {
    await api.post(`/imports/records/${recordId}/retry`);
    loadBatchRecords();
    if (selectedBatch.value) {
      viewBatch(selectedBatch.value.id);
    }
  } catch (e: any) {
    alert(e.data?.message || '重试失败');
  }
};

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    importFile.value = file;
  }
};

const handleDrop = (event: DragEvent) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    importFile.value = file;
  }
};

const handleImport = async () => {
  if (!importFile.value) return;

  importing.value = true;
  try {
    const formData = new FormData();
    formData.append('file', importFile.value);
    formData.append('source', importSource.value);
    formData.append('remark', importRemark.value);

    const result = await api.upload('/imports/upload', formData);

    showImportModal.value = false;
    importFile.value = null;
    importRemark.value = '';

    alert(`导入完成！成功 ${result.successCount} 条，失败 ${result.failedCount} 条，冲突 ${result.conflictCount} 条`);

    loadBatches();
    loadStats();
  } catch (e: any) {
    alert(e.data?.message || '导入失败');
  } finally {
    importing.value = false;
  }
};

watch(recordFilter, () => {
  recordPage.value = 1;
  loadBatchRecords();
});

onMounted(() => {
  loadBatches();
  loadStats();
});
</script>
