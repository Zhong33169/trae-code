<template>
  <div class="page-container">
    <el-row :gutter="16">
      <el-col :span="4" v-for="card in statCards" :key="card.key">
        <el-card shadow="hover" :body-style="{ padding: '16px' }">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div style="color:#909399; font-size:13px;">{{ card.label }}</div>
              <div style="font-size:28px; font-weight:bold; margin-top:6px;" :style="{ color: card.color }">{{ stats?.[card.key] ?? 0 }}</div>
            </div>
            <el-icon :size="32" :style="{ color: card.color }"><component :is="card.icon" /></el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px;">
      <el-col :span="14">
        <el-card>
          <template #header>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b>待处理队列（按当前角色）</b>
              <el-button size="small" type="primary" plain @click="$router.push('/materials')">查看全部 →</el-button>
            </div>
          </template>
          <el-table :data="taskList" size="small" stripe style="width:100%">
            <el-table-column label="案号" min-width="150">
              <template #default="{ row }">
                <el-link type="primary" @click="$router.push(`/materials/${row.id}`)">{{ row.case_no }}</el-link>
                <el-tag v-if="row.is_overdue" type="danger" size="small" style="margin-left:6px;">超时</el-tag>
                <el-tag v-if="hasAttachmentIssue(row)" type="warning" size="small" style="margin-left:6px;">附件异常</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="case_name" label="案件名称" min-width="200" show-overflow-tooltip />
            <el-table-column label="当前状态" width="150">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="优先级" width="80">
              <template #default="{ row }">
                <el-tag :type="priorityType(row.priority)" size="small">{{ priorityLabel(row.priority) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="登记/操作人" width="120">
              <template #default="{ row }">
                {{ row.registered_by_name || '-' }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card>
          <template #header>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b>最近失败 / 异常审计记录</b>
              <el-button size="small" type="primary" plain @click="$router.push('/audit')">查看全部 →</el-button>
            </div>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="a in recentFailLogs"
              :key="a.id"
              :timestamp="formatTime(a.created_at)"
              :type="a.result === 'fail' ? 'danger' : 'warning'"
              placement="top"
              size="large"
            >
              <div style="font-size:13px;">
                <div>
                  <b style="color:#303133;">{{ a.operator_name }}</b>
                  <el-tag size="small" style="margin-left:6px;">{{ roleDisplay(a.operator_role) }}</el-tag>
                  <span style="color:#909399; margin-left:8px;">{{ actionLabel(a.action) }}</span>
                </div>
                <div style="margin-top:4px; color:#606266;">
                  <el-link v-if="a.material_case_no" type="primary" @click="$router.push(`/materials/${a.material_id}`)">
                    {{ a.material_case_no }} {{ a.material_case_name || '' }}
                  </el-link>
                  <span v-if="a.attachment_file_name"> · 附件「{{ a.attachment_file_name }}」</span>
                </div>
                <div v-if="a.fail_reason" style="margin-top:6px; padding:6px 10px; background:#fef0f0; border:1px solid #fbc4c4; border-radius:4px; color:#c0392b;">
                  <el-icon style="vertical-align:-2px;"><Warning /></el-icon>
                  {{ a.fail_reason }}
                </div>
              </div>
            </el-timeline-item>
            <div v-if="!recentFailLogs.length" style="color:#909399; padding:16px 0; text-align:center;">暂无异常记录</div>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '../stores/user'
import api from '../api'
import {
  Files, DataLine, Clock, Warning, CircleCheck, RefreshLeft, DocumentChecked, FolderOpened, EditPen,
} from '@element-plus/icons-vue'

const userStore = useUserStore()
const stats = ref(null)
const taskList = ref([])
const recentFailLogs = ref([])

const statCards = [
  { key: 'total', label: '材料单总数', color: '#409eff', icon: Files },
  { key: 'registered', label: '待审核队列', color: '#e6a23c', icon: DataLine },
  { key: 'reviewing', label: '审核处理中', color: '#67c23a', icon: EditPen },
  { key: 'returned', label: '退回补正', color: '#f56c6c', icon: RefreshLeft },
  { key: 'verifying', label: '复核处理中', color: '#909399', icon: DocumentChecked },
  { key: 'archived', label: '已归档', color: '#606266', icon: FolderOpened },
  { key: 'overdue', label: '超期未处理', color: '#c0392b', icon: Clock },
  { key: 'has_attachment_issues', label: '附件异常', color: '#d4380d', icon: Warning },
]

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
function roleDisplay(r) {
  return { registrar: '登记员', reviewer: '审核主管', verifier: '复核负责人' }[r] || r
}
function actionLabel(a) {
  return {
    register: '登记发起', start_review: '领取审核', pass_review: '审核通过',
    return_material: '退回补正', resubmit: '重新提交', start_verify: '领取复核',
    pass_verify: '复核通过', reject_verify: '复核不通过', archive: '归档',
    reject_attachment: '驳回附件', batch_pass_review: '批量审核',
    batch_pass_verify: '批量复核', batch_archive: '批量归档',
  }[a] || a
}
function formatTime(t) {
  try { return new Date(t).toLocaleString('zh-CN', { hour12: false }) } catch { return t }
}
function hasAttachmentIssue(row) {
  return (row.attachments || []).some((a) => a.is_required && a.status === 'rejected')
}

async function loadStats() {
  const res = await api.get('/materials/stats/summary')
  if (res.data.success) stats.value = res.data.data
}

async function loadTaskList() {
  const res = await api.get('/materials/', {
    params: {
      operator_role: userStore.role,
      operator_id: userStore.user?.id,
    },
  })
  if (res.data.success) {
    taskList.value = (res.data.data || []).filter((x) => x.status !== 'archived').slice(0, 10)
  }
}

async function loadFailLogs() {
  const res = await api.get('/audit/fail_reasons')
  if (res.data.success) recentFailLogs.value = (res.data.data || []).slice(0, 8)
}

onMounted(async () => {
  await loadStats()
  await loadTaskList()
  await loadFailLogs()
})
</script>
