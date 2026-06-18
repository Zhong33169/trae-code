<template>
  <div class="page-container">
    <el-card shadow="never">
      <el-form :inline="true" :model="filters" style="margin-bottom:16px;">
        <el-form-item label="状态">
          <el-select v-model="filters.status" clearable placeholder="全部状态">
            <el-option v-for="s in allStatus" :key="s.key" :label="s.label" :value="s.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="filters.priority" clearable placeholder="全部优先级">
            <el-option label="紧急" value="urgent" />
            <el-option label="高" value="high" />
            <el-option label="普通" value="normal" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="案件类型">
          <el-select v-model="filters.case_type" clearable placeholder="全部类型">
            <el-option v-for="t in caseTypes" :key="t.key" :label="t.label" :value="t.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="异常标记">
          <el-checkbox v-model="filters.is_overdue">只看超时</el-checkbox>
          <el-checkbox v-model="filters.attachment_issue" style="margin-left:12px;">只看附件异常</el-checkbox>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="filters.keyword" placeholder="案号/案件名/当事人" clearable style="width:260px;" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadList"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="resetFilters"><el-icon><Refresh /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>

      <div style="display:flex; gap:10px; margin-bottom:14px;">
        <el-button type="primary" @click="$router.push('/materials/new')" v-if="userStore.can('register')">
          <el-icon><Plus /></el-icon>新建登记
        </el-button>
        <el-button type="warning" @click="openBatch('pass_review')"
                   :disabled="!hasSelection || !userStore.can('batch_process') || userStore.role !== 'reviewer'">
          <el-icon><Checked /></el-icon>批量审核通过（审核主管）
        </el-button>
        <el-button type="success" @click="openBatch('pass_verify')"
                   :disabled="!hasSelection || !userStore.can('batch_process') || userStore.role !== 'verifier'">
          <el-icon><CircleCheck /></el-icon>批量复核通过（复核负责人）
        </el-button>
        <el-button @click="openBatch('archive')"
                   :disabled="!hasSelection || !userStore.can('archive')"
                   type="info">
          <el-icon><FolderChecked /></el-icon>批量归档
        </el-button>
        <div style="flex:1;"></div>
        <div style="color:#909399; font-size:13px; align-self:center;">
          共 {{ filteredList.length }} 条，已选 {{ selectedIds.length }} 条
        </div>
      </div>

      <el-table
        :data="filteredList"
        border
        stripe
        v-loading="loading"
        @selection-change="onSelectionChange"
        @row-dblclick="(row) => $router.push(`/materials/${row.id}`)"
        style="width:100%;"
      >
        <el-table-column type="selection" width="44" :selectable="(row) => row.status !== 'archived'" />
        <el-table-column label="案号" width="150" fixed="left">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/materials/${row.id}`)">
              {{ row.case_no }}
            </el-link>
            <el-tag v-if="row.is_overdue" type="danger" size="small" style="margin-left:4px;" effect="dark">超时</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="case_name" label="案件名称" min-width="220" show-overflow-tooltip />
        <el-table-column label="当事人" min-width="220">
          <template #default="{ row }">
            <div style="font-size:12px;">
              <div>原：{{ row.plaintiff || '-' }}</div>
              <div>被：{{ row.defendant || '-' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="court_name" label="管辖/机构" min-width="180" show-overflow-tooltip />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ caseTypeLabel(row.case_type) }}</template>
        </el-table-column>
        <el-table-column label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="priorityType(row.priority)" size="small">{{ priorityLabel(row.priority) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="附件" width="130">
          <template #default="{ row }">
            <div style="font-size:12px;">
              <div>总数：<b>{{ (row.attachments || []).length }}</b></div>
              <div style="margin-top:2px;">
                必填：<span :style="{ color: requiredOk(row) ? '#67c23a' : '#f56c6c' }">
                  {{ requiredCount(row) }}/{{ row.attachments?.filter(a => a.is_required).length || 0 }}
                </span>
                <span v-if="!requiredOk(row)" style="color:#f56c6c; margin-left:4px;">！</span>
              </div>
              <el-tag v-if="rejectedCount(row) > 0" type="danger" size="small" style="margin-top:2px;">
                驳回 {{ rejectedCount(row) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="登记信息" width="150">
          <template #default="{ row }">
            <div style="font-size:12px;">
              <div>{{ row.registered_by_name || '-' }}</div>
              <div style="color:#909399;">{{ formatTime(row.registered_at) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="截止" width="160">
          <template #default="{ row }">
            <div v-if="row.deadline" style="font-size:12px;">
              <div :style="{ color: row.is_overdue ? '#f56c6c' : '#606266', fontWeight: row.is_overdue ? 'bold' : 'normal' }">
                {{ formatTime(row.deadline) }}
              </div>
              <div v-if="row.is_overdue" style="color:#f56c6c;">
                超期 {{ row.overdue_hours }} 小时
              </div>
            </div>
            <span v-else style="color:#c0c4cc;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" plain @click="$router.push(`/materials/${row.id}`)">
              详情
            </el-button>
            <template v-if="(row.status === 'registered' || row.status === 'returned') && userStore.can('review')">
              <el-button size="small" type="primary" @click="takeReview(row.id)">领取审核</el-button>
            </template>
            <template v-if="row.status === 'review_passed' && userStore.can('verify')">
              <el-button size="small" type="success" @click="takeVerify(row.id)">领取复核</el-button>
            </template>
            <template v-if="row.status === 'verified' && userStore.can('archive')">
              <el-button size="small" type="info" @click="archiveOne(row.id)">归档</el-button>
            </template>
            <template v-if="row.status === 'returned' && userStore.can('register')">
              <el-button size="small" type="warning" @click="resubmitOne(row.id)">
                重新提交
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="batchDialog" title="批量处理确认" width="680px">
      <el-alert v-if="batchAction === 'pass_review'" type="warning" :closable="false" show-icon style="margin-bottom:12px;">
        <b>批量审核通过（诉讼材料审核主管办理）</b>：会对所有已登记且附件齐全的单据批量通过审核。<br/>
        附件缺失或被驳回的单据会被自动跳过，并在下方逐条说明原因。
      </el-alert>
      <el-alert v-if="batchAction === 'pass_verify'" type="success" :closable="false" show-icon style="margin-bottom:12px;">
        <b>批量复核通过（法务服务中心复核负责人办理）</b>：对审核通过的单据批量复核。
      </el-alert>
      <el-alert v-if="batchAction === 'archive'" type="info" :closable="false" show-icon style="margin-bottom:12px;">
        <b>批量归档（法务服务中心复核负责人办理）</b>：对已复核通过的单据完成归档。
      </el-alert>

      <el-form :model="batchForm" label-width="100px">
        <el-form-item label="批次名称">
          <el-input v-model="batchForm.batch_name" placeholder="例：2026年6月第一批批量审核" />
        </el-form-item>
        <el-form-item label="审计备注">
          <el-input v-model="batchForm.audit_remark" type="textarea" :rows="2" placeholder="记录本次批量处理的备注说明" />
        </el-form-item>
        <el-form-item label="选择单据">
          <el-tag v-for="(mid, i) in selectedIds" :key="mid" style="margin:4px 4px 4px 0;" closable @close="removeSelection(i)">
            {{ caseNoMap[mid] || mid }}
          </el-tag>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="batchDialog = false">取消</el-button>
        <el-button type="primary" :loading="batchLoading" @click="confirmBatch">执行批量处理</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchResultDialog" title="批量处理结果" width="760px">
      <el-row :gutter="12" style="margin-bottom:16px;">
        <el-col :span="6">
          <el-statistic title="总数" :value="batchResult.total_count" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="成功" :value="batchResult.success_count">
            <template #suffix><el-icon style="color:#67c23a;"><CircleCheck /></el-icon></template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="失败" :value="batchResult.fail_count">
            <template #suffix><el-icon style="color:#f56c6c;"><Warning /></el-icon></template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="跳过" :value="batchResult.skip_count">
            <template #suffix><el-icon style="color:#e6a23c;"><DArrowRight /></el-icon></template>
          </el-statistic>
        </el-col>
      </el-row>

      <el-table :data="batchResult.details || []" border size="small">
        <el-table-column label="结果" width="80">
          <template #default="{ row }">
            <el-tag :type="row.result === '成功' ? 'success' : (row.result === '失败' ? 'danger' : 'warning')" size="small">
              {{ row.result }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="case_no" label="案号" width="150" />
        <el-table-column prop="case_name" label="案件名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="reason" label="说明" min-width="320" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.result === '成功'" style="color:#67c23a;">{{ row.reason }}</span>
            <span v-else-if="row.result === '失败'" style="color:#f56c6c;">{{ row.reason }}</span>
            <span v-else style="color:#e6a23c;">{{ row.reason }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useUserStore } from '../stores/user'
import api from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const userStore = useUserStore()
const loading = ref(false)
const list = ref([])
const selectedIds = ref([])
const caseNoMap = ref({})

const filters = reactive({
  status: '',
  priority: '',
  case_type: '',
  keyword: '',
  is_overdue: false,
  attachment_issue: false,
})

const allStatus = [
  { key: 'registered', label: '待审核（已登记）' },
  { key: 'reviewing', label: '审核中' },
  { key: 'review_passed', label: '待复核（审核通过）' },
  { key: 'returned', label: '已退回补正' },
  { key: 'verifying', label: '复核中' },
  { key: 'verified', label: '待归档（复核通过）' },
  { key: 'archived', label: '已归档' },
]
const caseTypes = [
  { key: 'civil', label: '民事案件' },
  { key: 'commercial', label: '商事案件' },
  { key: 'labor', label: '劳动争议' },
  { key: 'ip', label: '知识产权' },
  { key: 'insurance', label: '保险纠纷' },
  { key: 'criminal', label: '刑事案件' },
  { key: 'admin', label: '行政案件' },
]

const batchDialog = ref(false)
const batchResultDialog = ref(false)
const batchAction = ref('')
const batchLoading = ref(false)
const batchForm = reactive({ batch_name: '', audit_remark: '' })
const batchResult = reactive({ total_count: 0, success_count: 0, fail_count: 0, skip_count: 0, details: [] })

const hasSelection = computed(() => selectedIds.value.length > 0)

const filteredList = computed(() => {
  let l = list.value
  if (filters.attachment_issue) {
    l = l.filter((row) =>
      (row.attachments || []).some((a) => a.is_required && a.status === 'rejected')
    )
  }
  return l
})

function statusLabel(s) {
  return {
    registered: '待审核', reviewing: '审核中', review_passed: '待复核',
    returned: '退回补正', verifying: '复核中', verified: '待归档', archived: '已归档',
  }[s] || s
}
function statusTagType(s) {
  return {
    registered: 'warning', reviewing: 'primary', review_passed: 'success',
    returned: 'danger', verifying: 'warning', verified: 'success', archived: 'info',
  }[s] || 'info'
}
function priorityLabel(p) {
  return { urgent: '紧急', high: '高', normal: '普通', low: '低' }[p] || p
}
function priorityType(p) {
  return { urgent: 'danger', high: 'warning', normal: 'info', low: 'success' }[p] || 'info'
}
function caseTypeLabel(t) {
  return {
    civil: '民事', commercial: '商事', labor: '劳动', ip: '知产',
    insurance: '保险', criminal: '刑事', admin: '行政',
  }[t] || (t || '-')
}
function formatTime(t) {
  if (!t) return '-'
  try {
    const d = new Date(t)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return t }
}
function requiredCount(row) {
  return (row.attachments || []).filter((a) => a.is_required && a.status === 'valid').length
}
function requiredOk(row) {
  const req = (row.attachments || []).filter((a) => a.is_required)
  return req.length === 0 || req.every((a) => a.status === 'valid')
}
function rejectedCount(row) {
  return (row.attachments || []).filter((a) => a.status === 'rejected').length
}

async function loadList() {
  loading.value = true
  try {
    const res = await api.get('/materials/', {
      params: {
        status: filters.status || undefined,
        keyword: filters.keyword || undefined,
        case_type: filters.case_type || undefined,
        priority: filters.priority || undefined,
        is_overdue: filters.is_overdue || undefined,
      },
    })
    if (res.data.success) {
      list.value = res.data.data || []
      caseNoMap.value = {}
      list.value.forEach((r) => { caseNoMap.value[r.id] = r.case_no })
    }
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.status = ''
  filters.priority = ''
  filters.case_type = ''
  filters.keyword = ''
  filters.is_overdue = false
  filters.attachment_issue = false
  loadList()
}

function onSelectionChange(rows) {
  selectedIds.value = rows.map((r) => r.id)
}

function removeSelection(i) {
  selectedIds.value.splice(i, 1)
}

async function takeReview(id) {
  await ElMessageBox.confirm('确定领取该材料单进入审核流程？', '领取审核', { type: 'info' }).catch(() => {})
  const res = await api.post(`/materials/${id}/take_review`, { operator_id: userStore.user.id })
  if (res.data.success) {
    ElMessage.success('已领取审核任务')
    loadList()
  }
}

async function takeVerify(id) {
  await ElMessageBox.confirm('确定领取该材料单进入复核流程？', '领取复核', { type: 'info' }).catch(() => {})
  const res = await api.post(`/materials/${id}/take_verify`, { operator_id: userStore.user.id })
  if (res.data.success) {
    ElMessage.success('已领取复核任务')
    loadList()
  }
}

async function archiveOne(id) {
  await ElMessageBox.confirm('确定归档该材料单？归档后不可再修改。', '归档确认', { type: 'warning' }).catch(() => {})
  const res = await api.post(`/materials/${id}/archive`, { operator_id: userStore.user.id })
  if (res.data.success) {
    ElMessage.success('已归档')
    loadList()
  }
}

async function resubmitOne(id) {
  await ElMessageBox.confirm('确认附件已补齐，要重新提交进入审核队列？', '重新提交', { type: 'warning' }).catch(() => {})
  const res = await api.post(`/materials/${id}/resubmit`, { operator_id: userStore.user.id })
  if (res.data.success) {
    ElMessage.success('已重新提交审核')
    loadList()
  }
}

function openBatch(action) {
  batchAction.value = action
  batchForm.batch_name = `批量${action === 'pass_review' ? '审核' : action === 'pass_verify' ? '复核' : '归档'}-${formatTime(new Date().toISOString())}`
  batchForm.audit_remark = ''
  batchDialog.value = true
}

async function confirmBatch() {
  batchLoading.value = true
  try {
    const res = await api.post('/materials/batch/process', {
      material_ids: selectedIds.value,
      operator_id: userStore.user.id,
      action: batchAction.value,
      batch_name: batchForm.batch_name,
      audit_remark: batchForm.audit_remark || undefined,
    })
    if (res.data.success) {
      const d = res.data.data
      Object.assign(batchResult, d)
      batchDialog.value = false
      batchResultDialog.value = true
      loadList()
      selectedIds.value = []
    }
  } finally {
    batchLoading.value = false
  }
}

onMounted(loadList)
watch(() => userStore.role, loadList)
</script>
