<template>
  <el-dialog
    v-model="dialogVisible"
    title="问题派单"
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
      <el-form-item label="派单备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="3"
          placeholder="请输入派单备注（选填）"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">确认派单</el-button>
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
  }
})

const emit = defineEmits(['update:modelValue', 'success'])

const ticketStore = useTicketStore()

const dialogVisible = computed(() => props.modelValue)
const formRef = ref(null)
const loading = ref(false)

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
      status: 'dispatched',
      remark: formData.remark
    })
    ElMessage.success('派单成功')
    emit('success')
    handleClose()
  } catch (err) {
    console.error('派单失败:', err)
  } finally {
    loading.value = false
  }
}
</script>
