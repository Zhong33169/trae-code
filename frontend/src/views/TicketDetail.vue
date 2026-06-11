<template>
  <div class="ticket-detail-page">
    <div class="detail-header">
      <el-button :icon="ArrowLeft" link @click="goBack">
        返回列表
      </el-button>
      <h2 class="page-title">工单详情</h2>
      <div class="header-actions">
        <template v-if="canAssign">
          <el-button type="warning" @click="openAssign">
            问题派单
          </el-button>
        </template>
        <template v-if="canStartReturnVisit">
          <el-button type="primary" @click="openStartReturnVisit">
            开始回访
          </el-button>
        </template>
        <template v-if="canCloseReturnVisit">
          <el-button type="success" @click="openCloseReturnVisit">
            回访关闭
          </el-button>
        </template>
        <template v-if="canHandover">
          <el-button :icon="Switch" @click="openHandover">
            交接
          </el-button>
        </template>
      </div>
    </div>

    <div class="detail-content" v-loading="ticketStore.detailLoading">
      <el-row :gutter="16">
        <el-col :span="16">
          <el-card class="info-card" shadow="never">
            <template #header>
              <div class="card-header">
                <span class="card-title">基本信息</span>
                <el-tag :type="getStatusType(ticket?.status)" size="large">
                  {{ getStatusLabel(ticket?.status) }}
                </el-tag>
              </div>
            </template>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="工单号">
                {{ ticket?.id }}
              </el-descriptions-item>
              <el-descriptions-item label="标题">
                {{ ticket?.title }}
              </el-descriptions-item>
              <el-descriptions-item label="客户姓名">
                {{ ticket?.customer_name }}
              </el-descriptions-item>
              <el-descriptions-item label="联系电话">
                {{ ticket?.customer_phone }}
              </el-descriptions-item>
              <el-descriptions-item label="创建人">
                {{ ticket?.creator_name || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                {{ formatDateTime(ticket?.created_at) }}
              </el-descriptions-item>
              <el-descriptions-item label="问题描述" :span="2">
                {{ ticket?.description }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card class="track-card" shadow="never">
            <template #header>
              <div class="card-header">
                <span class="card-title">处理轨迹</span>
              </div>
            </template>
            <el-timeline>
              <el-timeline-item
                v-for="(track, index) in tracks"
                :key="track.id || index"
                :timestamp="formatDateTime(track.time)"
                :type="getTimelineType(track.type)"
                :icon="getTimelineIcon(track.type)"
              >
                <div class="track-item">
                  <div class="track-title">{{ track.title }}</div>
                  <div class="track-operator">操作人：{{ track.operator }}</div>
                  <div class="track-content" v-if="track.remark">
                    {{ track.remark }}
                  </div>
                </div>
              </el-timeline-item>
            </el-timeline>
            <div v-if="!tracks.length" class="empty-track">
              <el-empty description="暂无处理轨迹" :image-size="80" />
            </div>
          </el-card>
        </el-col>

        <el-col :span="8">
          <el-card class="side-card" shadow="never">
            <template #header>
              <span class="card-title">交接记录</span>
            </template>
            <div class="side-content" v-if="handoverRecords.length">
              <div
                v-for="record in handoverRecords"
                :key="record.id"
                class="handover-item"
              >
                <div class="handover-header">
                  <el-tag :type="getHandoverStatusType(record.status)" size="small">
                    {{ getHandoverStatusLabel(record.status) }}
                  </el-tag>
                  <span class="handover-shift">{{ getShiftLabel(record.shift) }}</span>
                </div>
                <div class="handover-time">
                  {{ formatDateTime(record.handover_time || record.created_at) }}
                </div>
                <div class="handover-info">
                  <span>交出人：{{ record.from_user_name }}（{{ getRoleLabel(record.from_role) }}）</span>
                </div>
                <div class="handover-info">
                  <span>接收人：{{ record.to_user_name }}（{{ getRoleLabel(record.to_role) }}）</span>
                </div>
                <div class="handover-info" v-if="record.remark">
                  <span>备注：{{ record.remark }}</span>
                </div>
                <div class="handover-actions" v-if="canAcceptHandover(record)">
                  <el-button type="success" size="small" @click="handleAcceptHandover(record)">
                    签收
                  </el-button>
                  <el-button type="danger" size="small" @click="handleRejectHandover(record)">
                    异常回传
                  </el-button>
                </div>
              </div>
            </div>
            <el-empty v-else description="暂无交接记录" :image-size="60" />
          </el-card>

          <el-card class="side-card" shadow="never">
            <template #header>
              <span class="card-title">操作日志</span>
            </template>
            <div class="side-content" v-if="operationLogs.length">
              <div
                v-for="log in operationLogs"
                :key="log.id"
                class="log-item"
              >
                <div class="log-action">{{ getLogTitle(log.action) }}</div>
                <div class="log-time">{{ formatDateTime(log.created_at) }}</div>
                <div class="log-operator">操作人：{{ log.user_name }}</div>
                <div class="log-remark" v-if="log.detail">{{ log.detail }}</div>
              </div>
            </div>
            <el-empty v-else description="暂无操作日志" :image-size="60" />
          </el-card>
        </el-col>
      </el-row>
    </div>

    <AssignTicketDialog
      v-model="assignVisible"
      :ticket-id="ticketId"
      :ticket-title="ticket?.title"
      @success="handleRefresh"
    />
    <CloseTicketDialog
      v-model="closeVisible"
      :ticket-id="ticketId"
      :ticket-title="ticket?.title"
      :target-status="ticket?.status === 'dispatched' ? 'return_visit' : 'closed'"
      @success="handleRefresh"
    />
    <HandoverDialog
      v-model="handoverVisible"
      :ticket-id="ticketId"
      :ticket-title="ticket?.title"
      @success="handleRefresh"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Document,
  Clock,
  User,
  CircleCheck,
  Warning,
  Phone,
  Switch
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useTicketStore } from '@/stores/ticket'
import { formatDateTime } from '@/utils/format'
import AssignTicketDialog from '@/components/AssignTicketDialog.vue'
import CloseTicketDialog from '@/components/CloseTicketDialog.vue'
import HandoverDialog from '@/components/HandoverDialog.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const ticketStore = useTicketStore()

const ticketId = computed(() => route.params.id)
const detailData = computed(() => ticketStore.detail)
const ticket = computed(() => detailData.value)
const handoverRecords = computed(() => detailData.value?.handover_records || [])
const operationLogs = computed(() => detailData.value?.operation_logs || [])

const tracks = computed(() => {
  const allTracks = []
  
  if (ticket.value) {
    allTracks.push({
      id: 'create',
      type: 'create',
      title: '工单创建',
      time: ticket.value.created_at,
      operator: ticket.value.creator_name || '系统',
      remark: ticket.value.description
    })
  }
  
  handoverRecords.value.forEach(record => {
    allTracks.push({
      id: `handover-${record.id}`,
      type: record.status === 'accepted' ? 'sign' : record.status === 'rejected' ? 'abnormal' : 'assign',
      title: getHandoverStatusLabel(record.status) + '交接',
      time: record.handover_time || record.created_at,
      operator: record.to_user_name || '未知',
      remark: record.remark
    })
  })
  
  operationLogs.value.forEach(log => {
    allTracks.push({
      id: `log-${log.id}`,
      type: getLogType(log.action),
      title: getLogTitle(log.action),
      time: log.created_at,
      operator: log.user_name || '系统',
      remark: log.detail
    })
  })
  
  allTracks.sort((a, b) => {
    return new Date(a.time) - new Date(b.time)
  })
  
  return allTracks
})

const assignVisible = ref(false)
const closeVisible = ref(false)
const handoverVisible = ref(false)

const canAssign = computed(() => {
  return ticket.value?.status === 'incoming' &&
    (authStore.role === 'cs_manager' || authStore.role === 'qa_manager')
})

const canStartReturnVisit = computed(() => {
  return ticket.value?.status === 'dispatched' &&
    (authStore.role === 'cs_manager' || authStore.role === 'qa_manager')
})

const canCloseReturnVisit = computed(() => {
  return ticket.value?.status === 'return_visit' &&
    (authStore.role === 'cs_manager' || authStore.role === 'qa_manager')
})

const canHandover = computed(() => {
  if (ticket.value?.status === 'closed') return false
  if (authStore.role === 'agent') return true
  if (authStore.role === 'qa_manager') return true
  return false
})

const closeTargetStatus = computed(() => {
  if (ticket.value?.status === 'dispatched') {
    return 'return_visit'
  }
  return 'closed'
})

const closeButtonText = computed(() => {
  if (ticket.value?.status === 'dispatched') {
    return '开始回访'
  }
  return '回访关闭'
})

function canAcceptHandover(record) {
  if (record.status !== 'pending') return false
  if (record.to_user !== authStore.user?.id) return false
  if (authStore.role === 'qa_manager' && record.from_role === 'agent') return true
  if (authStore.role === 'cs_manager' && record.from_role === 'qa_manager') return true
  return false
}

onMounted(() => {
  fetchDetail()
})

async function fetchDetail() {
  await ticketStore.fetchDetail(ticketId.value)
}

function goBack() {
  router.push('/tickets')
}

function openAssign() {
  assignVisible.value = true
}

function openStartReturnVisit() {
  closeVisible.value = true
}

function openCloseReturnVisit() {
  closeVisible.value = true
}

function openHandover() {
  handoverVisible.value = true
}

async function handleAcceptHandover(record) {
  try {
    await ElMessageBox.confirm(
      '确定要签收这个交接吗？',
      '确认签收',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await ticketStore.handleAcceptHandover(record.id)
    ElMessage.success('签收成功')
    handleRefresh()
  } catch {
  }
}

async function handleRejectHandover(record) {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入异常回传备注',
      '异常回传',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入异常原因',
        inputValidator: (value) => {
          if (!value) return '请输入异常原因'
          return true
        }
      }
    )
    await ticketStore.handleRejectHandover(record.id, { remark: value })
    ElMessage.success('异常回传成功')
    handleRefresh()
  } catch {
  }
}

