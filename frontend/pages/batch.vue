<template>
  <div class="batch-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">批量处理</h2>
        <p class="page-subtitle">批量审核和处理展期申请</p>
      </div>
    </div>

    <div class="batch-container">
      <div class="left-panel">
        <div class="card filter-card">
          <div class="filter-row">
            <div class="filter-item">
              <label class="filter-label">关键词</label>
              <input v-model="filters.keyword" type="text" class="filter-input" placeholder="申请编号/借款人" />
            </div>
            <div class="filter-item">
              <label class="filter-label">申请状态</label>
              <select v-model="filters.status" class="filter-select">
                <option value="">全部状态</option>
                <option v-if="isReviewer" value="pending_review">待审核</option>
                <option v-if="isFinalReviewer" value="review_approved">审核通过待复核</option>
                <option v-if="isFinalReviewer" value="final_approved">复核通过待归档</option>
              </select>
            </div>
            <div class="filter-item filter-actions">
              <button class="btn btn-primary" @click="handleSearch">搜索</button>
              <button class="btn btn-secondary" @click="handleReset">重置</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="table-header">
            <div class="select-info">
              <input 
                type="checkbox" 
                :checked="isAllSelected"
                @change="toggleSelectAll"
                class="checkbox"
              />
              <span>已选择 {{ selectedIds.length }} 项</span>
            </div>
          </div>
          <div class="table-wrapper" v-loading="loading">
            <table class="table table-small">
              <thead>
                <tr>
                  <th style="width: 40px;"></th>
                  <th>申请编号</th>
                  <th>借款人</th>
                  <th>展期天数</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in applicationList" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }">
                  <td>
                    <input 
                      type="checkbox" 
                      :checked="selectedIds.includes(item.id)"
                      @change="toggleSelect(item.id)"
                      class="checkbox"
                    />
                  </td>
                  <td class="link-text" @click="goToDetail(item.id)">{{ item.application_no }}</td>
                  <td>{{ item.borrower_name }}</td>
                  <td>{{ item.extension_days }} 天</td>
                  <td>
                    <span :class="['status-tag', `status-${item.status}`]">
                      {{ statusMap[item.status] }}
                    </span>
                  </td>
                </tr>
                <tr v-if="applicationList.length === 0 && !loading">
                  <td colspan="5" class="empty-row">暂无数据</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pagination">
            <span class="total-text">共 {{ total }} 条记录</span>
            <div class="pagination-btns">
              <button class="btn btn-secondary" :disabled="page <= 1 || loading" @click="prevPage">上一页</button>
              <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
              <button class="btn btn-secondary" :disabled="page >= totalPages || loading" @click="nextPage">下一页</button>
            </div>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="card operation-card">
          <h3 class="card-title">批量操作</h3>
          
          <div v-if="isReviewer" class="operation-section">
            <div class="section-label">审核操作</div>
            <div class="operation-btns">
              <button class="btn btn-primary btn-block" :disabled="selectedIds.length === 0 || processing" @click="handleBatchOperation('review_approve')">
                ✓ 批量审核通过
              </button>
              <button class="btn btn-reject btn-block" :disabled="selectedIds.length === 0 || processing" @click="showOpinionModal('review_reject')">
                ✕ 批量审核退回
              </button>
            </div>
          </div>

          <div v-if="isFinalReviewer" class="operation-section">
            <div class="section-label">复核操作</div>
            <div class="operation-btns">
              <button class="btn btn-primary btn-block" :disabled="selectedIds.length === 0 || processing" @click="handleBatchOperation('final_approve')">
                ✓ 批量复核通过
              </button>
              <button class="btn btn-reject btn-block" :disabled="selectedIds.length === 0 || processing" @click="showOpinionModal('final_reject')">
                ✕ 批量复核拒绝
              </button>
              <button class="btn btn-secondary btn-block" :disabled="selectedIds.length === 0 || processing" @click="handleBatchOperation('archive')">
                📦 批量归档
              </button>
            </div>
          </div>
        </div>

        <div class="card result-card" v-if="batchResult">
          <div class="result-header">
            <h3 class="card-title">处理结果</h3>
            <span class="result-task-no">{{ batchResult.task_no }}</span>
          </div>
          <div class="result-summary">
            <div class="result-stat success">
              <span class="stat-number">{{ batchResult.success_count || 0 }}</span>
              <span class="stat-label">成功</span>
            </div>
            <div class="result-stat fail">
              <span class="stat-number">{{ batchResult.failed_count || 0 }}</span>
              <span class="stat-label">失败</span>
            </div>
            <div class="result-stat total">
              <span class="stat-number">{{ batchResult.total_count || 0 }}</span>
              <span class="stat-label">总计</span>
            </div>
          </div>
          <div class="result-list">
            <div v-for="(item, index) in batchResult.items" :key="index" :class="['result-item', { 'result-item-fail': item.status !== 'success' }]">
              <div class="result-item-header">
                <div class="result-item-title">
                  <span class="result-app-no">{{ item.application_no }}</span>
                  <span class="result-borrower">{{ item.borrower_name }}</span>
                </div>
                <span :class="['result-status', item.status === 'success' ? 'success' : 'fail']">
                  {{ item.status_display }}
                </span>
              </div>
              <div v-if="item.status !== 'success'" class="result-item-detail">
                <div class="error-code">
                  <span class="detail-label">错误码：</span>
                  <span class="detail-value code">{{ item.error_code }}</span>
                </div>
                <div class="error-message">
                  <span class="detail-label">失败原因：</span>
                  <span class="detail-value">{{ item.error_message }}</span>
                </div>
                <div class="next-step">
                  <span class="detail-label">下一步建议：</span>
                  <span class="detail-value suggestion">{{ item.next_step }}</span>
                </div>
              </div>
              <div v-if="item.processed_at" class="result-item-time">
                处理时间：{{ formatDate(item.processed_at) }}
              </div>
            </div>
          </div>
        </div>

        <div class="card history-card">
          <div class="card-header">
            <h3 class="card-title">历史批量任务</h3>
          </div>
          <div class="history-list">
            <div v-for="task in batchTasks" :key="task.id" class="history-item" @click="viewTaskDetail(task)">
              <div class="history-item-header">
                <span class="history-task-id">{{ task.task_no }}</span>
                <span :class="['history-status', `status-${task.status}`]">{{ task.status_display }}</span>
              </div>
              <div class="history-item-info">
                <span>{{ task.action_display }}</span>
                <span>共 {{ task.total_count }} 项</span>
              </div>
              <div class="history-item-stats">
                <span class="stat-success">成功 {{ task.success_count }}</span>
                <span class="stat-fail">失败 {{ task.failed_count }}</span>
              </div>
              <div class="history-item-time">{{ formatDate(task.created_at) }}</div>
            </div>
            <div v-if="batchTasks.length === 0 && !historyLoading" class="empty-history">
              暂无历史任务
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ modalTitle }}</h3>
          <button class="modal-close" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <template v-if="modalType === 'opinion'">
            <label class="form-label">处理意见</label>
            <textarea v-model="opinionComment" class="form-textarea" placeholder="请输入处理意见..." rows="4"></textarea>
          </template>
          <template v-else-if="modalType === 'taskDetail' && selectedTaskDetail">
            <div class="task-detail">
              <div class="task-detail-item">
                <span class="detail-label">任务编号</span>
                <span class="detail-value">{{ selectedTaskDetail.task_no }}</span>
              </div>
              <div class="task-detail-item">
                <span class="detail-label">操作类型</span>
                <span class="detail-value">{{ selectedTaskDetail.action_display }}</span>
              </div>
              <div class="task-detail-item">
                <span class="detail-label">任务状态</span>
                <span :class="['status-tag', `status-${selectedTaskDetail.status}`]">{{ selectedTaskDetail.status_display }}</span>
              </div>
              <div class="task-detail-item">
                <span class="detail-label">创建时间</span>
                <span class="detail-value">{{ formatDate(selectedTaskDetail.created_at) }}</span>
              </div>
              <div class="task-detail-item">
                <span class="detail-label">处理数量</span>
                <span class="detail-value">共 {{ selectedTaskDetail.total_count }} 项，成功 {{ selectedTaskDetail.success_count }} 项，失败 {{ selectedTaskDetail.failed_count }} 项</span>
              </div>
              <div v-if="selectedTaskDetail.remark" class="task-detail-item">
                <span class="detail-label">备注</span>
                <span class="detail-value">{{ selectedTaskDetail.remark }}</span>
              </div>

              <div class="task-result-title">处理详情</div>
              <div class="task-result-list">
                <div v-for="(item, index) in selectedTaskDetail.items" :key="index" :class="['task-result-item', { 'task-result-fail': item.status !== 'success' }]">
                  <div class="task-result-header">
                    <div class="task-result-title-inner">
                      <span>{{ item.application_no }}</span>
                      <span class="task-result-borrower">{{ item.borrower_name }}</span>
                    </div>
                    <span :class="['result-status', item.status === 'success' ? 'success' : 'fail']">
                      {{ item.status_display }}
                    </span>
                  </div>
                  <div v-if="item.status !== 'success'" class="task-result-detail">
                    <div class="error-line">
                      <span class="error-label">错误码：</span>
                      <span class="error-code-val">{{ item.error_code }}</span>
                    </div>
                    <div class="error-line">
                      <span class="error-label">失败原因：</span>
                      <span>{{ item.error_message }}</span>
                    </div>
                    <div class="error-line suggestion-line">
                      <span class="error-label">下一步建议：</span>
                      <span>{{ item.next_step }}</span>
                    </div>
                  </div>
                  <div v-if="item.processed_at" class="task-result-time">
                    处理时间：{{ formatDate(item.processed_at) }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">关闭</button>
          <button v-if="modalType === 'opinion'" class="btn btn-primary" @click="confirmOpinion" :disabled="processing">
            {{ processing ? '处理中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore, type UserRole } from '~/stores/user'

definePageMeta({
  layout: 'default'
})

const { get, post } = useApi()
const userStore = useUserStore()

interface Application {
  id: number
  application_no: string
  borrower_name: string
  extension_days: number
  status: string
}

interface BatchResultItem {
  id: number
  application_id: number
  application_no: string
  borrower_name: string
  status: string
  status_display: string
  error_code: string
  error_message: string
  next_step: string
  processed_at: string
}

interface BatchResult {
  id: number
  task_no: string
  action: string
  action_display: string
  total_count: number
  success_count: number
  failed_count: number
  status: string
  status_display: string
  items: BatchResultItem[]
}

interface BatchTask {
  id: number
  task_no: string
  action: string
  action_display: string
  total_count: number
  success_count: number
  failed_count: number
  status: string
  status_display: string
  remark: string
  created_at: string
  completed_at: string
}

interface BatchTaskDetail extends BatchTask {
  items: BatchResultItem[]
}

const isReviewer = computed(() => userStore.hasRole(['reviewer'] as UserRole[]))
const isFinalReviewer = computed(() => userStore.hasRole(['final_reviewer'] as UserRole[]))

const filters = reactive({
  keyword: '',
  status: ''
})

const loading = ref(false)
const historyLoading = ref(false)
const processing = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const applicationList = ref<Application[]>([])
const selectedIds = ref<number[]>([])
const batchResult = ref<BatchResult | null>(null)
const batchTasks = ref<BatchTask[]>([])
const selectedTaskDetail = ref<BatchTaskDetail | null>(null)

const showModal = ref(false)
const modalType = ref<'opinion' | 'taskDetail'>('opinion')
const currentOperation = ref('')
const opinionComment = ref('')

const statusMap: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  review_approved: '审核通过待复核',
  returned_for_correction: '退回补正',
  final_approved: '复核通过待归档',
  rejected: '已拒绝',
  archived: '已归档'
}

const modalTitle = computed(() => {
  if (modalType.value === 'taskDetail') return '批量任务详情'
  switch (currentOperation.value) {
    case 'review_reject': return '批量审核退回'
    case 'final_reject': return '批量复核拒绝'
    default: return '批量操作'
  }
})

const isAllSelected = computed(() => {
  return applicationList.value.length > 0 && applicationList.value.every(item => selectedIds.value.includes(item.id))
})

const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const loadData = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: page.value,
      page_size: pageSize.value
    }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.status) params.status = filters.status

    const data = await get<{ items: Application[]; total: number }>('/applications', params)
    applicationList.value = data.items || []
    total.value = data.total || 0
  } catch (error) {
    console.error('Failed to load applications:', error)
  } finally {
    loading.value = false
  }
}

