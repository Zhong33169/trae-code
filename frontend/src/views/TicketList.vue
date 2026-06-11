<template>
  <div class="ticket-list-page">
    <header class="page-header">
      <div class="header-left">
        <h2 class="page-title">工单管理</h2>
      </div>
      <div class="header-right">
        <el-button v-if="authStore.role === 'agent'" type="primary" :icon="Phone" @click="openCallRegister">
          来电登记
        </el-button>
        <el-button v-if="authStore.role === 'qa_manager' || authStore.role === 'cs_manager'" :icon="Switch" @click="openHandover">
          我的待签收
        </el-button>
        <el-dropdown @command="handleCommand">
          <span class="user-info">
            <el-avatar :size="32" :icon="UserFilled" />
            <span class="username">{{ authStore.name || authStore.username }}</span>
            <span class="role-tag">{{ roleLabel }}</span>
            <el-icon><CaretBottom /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <div class="page-content">
      <el-card class="search-card" shadow="never">
        <el-form :model="searchForm" inline>
          <el-form-item label="状态">
            <el-select
              v-model="searchForm.status"
              placeholder="全部状态"
              clearable
              style="width: 160px"
              @change="handleSearch"
            >
              <el-option label="来电登记" value="incoming" />
              <el-option label="问题派单" value="dispatched" />
              <el-option label="回访中" value="return_visit" />
              <el-option label="已关闭" value="closed" />
              <el-option label="异常回传" value="exception" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search" @click="handleSearch">
              搜索
            </el-button>
            <el-button :icon="Refresh" @click="handleReset">
              重置
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-row :gutter="16" class="stats-row">
        <el-col :span="3">
          <el-card class="stat-card stat-total" shadow="hover">
            <div class="stat-icon">
              <el-icon :size="28"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ ticketStore.stats.total_tickets }}</div>
              <div class="stat-label">工单总数</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="3">
          <el-card class="stat-card stat-incoming" shadow="hover">
            <div class="stat-icon">
              <el-icon :size="28"><Phone /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ ticketStore.stats.incoming_count }}</div>
              <div class="stat-label">来电登记</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="3">
          <el-card class="stat-card stat-dispatched" shadow="hover">
            <div class="stat-icon">
              <el-icon :size="28"><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ ticketStore.stats.dispatched_count }}</div>
              <div class="stat-label">问题派单</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="3">
          <el-card class="stat-card stat-return-visit" shadow="hover">
            <div class="stat-icon">
              <el-icon :size="28"><ChatDotRound /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ ticketStore.stats.return_visit_count }}</div>
              <div class="stat-label">回访中</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="3">
          <el-card class="stat-card stat-closed" shadow="hover">
            <div class="stat-icon">
              <el-icon :size="28"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ ticketStore.stats.closed_count }}</div>
              <div class="stat-label">已关闭</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="3">
          <el-card class="stat-card stat-exception" shadow="hover">
            <div class="stat-icon">
              <el-icon :size="28"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ ticketStore.stats.exception_count }}</div>
              <div class="stat-label">异常回传</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="3" v-if="authStore.role === 'qa_manager' || authStore.role === 'cs_manager'">
          <el-card class="stat-card stat-handover" shadow="hover">
            <div class="stat-icon">
              <el-icon :size="28"><Switch /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ ticketStore.stats.pending_handover_count }}</div>
              <div class="stat-label">待交接</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="3" v-if="authStore.role === 'qa_manager' || authStore.role === 'cs_manager'">
          <el-card class="stat-card stat-today" shadow="hover">
            <div class="stat-icon">
              <el-icon :size="28"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ ticketStore.stats.today_tickets }}</div>
              <div class="stat-label">今日工单</div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <div class="batch-bar" v-if="selectedRows.length">
        <span class="batch-count">已选择 {{ selectedRows.length }} 条</span>
        <el-button
          v-if="canBatchAssign"
          type="warning"
          size="small"
          @click="batchAssign"
        >批量派单</el-button>
        <el-button
          v-if="canBatchReturnVisit"
          type="primary"
          size="small"
          @click="batchReturnVisit"
        >批量回访</el-button>
        <el-button
          v-if="canBatchClose"
          type="success"
          size="small"
          @click="batchClose"
        >批量关闭</el-button>
        <el-button
          v-if="canBatchHandover"
          type="info"
          size="small"
          @click="batchHandover"
        >批量交接</el-button>
        <el-button size="small" @click="clearSelection">清空选择</el-button>
      </div>

      <el-card class="table-card" shadow="never">
        <el-table
          v-loading="ticketStore.loading"
          :data="ticketStore.list"
          stripe
          border
          @row-click="handleRowClick"
          ref="tableRef"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" :selectable="isRowSelectable" />
          <el-table-column prop="id" label="工单号" width="100" />
          <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
          <el-table-column prop="customer_name" label="客户姓名" width="120" />
          <el-table-column prop="status" label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="creator_name" label="创建人" width="120" />
          <el-table-column prop="created_at" label="创建时间" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column label="最新交接" width="200">
            <template #default="{ row }">
              <div v-if="row.latest_handover_status">
                <el-tag :type="getHandoverStatusType(row.latest_handover_status)" size="small">
                  {{ getHandoverStatusLabel(row.latest_handover_status) }}
                </el-tag>
                <div class="handover-time">{{ formatDateTime(row.latest_handover_time) }}</div>
              </div>
              <span v-else class="text-gray">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="260" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link @click.stop="goToDetail(row)">
                详情
              </el-button>
              <el-button
                v-if="canAssign(row)"
                type="warning"
                link
                @click.stop="openAssign(row)"
              >
                派单
              </el-button>
              <el-button
                v-if="canReturnVisit(row)"
                type="success"
                link
                @click.stop="openClose(row)"
              >
                回访
              </el-button>
              <el-button
                v-if="canHandover(row)"
                type="info"
                link
                @click.stop="openRowHandover(row)"
              >
                交接
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrapper">
          <el-pagination
            v-model:current-page="pagination.currentPage"
            v-model:page-size="pagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="ticketStore.total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </el-card>
    </div>

    <CallRegisterDialog v-model="callRegisterVisible" @success="handleRefresh" />
    <AssignTicketDialog
      v-model="assignVisible"
      :ticket-id="currentTicketId"
      :ticket-title="currentTicketTitle"
      @success="handleRefresh"
    />
    <CloseTicketDialog
      v-model="closeVisible"
      :ticket-id="currentTicketId"
      :ticket-title="currentTicketTitle"
      :target-status="'return_visit'"
      @success="handleRefresh"
    />
    <HandoverDialog
      v-model="handoverVisible"
      :ticket-id="currentTicketId"
      :ticket-title="currentTicketTitle"
      :ticket-ids="batchTicketIds"
      @success="handleHandoverSuccess"
    />
    <el-dialog
      v-model="pendingHandoverVisible"
      title="我的待签收"
      width="600px"
    >
      <el-table :data="pendingHandoverList" v-loading="pendingHandoverLoading">
        <el-table-column prop="id" label="交接ID" width="80" />
        <el-table-column prop="ticket_id" label="工单ID" width="80" />
        <el-table-column prop="from_user_name" label="交出人" width="120">
          <template #default="{ row }">
            {{ row.from_user_name || row.from_user }}
          </template>
        </el-table-column>
        <el-table-column prop="shift" label="班次" width="100">
          <template #default="{ row }">
            {{ getShiftLabel(row.shift) }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="success" size="small" @click="handleAcceptHandover(row)">
              签收
            </el-button>
            <el-button type="danger" size="small" @click="handleRejectHandover(row)">
              异常回传
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!pendingHandoverList.length && !pendingHandoverLoading" class="empty-pending">
        <el-empty description="暂无待签收交接" :image-size="60" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Phone,
  Switch,
  UserFilled,
  CaretBottom,
  Search,
  Refresh,
  Document,
  Clock,
  Warning,
  CircleCheck,
  User,
  ChatDotRound
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useTicketStore } from '@/stores/ticket'
import { getMyHandover } from '@/api/ticket'
import { formatDateTime } from '@/utils/format'
import CallRegisterDialog from '@/components/CallRegisterDialog.vue'
import AssignTicketDialog from '@/components/AssignTicketDialog.vue'
import CloseTicketDialog from '@/components/CloseTicketDialog.vue'
import HandoverDialog from '@/components/HandoverDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const ticketStore = useTicketStore()

