<template>
  <div class="audit-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">审计日志</h2>
        <p class="page-subtitle">查看系统操作记录和审批日志</p>
      </div>
    </div>

    <div class="card filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">申请编号</label>
          <input v-model="filters.application_no" type="text" class="filter-input" placeholder="请输入申请编号" />
        </div>
        <div class="filter-item">
          <label class="filter-label">操作类型</label>
          <select v-model="filters.action_type" class="filter-select">
            <option value="">全部类型</option>
            <option value="create">创建</option>
            <option value="submit">提交</option>
            <option value="review_approve">审核通过</option>
            <option value="review_reject">审核退回</option>
            <option value="final_approve">复核通过</option>
            <option value="final_reject">复核拒绝</option>
            <option value="return">退回补正</option>
            <option value="archive">归档</option>
            <option value="scan">扫码核验</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="filter-label">操作人</label>
          <input v-model="filters.operator" type="text" class="filter-input" placeholder="请输入操作人" />
        </div>
        <div class="filter-item">
          <label class="filter-label">开始日期</label>
          <input v-model="filters.start_date" type="date" class="filter-input" />
        </div>
        <div class="filter-item">
          <label class="filter-label">结束日期</label>
          <input v-model="filters.end_date" type="date" class="filter-input" />
        </div>
        <div class="filter-item filter-actions">
          <button class="btn btn-primary" @click="handleSearch">搜索</button>
          <button class="btn btn-secondary" @click="handleReset">重置</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作人</th>
              <th>操作类型</th>
              <th>操作详情</th>
              <th>原状态</th>
              <th>新状态</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in auditLogs" :key="item.id">
              <td>{{ formatDate(item.created_at) }}</td>
              <td>{{ item.operator_name }}</td>
              <td>
                <span :class="['action-tag', `action-${item.action_type}`]">
                  {{ actionTypeMap[item.action_type] || item.action_type }}
                </span>
              </td>
              <td class="detail-text">{{ item.detail || '-' }}</td>
              <td>
                <span v-if="item.old_status" :class="['status-tag', `status-${item.old_status}`]">
                  {{ statusMap[item.old_status] || item.old_status }}
                </span>
                <span v-else>-</span>
              </td>
              <td>
                <span v-if="item.new_status" :class="['status-tag', `status-${item.new_status}`]">
                  {{ statusMap[item.new_status] || item.new_status }}
                </span>
                <span v-else>-</span>
              </td>
              <td class="detail-text">{{ item.remark || '-' }}</td>
            </tr>
            <tr v-if="auditLogs.length === 0 && !loading">
              <td colspan="7" class="empty-row">暂无数据</td>
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
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { get } = useApi()

interface AuditLog {
  id: string
  application_no: string
  action_type: string
  operator_name: string
  detail: string
  old_status: string
  new_status: string
  remark: string
  created_at: string
}

const filters = reactive({
  application_no: '',
  action_type: '',
  operator: '',
  start_date: '',
  end_date: ''
})

const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const auditLogs = ref<AuditLog[]>([])

const statusMap: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  review_approved: '审核通过待复核',
  returned_for_correction: '退回补正',
  final_approved: '复核通过待归档',
  rejected: '已拒绝',
  archived: '已归档'
}

const actionTypeMap: Record<string, string> = {
  create: '创建申请',
  submit: '提交申请',
  review_approve: '审核通过',
  review_reject: '审核退回',
  final_approve: '复核通过',
  final_reject: '复核拒绝',
  return: '退回补正',
  archive: '归档',
  scan: '扫码核验',
  login: '用户登录',
  update: '修改申请'
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const loadData = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: page.value,
      page_size: pageSize.value
    }
    if (filters.application_no) params.application_no = filters.application_no
    if (filters.action_type) params.action_type = filters.action_type
    if (filters.operator) params.operator = filters.operator
    if (filters.start_date) params.start_date = filters.start_date
    if (filters.end_date) params.end_date = filters.end_date

    const data = await get<{ items: AuditLog[]; total: number }>('/audit-logs', params)
    auditLogs.value = data.items || []
    total.value = data.total || 0
  } catch (error) {
    console.error('Failed to load audit logs:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  loadData()
}

const handleReset = () => {
  filters.application_no = ''
  filters.action_type = ''
  filters.operator = ''
  filters.start_date = ''
  filters.end_date = ''
  page.value = 1
  loadData()
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
})
</script>

<style scoped>
.audit-page {
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

.filter-card {
  padding: 20px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
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

.table-wrapper {
  overflow-x: auto;
}

.action-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.action-create {
  background: #dbeafe;
  color: #1e40af;
}

.action-submit {
  background: #fef3c7;
  color: #92400e;
}

.action-review_approve {
  background: #bfdbfe;
  color: #1e40af;
}

.action-review_reject {
  background: #fee2e2;
  color: #991b1b;
}

.action-final_approve {
  background: #d1fae5;
  color: #065f46;
}

.action-final_reject {
  background: #fecaca;
  color: #991b1b;
}

.action-return {
  background: #fed7aa;
  color: #c2410c;
}

.action-archive {
  background: #e5e7eb;
  color: #4b5563;
}

.action-scan {
  background: #ede9fe;
  color: #5b21b6;
}

.action-login {
  background: #d1fae5;
  color: #065f46;
}

.action-update {
  background: #fef3c7;
  color: #92400e;
}

.detail-text {
  font-size: 13px;
  color: #4b5563;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
}

.total-text {
  font-size: 13px;
  color: #6b7280;
}

.pagination-btns {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-info {
  font-size: 13px;
  color: #6b7280;
}

table {
  table-layout: fixed;
}
</style>