const loadBatchTasks = async () => {
  historyLoading.value = true
  try {
    const data = await get<{ items: BatchTask[] }>('/batch/tasks', { page_size: 10 })
    batchTasks.value = data.items || []
  } catch (error) {
    console.error('Failed to load batch tasks:', error)
  } finally {
    historyLoading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  selectedIds.value = []
  loadData()
}

const handleReset = () => {
  filters.keyword = ''
  filters.status = ''
  page.value = 1
  selectedIds.value = []
  loadData()
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = applicationList.value.map(item => item.id)
  }
}

const toggleSelect = (id: number) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

const showOpinionModal = (operation: string) => {
  if (selectedIds.value.length === 0) return
  currentOperation.value = operation
  opinionComment.value = ''
  modalType.value = 'opinion'
  showModal.value = true
}

const viewTaskDetail = async (task: BatchTask) => {
  selectedTaskDetail.value = null
  modalType.value = 'taskDetail'
  showModal.value = true
  try {
    const data = await get<BatchTaskDetail>(`/batch/tasks/${task.id}`)
    selectedTaskDetail.value = data
  } catch (error) {
    console.error('Failed to load task detail:', error)
  }
}

const closeModal = () => {
  showModal.value = false
  selectedTaskDetail.value = null
}

const confirmOpinion = () => {
  handleBatchOperation(currentOperation.value, opinionComment.value)
  closeModal()
}