const searchForm = reactive({
  status: ''
})

const pagination = reactive({
  currentPage: 1,
  pageSize: 10
})

const callRegisterVisible = ref(false)
const assignVisible = ref(false)
const closeVisible = ref(false)
const handoverVisible = ref(false)
const pendingHandoverVisible = ref(false)
const pendingHandoverList = ref([])
const pendingHandoverLoading = ref(false)
const currentTicketId = ref('')
const currentTicketTitle = ref('')
const selectedRows = ref([])
const tableRef = ref(null)
const batchTicketIds = ref([])

const roleLabel = computed(() => {
  const roleMap = {
    agent: '客服坐席',
    qa_manager: '质检主管',
    cs_manager: '客服经理'
  }
  return roleMap[authStore.role] || authStore.role
})

function isRowSelectable(row) {
  if (authStore.role === 'agent') {
    return row.created_by === authStore.user?.id && row.status !== 'closed'
  }
  return row.status !== 'closed'
}

const canBatchAssign = computed(() => {
  return (authStore.role === 'qa_manager' || authStore.role === 'cs_manager')
    && selectedRows.value.every(r => r.status === 'incoming')
    && selectedRows.value.length > 0
})

const canBatchReturnVisit = computed(() => {
  return (authStore.role === 'qa_manager' || authStore.role === 'cs_manager')
    && selectedRows.value.every(r => r.status === 'dispatched')
    && selectedRows.value.length > 0
})

