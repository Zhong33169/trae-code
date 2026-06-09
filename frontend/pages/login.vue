<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">护理计划单系统</h1>
      <p class="login-subtitle">跨班组交接确认平台</p>
      
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      
      <div class="form-item">
        <label class="form-label">用户名</label>
        <input 
          v-model="username" 
          class="form-input" 
          type="text" 
          placeholder="请输入用户名"
          @keyup.enter="handleLogin"
        />
      </div>
      
      <div class="form-item">
        <label class="form-label">密码</label>
        <input 
          v-model="password" 
          class="form-input" 
          type="password" 
          placeholder="请输入密码"
          @keyup.enter="handleLogin"
        />
      </div>
      
      <button 
        class="btn btn-primary login-btn" 
        @click="handleLogin"
        :disabled="loading"
      >
        {{ loading ? '登录中...' : '登录' }}
      </button>
      
      <div class="demo-accounts">
        <p class="demo-title">测试账号：</p>
        <p class="demo-item">登记员：registrar1 / 123456</p>
        <p class="demo-item">审核主管：auditor1 / 123456</p>
        <p class="demo-item">复核负责人：reviewer1 / 123456</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: false
})

const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  
  loading.value = true
  error.value = ''
  
  try {
    const result = await $fetch('http://localhost:8001/api/auth/login', {
      method: 'POST',
      body: {
        username: username.value,
        password: password.value
      }
    }) as any
    
    if (result.success) {
      authStore.login(result.data.token, result.data.user)
      navigateTo('/plans')
    } else {
      error.value = result.message || '登录失败'
    }
  } catch (e: any) {
    error.value = e.data?.message || e.message || '登录失败，请检查后端服务是否启动'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.demo-accounts {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.demo-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  font-size: 13px;
}

.demo-item {
  color: #666;
  font-size: 12px;
  margin-bottom: 4px;
}
</style>
