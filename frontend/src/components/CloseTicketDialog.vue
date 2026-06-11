<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="500px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item label="工单号">
        <el-input :value="ticketId" disabled />
      </el-form-item>
      <el-form-item label="工单标题">
        <el-input :value="ticketTitle" disabled />
      </el-form-item>
      <el-form-item v-if="isCloseMode" label="备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="3"
          placeholder="请输入备注（选填）"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ confirmButtonText }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useTicketStore } from '@/stores/ticket'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  ticketId: {
    type: [String, Number],
    default: ''
  },
  ticketTitle: {
    type: String,
    default: ''
  },
  targetStatus: {
    type: String,
    default: 'return_visit'
  }
})

const emit = defineEmits(['update:modelValue', 'success'])

const ticketStore = useTicketStore()

const dialogVisible = computed(() => props.modelValue)
const formRef = ref(null)
const loading = ref(false)

const isCloseMode = computed(() => props.targetStatus === 'closed')

const dialogTitle = computed(() => {
  return isCloseMode.value ? '关闭工单' : '开始回访'
})

const confirmButtonText = computed(() => {
  return isCloseMode.value ? '确认关闭' : '确认回访'
})

const formData = reactive({
  remark: ''
})

const rules = {}

watch(dialogVisible, (val) => {
  if (val) {
    resetForm()
  }
})

function resetForm() {
  formData.remark = ''
  formRef.value?.resetFields()
}

function handleClose() {
  emit('update:modelValue', false)
}

async function handleSubmit() {
  loading.value = true
  try {
    await ticketStore.handleUpdateStatus(props.ticketId, {
      status: props.targetStatus,
      remark: formData.remark
    })
    ElMessage.success(isCloseMode.value ? '关闭成功' : '回访开始成功')
    emit('success')
    handleClose()
  } catch (err) {
    console.error('操作失败:', err)
  } finally {
    loading.value = false
  }
}
</script>
