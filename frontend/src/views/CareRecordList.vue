<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { getCareRecords, batchUpdateStatus, getUsers } from '../api/care'

const router = useRouter()
const userStore = useUserStore()

const records = ref([])
const loading = ref(false)
const filterStatus = ref('')
const filterPriority = ref('')
const filterAnomaly = ref(false)
const filterKeyword = ref('')

const selectedIds = ref([])
const batchAction = ref('')
const showBatchDialog = ref(false)
const batchNurseId = ref(null)
const batchReviewerId = ref(null)
const batchReturnReason = ref('')
const batchResult = ref(null)
const showBatchResult = ref(false)
const batchSubmitting = ref(false)

const nurses = ref([])
const reviewers = ref([])

const statusMap = {
  initiated: '已发起', processing: '办理中', reviewing: '复核中',
  archived: '已归档', returned: '已退回', overdue: '超时'
}

const availableBatchActions = computed(() => {
  const r = userStore.role
  const map = {}
  if (r === 'doctor' || r === 'nurse' || r === 'admin') map['processing'] = '批量办理'
  if (r === 'nurse' || r === 'admin') map['reviewing'] = '批量提交复核'
  if (r === 'reviewer' || r === 'admin') map['archived'] = '批量归档'
  if (r === 'nurse' || r === 'reviewer' || r === 'admin') map['returned'] = '批量退回'
  return Object.entries(map).map(([value, label]) => ({ value, label }))
})

async function loadRecords() {
  loading.value = true
  try {
    const params = {}
    if (filterStatus.value) params.status = filterStatus.value
    if (filterPriority.value) params.priority = filterPriority.value
    if (filterAnomaly.value) params.anomaly = 'true'
    if (filterKeyword.value) params.keyword = filterKeyword.value
    if (userStore.role !== 'admin') {
      params.role = userStore.role
      params.userId = userStore.user?.id
    }
    const res = await getCareRecords(params)
    records.value = res.data
  } catch (e) {
    console.error('加载护理单失败', e)
  }
  loading.value = false
}

async function loadUsers() {
  try {
    const res = await getUsers()
    nurses.value = res.data.filter(u => u.role === 'nurse')
    reviewers.value = res.data.filter(u => u.role === 'reviewer')
  } catch (e) {
    console.error('加载用户列表失败', e)
  }
}

function goDetail(id) {
  router.push(`/care-records/${id}`)
}

function getAttSummary(record) {
  const total = record.attachment_count || 0
  const rejected = record.rejected_attachment_count || 0
  const missing = record.missing_required_count || 0
  const parts = [`${total}个附件`]
  if (rejected > 0) parts.push(`${rejected}个被驳回`)
  if (missing > 0) parts.push(`${missing}个必传缺失`)
  return parts.join('，')
}

function toggleSelect(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function toggleSelectAll() {
  if (selectedIds.value.length === records.value.length && records.value.length > 0) {
    selectedIds.value = []
  } else {
    selectedIds.value = records.value.map(r => r.id)
  }
}

function openBatchDialog() {
  if (selectedIds.value.length === 0) return
  batchAction.value = ''
  batchNurseId.value = null
  batchReviewerId.value = null
  batchReturnReason.value = ''
  batchResult.value = null
  showBatchDialog.value = true
}

async function submitBatch() {
  if (!batchAction.value) return
  if (batchAction.value === 'processing' && !batchNurseId.value && userStore.role !== 'nurse') return
  if (batchAction.value === 'reviewing' && !batchReviewerId.value && userStore.role !== 'reviewer') return
  if (batchAction.value === 'returned' && !batchReturnReason.value.trim()) return

  batchSubmitting.value = true
  try {
    const payload = {
      ids: selectedIds.value,
      status: batchAction.value
    }
    if (batchAction.value === 'processing' && batchNurseId.value) payload.nurse_id = batchNurseId.value
    if (batchAction.value === 'reviewing' && batchReviewerId.value) payload.reviewer_id = batchReviewerId.value
    if (batchAction.value === 'returned') payload.return_reason = batchReturnReason.value

    const res = await batchUpdateStatus(payload)
    batchResult.value = res.data
    showBatchDialog.value = false
    showBatchResult.value = true
    selectedIds.value = []
    loadRecords()
    userStore.refreshCareList()
  } catch (e) {
    alert(e.response?.data?.error || '批量操作失败')
  }
  batchSubmitting.value = false
}

onMounted(() => {
  if (!userStore.isLoggedIn) {
    router.push('/login')
    return
  }
  loadRecords()
  loadUsers()
})

watch([filterStatus, filterPriority, filterAnomaly], loadRecords)

watch(() => userStore.careListRefreshKey, () => {
  loadRecords()
})

let debounceTimer
watch(filterKeyword, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadRecords, 300)
})
</script>

