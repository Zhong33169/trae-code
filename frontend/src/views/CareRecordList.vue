<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { getCareRecords } from '../api/care'

const router = useRouter()
const userStore = useUserStore()

const records = ref([])
const loading = ref(false)
const filterStatus = ref('')
const filterPriority = ref('')
const filterAnomaly = ref(false)
const filterKeyword = ref('')

const statusMap = {
  initiated: '已发起', processing: '办理中', reviewing: '复核中',
  archived: '已归档', returned: '已退回', overdue: '超时'
}

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

onMounted(() => {
  if (!userStore.isLoggedIn) {
    router.push('/login')
    return
  }
  loadRecords()
})

watch([filterStatus, filterPriority, filterAnomaly], loadRecords)

let debounceTimer
watch(filterKeyword, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadRecords, 300)
})
</script>

<template>
  <div>
    <div class="page-title">
      <span>📋 住院护理单列表</span>
      <button v-if="userStore.canInitiate" class="btn btn-primary" @click="router.push('/care-records/new')">
        + 新建护理单
      </button>
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
          <tr v-for="r in records" :key="r.id" :class="{ 'row-overdue': r.is_overdue || r.status === 'overdue' }">
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
  </div>
</template>

<style scoped>
.row-overdue {
  background: #fff8f0 !important;
}
.row-overdue td {
  border-bottom-color: #fde293 !important;
}
</style>
