<script setup>
import { ref, onMounted } from 'vue'
import { searchAuditLogs } from '../api/care'

const logs = ref([])
const loading = ref(false)
const filterAction = ref('')
const filterRole = ref('')
const filterKeyword = ref('')
const startDate = ref('')
const endDate = ref('')

const actionLabels = {
  create: '创建', status_change: '状态变更', upload_attachment: '上传附件',
  approve_attachment: '审核通过', reject_attachment: '驳回附件',
  supplement_attachment: '补传标记', add_medication: '添加用药',
  update_medication: '更新用药', create_discharge: '创建出院确认',
  discharge_confirmed: '出院确认', discharge_rejected: '出院驳回',
  returned_recorded: '退回记录', overdue_recorded: '超时记录',
  status_change_failed: '状态变更失败', update: '更新信息'
}

async function loadLogs() {
  loading.value = true
  try {
    const params = {}
    if (filterAction.value) params.action = filterAction.value
    if (filterRole.value) params.actor_role = filterRole.value
    if (filterKeyword.value) params.keyword = filterKeyword.value
    if (startDate.value) params.start_date = startDate.value
    if (endDate.value) params.end_date = endDate.value
    const res = await searchAuditLogs(params)
    logs.value = res.data
  } catch (e) {
    console.error('加载审计日志失败', e)
  }
  loading.value = false
}

onMounted(loadLogs)
</script>

<template>
  <div>
    <div class="page-title">🔍 审计日志</div>

    <div class="toolbar">
      <select v-model="filterAction" @change="loadLogs">
        <option value="">全部操作</option>
        <option v-for="(label, key) in actionLabels" :key="key" :value="key">{{ label }}</option>
      </select>
      <select v-model="filterRole" @change="loadLogs">
        <option value="">全部角色</option>
        <option value="doctor">医生</option>
        <option value="nurse">护士</option>
        <option value="reviewer">复核员</option>
        <option value="admin">管理员</option>
        <option value="system">系统</option>
      </select>
      <input v-model="startDate" type="date" @change="loadLogs" style="width:140px" />
      <span style="color:#999">至</span>
      <input v-model="endDate" type="date" @change="loadLogs" style="width:140px" />
      <input v-model="filterKeyword" placeholder="搜索操作人/详情..." style="width:180px" @keyup.enter="loadLogs" />
      <button class="btn btn-sm btn-primary" @click="loadLogs">搜索</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table v-if="logs.length">
        <thead>
          <tr>
            <th>时间</th>
            <th>操作人</th>
            <th>角色</th>
            <th>护理单</th>
            <th>操作类型</th>
            <th>详情</th>
            <th>原因</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id" :class="{ 'row-failed': log.action.includes('failed') || log.action.includes('reject') || log.action === 'returned_recorded' || log.action === 'overdue_recorded' }">
            <td style="white-space:nowrap">{{ log.created_at }}</td>
            <td><strong>{{ log.actor_name }}</strong></td>
            <td>{{ log.actor_role }}</td>
            <td>
              <router-link v-if="log.care_record_id" :to="`/care-records/${log.care_record_id}`" style="color:#1a73e8;text-decoration:none">
                #{{ log.care_record_id }}
              </router-link>
              <span v-else>-</span>
            </td>
            <td>
              <span class="status-badge" :class="log.action.includes('reject') || log.action.includes('failed') || log.action === 'returned_recorded' || log.action === 'overdue_recorded' ? 'status-returned' : log.action.includes('approve') || log.action === 'discharge_confirmed' ? 'status-processing' : 'status-initiated'">
                {{ actionLabels[log.action] || log.action }}
              </span>
            </td>
            <td style="max-width:300px">{{ log.detail }}</td>
            <td style="max-width:200px;color:#c5221f">{{ log.reason || '-' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">{{ loading ? '加载中...' : '暂无审计日志' }}</div>
    </div>
  </div>
</template>

<style scoped>
.row-failed { background: #fff8f0 !important; }
</style>
