<template>
  <div class="applications-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">展期申请列表</h2>
        <p class="page-subtitle">管理所有贷款展期申请</p>
      </div>
      <button v-if="canCreate" class="btn btn-primary" @click="handleCreate">
        + 新建申请
      </button>
    </div>

    <div class="card filter-card">
      <div class="filter-row">
        <div class="filter-item">
          <label class="filter-label">关键词</label>
          <input v-model="filters.keyword" type="text" class="filter-input" placeholder="申请编号/借款人/身份证" />
        </div>
        <div class="filter-item">
          <label class="filter-label">申请状态</label>
          <select v-model="filters.status" class="filter-select">
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending_review">待审核</option>
            <option value="review_approved">审核通过待复核</option>
            <option value="returned_for_correction">退回补正</option>
            <option value="final_approved">复核通过待归档</option>
            <option value="rejected">已拒绝</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div class="filter-item">
          <label class="filter-label">是否紧急</label>
          <select v-model="filters.is_urgent" class="filter-select">
            <option value="">全部</option>
            <option value="true">紧急</option>
            <option value="false">普通</option>
          </select>
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
              <th>申请编号</th>
              <th>借款人</th>
              <th>身份证</th>
              <th>借款合同号</th>
              <th>展期天数</th>
              <th>状态</th>
              <th>是否紧急</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in applicationList" :key="item.id">
              <td class="link-text" @click="goToDetail(item.id)">{{ item.application_no }}</td>
              <td>{{ item.borrower_name }}</td>
              <td>{{ item.borrower_id_card }}</td>
              <td>{{ item.loan_contract_no }}</td>
              <td>{{ item.extension_days }} 天</td>
              <td>
                <span :class="['status-tag', `status-${item.status}`]">
                  {{ statusMap[item.status] }}
                </span>
              </td>
              <td>
                <span v-if="item.is_urgent" class="status-tag status-urgent">紧急</span>
                <span v-else class="status-tag status-draft">普通</span>
              </td>
              <td>{{ formatDate(item.created_at) }}</td>
              <td>
                <button class="link-btn" @click="goToDetail(item.id)">查看</button>
                <template v-if="canSubmit(item)">
                  <button class="link-btn link-btn-success" @click="handleSubmit(item)">提交</button>
                </template>
                <template v-if="canEdit(item)">
                  <button class="link-btn" @click="handleEdit(item)">编辑</button>
                </template>
                <template v-if="canReview(item)">
                  <button class="link-btn link-btn-success" @click="goToDetail(item.id)">审核</button>
                </template>
                <template v-if="canFinalReview(item)">
                  <button class="link-btn link-btn-success" @click="goToDetail(item.id)">复核</button>
                </template>
                <template v-if="canArchive(item)">
                  <button class="link-btn link-btn-success" @click="handleArchive(item)">归档</button>
                </template>
              </td>
            </tr>
            <tr v-if="applicationList.length === 0 && !loading">
              <td colspan="9" class="empty-row">暂无数据</td>
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
import { useUserStore, type UserRole } from '~/stores/user'

definePageMeta({
  layout: 'default'
})

const { get, put } = useApi()
const userStore = useUserStore()

interface Application {
  id: number
  application_no: string
  borrower_name: string
  borrower_id_card: string
  loan_contract_no: string
  extension_days: number
  status: string
  is_urgent: boolean
  created_at: string
}

const filters = reactive({
  keyword: '',
  status: '',
  is_urgent: ''
})

const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const applicationList = ref<Application[]>([])

const canCreate = computed(() => {
  return userStore.hasRole(['registrar', 'admin'] as UserRole[])
})

const statusMap: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  review_approved: '审核通过待复核',
  returned_for_correction: '退回补正',
  final_approved: '复核通过待归档',
  rejected: '已拒绝',
  archived: '已归档'
}

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

const canSubmit = (item: Application): boolean => {
  if (!userStore.hasRole(['registrar'] as UserRole[])) return false
  return item.status === 'draft' || item.status === 'returned_for_correction'
}

const canEdit = (item: Application): boolean => {
  if (!userStore.hasRole(['registrar'] as UserRole[])) return false
  return item.status === 'draft' || item.status === 'returned_for_correction'
}

const canReview = (item: Application): boolean => {
  if (!userStore.hasRole(['reviewer'] as UserRole[])) return false
  return item.status === 'pending_review'
}

const canFinalReview = (item: Application): boolean => {
  if (!userStore.hasRole(['final_reviewer'] as UserRole[])) return false
  return item.status === 'review_approved'
}

const canArchive = (item: Application): boolean => {
  if (!userStore.hasRole(['final_reviewer'] as UserRole[])) return false
  return item.status === 'final_approved'
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
    if (filters.is_urgent !== '') params.is_urgent = filters.is_urgent

    const data = await get<{ items: Application[]; total: number }>('/applications', params)
    applicationList.value = data.items || []
    total.value = data.total || 0
  } catch (error) {
    console.error('Failed to load applications:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  loadData()
}

const handleReset = () => {
  filters.keyword = ''
  filters.status = ''
  filters.is_urgent = ''
  page.value = 1
  loadData()
}

const handleCreate = () => {
  navigateTo('/applications/new')
}

const handleEdit = (item: Application) => {
  navigateTo(`/applications/${item.id}/edit`)
}

const handleSubmit = async (item: Application) => {
  if (!confirm(`确定提交申请 ${item.application_no}？`)) return
  try {
    await post(`/applications/${item.id}/submit`)
    alert('提交成功')
    loadData()
  } catch (error: any) {
    alert(error.message || '提交失败')
  }
}

const handleArchive = async (item: Application) => {
  if (!confirm(`确定归档申请 ${item.application_no}？`)) return
  try {
    await put(`/applications/${item.id}/archive`)
    alert('归档成功')
    loadData()
  } catch (error: any) {
    alert(error.message || '归档失败')
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
})

onActivated(() => {
  loadData()
})
</script>

<style scoped>
.applications-page {
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
  min-width: 180px;
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

.link-btn {
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  margin-right: 12px;
}

.link-btn:hover {
  text-decoration: underline;
}

.link-btn-danger {
  color: #ef4444;
}

.link-btn-success {
  color: #10b981;
}

.link-text {
  color: #3b82f6;
  cursor: pointer;
}

.link-text:hover {
  text-decoration: underline;
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
</style>
