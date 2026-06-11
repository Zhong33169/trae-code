<template>
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);">
    <div class="card" style="width: 100%; max-width: 420px; padding: 40px;">
      <h1 style="text-align: center; margin-bottom: 8px; color: #1890ff;">🏭 生产工单系统</h1>
      <p style="text-align: center; color: #666; margin-bottom: 32px;">扫码核验 · 生产工单管理</p>
      
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      
      <div class="form-item">
        <label class="form-label">选择岗位</label>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div 
            v-for="role in roles" 
            :key="role.role"
            @click="selectedRole = role.role"
            style="padding: 12px 16px; border: 2px solid #f0f0f0; border-radius: 8px; cursor: pointer; transition: all 0.2s;"
            :style="selectedRole === role.role ? 'border-color: #1890ff; background: #f0f5ff;': ''"
          >
            <div style="font-weight: 600;">{{ role.roleName }}</div>
            <div style="font-size: 12px; color: #999; margin-top: 4px;">
              {{ roleDesc[role.role] }}
            </div>
          </div>
        </div>
      </div>
      
      <div class="form-item" v-if="selectedRole">
        <label class="form-label">选择用户</label>
        <select v-model="selectedUser" class="form-select">
          <option value="">请选择用户</option>
          <option v-for="user in roleUsers" :key="user.id" :value="user.id">
            {{ user.name }}
          </option>
        </select>
      </div>
      
      <button 
        class="btn btn-primary" 
        style="width: 100%; padding: 12px; font-size: 16px; margin-top: 16px;"
        @click="handleLogin"
        :disabled="!selectedRole || !selectedUser || loading"
      >
        {{ loading ? '登录中...' : '登录系统' }}
      </button>
      
      <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          💡 演示提示：选择不同岗位体验不同功能
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
const auth = useAuth()
const api = useApi()

const error = ref('')
const loading = ref(false)
const selectedRole = ref('')
const selectedUser = ref('')
const roles = ref([])
const roleUsers = ref([])

const roleDesc = {
  registrar: '负责生产工单的发起、登记和补正',
  auditor: '负责生产过程的核验和质量检查',
  reviewer: '负责最终复核、归档和审计查看'
}

onMounted(async () => {
  auth.checkAuth()
  if (auth.isLoggedIn.value) {
    navigateTo('/')
    return
  }
  try {
    const res = await api.get('/auth/roles')
    if (res.success) {
      roles.value = res.data
    }
  } catch (e) {
    error.value = '加载岗位列表失败'
  }
})

watch(selectedRole, async (newRole) => {
  selectedUser.value = ''
  if (newRole) {
    try {
      const res = await api.get('/auth/users', { role: newRole })
      if (res.success) {
        roleUsers.value = res.data
      }
    } catch (e) {
      error.value = '加载用户列表失败'
    }
  } else {
    roleUsers.value = []
  }
})

const handleLogin = async () => {
  if (!selectedRole.value || !selectedUser.value) return
  
  error.value = ''
  loading.value = true
  
  try {
    await auth.login(selectedUser.value, selectedRole.value)
    navigateTo('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

useHead({ title: '登录 - 生产工单系统' })
</script>