const canBatchClose = computed(() => {
  return (authStore.role === 'qa_manager' || authStore.role === 'cs_manager')
    && selectedRows.value.every(r => r.status === 'return_visit')
    && selectedRows.value.length > 0
})

const canBatchHandover = computed(() => {
  if (authStore.role === 'cs_manager') return false
  if (selectedRows.value.length === 0) return false
  return selectedRows.value.every(r => r.status !== 'closed')
})

function handleSelectionChange(rows) {
  selectedRows.value = rows
}

function clearSelection() {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

function showBatchResult(result, operationName) {
  const failDetail = result.fail.length
    ? result.fail.map(f => `  - 工单 ${f.id}：${f.error}`).join('\n')
    : ''
  const message = `批量操作结果：
✅ 成功：${result.success.length} 条
❌ 失败：${result.fail.length} 条
${failDetail}`
  ElMessageBox.alert(message, `${operationName}结果`, {
    confirmButtonText: '确定',
    dangerouslyUseHTMLString: false
  })
}

async function batchAssign() {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入派单备注',
      '批量派单',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入备注（选填）'
      }
    )
    const ids = selectedRows.value.map(r => r.id)
    const result = await ticketStore.batchUpdateStatus(ids, { status: 'dispatched', remark: value || '' })
    clearSelection()
    showBatchResult(result, '批量派单')
  } catch {
  }
}

async function batchReturnVisit() {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入回访备注',
      '批量回访',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入备注（选填）'
      }
    )
    const ids = selectedRows.value.map(r => r.id)
    const result = await ticketStore.batchUpdateStatus(ids, { status: 'return_visit', remark: value || '' })
    clearSelection()
    showBatchResult(result, '批量回访')
  } catch {
  }
}

async function batchClose() {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入关闭备注',
      '批量关闭',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入备注（选填）'
      }
    )
    const ids = selectedRows.value.map(r => r.id)
    const result = await ticketStore.batchUpdateStatus(ids, { status: 'closed', remark: value || '' })
    clearSelection()
    showBatchResult(result, '批量关闭')
  } catch {
  }
}

function batchHandover() {
  batchTicketIds.value = selectedRows.value.map(r => r.id)
  currentTicketId.value = ''
  currentTicketTitle.value = ''
  handoverVisible.value = true
}

function handleHandoverSuccess(result) {
  clearSelection()
  batchTicketIds.value = []
  if (result) {
    showBatchResult(result, '批量交接')
  } else {
    handleRefresh()
  }
}

