<template>
  <div class="workbench-page">
    <section class="stats-section">
      <div class="stat-card" v-loading="loading">
        <div class="stat-icon icon-gray">📋</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.total_count || 0 }}</div>
          <div class="stat-label">全部申请</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-yellow">⏳</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.pending_count || 0 }}</div>
          <div class="stat-label">待处理</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-blue">📝</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.my_pending_count || 0 }}</div>
          <div class="stat-label">我的待办</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-green">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.approved_count || 0 }}</div>
          <div class="stat-label">已通过</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-red">❌</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.rejected_count || 0 }}</div>
          <div class="stat-label">已拒绝</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-orange">🔥</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.urgent_count || 0 }}</div>
          <div class="stat-label">紧急</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon icon-purple">↩️</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.returned_count || 0 }}</div>
          <div class="stat-label">退回补正</div>
        </div>
      </div>
    </section>

    <section class="content-section">
      <div class="card recent-applications">
        <div class="card-header">
          <h3 class="card-title">最近申请</h3>
          <NuxtLink to="/applications" class="view-all">查看全部 →</NuxtLink>
        </div>
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
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in recentApplications" :key="item.id">
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
              </tr>
              <tr v-if="recentApplications.length === 0 && !loading">
                <td colspan="8" class="empty-row">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card quick-actions">
        <div class="card-header">
          <h3 class="card-title">快捷操作</h3>
        </div>
        <div class="action-grid">
          <div class="action-item" @click="navigateTo('/applications')">
            <span class="action-icon">📋</span>
            <span class="action-text">申请列表</span>
          </div>
          <div class="action-item" @click="navigateTo('/scan')">
            <span class="action-icon">📱</span>
            <span class="action-text">扫码核验</span>
          </div>
          <div class="action-item" v-if="showBatch" @click="navigateTo('/batch')">
            <span class="action-icon">⚙️</span>
            <span class="action-text">批量处理</span>
          </div>
          <div class="action-item" @click="navigateTo('/audit')">
            <span class="action-icon">📝</span>
            <span class="action-text">审计日志</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useUserStore, type UserRole } from '~/stores/user'

definePageMeta({
  layout: 'default'
})

const { get } = useApi()
const userStore = useUserStore()

interface DashboardStats {
  total_count: number
  pending_count: number
  my_pending_count: number
  approved_count: number
  rejected_count: number
  urgent_count: number
  returned_count: number
}

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

const loading = ref(false)
const stats = reactive<DashboardStats>({
  total_count: 0,
  pending_count: 0,
  my_pending_count: 0,
  approved_count: 0,
  rejected_count: 0,
  urgent_count: 0,
  returned_count: 0
})

const recentApplications = ref<Application[]>([])

const showBatch = computed(() => {
  return userStore.hasRole(['reviewer', 'final_reviewer', 'admin'] as UserRole[])
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

const loadStats = async () => {
  try {
    const data = await get<DashboardStats>('/dashboard/stats')
    Object.assign(stats, data)
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

const loadRecentApplications = async () => {
  try {
    const data = await get<{ items: Application[] }>('/applications', { page_size: 5 })
    recentApplications.value = data.items || []
  } catch (error) {
    console.error('Failed to load recent applications:', error)
  }
}

const loadData = async () => {
  loading.value = true
  try {
    await Promise.all([loadStats(), loadRecentApplications()])
  } finally {
    loading.value = false
  }
}

const goToDetail = (id: number) => {
  navigateTo(`/applications/${id}`)
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.workbench-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 16px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.icon-gray {
  background: #f3f4f6;
}

.icon-yellow {
  background: #fef3c7;
}

.icon-blue {
  background: #dbeafe;
}

.icon-green {
  background: #d1fae5;
}

.icon-red {
  background: #fee2e2;
}

.icon-orange {
  background: #fed7aa;
}

.icon-purple {
  background: #ede9fe;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.content-section {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
}

.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.view-all {
  font-size: 13px;
  color: #3b82f6;
  text-decoration: none;
  cursor: pointer;
}

.view-all:hover {
  text-decoration: underline;
}

.link-text {
  color: #3b82f6;
  cursor: pointer;
  text-decoration: none;
}

.link-text:hover {
  text-decoration: underline;
}

.table-wrapper {
  overflow-x: auto;
}

.quick-actions {
  align-self: start;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 12px;
  background: #f9fafb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-item:hover {
  background: #eff6ff;
  transform: translateY(-2px);
}

.action-icon {
  font-size: 28px;
}

.action-text {
  font-size: 13px;
  color: #374151;
  font-weight: 500;
}

.empty-row {
  text-align: center;
  color: #9ca3af;
  padding: 40px 0 !important;
}

@media (max-width: 1400px) {
  .stats-section {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-section {
    grid-template-columns: repeat(2, 1fr);
  }

  .content-section {
    grid-template-columns: 1fr;
  }
}
</style>
