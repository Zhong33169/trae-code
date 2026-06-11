<template>
  <el-dialog
    v-model="dialogVisible"
    title="来电登记"
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
      <el-form-item label="客户姓名" prop="customer_name">
        <el-input v-model="formData.customer_name" placeholder="请输入客户姓名" />
      </el-form-item>
      <el-form-item label="联系电话" prop="customer_phone">
        <el-input v-model="formData.customer_phone" placeholder="请输入联系电话" />
      </el-form-item>
      <el-form-item label="标题" prop="title">
        <el-input v-model="formData.title" placeholder="请输入工单标题" />
      </el-form-item>
      <el-form-item label="问题描述" prop="description">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="4"
          placeholder="请输入问题描述"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">确认登记</el-button>
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
  }
})

const emit = defineEmits(['update:modelValue', 'success'])

const ticketStore = useTicketStore()

const dialogVisible = computed(() => props.modelValue)
const formRef = ref(null)
const loading = ref(false)

const formData = reactive({
  customer_name: '',
  customer_phone: '',
  title: '',
  description: ''
})

const rules = {
  customer_name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }],
  customer_phone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' }
  ],
  title: [{ required: true, message: '请输入工单标题', trigger: 'blur' }],
  description: [{ required: true, message: '请输入问题描述', trigger: 'blur' }]
}

watch(dialogVisible, (val) => {
  if (val) {
    resetForm()
  }
})

function resetForm() {
  formData.customer_name = ''
  formData.customer_phone = ''
  formData.title = ''
  formData.description = ''
  formRef.value?.resetFields()
}

function handleClose() {
  emit('update:modelValue', false)
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        await ticketStore.handleCreateTicket({ ...formData })
        ElMessage.success('登记成功')
        emit('success')
        handleClose()
      } catch (err) {
        console.error('登记失败:', err)
      } finally {
        loading.value = false
      }
    }
  })
}
</script>
