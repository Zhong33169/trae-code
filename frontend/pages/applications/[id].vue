<template>
  <div class="application-detail">
    <div class="page-header">
      <div class="header-left">
        <button class="back-btn" @click="goBack">
          ← 返回列表
        </button>
        <h2 class="page-title">展期申请详情</h2>
      </div>
      <div class="header-right">
        <span v-if="application?.is_urgent" class="status-tag status-urgent" style="margin-right: 8px;">紧急</span>
        <span :class="['status-tag', `status-${application?.status}`]">
          {{ statusMap[application?.status || ''] || application?.status }}
        </span>
      </div>
    </div>

    <div class="detail-grid" v-if="application">
      <div class="card section-card">
        <div class="section-title">
          <span class="section-icon">👤</span>
          <h3>借款人信息</h3>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">申请编号</span>
            <span class="info-value">{{ application.application_no }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">借款人姓名</span>
            <span class="info-value">{{ application.borrower_name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">身份证号</span>
            <span class="info-value">{{ application.borrower_id_card }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">联系电话</span>
            <span class="info-value">{{ application.borrower_phone }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">登记员</span>
            <span class="info-value">{{ application.registrar_name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">申请时间</span>
            <span class="info-value">{{ formatDateTime(application.created_at) }}</span>
          </div>
        </div>
      </div>

      <div class="card section-card">
        <div class="section-title">
          <span class="section-icon">💰</span>
          <h3>借款信息</h3>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">借款合同号</span>
            <span class="info-value">{{ application.loan_contract_no }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">原始本金</span>
            <span class="info-value">¥{{ formatNumber(application.original_principal) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">原利率</span>
            <span class="info-value">{{ application.original_interest_rate }}%</span>
          </div>
          <div class="info-item">
            <span class="info-label">原到期日</span>
            <span class="info-value">{{ application.original_due_date }}</span>
          </div>
        </div>
      </div>

      <div class="card section-card">
        <div class="section-title">
          <span class="section-icon">📝</span>
          <h3>展期信息</h3>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">展期天数</span>
            <span class="info-value highlight">{{ application.extension_days }} 天</span>
          </div>
          <div class="info-item">
            <span class="info-label">展期后到期日</span>
            <span class="info-value">{{ application.new_due_date }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">执行利率</span>
            <span class="info-value">{{ application.new_interest_rate || application.original_interest_rate }}%</span>
          </div>
          <div class="info-item">
            <span class="info-label">是否紧急</span>
            <span class="info-value">
              <span v-if="application.is_urgent" class="status-tag status-urgent">是</span>
              <span v-else class="status-tag status-draft">否</span>
            </span>
          </div>
        </div>
        <div class="info-item full-width">
          <span class="info-label">展期原因</span>
          <span class="info-value">{{ application.extension_reason }}</span>
        </div>
      </div>

      <div class="card section-card">
        <div class="section-title">
          <span class="section-icon">👥</span>
          <h3>处理人员</h3>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">登记员</span>
            <span class="info-value">{{ application.registrar_name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">审核主管</span>
            <span class="info-value">{{ application.reviewer_name || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">复核负责人</span>
            <span class="info-value">{{ application.final_reviewer_name || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">当前处理角色</span>
            <span class="info-value">{{ roleMap[application.current_handler_role] || application.current_handler_role || '无' }}</span>
          </div>
        </div>
      </div>

      <div class="card section-card full-width">
        <div class="section-title">
          <span class="section-icon">📅</span>
          <h3>还款计划</h3>
        </div>
        <div class="table-wrapper">
          <table class="table table-small">
            <thead>
              <tr>
                <th>期数</th>
                <th>还款日期</th>
                <th>应还本金</th>
                <th>应还利息</th>
                <th>应还总额</th>
                <th>是否展期</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in application.repayment_plans" :key="item.id">
                <td>第 {{ item.plan_no }} 期</td>
                <td>{{ item.due_date }}</td>
                <td>¥{{ formatNumber(item.principal) }}</td>
                <td>¥{{ formatNumber(item.interest) }}</td>
                <td>¥{{ formatNumber(item.total_amount) }}</td>
                <td>
                  <span v-if="item.is_extension_period" class="status-tag status-review_approved">是</span>
                  <span v-else class="status-tag status-draft">否</span>
                </td>
              </tr>
              <tr v-if="application.repayment_plans.length === 0">
                <td colspan="6" class="empty-row">暂无还款计划</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card section-card full-width">
        <div class="section-title">
          <span class="section-icon">📎</span>
          <h3>材料清单</h3>
        </div>
        <div class="table-wrapper">
          <table class="table table-small">
            <thead>
              <tr>
                <th>材料类型</th>
                <th>材料名称</th>
                <th>是否必填</th>
                <th>核验状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in application.materials" :key="item.id">
                <td>{{ item.material_type_display }}</td>
                <td>{{ item.material_name }}</td>
                <td>
                  <span v-if="item.is_required" class="status-tag status-urgent">必填</span>
                  <span v-else class="status-tag status-draft">选填</span>
                </td>
                <td>
                  <span v-if="item.is_verified" class="status-tag status-final_approved">已核验</span>
                  <span v-else class="status-tag status-draft">未核验</span>
                </td>
              </tr>
              <tr v-if="application.materials.length === 0">
                <td colspan="4" class="empty-row">暂无材料</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card section-card full-width" v-if="application.review_opinion || application.final_review_opinion">
        <div class="section-title">
          <span class="section-icon">💬</span>
          <h3>审核意见</h3>
        </div>
        <div class="comment-list">
          <div v-if="application.review_opinion" class="comment-item">
            <div class="comment-header">
              <span class="comment-user">{{ application.reviewer_name }}</span>
              <span class="comment-role">展期审核主管</span>
              <span :class="['status-tag', `status-${application.status}`]">审核</span>
            </div>
            <div class="comment-content">{{ application.review_opinion }}</div>
          </div>
          <div v-if="application.final_review_opinion" class="comment-item">
            <div class="comment-header">
              <span class="comment-user">{{ application.final_reviewer_name }}</span>
              <span class="comment-role">小贷公司复核负责人</span>
              <span class="status-tag status-final_approved">复核</span>
            </div>
            <div class="comment-content">{{ application.final_review_opinion }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-card">
      <p>加载中...</p>
    </div>

    <div class="card timeline-card" v-if="!loading">
      <div class="section-title">
        <span class="section-icon">⏱️</span>
        <h3>审计日志</h3>
      </div>
      <div class="timeline">
        <div v-for="(log, index) in auditLogs" :key="log.id" class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-title">{{ log.action_display }}</span>
              <span class="timeline-time">{{ formatDateTime(log.created_at) }}</span>
            </div>
            <div class="timeline-desc">{{ log.action_detail || log.remark || '-' }}</div>
            <div class="timeline-meta">
              <span>操作人：{{ log.operator_name }}</span>
              <span v-if="log.old_status">原状态：{{ statusMap[log.old_status] || log.old_status }}</span>
              <span v-if="log.new_status">新状态：{{ statusMap[log.new_status] || log.new_status }}</span>
            </div>
          </div>
        </div>
        <div v-if="auditLogs.length === 0 && !auditLoading" class="empty-timeline">
          暂无审计日志
        </div>
      </div>
    </div>

    <div class="action-bar" v-if="showActionBar">
      <button class="btn btn-secondary" @click="goBack">返回</button>
      <div class="action-btns">
        <template v-if="isRegistrar && canSubmitStatus">
          <button class="btn btn-primary" @click="handleSubmit" :disabled="submitting">
            {{ submitting ? '提交中...' : '提交申请' }}
          </button>
        </template>
        <template v-if="isReviewer && application?.status === 'pending_review'">
          <button class="btn btn-reject" @click="openReviewModal('reject')">审核退回</button>
          <button class="btn btn-primary" @click="openReviewModal('approve')">审核通过</button>
        </template>
        <template v-if="isFinalReviewer && application?.status === 'review_approved'">
          <button class="btn btn-reject" @click="openFinalModal('reject')">复核拒绝</button>
          <button class="btn btn-primary" @click="openFinalModal('approve')">复核通过</button>
        </template>
        <template v-if="isFinalReviewer && application?.status === 'final_approved'">
          <button class="btn btn-primary" @click="handleArchive" :disabled="submitting">
            {{ submitting ? '归档中...' : '归档' }}
          </button>
        </template>
      </div>
    </div>

    <div v-if="showReviewModal" class="modal-overlay" @click.self="showReviewModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ reviewAction === 'approve' ? '审核通过' : '审核退回' }}</h3>
          <button class="modal-close" @click="showReviewModal = false">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">审核意见</label>
          <textarea v-model="reviewComment" class="form-textarea" placeholder="请输入审核意见..." rows="4"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showReviewModal = false">取消</button>
          <button :class="['btn', reviewAction === 'approve' ? 'btn-primary' : 'btn-reject']" @click="handleReview" :disabled="submitting">
            {{ submitting ? '提交中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showFinalModal" class="modal-overlay" @click.self="showFinalModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ finalAction === 'approve' ? '复核通过' : '复核拒绝' }}</h3>
          <button class="modal-close" @click="showFinalModal = false">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">复核意见</label>
          <textarea v-model="finalComment" class="form-textarea" placeholder="请输入复核意见..." rows="4"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showFinalModal = false">取消</button>
          <button :class="['btn', finalAction === 'approve' ? 'btn-primary' : 'btn-reject']" @click="handleFinalReview" :disabled="submitting">
            {{ submitting ? '提交中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { get, post, put } = useApi()
const userStore = useUserStore()
const route = useRoute()

const id = computed(() => route.params.id as string)

interface RepaymentPlan {
  id: number
  plan_no: number
  due_date: string
  principal: string
  interest: string
  total_amount: string
  is_extension_period: boolean
}

interface Material {
  id: number
  material_type: string
  material_type_display: string
  material_name: string
  is_required: boolean
  is_verified: boolean
  upload_time: string
}

interface ApplicationDetail {
  id: number
  application_no: string
  qr_code: string
  borrower_name: string
  borrower_id_card: string
  borrower_phone: string
  loan_contract_no: string
  original_principal: string
  original_interest_rate: string
  original_due_date: string
  extension_days: number
  extension_reason: string
  new_due_date: string
  new_interest_rate: string | null
  status: string
  status_display: string
  current_handler_role: string
  registrar_name: string
  reviewer_name: string | null
  final_reviewer_name: string | null
  review_opinion: string
  final_review_opinion: string
  is_urgent: boolean
  deadline: string | null
  created_at: string
  updated_at: string
  version: number
  repayment_plans: RepaymentPlan[]
  materials: Material[]
}

interface AuditLog {
  id: number
  application_no: string
  operator_name: string
  action: string
  action_display: string
  action_detail: string
  old_status: string
  new_status: string
  remark: string
  created_at: string
}

const loading = ref(false)
const auditLoading = ref(false)
const submitting = ref(false)
const application = ref<ApplicationDetail | null>(null)
const auditLogs = ref<AuditLog[]>([])

const showReviewModal = ref(false)
const reviewAction = ref<'approve' | 'reject'>('approve')
const reviewComment = ref('')

const showFinalModal = ref(false)
const finalAction = ref<'approve' | 'reject'>('approve')
const finalComment = ref('')

const isRegistrar = computed(() => userStore.hasRole('registrar'))
const isReviewer = computed(() => userStore.hasRole('reviewer'))
const isFinalReviewer = computed(() => userStore.hasRole('final_reviewer'))

const canSubmitStatus = computed(() => {
  return application.value?.status === 'draft' || application.value?.status === 'returned_for_correction'
})

const showActionBar = computed(() => {
  if (!application.value) return false
  if (isRegistrar.value && canSubmitStatus.value) return true
  if (isReviewer.value && application.value.status === 'pending_review') return true
  if (isFinalReviewer.value && application.value.status === 'review_approved') return true
  if (isFinalReviewer.value && application.value.status === 'final_approved') return true
  return false
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

const roleMap: Record<string, string> = {
  registrar: '展期登记员',
  reviewer: '展期审核主管',
  final_reviewer: '小贷公司复核负责人',
  admin: '系统管理员'
}

const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const formatNumber = (num: string | number): string => {
  if (num === undefined || num === null) return '0'
  const n = typeof num === 'string' ? parseFloat(num) : num
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const loadDetail = async () => {
  loading.value = true
  try {
    const data = await get<ApplicationDetail>(`/applications/${id.value}`)
    application.value = data
  } catch (error: any) {
    console.error('Failed to load application detail:', error)
    alert(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const loadAuditLogs = async () => {
  if (!application.value?.application_no) return
  auditLoading.value = true
  try {
    const data = await get<{ items: AuditLog[]; total: number }>('/audit-logs', {
      application_no: application.value.application_no,
      page_size: 50
    })
    auditLogs.value = data.items || []
  } catch (error) {
    console.error('Failed to load audit logs:', error)
  } finally {
    auditLoading.value = false
  }
}

const handleSubmit = async () => {
  if (!confirm('确定提交该申请？提交后将进入审核流程。')) return
  submitting.value = true
  try {
    await put(`/applications/${id.value}/submit`)
    alert('提交成功')
    await loadDetail()
    await loadAuditLogs()
  } catch (error: any) {
    alert(error.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

const openReviewModal = (action: 'approve' | 'reject') => {
  reviewAction.value = action
  reviewComment.value = ''
  showReviewModal.value = true
}

const handleReview = async () => {
  if (!reviewComment.value.trim()) {
    alert('请输入审核意见')
    return
  }
  submitting.value = true
  try {
    await post(`/applications/${id.value}/review`, {
      application_id: Number(id.value),
      approved: reviewAction.value === 'approve',
      opinion: reviewComment.value
    })
    alert('操作成功')
    showReviewModal.value = false
    reviewComment.value = ''
    await loadDetail()
    await loadAuditLogs()
  } catch (error: any) {
    alert(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const openFinalModal = (action: 'approve' | 'reject') => {
  finalAction.value = action
  finalComment.value = ''
  showFinalModal.value = true
}

const handleFinalReview = async () => {
  if (!finalComment.value.trim()) {
    alert('请输入复核意见')
    return
  }
  submitting.value = true
  try {
    await post(`/applications/${id.value}/final-review`, {
      application_id: Number(id.value),
      approved: finalAction.value === 'approve',
      opinion: finalComment.value
    })
    alert('操作成功')
    showFinalModal.value = false
    finalComment.value = ''
    await loadDetail()
    await loadAuditLogs()
  } catch (error: any) {
    alert(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const handleArchive = async () => {
  if (!confirm('确定归档该申请？归档后不可修改。')) return
  submitting.value = true
  try {
    await put(`/applications/${id.value}/archive`)
    alert('归档成功')
    await loadDetail()
    await loadAuditLogs()
  } catch (error: any) {
    alert(error.message || '归档失败')
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  navigateTo('/applications')
}

onMounted(() => {
  loadDetail()
  loadAuditLogs()
})
</script>

<style scoped>
.application-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 80px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.back-btn:hover {
  text-decoration: underline;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.section-card {
  padding: 20px;
}

.section-card.full-width {
  grid-column: 1 / -1;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.section-icon {
  font-size: 20px;
}

.section-title h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 12px;
  color: #6b7280;
}

.info-value {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

.info-value.highlight {
  color: #3b82f6;
  font-size: 16px;
}

.table-wrapper {
  overflow-x: auto;
}

.table-small th,
.table-small td {
  padding: 8px 12px;
  font-size: 13px;
}

.empty-row {
  text-align: center;
  color: #9ca3af;
  padding: 30px 0 !important;
}

.loading-card {
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  color: #6b7280;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.comment-item {
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.comment-user {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.comment-role {
  font-size: 12px;
  color: #6b7280;
}

.comment-content {
  font-size: 13px;
  color: #374151;
  line-height: 1.6;
}

.timeline-card {
  padding: 20px;
}

.timeline {
  position: relative;
  padding-left: 30px;
}

.timeline-item {
  position: relative;
  padding-bottom: 24px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: -30px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #3b82f6;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px #3b82f6;
}

.timeline-content {
  padding-left: 8px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.timeline-time {
  font-size: 12px;
  color: #9ca3af;
}

.timeline-desc {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
}

.timeline-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #9ca3af;
}

.empty-timeline {
  text-align: center;
  color: #9ca3af;
  padding: 30px 0;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 240px;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 100;
}

.action-btns {
  display: flex;
  gap: 12px;
}

.btn-reject {
  background: #fff;
  color: #ef4444;
  border: 1px solid #fecaca;
}

.btn-reject:hover {
  background: #fef2f2;
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
  width: 500px;
  max-width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #f3f4f6;
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
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #f3f4f6;
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

.status-urgent {
  background: #fee2e2;
  color: #991b1b;
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .action-bar {
    left: 0;
  }
}
</style>
