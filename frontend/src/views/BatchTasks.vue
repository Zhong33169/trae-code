<template>
  <div class="page-container">
    <el-card shadow="never">
      <el-table :data="tasks" border stripe v-loading="loading">
        <el-table-column label="批次" width="240">
          <template #default="{ row }">
            <div style="font-weight:bold;">{{ row.batch_name }}</div>
            <div style="color:#909399; font-size:12px;">ID：{{ row.id.slice(0, 16) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作人" width="140">
          <template #default="{ row }">{{ row.operator_name }}</template>
        </el-table-column>
        <el-table-column label="总数" width="80" align="center">
          <template #default="{ row }"><b>{{ row.total_count }}</b></template>
        </el-table-column>
        <el-table-column label="成功" width="80" align="center">
          <template #default="{ row }">
            <span style="color:#67c23a; font-weight:bold;">{{ row.success_count }}</span>
          </template>
        </el-table-column>
        <el-table-column label="失败" width="80" align="center">
          <template #default="{ row }">
            <span style="color:#f56c6c; font-weight:bold;">{{ row.fail_count }}</span>
          </template>
        </el-table-column>
        <el-table-column label="跳过" width="80" align="center">
          <template #default="{ row }">
            <span style="color:#e6a23c; font-weight:bold;">{{ row.skip_count }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag type="success" size="small">{{ row.status === 'completed' ? '已完成' : row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建/完成" width="180">
          <template #default="{ row }">
            <div style="font-size:12px;">
              <div>{{ formatTime(row.created_at) }}</div>
              <div style="color:#909399;">完成：{{ formatTime(row.completed_at) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" plain @click="showDetails(row)">查看明细</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailDialog" title="批量处理结果明细" width="760px">
      <el-row :gutter="12" style="margin-bottom:12px;">
        <el-col :span="6"><el-statistic title="批次" :value="detailTask?.batch_name || '-'" /></el-col>
        <el-col :span="6"><el-statistic title="成功" :value="detailTask?.success_count || 0" /></el-col>
        <el-col :span="6"><el-statistic title="失败" :value="detailTask?.fail_count || 0" /></el-col>
        <el-col :span="6"><el-statistic title="跳过" :value="detailTask?.skip_count || 0" /></el-col>
      </el-row>

      <el-table :data="parsedDetails" border size="small">
        <el-table-column label="结果" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.result === '成功' ? 'success' : (row.result === '失败' ? 'danger' : 'warning')" size="small">
              {{ row.result }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="case_no" label="案号" width="150">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/materials/${row.material_id}`)">{{ row.case_no }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="case_name" label="案件名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="reason" label="逐条说明" min-width="300" show-overflow-tooltip>
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
import { ref, onMounted } from 'vue'
import api from '../api'

const loading = ref(false)
const tasks = ref([])
const detailDialog = ref(false)
const detailTask = ref(null)
const parsedDetails = ref([])

function formatTime(t) {
  if (!t) return '-'
  try {
    const d = new Date(t)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return t }
}

async function load() {
  loading.value = true
  try {
    const res = await api.get('/materials/batch/list')
    if (res.data.success) tasks.value = res.data.data || []
  } finally {
    loading.value = false
  }
}

function showDetails(row) {
  detailTask.value = row
  try {
    parsedDetails.value = JSON.parse(row.result_details || '[]')
  } catch {
    parsedDetails.value = []
  }
  detailDialog.value = true
}

onMounted(load)
</script>
