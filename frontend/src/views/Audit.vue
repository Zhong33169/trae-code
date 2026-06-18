<template>
  <div class="page-container">
    <el-card shadow="never">
      <el-form :inline="true" :model="filters" style="margin-bottom:16px;">
        <el-form-item label="结果">
          <el-select v-model="filters.result" clearable placeholder="全部">
            <el-option label="成功" value="success" />
            <el-option label="失败（含退回/驳回）" value="fail" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-select v-model="filters.operator_id" clearable placeholder="全部" style="width:180px;">
            <el-option v-for="u in userStore.allUsers" :key="u.id" :label="u.real_name" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="filters.keyword" placeholder="案号/案件名/失败原因" clearable style="width:260px;" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="load"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
          <el-button type="danger" plain @click="loadFailOnly">
            <el-icon><Warning /></el-icon>仅看失败/异常
          </el-button>
        </el-form-item>
      </el-form>

      <el-alert type="info" :closable="false" show-icon style="margin-bottom:14px;">
        所有失败原因进入审计；可追溯操作人、操作时间、失败原因、关联材料单或附件。
      </el-alert>

      <el-table :data="logs" border stripe v-loading="loading" style="width:100%">
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作人" width="120">
          <template #default="{ row }">
            <div>{{ row.operator_name }}</div>
            <el-tag size="small" style="margin-top:2px;">{{ roleDisplay(row.operator_role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="动作" width="140">
          <template #default="{ row }">{{ actionLabel(row.action) }}</template>
        </el-table-column>
        <el-table-column label="关联材料/附件" min-width="220">
          <template #default="{ row }">
            <el-link v-if="row.material_case_no" type="primary" @click="$router.push(`/materials/${row.material_id}`)">
              {{ row.material_case_no }}
            </el-link>
            <span v-if="row.material_case_name" style="color:#606266; margin-left:4px;">
              {{ row.material_case_name }}
            </span>
            <div v-if="row.attachment_file_name" style="margin-top:4px;">
              <el-tag type="warning" size="small" effect="plain">附件</el-tag>
              <span style="margin-left:4px;">{{ row.attachment_file_name }}</span>
            </div>
            <el-tag v-if="row.batch_id" size="small" type="info" effect="plain" style="margin-top:4px;">
              批次 {{ row.batch_id.slice(0, 8) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="详情" min-width="260">
          <template #default="{ row }">
            <div v-if="row.action_detail" style="color:#606266; font-size:12px;">{{ row.action_detail }}</div>
            <div v-if="row.fail_reason" style="margin-top:4px; padding:6px 10px; background:#fef0f0; border:1px solid #fbc4c4; border-radius:4px; color:#c0392b; font-size:12px;">
              <el-icon style="vertical-align:-2px;"><Warning /></el-icon>
              <b>失败原因：</b>{{ row.fail_reason }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.result === 'success' ? 'success' : 'danger'" size="small">
              {{ row.result === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import api from '../api'

const userStore = useUserStore()
const loading = ref(false)
const logs = ref([])
const filters = reactive({
  result: '',
  operator_id: '',
  keyword: '',
})

function formatTime(t) {
  if (!t) return '-'
  try {
    const d = new Date(t)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch { return t }
}
function roleDisplay(r) {
  return { registrar: '登记员', reviewer: '审核主管', verifier: '复核负责人' }[r] || r
}
function actionLabel(a) {
  return {
    register: '登记发起', start_review: '领取审核', pass_review: '审核通过',
    return_material: '退回补正', resubmit: '补正重提', start_verify: '领取复核',
    pass_verify: '复核通过', reject_verify: '复核不通过', archive: '归档',
    add_attachment: '添加附件', reject_attachment: '驳回附件',
    batch_pass_review: '批量审核', batch_pass_verify: '批量复核', batch_archive: '批量归档',
  }[a] || a
}

async function load() {
  loading.value = true
  try {
    const res = await api.get('/audit/', {
      params: {
        result: filters.result || undefined,
        operator_id: filters.operator_id || undefined,
        keyword: filters.keyword || undefined,
      },
    })
    if (res.data.success) logs.value = res.data.data || []
  } finally {
    loading.value = false
  }
}

function reset() {
  filters.result = ''
  filters.operator_id = ''
  filters.keyword = ''
  load()
}

function loadFailOnly() {
  filters.result = 'fail'
  load()
}

onMounted(async () => {
  await userStore.fetchUsers()
  load()
})
</script>