function handleRefresh() {
  fetchDetail()
  ticketStore.fetchStats()
}

function getStatusLabel(status) {
  const map = {
    incoming: '来电登记',
    dispatched: '问题派单',
    return_visit: '回访中',
    closed: '已关闭',
    exception: '异常回传'
  }
  return map[status] || status || '-'
}

function getStatusType(status) {
  const map = {
    incoming: 'info',
    dispatched: 'warning',
    return_visit: 'primary',
    closed: 'success',
    exception: 'danger'
  }
  return map[status] || ''
}

function getHandoverStatusLabel(status) {
  const map = {
    pending: '待签收',
    accepted: '签收完成',
    rejected: '异常回传'
  }
  return map[status] || status
}

function getHandoverStatusType(status) {
  const map = {
    pending: 'warning',
    accepted: 'success',
    rejected: 'danger'
  }
  return map[status] || ''
}

function getShiftLabel(shift) {
  const map = {
    morning: '早班',
    afternoon: '中班',
    night: '晚班'
  }
  return map[shift] || shift
}

function getRoleLabel(role) {
  const map = {
    agent: '坐席',
    qa_manager: '质检主管',
    cs_manager: '客服经理'
  }
  return map[role] || role
}

function getTimelineType(type) {
  const map = {
    create: 'primary',
    sign: 'success',
    assign: 'warning',
    process: 'info',
    close: 'success',
    abnormal: 'danger'
  }
  return map[type] || 'primary'
}