const handleBatchOperation = async (operation: string, comment?: string) => {
  if (selectedIds.value.length === 0) return

  processing.value = true
  batchResult.value = null
  try {
    const data = await post<BatchResult>('/batch', {
      application_ids: selectedIds.value,
      action: operation,
      remark: comment || ''
    })
    batchResult.value = data
    selectedIds.value = []
    loadData()
    loadBatchTasks()
  } catch (error: any) {
    alert(error.message || '批量操作失败')
  } finally {
    processing.value = false
  }
}

const goToDetail = (id: number) => {
  navigateTo(`/applications/${id}`)
}

const prevPage = () => {
  if (page.value > 1) {
    page.value--
    loadData()
  }
}

const nextPage = () => {
  if (page.value < totalPages.value) {
    page.value++
    loadData()
  }
}

onMounted(() => {
  loadData()
  loadBatchTasks()
})
</script>

<style scoped>
.batch-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.page-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.batch-container {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  align-items: start;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 24px;
}

.filter-card {
  padding: 16px 20px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 160px;
}

.filter-label {
  font-size: 13px;
  color: #374151;
  font-weight: 500;
}

.filter-input,
.filter-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
  background: #fff;
}

.filter-input:focus,
.filter-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.filter-actions {
  flex-direction: row;
  gap: 8px;
  flex: none;
}

.checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.table-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.select-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #374151;
}

.table-wrapper {
  overflow-x: auto;
}

.table-small th,
.table-small td {
  padding: 10px 12px;
  font-size: 13px;
}

tbody tr.selected {
  background: #eff6ff;
}

.empty-row {
  text-align: center;
  color: #9ca3af;
  padding: 40px 0 !important;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}

.total-text {
  font-size: 13px;
  color: #6b7280;
}

.pagination-btns {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-info {
  font-size: 13px;
  color: #6b7280;
}

.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 16px 0;
}

.card-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.card-header .card-title {
  margin: 0;
}

.operation-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.operation-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.section-label {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 10px;
}

.operation-btns {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn-block {
  width: 100%;
}

.btn-reject {
  background: #fff;
  color: #ef4444;
  border: 1px solid #fecaca;
}

.btn-reject:hover:not(:disabled) {
  background: #fef2f2;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.result-header .card-title {
  margin: 0;
}

.result-task-no {
  font-size: 12px;
  color: #6b7280;
  font-family: monospace;
}

.result-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.result-stat {
  flex: 1;
  text-align: center;
  padding: 12px;
  border-radius: 8px;
}

.result-stat.success {
  background: #d1fae5;
}

.result-stat.fail {
  background: #fee2e2;
}

.stat-number {
  display: block;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.result-stat.success .stat-number {
  color: #059669;
}

.result-stat.fail .stat-number {
  color: #dc2626;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
}

.result-stat.total {
  background: #e0e7ff;
}

.result-stat.total .stat-number {
  color: #4f46e5;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 350px;
  overflow-y: auto;
}

.result-item {
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 4px solid #10b981;
}

.result-item.result-item-fail {
  background: #fef2f2;
  border-left-color: #ef4444;
}

.result-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.result-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-app-no {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.result-borrower {
  font-size: 12px;
  color: #6b7280;
}

.result-status {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 12px;
}

.result-status.success {
  background: #d1fae5;
  color: #059669;
}

.result-status.fail {
  background: #fee2e2;
  color: #dc2626;
}

.result-item-info {
  font-size: 12px;
  color: #6b7280;
}

.result-item-detail {
  background: #fff;
  border-radius: 6px;
  padding: 10px;
  margin-top: 8px;
  border: 1px solid #fecaca;
}

.result-item-detail .detail-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.result-item-detail .detail-value {
  font-size: 12px;
  color: #374151;
}

.result-item-detail .error-code,
.result-item-detail .error-message,
.result-item-detail .next-step {
  margin-bottom: 6px;
}

.result-item-detail .error-code:last-child,
.result-item-detail .error-message:last-child,
.result-item-detail .next-step:last-child {
  margin-bottom: 0;
}

.result-item-detail .detail-value.code {
  font-family: monospace;
  background: #fef2f2;
  padding: 2px 6px;
  border-radius: 4px;
  color: #dc2626;
  font-weight: 500;
}

.result-item-detail .detail-value.suggestion {
  color: #059669;
  font-weight: 500;
}

.result-item-time {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 6px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.history-item {
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-item:hover {
  background: #eff6ff;
}

.history-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.history-task-id {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  font-family: monospace;
}

.history-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
}

.history-item-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.history-item-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  margin-bottom: 4px;
}

.history-item-stats .stat-success {
  color: #059669;
}

.history-item-stats .stat-fail {
  color: #dc2626;
}

.history-item-time {
  font-size: 11px;
  color: #9ca3af;
}

.empty-history {
  text-align: center;
  color: #9ca3af;
  padding: 30px 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 12px;
  width: 600px;
  max-width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
  line-height: 1;
}

.modal-close:hover {
  color: #6b7280;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #f3f4f6;
  flex-shrink: 0;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  resize: vertical;
  transition: all 0.2s;
}

.form-textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.task-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.detail-label {
  font-size: 13px;
  color: #6b7280;
}

.detail-value {
  font-size: 13px;
  color: #1f2937;
  font-weight: 500;
}

.task-result-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 12px 0 10px 0;
}

.task-result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-result-item {
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border-left: 3px solid #10b981;
}

.task-result-item.task-result-fail {
  background: #fef2f2;
  border-left-color: #ef4444;
}

.task-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  margin-bottom: 6px;
}

.task-result-title-inner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-result-borrower {
  font-size: 12px;
  color: #6b7280;
}

.task-result-detail {
  background: #fff;
  padding: 8px 10px;
  border-radius: 4px;
  border: 1px solid #fecaca;
  margin-bottom: 6px;
}

.task-result-detail .error-line {
  font-size: 12px;
  margin-bottom: 4px;
  color: #374151;
}

.task-result-detail .error-line:last-child {
  margin-bottom: 0;
}

.task-result-detail .error-label {
  color: #6b7280;
  font-weight: 500;
}

.task-result-detail .error-code-val {
  font-family: monospace;
  background: #fef2f2;
  padding: 1px 4px;
  border-radius: 3px;
  color: #dc2626;
  font-weight: 500;
}

.task-result-detail .suggestion-line {
  color: #059669;
  font-weight: 500;
}

.task-result-time {
  font-size: 11px;
  color: #9ca3af;
}

.link-text {
  color: #3b82f6;
  cursor: pointer;
}

.link-text:hover {
  text-decoration: underline;
}

@media (max-width: 1024px) {
  .batch-container {
    grid-template-columns: 1fr;
  }

  .right-panel {
    position: static;
  }
}
</style>