<template>
  <div>
    <div class="page-title">
      <span>住院护理单列表</span>
      <div style="display:flex;gap:8px">
        <button v-if="selectedIds.length > 0" class="btn btn-warning" @click="openBatchDialog">
          批量操作 ({{ selectedIds.length }})
        </button>
        <button v-if="userStore.canInitiate" class="btn btn-primary" @click="router.push('/care-records/new')">
          + 新建护理单
        </button>
      </div>
    </div>

    <div class="toolbar">
      <select v-model="filterStatus">
        <option value="">全部状态</option>
        <option value="initiated">已发起</option>
        <option value="processing">办理中</option>
        <option value="reviewing">复核中</option>
        <option value="archived">已归档</option>
        <option value="returned">已退回</option>
        <option value="overdue">超时</option>
      </select>
      <select v-model="filterPriority">
        <option value="">全部优先级</option>
        <option value="normal">普通</option>
        <option value="urgent">紧急</option>
        <option value="critical">危重</option>
      </select>
      <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer">
        <input type="checkbox" v-model="filterAnomaly" /> 仅显示异常
      </label>
      <input v-model="filterKeyword" placeholder="搜索宠物名/主人/诊断..." style="width:200px" />
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table v-if="records.length">
        <thead>
          <tr>
            <th style="width:36px">
              <input type="checkbox" :checked="selectedIds.length === records.length && records.length > 0" @change="toggleSelectAll" />
            </th>
            <th>编号</th>
            <th>宠物</th>
            <th>主人</th>
            <th>诊断</th>
            <th>状态</th>
            <th>优先级</th>
            <th>负责医生</th>
            <th>护理护士</th>
            <th>附件</th>
            <th>入院日期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in records" :key="r.id" :class="{ 'row-overdue': r.is_overdue || r.status === 'overdue', 'row-selected': selectedIds.includes(r.id) }">
            <td>
              <input type="checkbox" :checked="selectedIds.includes(r.id)" @change="toggleSelect(r.id)" />
            </td>
            <td>#{{ r.id }}</td>
            <td><strong>{{ r.pet_name }}</strong><span v-if="r.species" style="color:#999;margin-left:4px">({{ r.species }})</span></td>
            <td>{{ r.owner_name }}</td>
            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="r.diagnosis">{{ r.diagnosis }}</td>
            <td>
              <span class="status-badge" :class="`status-${r.status}`">
                {{ statusMap[r.status] || r.status }}
              </span>
            </td>
            <td><span class="priority-badge" :class="`priority-${r.priority}`">{{ {normal:'普通',urgent:'紧急',critical:'危重'}[r.priority] }}</span></td>
            <td>{{ r.doctor_name || '-' }}</td>
            <td>{{ r.nurse_name || '-' }}</td>
            <td>
              <span :style="{color: r.rejected_attachment_count > 0 || r.missing_required_count > 0 ? '#c5221f' : '#333'}">
                {{ getAttSummary(r) }}
              </span>
            </td>
            <td>{{ r.admission_date?.slice(0,10) }}</td>
            <td>
              <button class="btn btn-sm btn-info" @click="goDetail(r.id)">详情</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        {{ loading ? '加载中...' : '暂无护理单数据' }}
      </div>
    </div>

    <div v-if="showBatchDialog" class="dialog-overlay" @click.self="showBatchDialog = false">
      <div class="dialog-box" style="min-width:420px">
        <h3>批量操作 ({{ selectedIds.length }} 条)</h3>
        <div class="form-group">
          <label>操作类型 *</label>
          <select v-model="batchAction">
            <option value="">请选择操作</option>
            <option v-for="a in availableBatchActions" :key="a.value + a.label" :value="a.value">{{ a.label }}</option>
          </select>
        </div>
        <div v-if="batchAction === 'processing' && userStore.role !== 'nurse'" class="form-group">
          <label>经办护士 *</label>
          <select v-model="batchNurseId">
            <option value="">请选择护士</option>
            <option v-for="n in nurses" :key="n.id" :value="n.id">{{ n.name }}</option>
          </select>
        </div>
        <div v-if="batchAction === 'processing' && userStore.role === 'nurse'" class="form-group">
          <label>经办护士</label>
          <p style="color:#666;font-size:13px">将以当前登录护士 ({{ userStore.user?.name }}) 作为经办护士</p>
        </div>
        <div v-if="batchAction === 'reviewing' && userStore.role !== 'reviewer'" class="form-group">
          <label>复核人 *</label>
          <select v-model="batchReviewerId">
            <option value="">请选择复核人</option>
            <option v-for="r in reviewers" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>
        <div v-if="batchAction === 'reviewing' && userStore.role === 'reviewer'" class="form-group">
          <label>复核人</label>
          <p style="color:#666;font-size:13px">将以当前登录复核员 ({{ userStore.user?.name }}) 作为复核人</p>
        </div>
        <div v-if="batchAction === 'returned'" class="form-group">
          <label>退回原因 *</label>
          <textarea v-model="batchReturnReason" rows="3" placeholder="请填写退回原因"></textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-outline" @click="showBatchDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="!batchAction || batchSubmitting" @click="submitBatch">
            {{ batchSubmitting ? '处理中...' : '确认执行' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showBatchResult" class="dialog-overlay" @click.self="showBatchResult = false">
      <div class="dialog-box" style="min-width:500px;max-height:80vh;overflow-y:auto">
        <h3>批量操作结果</h3>
        <div v-if="batchResult" style="margin-bottom:12px">
          <p>总计: {{ batchResult.total }} 条 | 成功: <span style="color:#1e8e3e">{{ batchResult.success_count }}</span> | 失败: <span style="color:#c5221f">{{ batchResult.fail_count }}</span></p>
        </div>
        <table v-if="batchResult" style="width:100%;font-size:13px">
          <thead>
            <tr>
              <th>编号</th>
              <th>结果</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in batchResult.results" :key="r.id" :style="{background: r.success ? '#f0fdf4' : '#fef2f2'}">
              <td>#{{ r.id }}</td>
              <td><span :style="{color: r.success ? '#1e8e3e' : '#c5221f', fontWeight:'bold'}">{{ r.success ? '成功' : '失败' }}</span></td>
              <td>{{ r.message }}</td>
            </tr>
          </tbody>
        </table>
        <div style="text-align:right;margin-top:12px">
          <button class="btn btn-primary" @click="showBatchResult = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.row-overdue {
  background: #fff8f0 !important;
}
.row-overdue td {
  border-bottom-color: #fde293 !important;
}
.row-selected {
  background: #e8f0fe !important;
}
</style>
