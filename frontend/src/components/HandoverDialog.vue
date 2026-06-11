<template>
  <el-dialog
    v-model="dialogVisible"
    title="交接确认"
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
      <el-form-item v-if="ticketId" label="工单号">
        <el-input :value="ticketId" disabled />
      </el-form-item>
      <el-form-item v-if="ticketTitle" label="工单标题">
        <el-input :value="ticketTitle" disabled />
      </el-form-item>
      <el-form-item label="班次" prop="shift">
        <el-select v-model="formData.shift" placeholder="请选择班次" style="width: 100%">
          <el-option label="早班" value="morning" />
          <el-option label="中班" value="afternoon" />
          <el-option label="晚班" value="night" />
        </el-select>
      </el-form-item>
      <el-form-item label="接收人" prop="to_user">
        <el-select
          v-model="formData.to_user"
          placeholder="请选择接收人"
          style="width: 100%"
          filterable
        >
          <el-option
            v-for="item in userList"
            :key="item.id"
            :label="item.name || item.username"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="交接备注" prop="remark">
        <el-input
          v-model="formData.remark"
          type="textarea"
          :rows="3"
          placeholder="请输入交接备注（选填）"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">确认交接</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useTicketStore } from '@/stores/ticket'
import { getQaManagers, getCsManagers } from '@/api/ticket'
import { useAuthStore } from '@/stores/auth'

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
const authStore = useAuthStore()

const dialogVisible = computed(() => props.modelValue)
const formRef = ref(null)
const loading = ref(false)
const userList = ref([])

const formData = reactive({
  shift: '',
  to_user: '',
  remark: ''
})

const rules = {
  shift: [{ required: true, message: '请选择班次', trigger: 'change' }],
  to_user: [{ required: true, message: '请选择接收人', trigger: 'change' }]
}

watch(dialogVisible, async (val) => {
  if (val) {
    resetForm()
    await fetchUserList()
  }
})

async function fetchUserList() {
  try {
    if (authStore.role === 'agent') {
      userList.value = await getQaManagers() || []
    } else if (authStore.role === 'qa_manager') {
      userList.value = await getCsManagers() || []
    } else {
      userList.value = []
    }
  } catch (err) {
    console.error('获取用户列表失败:', err)
    userList.value = []
  }
}

function resetForm() {
  formData.shift = ''
  formData.to_user = ''
  formData.remark = ''
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
        const submitData = { ...formData }
        if (props.ticketId) {
          submitData.ticket_id = props.ticketId
        }
        submitData.from_role = authStore.role
        await ticketStore.handleSubmitHandover(submitData)
        ElMessage.success('交接成功')
        emit('success')
        handleClose()
      } catch (err) {
        console.error('交接失败:', err)
      } finally {
        loading.value = false
      }
    }
  })
}
</script>
