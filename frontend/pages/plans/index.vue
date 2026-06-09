<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">护理计划单列表</h2>
      <div>
        <button 
          v-if="authStore.role === 'registrar'"
          class="btn btn-primary" 
          @click="navigateTo('/plans/create')"
        >
          + 新建护理计划
        </button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <label>状态筛选：</label>
        <select v-model="filterStatus" @change="handleStatusChange">
          <option value="all">全部</option>
          <option value="draft">草稿</option>
          <option value="pending_audit">待审核</option>
          <option value="pending_review">待复核</option>
          <option value="archived">已归档</option>
          <option value="returned">已退回</option>
        </select>
        <span style="margin-left: auto; color: #666;">共 {{ total }} 条</span>
      </div>

      <div v-if="showBatchBar" class="batch-bar">
        <span class="batch-selected">已选择 {{ selectedIds.length }} 条</span>
        <template v-if="authStore.role === 'registrar'">
          <button 
            v-if="canBatchSubmit" 
            class="btn btn-primary btn-sm"
            @click="openBatchModal('submit')"
          >
            批量提交
          </button>
          <button 
            v-if="canBatchResubmit" 
            class="btn btn-primary btn-sm"
            @click="openBatchModal('resubmit')"
          >
            批量重新提交
          </button>
        </template>
        <template v-else-if="authStore.role === 'auditor'">
          <button 
            v-if="canBatchApprove" 
            class="btn btn-success btn-sm"
            @click="openBatchModal('approve')"
          >
            批量审核通过
          </button>
          <button 
            v-if="canBatchReject" 
            class="btn btn-danger btn-sm"
            @click="openBatchModal('reject')"
          >
            批量退回
          </button>
        </template>
        <template v-else-if="authStore.role === 'reviewer'">
          <button 
            v-if="canBatchArchive" 
            class="btn btn-success btn-sm"
            @click="openBatchModal('archive')"
          >
            批量复核归档
          </button>
          <button 
            v-if="canBatchRejectReviewer" 
            class="btn btn-danger btn-sm"
            @click="openBatchModal('reject')"
          >
            批量退回
          </button>
        </template>
        <button class="btn btn-default btn-sm" @click="clearSelection">
          取消选择
        </button>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      
      <div v-else-if="plans.length === 0" class="empty">
        暂无数据
      </div>
      
      <table v-else class="table">
        <thead>
          <tr>
            <th class="col-checkbox">
              <input 
                type="checkbox" 
                v-model="selectAll" 
                @change="toggleSelectAll"
              />
            </th>
            <th>计划编号</th>
            <th>老人姓名</th>
            <th>性别</th>
            <th>年龄</th>
            <th>房间/床位</th>
            <th>护理级别</th>
            <th v-if="showAssessmentCol">入住评估</th>
            <th v-if="showFamilyConfirmCol">家属确认</th>
            <th v-if="showReturnReasonCol">退回原因</th>
            <th>状态</th>
            <th v-if="showAssessmentByCol">评估人</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="plan in plans" :key="plan.id" :class="{ 'row-selected': selectedIds.includes(plan.id) }">
            <td class="col-checkbox">
              <input 
                type="checkbox" 
                :value="plan.id" 
                v-model="selectedIds"
                :disabled="!canSelect(plan)"
              />
            </td>
            <td>{{ plan.plan_no }}</td>
            <td>{{ plan.elder_name }}</td>
            <td>{{ plan.elder_gender }}</td>
            <td>{{ plan.elder_age }}</td>
            <td>{{ plan.room_no }} / {{ plan.bed_no }}</td>
            <td>{{ plan.plan_level || '-' }}</td>
            <td v-if="showAssessmentCol">
              <span :class="['status-tag', `status-${plan.assessment_status}`]">
                {{ ASSESSMENT_STATUS_MAP[plan.assessment_status] }}
              </span>
            </td>
            <td v-if="showFamilyConfirmCol">
              <span :class="['status-tag', `status-${plan.family_confirm_status}`]">
                {{ FAMILY_CONFIRM_STATUS_MAP[plan.family_confirm_status] }}
              </span>
            </td>
            <td v-if="showReturnReasonCol" class="col-reason">
              {{ plan.return_reason || '-' }}
            </td>
            <td>
              <span :class="['status-tag', `status-${plan.status}`]">
                {{ STATUS_MAP[plan.status] }}
              </span>
            </td>
            <td v-if="showAssessmentByCol">{{ plan.assessment_by || '-' }}</td>
            <td>{{ formatDate(plan.created_at) }}</td>
            <td>
              <button class="btn btn-default btn-sm" @click="viewDetail(plan.id)">
                详情
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > pageSize" class="pagination">
        <button @click="prevPage" :disabled="page <= 1">上一页</button>
        <span>第 {{ page }} 页 / 共 {{ totalPages }} 页</span>
        <button @click="nextPage" :disabled="page >= totalPages">下一页</button>
      </div>
    </div>

    <div v-if="showBatchModal" class="modal-overlay" @click.self="closeBatchModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ BATCH_ACTION_MAP[batchAction] || '批量操作' }}</h3>
          <button class="modal-close" @click="closeBatchModal">&times;</button>
        </div>
        <div class="modal-body">
          <p>已选择 <strong>{{ selectedIds.length }}</strong> 条记录</p>

          <div v-if="batchAction === 'approve' || batchAction === 'archive'" class="form-group">
            <label>交接信息 <span class="required">*</span></label>
            <div class="handover-form">
              <div>
                <label>班次：</label>
                <select v-model="handoverForm.shift">
                  <option value="">请选择</option>
                  <option v-for="s in SHIFT_OPTIONS" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
              <div>
                <label>交出人：</label>
                <input type="text" v-model="handoverForm.handoff_person" placeholder="请输入交出人" />
              </div>
              <div>
                <label>接收人：</label>
                <input type="text" v-model="handoverForm.receiver_person" placeholder="请输入接收人" />
              </div>
              <div>
                <label>确认时间：</label>
                <input type="datetime-local" v-model="handoverForm.confirm_time" />
              </div>
            </div>
            <p v-if="handoverError" class="error-text">{{ handoverError }}</p>
          </div>

          <div v-if="batchAction === 'reject'" class="form-group">
            <label>退回原因 <span class="required">*</span></label>
            <textarea 
              v-model="rejectReason" 
              rows="4" 
              placeholder="请填写退回原因"
            ></textarea>
            <p v-if="rejectError" class="error-text">{{ rejectError }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="closeBatchModal">取消</button>
          <button 
            class="btn btn-primary" 
            @click="executeBatch"
            :disabled="batchSubmitting"
          >
            {{ batchSubmitting ? '处理中...' : '确认提交' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showResultModal" class="modal-overlay" @click.self="closeResultModal">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>批量处理结果</h3>
          <button class="modal-close" @click="closeResultModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="result-summary">
            <div class="result-stat success">
              <span class="stat-number">{{ batchResult?.batch.success_count || 0 }}</span>
              <span class="stat-label">成功</span>
            </div>
            <div class="result-stat fail">
              <span class="stat-number">{{ batchResult?.batch.fail_count || 0 }}</span>
              <span class="stat-label">失败</span>
            </div>
            <div class="result-stat total">
              <span class="stat-number">{{ batchResult?.batch.total_count || 0 }}</span>
              <span class="stat-label">总数</span>
            </div>
          </div>

          <div v-if="batchResult?.items.length" class="result-detail">
            <h4>处理明细</h4>
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>计划编号</th>
                  <th>老人姓名</th>
                  <th>原状态</th>
                  <th>目标状态</th>
                  <th>结果</th>
                  <th>失败原因</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in batchResult.items" :key="item.id">
                  <td>{{ item.plan_no }}</td>
                  <td>{{ item.elder_name }}</td>
                  <td>{{ item.from_status ? STATUS_MAP[item.from_status] : '-' }}</td>
                  <td>{{ item.to_status ? STATUS_MAP[item.to_status] : '-' }}</td>
                  <td>
                    <span :class="['status-tag', item.success ? 'status-completed' : 'status-rejected']">
                      {{ item.success ? '成功' : '失败' }}
                    </span>
                  </td>
                  <td class="col-reason">{{ item.error_message || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="handleResultConfirm">
            确定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useStatisticsStore } from '~/stores/statistics'
import { 
  STATUS_MAP, 
  ASSESSMENT_STATUS_MAP, 
  FAMILY_CONFIRM_STATUS_MAP,
  SHIFT_OPTIONS,
  BATCH_ACTION_MAP,
  type NursingPlan,
  type BatchTransitionResponse
} from '~/types'

definePageMeta({
  layout: 'default'
})

const authStore = useAuthStore()
const statsStore = useStatisticsStore()

const plans = ref<NursingPlan[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const filterStatus = ref('all')

const selectedIds = ref<string[]>([])
const selectAll = ref(false)
const showBatchModal = ref(false)
const batchAction = ref('')
const batchSubmitting = ref(false)
const handoverForm = ref({
  shift: '',
  handoff_person: '',
  receiver_person: '',
  confirm_time: ''
})
const handoverError = ref('')
const rejectReason = ref('')
const rejectError = ref('')

const showResultModal = ref(false)
const batchResult = ref<BatchTransitionResponse | null>(null)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const showBatchBar = computed(() => selectedIds.value.length > 0)

const showAssessmentCol = computed(() => 
  authStore.role === 'registrar' || authStore.role === 'auditor'
)

const showFamilyConfirmCol = computed(() => 
  authStore.role === 'registrar' || authStore.role === 'auditor'
)

const showReturnReasonCol = computed(() => 
  authStore.role === 'registrar' || authStore.role === 'auditor' || authStore.role === 'reviewer'
)

const showAssessmentByCol = computed(() => 
  authStore.role === 'auditor' || authStore.role === 'reviewer'
)

const showPlanLevelCol = computed(() => true)

const canBatchSubmit = computed(() => {
  return selectedIds.value.some(id => {
    const plan = plans.value.find(p => p.id === id)
    return plan && plan.status === 'draft'
  })
})

const canBatchResubmit = computed(() => {
  return selectedIds.value.some(id => {
    const plan = plans.value.find(p => p.id === id)
    return plan && plan.status === 'returned'
  })
})

const canBatchApprove = computed(() => {
  return selectedIds.value.some(id => {
    const plan = plans.value.find(p => p.id === id)
    return plan && plan.status === 'pending_audit'
  })
})

const canBatchReject = computed(() => {
  return selectedIds.value.some(id => {
    const plan = plans.value.find(p => p.id === id)
    return plan && plan.status === 'pending_audit'
  })
})

const canBatchArchive = computed(() => {
  return selectedIds.value.some(id => {
    const plan = plans.value.find(p => p.id === id)
    return plan && plan.status === 'pending_review'
  })
})

const canBatchRejectReviewer = computed(() => {
  return selectedIds.value.some(id => {
    const plan = plans.value.find(p => p.id === id)
    return plan && plan.status === 'pending_review'
  })
})

function canSelect(plan: NursingPlan): boolean {
  if (authStore.role === 'registrar') {
    return plan.status === 'draft' || plan.status === 'returned'
  }
  if (authStore.role === 'auditor') {
    return plan.status === 'pending_audit'
  }
  if (authStore.role === 'reviewer') {
    return plan.status === 'pending_review'
  }
  return false
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return dateStr.replace('T', ' ').substring(0, 16)
}

function toggleSelectAll() {
  if (selectAll.value) {
    selectedIds.value = plans.value
      .filter(p => canSelect(p))
      .map(p => p.id)
  } else {
    selectedIds.value = []
  }
}

function clearSelection() {
  selectedIds.value = []
  selectAll.value = false
}

function handleStatusChange() {
  page.value = 1
  clearSelection()
  loadPlans()
}

async function loadPlans() {
  loading.value = true
  try {
    const statusParam = filterStatus.value === 'all' ? '' : filterStatus.value
    const result = await $fetch(`http://localhost:8001/api/plans/list`, {
      method: 'GET',
      params: {
        status: statusParam,
        page: page.value,
        page_size: pageSize.value
      },
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any

    if (result.success) {
      plans.value = result.data.items
      total.value = result.data.total
    }
  } catch (e) {
    console.error('加载列表失败', e)
  } finally {
    loading.value = false
  }
}

function viewDetail(id: string) {
  navigateTo(`/plans/${id}`)
}

function prevPage() {
  if (page.value > 1) {
    page.value--
    clearSelection()
    loadPlans()
  }
}

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++
    clearSelection()
    loadPlans()
  }
}

function openBatchModal(action: string) {
  batchAction.value = action
  handoverError.value = ''
  rejectError.value = ''
  handoverForm.value = {
    shift: '',
    handoff_person: '',
    receiver_person: '',
    confirm_time: ''
  }
  rejectReason.value = ''
  showBatchModal.value = true
}

function closeBatchModal() {
  showBatchModal.value = false
}

function validateHandover(): boolean {
  if (!handoverForm.value.shift) {
    handoverError.value = '请选择班次'
    return false
  }
  if (!handoverForm.value.handoff_person.trim()) {
    handoverError.value = '请输入交出人'
    return false
  }
  if (!handoverForm.value.receiver_person.trim()) {
    handoverError.value = '请输入接收人'
    return false
  }
  if (!handoverForm.value.confirm_time) {
    handoverError.value = '请选择确认时间'
    return false
  }
  handoverError.value = ''
  return true
}

async function executeBatch() {
  if (batchAction.value === 'approve' || batchAction.value === 'archive') {
    if (!validateHandover()) return
  }

  if (batchAction.value === 'reject') {
    if (!rejectReason.value.trim()) {
      rejectError.value = '请填写退回原因'
      return
    }
    rejectError.value = ''
  }

  batchSubmitting.value = true

  try {
    const body: any = {
      plan_ids: selectedIds.value,
      action: batchAction.value
    }

    if (batchAction.value === 'reject') {
      body.reason = rejectReason.value
    }

    if (batchAction.value === 'approve' || batchAction.value === 'archive') {
      body.handover = {
        shift: handoverForm.value.shift,
        handoff_person: handoverForm.value.handoff_person,
        receiver_person: handoverForm.value.receiver_person,
        confirm_time: handoverForm.value.confirm_time.replace('T', ' ') + ':00'
      }
    }

    const result = await $fetch(`http://localhost:8001/api/plans/batch/transition`, {
      method: 'POST',
      body,
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    }) as any

    if (result.success) {
      batchResult.value = result.data
      showBatchModal.value = false
      showResultModal.value = true
      clearSelection()
      await loadPlans()
      await statsStore.refreshStats()
    } else {
      alert(result.message || '批量操作失败')
    }
  } catch (e: any) {
    console.error('批量操作失败', e)
    alert(e?.data?.message || '批量操作失败')
  } finally {
    batchSubmitting.value = false
  }
}

function closeResultModal() {
  showResultModal.value = false
  batchResult.value = null
}

function handleResultConfirm() {
  closeResultModal()
}

onMounted(() => {
  if (!authStore.isLoggedIn) {
    navigateTo('/login')
    return
  }
  loadPlans()
})
</script>

<style scoped>
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.status-pending {
  background: #fff7e6;
  color: #fa8c16;
}

.status-completed {
  background: #f6ffed;
  color: #52c41a;
}

.status-cancelled {
  background: #f0f0f0;
  color: #999;
}

.status-confirmed {
  background: #f6ffed;
  color: #52c41a;
}

.status-rejected {
  background: #fff1f0;
  color: #f5222d;
}

.col-checkbox {
  width: 40px;
  text-align: center;
}

.row-selected {
  background: #e6f7ff !important;
}

.col-reason {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  background: #f0f5ff;
  border-radius: 4px;
  margin-bottom: 15px;
}

.batch-selected {
  font-weight: bold;
  color: #1890ff;
  margin-right: 10px;
}

.handover-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 10px;
}

.handover-form > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.handover-form label {
  font-size: 13px;
  color: #666;
}

.error-text {
  color: #f5222d;
  font-size: 13px;
  margin-top: 5px;
}

.modal-large {
  width: 800px !important;
  max-width: 90vw;
}

.result-summary {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  justify-content: center;
}

.result-stat {
  text-align: center;
  padding: 20px 30px;
  border-radius: 8px;
  min-width: 100px;
}

.result-stat.success {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}

.result-stat.fail {
  background: #fff1f0;
  border: 1px solid #ffa39e;
}

.result-stat.total {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
}

.stat-number {
  display: block;
  font-size: 28px;
  font-weight: bold;
}

.result-stat.success .stat-number {
  color: #52c41a;
}

.result-stat.fail .stat-number {
  color: #f5222d;
}

.result-stat.total .stat-number {
  color: #1890ff;
}

.stat-label {
  display: block;
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.result-detail h4 {
  margin-bottom: 10px;
}

.table-sm {
  font-size: 13px;
}

.table-sm th,
.table-sm td {
  padding: 8px 10px;
}

.required {
  color: #f5222d;
}

.btn-success {
  background: #52c41a;
  color: white;
}

.btn-success:hover {
  background: #73d13d;
}

.btn-danger {
  background: #ff4d4f;
  color: white;
}

.btn-danger:hover {
  background: #ff7875;
}
</style>