function getTimelineIcon(type) {
  const iconMap = {
    create: Document,
    sign: CircleCheck,
    assign: User,
    process: Clock,
    close: CircleCheck,
    abnormal: Warning
  }
  return iconMap[type] || Document
}

function getLogType(action) {
  if (action === 'create_ticket') return 'create'
  if (action.startsWith('status_change')) return 'assign'
  if (action === 'handover_submit') return 'assign'
  if (action === 'handover_accept') return 'sign'
  if (action === 'handover_reject') return 'abnormal'
  return 'process'
}

function getLogTitle(action) {
  const map = {
    'create_ticket': '创建工单',
    'handover_submit': '提交交接',
    'handover_accept': '签收交接',
    'handover_reject': '异常回传'
  }
  if (map[action]) return map[action]
  if (action.startsWith('status_change:')) {
    const parts = action.replace('status_change:', '').split('->')
    if (parts.length === 2) {
      return `状态变更：${getStatusLabel(parts[0])} → ${getStatusLabel(parts[1])}`
    }
    return '状态变更'
  }
  return action
}
</script>

<style scoped>
.ticket-detail-page {
  width: 100%;
  min-height: 100vh;
  background: #f5f7fa;
}

.detail-header {
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: 60px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
  gap: 16px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  flex: 1;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.detail-content {
  padding: 16px 24px;
}

.info-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.track-card {
  margin-bottom: 16px;
}

.track-item {
  padding: 4px 0;
}

.track-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.track-operator {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.track-content {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-top: 4px;
}

.empty-track {
  padding: 20px 0;
}

.side-card {
  margin-bottom: 16px;
}

.side-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.handover-item {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.handover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.handover-shift {
  font-size: 12px;
  color: #909399;
}

.handover-time {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.handover-info {
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}

.handover-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.log-item {
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}

.log-item:last-child {
  border-bottom: none;
}

.log-action {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.log-time {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.log-operator {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.log-remark {
  font-size: 13px;
  color: #606266;
  padding: 6px 8px;
  background: #f5f7fa;
  border-radius: 4px;
}
</style>