onMounted(() => {
  fetchData()
})

async function fetchData() {
  await Promise.all([
    ticketStore.fetchList({
      page: pagination.currentPage,
      page_size: pagination.pageSize,
      status: searchForm.status
    }),
    ticketStore.fetchStats()
  ])
}

function handleSearch() {
  pagination.currentPage = 1
  fetchData()
}

function handleReset() {
  searchForm.status = ''
  pagination.currentPage = 1
  fetchData()
}

function handleSizeChange(size) {
  pagination.pageSize = size
  pagination.currentPage = 1
  fetchData()
}

function handleCurrentChange(page) {
  pagination.currentPage = page
  fetchData()
}

function handleRowClick(row) {
  goToDetail(row)
}

function goToDetail(row) {
  router.push(`/tickets/${row.id}`)
}

function openCallRegister() {
  callRegisterVisible.value = true
}

function openAssign(row) {
  currentTicketId.value = row.id
  currentTicketTitle.value = row.title
  assignVisible.value = true
}

function openClose(row) {
  currentTicketId.value = row.id
  currentTicketTitle.value = row.title
  closeVisible.value = true
}

function openRowHandover(row) {
  currentTicketId.value = row.id
  currentTicketTitle.value = row.title
  handoverVisible.value = true
}

async function openHandover() {
  pendingHandoverVisible.value = true
  await fetchPendingHandover()
}

function canAssign(row) {
  return row.status === 'incoming' &&
    (authStore.role === 'cs_manager' || authStore.role === 'qa_manager')
}

function canReturnVisit(row) {
  return row.status === 'dispatched' &&
    (authStore.role === 'cs_manager' || authStore.role === 'qa_manager')
}

function canHandover(row) {
  if (row.status === 'closed') return false
  if (authStore.role === 'agent') return true
  if (authStore.role === 'qa_manager') return true
  return false
}

async function fetchPendingHandover() {
  pendingHandoverLoading.value = true
  try {
    const res = await getMyHandover({ status: 'pending' })
    pendingHandoverList.value = res || []
  } catch (err) {
    console.error('获取待签收列表失败:', err)
    pendingHandoverList.value = []
  } finally {
    pendingHandoverLoading.value = false
  }
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
    await fetchPendingHandover()
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
    await fetchPendingHandover()
    handleRefresh()
  } catch {
  }
}

function getShiftLabel(shift) {
  const map = {
    morning: '早班',
    afternoon: '中班',
    night: '晚班'
  }
  return map[shift] || shift
}

function handleRefresh() {
  fetchData()
}

function handleCommand(command) {
  if (command === 'logout') {
    authStore.logout()
    router.push('/login')
  }
}

function getStatusLabel(status) {
  const map = {
    incoming: '来电登记',
    dispatched: '问题派单',
    return_visit: '回访中',
    closed: '已关闭',
    exception: '异常回传'
  }
  return map[status] || status
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
</script>

<style scoped>
.ticket-list-page {
  width: 100%;
  min-height: 100vh;
  background: #f5f7fa;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 60px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.user-info:hover {
  background: #f5f7fa;
}

.username {
  font-size: 14px;
  color: #303133;
}

.role-tag {
  font-size: 12px;
  padding: 2px 6px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 4px;
}

.page-content {
  padding: 16px 24px;
}

.search-card {
  margin-bottom: 16px;
}

.stats-row {
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 8px;
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.stat-total .stat-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.stat-incoming .stat-icon {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #fff;
}

.stat-dispatched .stat-icon {
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
  color: #fff;
}

.stat-return-visit .stat-icon {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  color: #fff;
}

.stat-closed .stat-icon {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: #fff;
}

.stat-exception .stat-icon {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #fff;
}

.stat-handover .stat-icon {
  background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
  color: #fff;
}

.stat-today .stat-icon {
  background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.table-card {
  margin-bottom: 16px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.handover-time {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.text-gray {
  color: #c0c4cc;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  margin-bottom: 16px;
}

.batch-count {
  font-size: 14px;
  color: #409eff;
  font-weight: 500;
  margin-right: 8px;
}
</style>
