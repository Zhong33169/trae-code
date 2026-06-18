<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-left">
        <div class="brand-info">
          <h1 class="brand-title">贷款展期业务管理系统</h1>
          <p class="brand-subtitle">专业、高效、安全的展期审批工作台</p>
          <div class="features">
            <div class="feature-item">
              <span class="feature-icon">✅</span>
              <span>全流程线上审批</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✅</span>
              <span>多角色权限管理</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✅</span>
              <span>扫码核验防篡改</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✅</span>
              <span>完整审计日志</span>
            </div>
          </div>
        </div>
      </div>
      <div class="login-right">
        <div class="login-card">
          <h2 class="login-title">用户登录</h2>
          <p class="login-desc">请选择用户或输入用户名登录</p>
          
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input 
              v-model="username" 
              type="text" 
              class="form-input" 
              placeholder="请输入用户名"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">快速选择</label>
            <div class="user-list">
              <div 
                v-for="user in userOptions" 
                :key="user.username"
                :class="['user-item', { active: username === user.username }]"
                @click="selectUser(user.username)"
              >
                <span class="user-icon">{{ user.icon }}</span>
                <div class="user-info">
                  <span class="user-name">{{ user.username }}</span>
                  <span class="user-role">{{ user.roleName }}</span>
                </div>
              </div>
            </div>
          </div>

          <button class="btn-login" :disabled="loading" @click="handleLogin">
            <span v-if="loading">登录中...</span>
            <span v-else>登 录</span>
          </button>

          <p class="login-tip">演示模式：选择用户或输入用户名即可登录</p>
          <p v-if="errorMessage" class="login-error">{{ errorMessage }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore, type UserRole } from '~/stores/user'

definePageMeta({
  layout: false
})

const userStore = useUserStore()

const username = ref('')
const loading = ref(false)
const errorMessage = ref('')

const userOptions = [
  { username: 'zhangsan', role: 'registrar' as UserRole, roleName: '展期登记员', icon: '�' },
  { username: 'lisi', role: 'reviewer' as UserRole, roleName: '展期审核主管', icon: '�' },
  { username: 'wangwu', role: 'final_reviewer' as UserRole, roleName: '小贷公司复核负责人', icon: '🏦' },
  { username: 'admin', role: 'admin' as UserRole, roleName: '系统管理员', icon: '�' }
]

const selectUser = (name: string) => {
  username.value = name
  errorMessage.value = ''
}

const handleLogin = async () => {
  if (!username.value.trim()) {
    errorMessage.value = '请输入用户名'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    await userStore.login(username.value.trim())
    navigateTo('/workbench')
  } catch (error: any) {
    errorMessage.value = error.message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #3b82f6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-container {
  width: 100%;
  max-width: 1000px;
  display: flex;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  min-height: 600px;
}

.login-left {
  flex: 1;
  background: linear-gradient(160deg, #1e3a5f 0%, #2563eb 100%);
  padding: 60px 50px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.brand-info {
  color: #fff;
}

.brand-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 12px;
  line-height: 1.3;
}

.brand-subtitle {
  font-size: 16px;
  opacity: 0.85;
  margin-bottom: 40px;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  opacity: 0.95;
}

.feature-icon {
  font-size: 20px;
}

.login-right {
  flex: 1;
  padding: 60px 50px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-card {
  width: 100%;
}

.login-title {
  font-size: 26px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 8px;
}

.login-desc {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 32px;
}

.form-group {
  margin-bottom: 24px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
  outline: none;
}

.form-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.user-item:hover {
  border-color: #93c5fd;
  background: #f0f7ff;
}

.user-item.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.user-icon {
  font-size: 28px;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.user-role {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.btn-login {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 8px;
}

.btn-login:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-login:active:not(:disabled) {
  transform: translateY(0);
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-tip {
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
  margin-top: 20px;
}

.login-error {
  text-align: center;
  font-size: 13px;
  color: #ef4444;
  margin-top: 12px;
}
</style>
