<template>
  <div class="page-container">
    <el-card style="max-width:900px; margin:0 auto;">
      <template #header>
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <b><el-icon style="vertical-align:-2px;"><EditPen /></el-icon> 新建诉讼材料登记（诉讼材料登记员发起）</b>
          <el-button text @click="$router.back()">取消</el-button>
        </div>
      </template>

      <el-form :model="form" label-width="130px" :rules="rules" ref="formRef">
        <el-divider content-position="left">案件基本信息</el-divider>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="案号" prop="case_no">
              <el-input v-model="form.case_no" placeholder="例：CASE-2026-0009" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="案件类型" prop="case_type">
              <el-select v-model="form.case_type" placeholder="请选择" style="width:100%;">
                <el-option v-for="t in caseTypes" :key="t.key" :label="t.label" :value="t.key" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="案件名称" prop="case_name">
          <el-input v-model="form.case_name" placeholder="例：买卖合同纠纷一审" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="原告/申请人">
              <el-input v-model="form.plaintiff" placeholder="例：上海XX有限公司" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="被告/被申请人">
              <el-input v-model="form.defendant" placeholder="例：北京XX有限公司" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="管辖法院/机构">
              <el-input v-model="form.court_name" placeholder="例：上海市浦东新区人民法院" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优先级" prop="priority">
              <el-select v-model="form.priority" style="width:100%;">
                <el-option label="紧急（需今日处理）" value="urgent" />
                <el-option label="高优先级" value="high" />
                <el-option label="普通" value="normal" />
                <el-option label="低" value="low" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="处理截止时间" prop="deadline">
          <el-date-picker
            v-model="form.deadline"
            type="datetime"
            placeholder="选择截止日期时间"
            style="width:100%;"
            value-format="YYYY-MM-DDTHH:mm:ss+08:00"
          />
        </el-form-item>

        <el-divider content-position="left">附件登记（演示用，真实项目替换为文件上传组件）</el-divider>

        <el-table :data="attachments" border size="small" style="margin-bottom:12px;">
          <el-table-column label="文件名" min-width="240">
            <template #default="{ row, $index }">
              <el-input v-model="row.file_name" size="small" placeholder="例：起诉状.pdf" />
            </template>
          </el-table-column>
          <el-table-column label="类型" width="160">
            <template #default="{ row }">
              <el-input v-model="row.file_type" size="small" placeholder="例：application/pdf" />
            </template>
          </el-table-column>
          <el-table-column label="大小(KB)" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.file_size" size="small" :min="1" />
            </template>
          </el-table-column>
          <el-table-column label="必填" width="80" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.is_required" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ $index }">
              <el-button size="small" text type="danger" @click="removeAtt($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button type="primary" plain size="small" @click="addAtt">
          <el-icon><Plus /></el-icon>添加附件行
        </el-button>

        <el-divider />

        <div style="text-align:center;">
          <el-button @click="$router.back()">取消</el-button>
          <el-button type="primary" @click="onSubmit" :loading="loading" style="min-width:160px;">
            <el-icon><Promotion /></el-icon>发起登记
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import api from '../api'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref(null)
const loading = ref(false)

const caseTypes = [
  { key: 'civil', label: '民事案件' },
  { key: 'commercial', label: '商事案件' },
  { key: 'labor', label: '劳动争议' },
  { key: 'ip', label: '知识产权' },
  { key: 'insurance', label: '保险纠纷' },
  { key: 'criminal', label: '刑事案件' },
  { key: 'admin', label: '行政案件' },
]

const form = reactive({
  case_no: 'CASE-2026-' + String(Math.floor(Math.random() * 9000) + 1000),
  case_name: '',
  case_type: 'civil',
  plaintiff: '',
  defendant: '',
  court_name: '',
  priority: 'normal',
  deadline: null,
})

const rules = {
  case_no: [{ required: true, message: '请输入案号' }],
  case_name: [{ required: true, message: '请输入案件名称' }],
  case_type: [{ required: true, message: '请选择案件类型' }],
}

const attachments = ref([
  { file_name: '起诉状.pdf', file_type: 'application/pdf', file_size: 2048, is_required: true },
  { file_name: '证据材料.pdf', file_type: 'application/pdf', file_size: 4096, is_required: true },
])

function addAtt() {
  attachments.value.push({ file_name: '', file_type: 'application/pdf', file_size: 1024, is_required: false })
}
function removeAtt(i) {
  attachments.value.splice(i, 1)
}

async function onSubmit() {
  await formRef.value?.validate().catch(() => null)
  if (!form.case_no?.trim() || !form.case_name?.trim()) return

  loading.value = true
  try {
    const res = await api.post('/materials/', {
      case_no: form.case_no.trim(),
      case_name: form.case_name.trim(),
      plaintiff: form.plaintiff?.trim() || undefined,
      defendant: form.defendant?.trim() || undefined,
      court_name: form.court_name?.trim() || undefined,
      case_type: form.case_type,
      priority: form.priority,
      deadline: form.deadline || undefined,
      operator_id: userStore.user.id,
    })

    if (res.data.success) {
      const mid = res.data.data.id
      for (const a of attachments.value) {
        if (!a.file_name?.trim()) continue
        await api.post(`/materials/${mid}/attachments`, {
          file_name: a.file_name,
          file_type: a.file_type,
          file_size: (a.file_size || 1024) * 1024,
          is_required: a.is_required,
          operator_id: userStore.user.id,
        })
      }
      ElMessage.success('诉讼材料登记已发起')
      router.push(`/materials/${mid}`)
    }
  } finally {
    loading.value = false
  }
}
</script>
